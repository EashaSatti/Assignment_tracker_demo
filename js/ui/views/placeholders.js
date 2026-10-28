/* =========================================================
   PLACEHOLDER SCREENS
   Every page in EF.config.nav gets a simple "coming soon"
   screen. When we build a real screen in a later phase, it
   registers the same path and replaces its placeholder.
   (This file loads before the real screens, and the later
   registration wins.)
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  EF.config.nav.forEach(function (item) {
    EF.router.register(item.path, {
      title: item.label,
      render: function (page) {
        var extra = '';
        if (item.path === 'dashboard') {
          extra = '<a class="btn btn--secondary" href="#/design">' +
            EF.icons.get('layers') + 'Preview the design system</a>';
        }

        page.innerHTML =
          '<section class="empty card">' +
            '<div class="empty__icon">' + EF.icons.get(item.icon) + '</div>' +
            '<h2 class="empty__title">' + EF.utils.escapeHtml(item.label) + ' is coming soon</h2>' +
            '<p class="empty__text">' + EF.utils.escapeHtml(item.blurb) + '</p>' +
            '<span class="badge badge--neutral">' + EF.icons.get('clock') + 'Planned for Phase ' + item.phase + '</span>' +
            extra +
          '</section>';
      }
    });
  });
})();