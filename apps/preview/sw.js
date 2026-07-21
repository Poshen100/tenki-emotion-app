/**
 * TENKI 決策快訊 — Web Push service worker.
 * Served at /decision-alert/sw.js (scope /decision-alert/). Shows a
 * notification on push and focuses/opens the decision page on click.
 * Fact-only content; no trading instructions.
 */
/* global self, clients */

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  var title = data.title || 'TENKI 決策快訊';
  var body = data.body || '有新的決策環境觸發';
  var url = data.url || '/decision-alert/';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/brand/favicon/android-chrome-192.png',
      badge: '/brand/favicon/android-chrome-192.png',
      tag: 'tenki-alert',
      data: { url: url },
    }),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/decision-alert/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('/decision-alert/') !== -1 && 'focus' in list[i]) {
          return list[i].focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return undefined;
    }),
  );
});
