/**
 * RESULTS COMPONENTS JS
 * Dynamically injects the high-end UI into dashboard-layer,
 * avoiding direct mutations to index.html structure.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Wait a short moment to ensure index.html's other scripts have finished parsing
  setTimeout(initResultsPage, 500);
});

function initResultsPage() {
  const dashboardLayer = document.getElementById('dashboard-layer');
  if (!dashboardLayer) return;

  // Create the root container
  const rpContainer = document.createElement('div');
  rpContainer.className = 'rp-container';
  
  // Construct the inner HTML matching the mockup specifications perfectly
  rpContainer.innerHTML = `
    <!-- Topbar -->
    <div class="rp-topbar">
      <div class="rp-topbar__badge">
        <span>✦</span> DEEP SCAN · 60s
      </div>
      <div class="rp-topbar__pills">
        <div class="rp-pill rp-pill--active">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M12 2l7 7-7 7M12 22l7-7-7-7"/></svg>
          Garmin Sync
        </div>
        <div class="rp-pill rp-pill--inactive">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h4l2-9 4 18 2-9h6"/></svg>
          rPPG 眉心
        </div>
      </div>
    </div>

    <!-- TEI Ring -->
    <div class="rp-tei">
      <svg width="280" height="280" viewBox="0 0 280 280" style="position:absolute; top:0; left:0; transform: rotate(135deg);">
        <!-- Inner ring -->
        <circle cx="140" cy="140" r="115" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="6" stroke-dasharray="722" stroke-dashoffset="180" stroke-linecap="round" />
        
        <!-- Outer Gradient definitions -->
        <defs>
          <linearGradient id="rpGradOuter" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34C759" /> <!-- Green -->
            <stop offset="30%" stop-color="#00B4D8" /> <!-- Cyan -->
            <stop offset="70%" stop-color="#F5A623" /> <!-- Amber -->
            <stop offset="100%" stop-color="#8E8E93" /> <!-- Gray -->
          </linearGradient>
        </defs>
        
        <!-- Outer ring -->
        <!-- Circumference = 2 * PI * 130 = 816.8 -->
        <!-- 270 deg / 360 deg * 816.8 = 612.6 visible length -->
        <circle cx="140" cy="140" r="130" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="12" stroke-dasharray="816.8" stroke-dashoffset="204.2" stroke-linecap="round" />
        <circle cx="140" cy="140" r="130" fill="none" stroke="url(#rpGradOuter)" stroke-width="12" stroke-dasharray="816.8" stroke-dashoffset="204.2" stroke-linecap="round" id="rp-tei-arc" style="transition: stroke-dashoffset 1s ease-out;" />
      </svg>
      
      <!-- Indicator Dot (calculated via JS) -->
      <div id="rp-tei-dot" style="position:absolute; width:12px; height:12px; background:#F5A623; border-radius:50%; box-shadow: 0 0 8px #F5A623; top: 12px; left: 50%; transform: translate(-50%, -50%); transition: transform 1s ease-out; transform-origin: 50% 128px;"></div>
      
      <div class="rp-tei__content">
        <h1 class="rp-tei__score" id="rp-tei-val">72</h1>
        <div class="rp-tei__sub">TEI · PR99</div>
        <div class="rp-tei__status" id="rp-tei-status">Optimal</div>
      </div>
    </div>

    <!-- Coach Hint -->
    <div class="rp-coach">
      <p class="rp-coach__text">保持專注，信任你的策略判斷，目前的生理狀態顯示你已處於最佳交易區間。</p>
    </div>

    <!-- 4 Grid Snapshots -->
    <div class="rp-snapshot-grid">
      <!-- HR -->
      <div class="rp-snapcard">
        <div class="rp-snapcard__header">
          <div class="rp-snapcard__title">Heart Rate</div>
          <div class="rp-snapcard__badge rp-snapcard__badge--neutral">Garmin Sync</div>
        </div>
        <div class="rp-snapcard__body">
          <div class="rp-snapcard__val" id="rp-val-hr">68</div>
          <div class="rp-snapcard__unit">BPM</div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="rp-snapcard__wave" width="100%" height="100%" viewBox="0 0 60 24" preserveAspectRatio="none">
          <polyline id="rp-wave-hr" fill="none" stroke="#FF453A" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        </svg>
      </div>
      <!-- HRV -->
      <div class="rp-snapcard">
        <div class="rp-snapcard__header">
          <div class="rp-snapcard__title">HRV</div>
          <div class="rp-snapcard__badge rp-snapcard__badge--cyan">Balanced</div>
        </div>
        <div class="rp-snapcard__body">
          <div class="rp-snapcard__val" id="rp-val-hrv">52</div>
          <div class="rp-snapcard__unit">ms <span style="font-size:10px;">RMSSD</span></div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="rp-snapcard__wave" width="100%" height="100%" viewBox="0 0 60 24" preserveAspectRatio="none">
          <polyline id="rp-wave-hrv" fill="none" stroke="#34C759" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        </svg>
      </div>
      <!-- RR -->
      <div class="rp-snapcard">
        <div class="rp-snapcard__header">
          <div class="rp-snapcard__title">Respiratory</div>
        </div>
        <div class="rp-snapcard__body">
          <div class="rp-snapcard__val" id="rp-val-rr">14</div>
          <div class="rp-snapcard__unit">BrPM</div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="rp-snapcard__wave" width="100%" height="100%" viewBox="0 0 60 24" preserveAspectRatio="none">
          <polyline id="rp-wave-rr" fill="none" stroke="#00B4D8" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        </svg>
      </div>
      <!-- Stress -->
      <div class="rp-snapcard">
        <div class="rp-snapcard__header">
          <div class="rp-snapcard__title">Stress</div>
        </div>
        <div class="rp-snapcard__stress-top mt-2">
           <div class="rp-snapcard__body" style="margin-top:0;">
             <div class="rp-snapcard__val" id="rp-val-strs">25</div>
             <div class="rp-snapcard__unit">/100</div>
           </div>
           <div class="rp-snapcard__unit" id="rp-val-strs-pct">25%</div>
        </div>
        <div class="rp-snapcard__stress-bar-container" style="background: rgba(255,255,255,0.1); width: 100%; height: 4px; border-radius: 2px;">
          <div class="rp-snapcard__stress-bar" id="rp-bar-strs" style="width: 25%; height: 100%; background: linear-gradient(90deg, #34C759, #F5A623, #FF453A); border-radius: 2px;"></div>
        </div>
      </div>
    </div>

    <!-- Body Battery -->
    <div class="rp-battery">
      <div class="rp-battery__title">Body Battery Card</div>
      
      <div class="rp-battery__chart-row">
        <div class="rp-battery__bars" id="rp-battery-bars">
           <!-- Rendered via JS -->
        </div>
        <div class="rp-battery__score-box">
          <div class="rp-battery__score" id="rp-battery-score">78</div>
          <div class="rp-battery__max">/ 100</div>
        </div>
      </div>
      
      <div class="rp-ans-container">
        <div class="rp-ans__title">ANS Balance</div>
        <div class="rp-ans__bar">
          <div class="rp-ans__sns" style="width: 38%" id="rp-ans-sns-bar"></div>
          <div class="rp-ans__pns" style="width: 62%" id="rp-ans-pns-bar"></div>
        </div>
        <div class="rp-ans__labels">
          <div class="rp-ans__label-left">
            <span style="color:var(--accent-red)" id="rp-sns-pct">38%</span>
            <span style="color:#FFF; font-weight:600">SNS</span>
          </div>
          <div class="rp-ans__label-right">
            <span style="color:#FFF; font-weight:600">PNS</span>
            <span style="color:var(--accent-green)" id="rp-pns-pct">62%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- FDCB Floating Bar -->
    <div class="rp-fdcb" id="rp-fdcb">
      <div class="rp-fdcb__top" id="rp-fdcb-toggle">
        <div class="rp-fdcb__left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          Canslim GS ▾
        </div>
        <div class="rp-fdcb__timer">02:18</div>
        <div class="rp-fdcb__btn" id="rp-fdcb-check">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </div>
      <div class="rp-fdcb__expand-zone">
        <div class="rp-fdcb__progress">
          <div class="rp-fdcb__progress-fill"></div>
        </div>
        <div class="rp-fdcb__progress-label">Sweet Zone</div>
      </div>
    </div>
  `;

  dashboardLayer.appendChild(rpContainer);
  
  // Initialize dynamic generation
  generateBatteryBars();
  
  // Initialize interactions
  const fdcb = document.getElementById('rp-fdcb');
  const fdcbToggle = document.getElementById('rp-fdcb-toggle');
  const fdcbCheck = document.getElementById('rp-fdcb-check');
  
  fdcbToggle.addEventListener('click', (e) => {
    if(e.target === fdcbCheck || fdcbCheck.contains(e.target)) return;
    fdcb.classList.toggle('is-expanded');
  });
  
  fdcbCheck.addEventListener('click', () => {
    fdcbCheck.style.transform = 'scale(0.8)';
    setTimeout(() => fdcbCheck.style.transform = 'scale(1)', 150);
    console.log('[TENKI] FDCB Confirmed');
  });

  // Start waveform animation and polling
  startWaveforms();
  startDataPolling();
}

/**
 * Generate the 24 colored gradient bars for Body Battery
 */
function generateBatteryBars() {
  const container = document.getElementById('rp-battery-bars');
  if(!container) return;
  
  // Smoothly dropping profile
  const vals = [95,95,94,92,90,88,86,85,82,80,78,76,74,74,72,70,68,66,66,64,62,60,58,56];
  
  let html = '';
  for(let i=0; i<24; i++) {
    const p = i/23;
    // Green -> Amber -> Brown color mapping
    // RGB interp: G(52, 199, 89) -> A(245, 166, 35) -> B(139, 87, 42)
    let r, g, b;
    if (p < 0.5) {
      let t = p * 2;
      r = 52 + (245 - 52) * t;
      g = 199 + (166 - 199) * t;
      b = 89 + (35 - 89) * t;
    } else {
      let t = (p - 0.5) * 2;
      r = 245 + (139 - 245) * t;
      g = 166 + (87 - 166) * t;
      b = 35 + (42 - 35) * t;
    }
    const color = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
    const h = Math.max(20, (vals[i]/100) * 100); 
    html += `<div class="rp-battery__bar" style="background:${color}; height:${h}%;"></div>`;
  }
  container.innerHTML = html;
}

/**
 * Draw continuous scrolling waveforms using requestAnimationFrame
 */
let waveforms = {
  hr:  { els: [], offset: 0, speed: 2.0, amp: 8, baseline: 12 },
  hrv: { els: [], offset: 0, speed: 1.5, amp: 6, baseline: 12 },
  rr:  { els: [], offset: 0, speed: 0.8, amp: 4, baseline: 12 }
};

function startWaveforms() {
  for(let i=0; i<40; i++) {
    waveforms.hr.els.push(Math.sin(i*0.5)*waveforms.hr.amp + (Math.random()*2));
    waveforms.hrv.els.push(Math.sin(i*0.4)*waveforms.hrv.amp + (Math.random()*1));
    waveforms.rr.els.push(Math.sin(i*0.2)*waveforms.rr.amp + (Math.random()*3));
  }
  
  function draw() {
    Object.keys(waveforms).forEach(k => {
      const w = waveforms[k];
      w.offset += w.speed;
      if(w.offset > 10) { // Shift array to create smooth scrolling effect
        w.offset -= 10;
        w.els.shift();
        w.els.push(Math.sin(Date.now()/500 * w.speed)*w.amp + (Math.random()*(k==='rr'?3:2)));
      }
      
      const poly = document.getElementById(`rp-wave-${k}`);
      if(poly) {
        let pts = '';
        w.els.forEach((val, i) => {
          let x = (i * 2) - (w.offset * 0.2); // stretch X
          let y = w.baseline - val;
          pts += `${x},${y} `;
        });
        poly.setAttribute('points', pts);
      }
    });
    requestAnimationFrame(draw);
  }
  draw();
}

/**
 * Fallback Data Polling (Event Bridge - Scheme C/B fallback)
 */
function startDataPolling() {
  setInterval(() => {
    // Attempt to grab from DOM (Scheme C)
    const getVal = (id) => {
      const el = document.getElementById(id);
      if(!el) return null;
      const num = parseInt(el.textContent, 10);
      return isNaN(num) ? null : num;
    };
    
    let hr = getVal('snap-hr') || getVal('bio-hr-val') || 68;
    let rr = getVal('snap-rr') || 14;
    let hrv = getVal('hrv-val') || getVal('bio-hrv-val') || 52;
    let tei = getVal('ring-score') ? 72 : 72; // Hard fallback
    
    updateUI({ hr, rr, hrv, tei });
    
  }, 1000);
}

function updateUI(data) {
  if(data.hr) document.getElementById('rp-val-hr').textContent = data.hr;
  if(data.rr) document.getElementById('rp-val-rr').textContent = data.rr;
  if(data.hrv) document.getElementById('rp-val-hrv').textContent = data.hrv;
  
  // Example dynamic mapping for TEI
  const teiVal = data.tei || 72;
  const teiEl = document.getElementById('rp-tei-val');
  if(teiEl) {
    teiEl.textContent = teiVal;
    
    // Position dot mapping on golden arc
    // Math: arc length 270 deg representing TEI 0-100.
    // Start angle: 135deg (Left-bottom), End angle: 405deg.
    const pct = Math.min(100, Math.max(0, teiVal)) / 100;
    const angleRot = (pct * 270); 
    
    const dot = document.getElementById('rp-tei-dot');
    if(dot) dot.style.transform = `translate(-50%, -50%) rotate(${angleRot}deg)`;
    
    // Dash Offset mapping
    // total 816.8, visible 612.6.
    // 0 = empty (dashoffset = 816.8), 100 = full (dashoffset = 816.8 - 612.6 = 204.2)
    const arc = document.getElementById('rp-tei-arc');
    if(arc) arc.style.strokeDashoffset = 816.8 - (612.6 * pct);
  }
}
