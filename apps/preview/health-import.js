/**
 * Apple Health 匯出解析 —— 瀏覽器端串流版。
 *
 * 這支檔案是 `packages/engine/src/importers/apple-health.ts` 的鏡像實作
 * （preview 是純 ES5 瀏覽器環境，不經 bundler，所以無法直接 import 引擎）。
 * 邏輯與常數必須與引擎版本一致；引擎那份有完整測試，這份是它的搬運。
 *
 * 🔒 檔案完全在本機處理，一個位元組都不會離開這台裝置。
 *    沒有 fetch、沒有 XHR、沒有任何網路呼叫。
 */
(function () {
  'use strict';

  var SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis';
  var HRV_TYPE = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
  var HR_TYPE = 'HKQuantityTypeIdentifierHeartRate';
  var WANTED = [SLEEP_TYPE, HRV_TYPE, HR_TYPE];

  var ASLEEP = [
    'HKCategoryValueSleepAnalysisAsleepUnspecified',
    'HKCategoryValueSleepAnalysisAsleepCore',
    'HKCategoryValueSleepAnalysisAsleepDeep',
    'HKCategoryValueSleepAnalysisAsleepREM',
  ];
  var IN_BED = 'HKCategoryValueSleepAnalysisInBed';

  var NIGHT_GAP_MS = 3 * 60 * 60 * 1000;
  var PAIRS_NEEDED = 20;
  var DAYS_NEEDED = 14;

  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/;

  function parseAppleDate(raw) {
    var m = DATE_RE.exec(String(raw).trim());
    if (!m) return null;
    // 群組：1=年 2=月 3=日 4=時 5=分 6=秒 7=符號 8=時區時 9=時區分
    var utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    var offsetMinutes = (+m[8] * 60 + +m[9]) * (m[7] === '-' ? -1 : 1);
    return utc - offsetMinutes * 60000;
  }

  function attr(line, name) {
    var m = new RegExp('\\b' + name + '="([^"]+)"').exec(line);
    return m ? m[1] : null;
  }

  function parseLine(line) {
    if (line.indexOf('<Record') === -1) return null;
    var type = attr(line, 'type');
    if (!type || WANTED.indexOf(type) === -1) return null;

    var value = attr(line, 'value');
    var start = parseAppleDate(attr(line, 'startDate'));
    var end = parseAppleDate(attr(line, 'endDate'));
    if (value === null || start === null || end === null || end < start) return null;

    return { type: type, value: value, startMs: start, endMs: end };
  }

  function localDateKey(ms) {
    var d = new Date(ms);
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function groupNights(records) {
    var sleep = records
      .filter(function (r) { return r.type === SLEEP_TYPE; })
      .sort(function (a, b) { return a.startMs - b.startMs; });
    if (!sleep.length) return [];

    var nights = [];
    var bucket = [sleep[0]];

    function flush() {
      var asleepMs = 0;
      var inBedMs = 0;
      var endMs = bucket[0].endMs;
      for (var i = 0; i < bucket.length; i++) {
        var seg = bucket[i];
        var dur = seg.endMs - seg.startMs;
        if (ASLEEP.indexOf(seg.value) !== -1) asleepMs += dur;
        else if (seg.value === IN_BED) inBedMs += dur;
        if (seg.endMs > endMs) endMs = seg.endMs;
      }
      nights.push({
        morningDate: localDateKey(endMs),
        asleepHours: asleepMs / 3600000,
        inBedHours: inBedMs / 3600000,
        startMs: bucket[0].startMs,
        endMs: endMs,
        segmentCount: bucket.length,
      });
    }

    for (var i = 1; i < sleep.length; i++) {
      var prevEnd = 0;
      for (var j = 0; j < bucket.length; j++) {
        if (bucket[j].endMs > prevEnd) prevEnd = bucket[j].endMs;
      }
      if (sleep[i].startMs - prevEnd > NIGHT_GAP_MS) {
        flush();
        bucket = [sleep[i]];
      } else {
        bucket.push(sleep[i]);
      }
    }
    flush();
    return nights;
  }

  function summarize(records, nights) {
    var hrv = 0;
    var hr = 0;
    var earliest = Infinity;
    var latest = -Infinity;

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === HRV_TYPE) hrv++;
      if (r.type === HR_TYPE) hr++;
      if (r.startMs < earliest) earliest = r.startMs;
      if (r.endMs > latest) latest = r.endMs;
    }

    var spanDays = records.length ? Math.round((latest - earliest) / 86400000) : 0;

    var meanAsleep = null;
    if (nights.length) {
      var total = 0;
      for (var k = 0; k < nights.length; k++) total += nights[k].asleepHours;
      meanAsleep = total / nights.length;
    }

    var sufficient = nights.length >= PAIRS_NEEDED && spanDays >= DAYS_NEEDED;
    var notes = [];

    if (!records.length) {
      notes.push('這個檔案裡沒有找到我們需要的紀錄類型。確認你選的是 export.xml。');
    }
    if (!nights.length) {
      notes.push(
        '沒有睡眠資料。睡眠只有在你有追蹤時才會出現 —— 透過「睡眠專注模式」排程或睡眠 app。' +
        '沒有它就建不出睡眠模式這個特質。'
      );
    } else if (!sufficient) {
      notes.push(
        nights.length + ' 個夜晚、橫跨 ' + spanDays + ' 天。睡眠模式至少需要 ' +
        PAIRS_NEEDED + ' 個夜晚且橫跨 ' + DAYS_NEEDED + ' 天。'
      );
    }
    if (!hrv) {
      notes.push(
        '沒有 HRV。iPhone 本身沒有心率感測器，這項只有在有 Apple Watch 或其他連接裝置時才會出現。' +
        '相機掃描會補上這一塊。'
      );
    }

    return {
      totalRecords: records.length,
      sleepNights: nights.length,
      hrvReadings: hrv,
      heartRateReadings: hr,
      spanDays: spanDays,
      meanAsleepHours: meanAsleep,
      sufficient: sufficient,
      notes: notes,
    };
  }

  // ── UI ────────────────────────────────────

  var el = {};
  var lastPayload = null;

  function show(id, on) {
    if (el[id]) el[id].hidden = !on;
  }

  function setProgress(mb) {
    el.progress.textContent = '已讀取 ' + mb.toFixed(1) + ' MB…';
  }

  function render(summary, nights) {
    el.statRecords.textContent = summary.totalRecords.toLocaleString();
    el.statNights.textContent = String(summary.sleepNights);
    el.statSpan.textContent = summary.spanDays + ' 天';
    el.statMean.textContent =
      summary.meanAsleepHours === null
        ? '—'
        : summary.meanAsleepHours.toFixed(1) + ' 小時';

    el.verdict.className = 'verdict ' + (summary.sufficient ? 'ok' : 'wait');
    el.verdict.textContent = summary.sufficient
      ? '✓ 這份資料足以跑睡眠相關性分析'
      : '還不夠跑睡眠相關性分析';

    el.notes.innerHTML = '';
    for (var i = 0; i < summary.notes.length; i++) {
      var li = document.createElement('li');
      li.textContent = summary.notes[i];
      el.notes.appendChild(li);
    }

    lastPayload = { summary: summary, nights: nights };
    show('results', true);
    show('downloadRow', nights.length > 0);
  }

  /** 把一段文字切行、解析，回傳未完成的尾段。 */
  function consumeChunk(text, records) {
    var lines = text.split('\n');
    var carry = lines.pop() || '';
    for (var i = 0; i < lines.length; i++) {
      var rec = parseLine(lines[i]);
      if (rec) records.push(rec);
    }
    return carry;
  }

  /** 串流路徑（Safari 16.4+ / Chrome）。整份檔案永遠不會同時進記憶體。 */
  async function readStreaming(file, records) {
    var reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
    var bytes = 0;
    var carry = '';
    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      carry = consumeChunk(carry + chunk.value, records);
      setProgress(bytes / 1048576);
    }
    return carry;
  }

  /**
   * 舊版 Safari 的退路：用 Blob.slice + FileReader 分塊。
   * 同樣不會一次載入整份檔案。
   */
  function readChunked(file, records) {
    var CHUNK = 4 * 1024 * 1024;
    var offset = 0;
    var carry = '';

    return new Promise(function (resolve, reject) {
      function next() {
        if (offset >= file.size) { resolve(carry); return; }
        var reader = new FileReader();
        reader.onerror = function () { reject(reader.error); };
        reader.onload = function () {
          carry = consumeChunk(carry + reader.result, records);
          offset += CHUNK;
          setProgress(Math.min(offset, file.size) / 1048576);
          setTimeout(next, 0); // 讓出主執行緒，畫面才不會卡住
        };
        reader.readAsText(file.slice(offset, offset + CHUNK));
      }
      next();
    });
  }

  async function handleFile(file) {
    show('results', false);
    show('progress', true);
    el.progress.textContent = '開始讀取…';

    var records = [];
    var carry = '';

    try {
      var canStream =
        typeof file.stream === 'function' && typeof TextDecoderStream !== 'undefined';
      carry = canStream
        ? await readStreaming(file, records)
        : await readChunked(file, records);

      if (carry) {
        var tail = parseLine(carry);
        if (tail) records.push(tail);
      }
    } catch (err) {
      el.progress.textContent = '讀取失敗：' + (err && err.message ? err.message : err);
      return;
    }

    show('progress', false);
    var nights = groupNights(records);
    render(summarize(records, nights), nights);
  }

  function download() {
    if (!lastPayload) return;
    var blob = new Blob([JSON.stringify(lastPayload, null, 2)], {
      type: 'application/json',
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'tenki-sleep-history.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    [
      'fileInput', 'progress', 'results', 'verdict', 'notes',
      'statRecords', 'statNights', 'statSpan', 'statMean',
      'downloadRow', 'downloadBtn',
    ].forEach(function (id) { el[id] = document.getElementById(id); });

    el.fileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) handleFile(file);
    });
    el.downloadBtn.addEventListener('click', download);
  });
})();
