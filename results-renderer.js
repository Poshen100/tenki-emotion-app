/**
 * v4.2 Results Page Renderer
 * 
 * 生成並更新整個結果頁 DOM
 */

class ResultsRenderer {
    constructor() {
        this.container = document.getElementById('results-page');
        this.sparklines = {};
        this.built = false;
    }

    showWarmup() {
        if (!this.built) this._buildDOM();

        this.updateBadge(0, 0);
        this._updateText('tei-num', '--');
        this._updateText('zone-txt', '校準感測器...');
        this._updateText('coach-txt', '保持平靜...');
        this._setZoneColor('#8E8E93');
    }

    updateBadge(phase, elapsed) {
        const texts = [
            '✦ WARMUP · --',
            `✦ GLIMPSE · ${elapsed}s`,
            `✦ SCANNING · ${elapsed}s`,
            `✦ STANDARD · ${elapsed}s`,
            `✦ DEEP SCAN · ${elapsed}s`
        ];
        this._updateText('scan-badge-txt', texts[phase] || texts[4]);
    }

    updatePhaseDots(phase) {
        // 省略實作細節，可以用 unicode 點表示
    }

    updateAll(e, hist, ans, phase) {
        // 1. TEI Number & Ring
        const teiStr = Math.round(e.tei).toString();
        this._updateText('tei-num', teiStr);
        this._updateRing(e.tei, e.hrv);

        // 2. Zone & Coach
        const zone = this._getZoneInfo(e.tei);
        this._updateText('zone-txt', zone.name);
        this._updateText('coach-txt', zone.coach);
        this._setZoneColor(zone.color);

        // 3. Bento Grid (with pulse style)
        this._updateBioCard('hr', Math.round(e.hr), hist.hr);
        this._updateBioCard('hrv', Math.round(e.hrv), hist.hrv);
        this._updateBioCard('rr', e.rr.toFixed(1), hist.rr);
        this._updateStressCard(e.stress);

        // Pulse anim updates
        document.documentElement.style.setProperty('--pulse-dur', `${60 / e.hr}s`);

        // 4. ANS Balance
        this._updateANS(ans);

        // 5. SQI
        this._updateText('sqi-txt', `SQI ${e.sqi.toFixed(1)}%`);

        // 6. Background Stardust glow matching zone color
        const bg = document.getElementById('stardust-bg');
        if (bg) {
            // 提取 hex -> rgba
            let r = 0, g = 0, b = 0;
            if (zone.color.length === 7) {
                r = parseInt(zone.color.slice(1, 3), 16);
                g = parseInt(zone.color.slice(3, 5), 16);
                b = parseInt(zone.color.slice(5, 7), 16);
            }
            bg.style.background = `radial-gradient(circle at 50% 30%, rgba(${r},${g},${b},0.12) 0%, rgba(0,0,0,0) 70%)`;
        }
    }

    showComplete(e) {
        this._updateText('scan-badge-txt', '✦ DEEP SCAN · 60s');
        const bar = document.querySelector('.fdcb-bar');
        if (bar) bar.classList.add('visible');
    }

    _getZoneInfo(tei) {
        if (tei >= 80) return { name: '⚠️ Peak Zone — 高能警戒', color: '#F5A623', coach: '高能量狀態，自信充沛。提醒自己：自信是好的，過度自信需要留意。' };
        if (tei >= 55) return { name: '✅ Optimal Zone — 理想執行區', color: '#00B4D8', coach: '保持專注，信任你的策略判斷。當前狀態適合全功能交易。' };
        if (tei >= 35) return { name: '⏸️ Neutral Zone — 中性區', color: '#E5E5EA', coach: '適度放慢節奏。等待更好的時機，也是策略的一部分。' };
        return { name: '🔁 Degraded Zone — 低能區', color: '#5E3A87', coach: '身體發出需要休息的訊號。啟動呼吸校準，這不是弱點，是自律。' };
    }

    _setZoneColor(c) {
        const p = document.getElementById('zone-pill');
        if (p) {
            p.style.backgroundColor = `${c}33`; // 20% opacity
            p.style.color = c;
        }
    }

    _updateRing(tei, hrv) {
        const pTEI = Math.max(0, Math.min(100, tei));
        const outerCirc = 2 * Math.PI * 102; // 640.88
        const offset = outerCirc * (1 - pTEI / 100);
        const outerSvg = document.getElementById('svg-outer-val');
        if (outerSvg) outerSvg.style.strokeDashoffset = offset;

        const pHRV = Math.max(0, Math.min(100, (hrv / 80) * 100));
        const innerCirc = 2 * Math.PI * 80;  // 502.65
        const innerOffset = innerCirc * (1 - pHRV / 100);
        const innerSvg = document.getElementById('svg-inner-val');
        if (innerSvg) innerSvg.style.strokeDashoffset = innerOffset;
    }

    _updateBioCard(id, val, histData) {
        this._updateText(`card-${id}-val`, val);
        if (this.sparklines[id]) {
            this.sparklines[id].render(histData);
        }
    }

    _updateStressCard(val) {
        this._updateText('card-stress-val', Math.round(val));
        const fill = document.getElementById('stress-fill');
        const dot = document.getElementById('stress-dot');
        if (fill && dot) {
            fill.style.width = `${val}%`;
            dot.style.left = `calc(${val}% - 6px)`;
        }
    }

    _updateANS(ans) {
        const sns = document.getElementById('ans-sns');
        const pns = document.getElementById('ans-pns');
        const div = document.getElementById('ans-divider');
        const lbl = document.getElementById('ans-lbl');

        if (sns && pns && div && lbl) {
            sns.style.width = `${ans.sns}%`;
            div.style.left = `${ans.sns}%`;
            lbl.innerText = `SNS ${ans.sns}% · PNS ${ans.pns}%`;
        }
    }

    _updateText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    _buildDOM() {
        this.container.innerHTML = `
      <canvas id="stardust-bg"></canvas>
      
      <div class="scan-badge" id="scan-badge-txt">✦ WARMUP · --</div>
      
      <div class="source-strip">
        <div class="source-chip"><div class="dot"></div>rPPG</div>
      </div>
      
      <div class="tei-ring-container bio-pulse">
        <svg class="tei-ring" viewBox="0 0 240 240">
          <defs>
            <linearGradient id="tei-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#34C759" />
              <stop offset="50%" stop-color="#00B4D8" />
              <stop offset="100%" stop-color="#F5A623" />
            </linearGradient>
          </defs>
          <!-- Inner ring (HRV) -->
          <circle class="ring-bg" cx="120" cy="120" r="80" />
          <circle id="svg-inner-val" cx="120" cy="120" r="80" stroke="url(#tei-grad)" stroke-width="6" stroke-dasharray="502.65" stroke-dashoffset="502.65" stroke-linecap="round" fill="none" />
          
          <!-- Outer ring (TEI) -->
          <circle class="ring-bg" cx="120" cy="120" r="102" />
          <circle id="svg-outer-val" cx="120" cy="120" r="102" stroke="url(#tei-grad)" stroke-width="8" stroke-dasharray="640.88" stroke-dashoffset="640.88" stroke-linecap="round" fill="none" />
        </svg>
        <div class="tei-number" id="tei-num">--</div>
        <div class="tei-sub">TEI · PR99</div>
      </div>
      
      <div class="zone-container bio-pulse">
        <div class="zone-pill" id="zone-pill">
          <span id="zone-txt">校準感測器...</span>
        </div>
        <div class="coach-card" id="coach-txt">保持平靜...</div>
      </div>
      
      <div class="bento-grid">
        <div class="bio-card">
          <div class="bio-card-title">心率 HR</div>
          <div class="bio-card-value bio-pulse"><span id="card-hr-val">--</span> <span class="bio-card-unit">BPM</span></div>
          <canvas class="sparkline-canvas" id="spark-hr"></canvas>
        </div>
        <div class="bio-card">
          <div class="bio-card-title">心變異 HRV</div>
          <div class="bio-card-value bio-pulse"><span id="card-hrv-val">--</span> <span class="bio-card-unit">ms</span></div>
          <canvas class="sparkline-canvas" id="spark-hrv"></canvas>
        </div>
        <div class="bio-card">
          <div class="bio-card-title">呼吸 RR</div>
          <div class="bio-card-value bio-pulse"><span id="card-rr-val">--</span> <span class="bio-card-unit">BrPM</span></div>
          <canvas class="sparkline-canvas" id="spark-rr"></canvas>
        </div>
        <div class="bio-card">
          <div class="bio-card-title">壓力 Stress</div>
          <div class="bio-card-value bio-pulse"><span id="card-stress-val">--</span></div>
          <div class="stress-bar-container">
            <div class="stress-track">
              <div class="stress-fill" id="stress-fill"></div>
              <div class="stress-dot" id="stress-dot"></div>
            </div>
            <div class="stress-ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
          </div>
        </div>
      </div>

      <div class="ans-balance-section bio-pulse">
        <div class="section-header">
          <div class="section-title">自律神經平衡</div>
        </div>
        <div class="ans-track">
          <div class="ans-sns" id="ans-sns" style="width: 50%"></div>
          <div class="ans-divider" id="ans-divider" style="left: 50%"></div>
          <div class="ans-pns" id="ans-pns"></div>
        </div>
        <div class="ans-labels">
          <span style="color: #FF6B35">交感 (SNS)</span>
          <span id="ans-lbl">SNS 50% · PNS 50%</span>
          <span style="color: #00B4D8">副交感 (PNS)</span>
        </div>
      </div>
      
      <div class="body-battery-section bio-pulse">
        <div class="section-header">
          <div class="section-title">身體能量</div>
          <div class="section-value">78</div>
        </div>
        <div class="bb-chart" id="bb-chart">
          ${[90, 95, 92, 85, 72, 55, 42, 48, 62, 70, 75, 78].map((v, i) => `
            <div class="bb-col">
              <div class="bb-bar" style="height: ${v}%; background: linear-gradient(180deg, #34C759, #1A6B2E); opacity: ${0.2 + (i / 12) * 0.6}; transition-delay: ${i * 80}ms"></div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="sqi-section">
        <div class="sqi-score" id="sqi-txt">SQI --%</div>
      </div>
      
      <!-- FDCB Bar -->
      <div class="fdcb-bar">
        <div class="fdcb-left">Canslim GS ▾</div>
        <div class="fdcb-center">
          <span class="play-icon">▶</span>
          <span>5:00</span>
        </div>
        <div class="fdcb-right">● ● ✔ ●</div>
      </div>
    `;

        // Initialize Canvas Sparklines after DOM insertion
        const hrC = document.getElementById('spark-hr');
        const hrvC = document.getElementById('spark-hrv');
        const rrC = document.getElementById('spark-rr');
        if (hrC) this.sparklines.hr = new Sparkline(hrC, '#FF453A');
        if (hrvC) this.sparklines.hrv = new Sparkline(hrvC, '#00B4D8');
        if (rrC) this.sparklines.rr = new Sparkline(rrC, '#34C759');

        // Trigger stagger animation for BB chart
        setTimeout(() => {
            const bars = document.querySelectorAll('.bb-bar');
            bars.forEach(b => {
                const h = b.style.height;
                b.style.height = '0%';
                // Force reflow
                void b.offsetHeight;
                b.style.height = h;
            });
        }, 100);

        this.built = true;
    }
}
