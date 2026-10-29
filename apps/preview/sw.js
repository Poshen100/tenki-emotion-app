/**
 * TENKI 決策快訊 — Web Push service worker.
 * Served at /decision-alert/sw.js (scope /decision-alert/). Shows a
 * notification on push and focuses/opens the decision page on click.
 * Fact-only content; no trading instructions.
 */
/* global self */

/**
 * 🔴 **沒有 tag 時絕對不能退回一個常數。**
 *
 * 裝置上兩則通知共用同一個 tag ＝ 後到的**直接取代**先到的。所以 tag 是一個
 * 宣稱：「這兩則是同一件事」。先前這裡寫死 `'tenki-alert'`，於是 ES1! 的快訊
 * 會被 NQ1! 的靜默蓋掉，使用者永遠看不到第一則。
 *
 * 正常情況下 server 會帶 tag 來（`domain/src/policies/alert-policy.ts` 的
 * `pushNotificationTag()`，判準是標的 —— 跟冷卻、節流、安靜更新同一把尺）。
 * 帶不來的時候（舊版 server、payload 壞掉）我們**不知道**這則跟上一則是不是
 * 同一件事 —— 那就不要宣稱。給一個唯一值，寧可多留一則也不要弄丟一則。
 *
 * @returns {string} 不會跟任何其他通知相撞的 tag。
 */
function uniqueTag() {
  return 'tenki-alert:unknown:' + Date.now() + ':' + Math.random().toString(36).slice(2, 8);
}

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  var title = data.title || 'TENKI 決策快訊';
  var body = data.body || '有新的決策環境觸發';
  var url = data.url || '/decision-alert/';
  var tag = (typeof data.tag === 'string' && data.tag) ? data.tag : uniqueTag();
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/brand/favicon/android-chrome-192.png',
      badge: '/brand/favicon/android-chrome-192.png',
      tag: tag,
      data: { url: url },
    }),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/decision-alert/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      // 🔴 **先前這裡算出了 `target` 卻沒有用它** —— 只要找到任何一個
      //    `/decision-alert/` 視窗就 focus，不管它現在停在哪個網址。
      //    今天看不出症狀（server 送的 url 永遠是 `/decision-alert/`），
      //    但程式碼長得像有在用，那正是下一個人會踩的陷阱：哪天 url 開始
      //    帶 hash（例如 `#result`），通知就會把人丟到一個不相干的畫面。
      //
      //    順序：①已經停在目的地的視窗 → 直接 focus；②其他本站視窗 →
      //    focus **並且導到目的地**；③都沒有 → 開一個。
      var fallback = null;
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (typeof client.url !== 'string') continue;
        if (client.url.indexOf('/decision-alert/') === -1) continue;
        if (sameTarget(client.url, target)) {
          return 'focus' in client ? client.focus() : undefined;
        }
        if (fallback === null) fallback = client;
      }
      if (fallback !== null) {
        // navigate() 在部分瀏覽器／未受控的 client 上不存在或會 reject ——
        // 那時退回單純 focus，至少人還在這個 App 裡，不要整個 handler 掛掉。
        var focused = 'focus' in fallback ? fallback.focus() : Promise.resolve(fallback);
        return Promise.resolve(focused).then(function (c) {
          var w = c || fallback;
          if (w && typeof w.navigate === 'function') {
            return w.navigate(target).catch(function () { return w; });
          }
          return w;
        });
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});

/**
 * 這個視窗是不是已經停在目的地。
 *
 * ⚠️ 比的是**路徑＋hash**，不是整串網址 —— client.url 是絕對網址，而 target
 * 是站內相對路徑。用 indexOf 直接比會在 target 是 `/decision-alert/` 時
 * 命中每一個這一頁的視窗（連停在 `#result` 的也算），那就等於沒有比。
 *
 * @param {string} clientUrl - 視窗的絕對網址。
 * @param {string} target - 站內相對路徑（可含 hash）。
 * @returns {boolean}
 */
function sameTarget(clientUrl, target) {
  try {
    var a = new URL(clientUrl);
    var b = new URL(target, a.origin);
    return a.pathname === b.pathname && a.hash === b.hash;
  } catch (e) {
    return false;
  }
}
