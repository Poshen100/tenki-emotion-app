// ========== TENKI v50 rPPG Worker ==========
let running=false,scanId=null,t0=0,ts=[],rgb=[],hrHistory=[],frameCount=0,meta=null,lastMetrics=null;

function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function biquadBandpass(fs,f0,Q){
  const w0=2*Math.PI*f0/fs,alpha=Math.sin(w0)/(2*Q),cosw0=Math.cos(w0);
  const b0=alpha,b1=0,b2=-alpha,a0=1+alpha,a1=-2*cosw0,a2=1-alpha;
  return {b0:b0/a0,b1:b1/a0,b2:b2/a0,a1:a1/a0,a2:a2/a0,z1:0,z2:0};
}
function biquadProcess(f,x){const y=f.b0*x+f.z1;f.z1=f.b1*x-f.a1*y+f.z2;f.z2=f.b2*x-f.a2*y;return y;}
function variance(arr){if(arr.length<2)return 0;const m=arr.reduce((a,b)=>a+b,0)/arr.length;return arr.reduce((a,b)=>a+(b-m)*(b-m),0)/(arr.length-1);}
function mean(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}
function std(arr){return Math.sqrt(Math.max(0,variance(arr)));}

function detectPeaks(signal,timesMs,minBpm=45,maxBpm=180){
  const peaks=[];if(signal.length<10)return peaks;
  const minDist=60000/maxBpm,maxDist=60000/minBpm;let lastT=-1e9;
  const sAbs=signal.map(v=>Math.abs(v)),thr=mean(sAbs)+0.8*std(sAbs);
  for(let i=2;i<signal.length-2;i++){
    if(signal[i]>thr&&signal[i]>signal[i-1]&&signal[i]>signal[i+1]){
      const t=timesMs[i];if(t-lastT<minDist)continue;
      let j=i;for(let k=i-2;k<=i+2;k++){if(signal[k]>signal[j])j=k;}
      const tt=timesMs[j];if(tt-lastT>=minDist&&tt-lastT<=maxDist){peaks.push(tt);lastT=tt;}
    }
  }
  return peaks;
}

function fftReIm(re,im){
  const n=re.length;let i=0;
  for(let j=1;j<n-1;j++){let bit=n>>1;for(;i&bit;bit>>=1)i^=bit;i^=bit;if(j<i){[re[j],re[i]]=[re[i],re[j]];[im[j],im[i]]=[im[i],im[j]];}}
  for(let len=2;len<=n;len<<=1){
    const ang=-2*Math.PI/len,wlenRe=Math.cos(ang),wlenIm=Math.sin(ang);
    for(let i=0;i<n;i+=len){let wRe=1,wIm=0;
      for(let j=0;j<len/2;j++){
        const uRe=re[i+j],uIm=im[i+j];const vRe=re[i+j+len/2]*wRe-im[i+j+len/2]*wIm,vIm=re[i+j+len/2]*wIm+im[i+j+len/2]*wRe;
        re[i+j]=uRe+vRe;im[i+j]=uIm+vIm;re[i+j+len/2]=uRe-vRe;im[i+j+len/2]=uIm-vIm;
        const nwRe=wRe*wlenRe-wIm*wlenIm,nwIm=wRe*wlenIm+wIm*wlenRe;wRe=nwRe;wIm=nwIm;
      }
    }
  }
}

function powerSpectrum(signal,fs){
  let n=1;while(n<signal.length)n<<=1;
  const re=new Array(n).fill(0),im=new Array(n).fill(0),m=signal.reduce((a,b)=>a+b,0)/signal.length;
  for(let i=0;i<signal.length;i++)re[i]=signal[i]-m;
  fftReIm(re,im);const half=n/2,ps=new Array(half).fill(0);
  for(let k=1;k<half;k++){ps[k]=re[k]*re[k]+im[k]*im[k];}
  return {ps,n};
}

function pickPeakFreq(signal,fs,fMin,fMax){
  if(signal.length<64)return {freq:null,snr:null};
  const {ps,n}=powerSpectrum(signal,fs);const df=fs/n;
  const kMin=Math.max(1,Math.floor(fMin/df)),kMax=Math.min(ps.length-1,Math.floor(fMax/df));
  let kPeak=kMin;for(let k=kMin;k<=kMax;k++){if(ps[k]>ps[kPeak])kPeak=k;}
  const peak=ps[kPeak];const band=ps.slice(kMin,kMax+1).filter(v=>Number.isFinite(v));
  band.sort((a,b)=>a-b);const med=band[Math.floor(band.length/2)]||1e-9;const snr=peak/(med+1e-9);
  return {freq:kPeak*df,snr};
}

function percentileRank(val,arr){
  if(!arr.length)return 50;let less=0,eq=0;
  for(const x of arr){if(x<val)less++;else if(x===val)eq++;}
  return Math.round(100*(less+0.5*eq)/arr.length);
}

function normPR(pr){return clamp(pr/99,0,1);}
function penaltySQ(sqPr){if(sqPr>=80)return 0;if(sqPr>=50)return(80-sqPr)/30*0.5;return 1;}
function gradeFromSQS(sqs){if(sqs>=90)return'A';if(sqs>=75)return'B';if(sqs>=60)return'C';return'D';}
function weightsByGrade(g){
  if(g==='A')return{w_hrv:0.45,w_hr:0.20,w_rr:0.20,w_sq:0.15};
  if(g==='B')return{w_hrv:0.30,w_hr:0.25,w_rr:0.20,w_sq:0.25};
  if(g==='C')return{w_hrv:0.00,w_hr:0.40,w_rr:0.25,w_sq:0.35};
  return null;
}

function computeSQS(inputs){
  const P={light:0,motion:0,roi:0,fps:0,sqi:0,stability:0,highHR:0};
  const lm=inputs.lumaMean||0;
  if(lm<60)P.light=20;else if(lm<90)P.light=8+(90-lm)/30*12;else P.light=0;
  if((inputs.satRatio||0)>0.03)P.light=Math.min(20,P.light+10);
  if((inputs.lumaStd||0)>35)P.light=Math.min(20,P.light+5);
  const g=inputs.gyroRms||0;
  if(g<=0.8)P.motion=0;else if(g<=1.6)P.motion=8;else if(g<=2.5)P.motion=18;else P.motion=25;
  if((inputs.jitterPx||0)>2.0)P.motion=Math.min(25,P.motion+5);
  if(!inputs.roiOk)P.roi=15;
  const fps=inputs.fps||0,dr=inputs.dropRate||0;
  if(fps>=28&&dr<=0.02)P.fps=0;else if((fps>=24&&fps<=27)||(dr>0.02&&dr<=0.05))P.fps=5;else P.fps=10;
  const s=inputs.nSQI||0;
  if(s<0.293)P.sqi=25;else if(s<0.6)P.sqi=15;else if(s<1.2)P.sqi=6;else P.sqi=0;
  const hstd=inputs.hrStd||0;
  if(hstd<=2)P.stability=0;else if(hstd<=5)P.stability=3;else P.stability=5;
  const hr=inputs.hrBpm||0;
  if(hr<=80)P.highHR=0;else if(hr<=90)P.highHR=8;else P.highHR=20;
  const total=clamp(100-(P.light+P.motion+P.roi+P.fps+P.sqi+P.stability+P.highHR),0,100);
  return {sqs:total,penalties:P};
}

function update(){
  if(!running)return;
  const n=ts.length;if(n<120)return;
  const dur=(ts[n-1]-ts[0])/1000;const fs=(n/dur);
  const gSig=rgb.map(v=>v.g);
  const bp1=biquadBandpass(fs,1.2,1.2),bp2=biquadBandpass(fs,2.0,1.2),bp=[];
  for(let i=0;i<gSig.length;i++){const x=gSig[i];const y=0.55*biquadProcess(bp1,x)+0.45*biquadProcess(bp2,x);bp.push(y);}
  const res=gSig.map((x,i)=>x-bp[i]);const vBP=variance(bp),vRes=variance(res),nSQI=vRes>0?vBP/(vRes):0;
  const {freq:hrHz,snr:hrSnr}=pickPeakFreq(bp,fs,0.7,3.0);const hrBpm=hrHz?hrHz*60:null;
  const env=bp.map(v=>Math.abs(v));const rrBp=biquadBandpass(fs,0.25,0.8),rrArr=[];
  for(let i=0;i<env.length;i++)rrArr.push(biquadProcess(rrBp,env[i]));
  const {freq:rrHz,snr:rrSnr}=pickPeakFreq(rrArr,fs,0.1,0.7);const rrBrpm=rrHz?rrHz*60:null;
  const peaks=detectPeaks(bp,ts,45,180);let rmssd=null;
  if(peaks.length>=4){const ibis=[];for(let i=1;i<peaks.length;i++)ibis.push(peaks[i]-peaks[i-1]);const diffs=[];
    for(let i=1;i<ibis.length;i++)diffs.push(ibis[i]-ibis[i-1]);const msq=diffs.reduce((a,b)=>a+b*b,0)/diffs.length;rmssd=Math.sqrt(msq);}
  if(Number.isFinite(hrBpm)){hrHistory.push(hrBpm);if(hrHistory.length>10)hrHistory.shift();}
  const hrStd=std(hrHistory);
  const in2=Object.assign({},meta,{nSQI,hrBpm:hrBpm||0,hrStd});const {sqs,penalties}=computeSQS(in2);const grade=gradeFromSQS(sqs);
  const hist=(meta&&meta.prHistory)?meta.prHistory:{};
  const hr_pr=(hrBpm&&hist.hr&&hist.hr.length)?percentileRank(hrBpm,hist.hr):50;
  const hrv_pr=(rmssd&&hist.hrv&&hist.hrv.length)?percentileRank(rmssd,hist.hrv):50;
  const rr_pr=(rrBrpm&&hist.rr&&hist.rr.length)?percentileRank(rrBrpm,hist.rr):50;
  const sq_pr=percentileRank(sqs,hist.sqs||[]);
  const w=weightsByGrade(grade);let tei_raw=null,tei_pr=null;
  if(w&&grade!=='D'){
    const stateScore=w.w_hrv*normPR(hrv_pr)+w.w_hr*normPR(hr_pr)+w.w_rr*normPR(rr_pr);
    tei_raw=stateScore*(1-w.w_sq*penaltySQ(sq_pr));
    tei_pr=percentileRank(tei_raw,(hist.tei_raw||[]));
  }
  lastMetrics={hrBpm,hrHz,hrSnr,rrBrpm,rrHz,rrSnr,rmssd,fs,nSQI,sqs,grade,penalties,pr:{hr_pr,hrv_pr,rr_pr,sq_pr,tei_pr},tei_raw,weights:w};
  postMessage({type:'metrics',scanId,metrics:lastMetrics});
}

function capBuffers(maxN){if(ts.length>maxN){const cut=ts.length-maxN;ts.splice(0,cut);rgb.splice(0,cut);}}

onmessage=(e)=>{
  const msg=e.data||{};
  if(msg.type==='start'){running=true;scanId=msg.scanId;t0=msg.t0;ts=[];rgb=[];meta=msg.meta||{};hrHistory=[];frameCount=0;postMessage({type:'started',scanId});}
  if(msg.type==='stop'){running=false;postMessage({type:'stopped',scanId});}
  if(msg.type==='reset'){running=false;scanId=null;ts=[];rgb=[];meta=null;hrHistory=[];postMessage({type:'reset'});}
  if(msg.type==='frame'){
    if(!running)return;
    const {t,r,g,b,metaUpdate}=msg;frameCount++;
    if(metaUpdate)meta=Object.assign({},meta,metaUpdate);
    ts.push(t);rgb.push({r,g,b});capBuffers(900);
    if(frameCount%15===0)update();
  }
  if(msg.type==='export_request'){
    const out={scanId,meta,lastMetrics,ts:ts.slice(-600),rgb:rgb.slice(-600)};
    postMessage({type:'export_payload',payload:out});
  }
};
