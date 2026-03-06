/**
 * 模擬「使用者已完成 30 秒手指覆蓋 PPG 掃描」後的基線
 * 
 * 基於健康成人靜息態生理參考範圍:
 *   HR:  60-75 BPM (靜息)
 *   HRV: 40-65 ms RMSSD (健康成人)
 *   RR:  12-18 BrPM
 * 
 * 模擬 7 天 × 3 次/天 = 21 筆掃描的統計基線
 */

const BaselineSim = {
  // 7 天基線統計 (模擬 Welford 結果)
  stats: {
    hr:  { mean: 68, std: 6.2 },   // 靜息心率
    hrv: { mean: 48, std: 12.5 },  // RMSSD
    rr:  { mean: 14.5, std: 2.1 }, // 呼吸率
    sampleCount: 21,
    windowDays: 7,
  },

  // 模擬 Garmin 數據 (Pro tier 才顯示)
  garmin: {
    connected: true,
    deviceName: 'Forerunner 265',
    hrvStatus: 'Balanced',      // Balanced | Unbalanced | Low | Poor
    hrvNightMean: 45,           // 夜間平均 ms
    hrvBaseline: [42, 58],      // 基線範圍
    stress: null,               // 即時計算
    bodyBattery: 78,
    bb24h: [90,95,92,85,72,55,42,48,62,70,75,78], // 12 bars
  },

  /**
   * 生成模擬的 24hr Body Battery 歷史
   * 模式: 睡眠充電 → 工作消耗 → 晚間恢復
   */
  generateBB24h() {
    const base = [90,95,92,85,72,55,42,48,62,70,75,78];
    return base.map(v => v + Math.round((Math.random()-0.5)*4));
  },

  /**
   * 從即時 rPPG 數據計算 Stress (模擬 Garmin Firstbeat)
   * 基於 LF/HF ratio 的簡化近似
   * 
   * Stress 0-25:  Rest (綠)
   * Stress 26-50: Low (藍)
   * Stress 51-75: Medium (橙)
   * Stress 76-100: High (紅)
   */
  calculateStress(hr, hrv, rr) {
    // HRV 低 + HR 高 = 壓力大
    const hrvZ = (hrv - this.stats.hrv.mean) / this.stats.hrv.std;
    const hrZ  = (hr - this.stats.hr.mean) / this.stats.hr.std;
    // Stress 與 HRV 負相關，與 HR 正相關
    const raw = 50 - hrvZ * 20 + hrZ * 15;
    return Math.max(0, Math.min(100, Math.round(raw)));
  },

  /**
   * 計算 SNS/PNS 平衡
   * SNS (交感): 與 HR 正相關, 與 HRV 負相關
   * PNS (副交感): 與 HRV 正相關, 與 RR 慢正相關
   */
  calculateANS(hr, hrv, rr) {
    const hrvZ = (hrv - this.stats.hrv.mean) / this.stats.hrv.std;
    const hrZ  = (hr - this.stats.hr.mean) / this.stats.hr.std;
    const rrZ  = (rr - this.stats.rr.mean) / this.stats.rr.std;

    // PNS 指標 (0-1): HRV 高 + RR 慢 = PNS 活躍
    const pnsRaw = 0.5 + hrvZ * 0.15 - rrZ * 0.08;
    const pns = Math.max(0.15, Math.min(0.85, pnsRaw));
    const sns = 1 - pns;

    return {
      sns: Math.round(sns * 100),
      pns: Math.round(pns * 100),
      label: pns > 0.6 ? 'Parasympathetic dominant (cool)' :
             sns > 0.6 ? 'Sympathetic dominant (warm)' : 'Balanced',
    };
  },
};
