/* =========================================================
   SHELL
   The permanent frame around every screen: sidebar, mobile
   bottom navigation, "More" sheet, theme button and the
   notification bell. The navigation is built from
   EF.config.nav so it is defined in one place only.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var items = EF.config.nav;
  var currentPath = null;

  function label(item) {
    return EF.utils.escapeHtml(item.label);
  }

  function navLinkHtml(item) {
    return '<a class="nav-link" href="#/' + item.path + '" data-route="' + item.path + '" title="' + label(item) + '">' +
      EF.icons.get(item.icon) +
      '<span class="nav-link__label">' + label(item) + '</span>' +
      '</a>';
  }

  // Replace <span data-icon="bell"></span> style placeholders with real icons
  function hydrateIcons() {
    EF.utils.qsa('[data-icon]').forEach(function (element) {
      element.innerHTML = EF.icons.get(element.getAttribute('data-icon'));
    });
  }

  function buildSidebar() {
    var html = '';
    var lastSection = null;
    items.forEach(function (item) {
      if (lastSection !== null && item.section !== lastSection) {
        html += '<div class="nav-divider" role="separator"></div>';
      }
      lastSection = item.section;
      html += navLinkHtml(item);
    });
    document.getElementById('sidebar-nav').innerHTML = html;
  }

  function buildBottomNav() {
    var html = '';
    items.forEach(function (item) {
      if (item.primary) {
        html += '<a class="bottom-nav__item" href="#/' + item.path + '" data-route="' + item.path + '">' +
          EF.icons.get(item.icon) + '<span>' + label(item) + '</span></a>';
      }
    });
    html += '<button type="button" class="bottom-nav__item" id="more-button" aria-haspopup="dialog">' +
      EF.icons.get('more') + '<span>More</span></button>';
    document.getElementById('bottom-nav').innerHTML = html;
  }

  function openMore() {
    var html = '<nav class="sheet-nav" aria-label="More pages">';
    items.forEach(function (item) {
      if (!item.primary) {
        html += navLinkHtml(item);
      }
    });
    html += '</nav>';

    var dialog = EF.modal.open({ title: 'More', bodyHtml: html });
    setActive(currentPath); // highlight the current page inside the sheet too

    // Choosing a page closes the sheet
    dialog.addEventListener('click', function (event) {
      if (event.target.closest('a[href^="#/"]')) {
        dialog.close();
      }
    });
  }

  // Mark the link for the current page (aria-current also helps screen readers)
  function setActive(path) {
    currentPath = path;

    EF.utils.qsa('[data-route]').forEach(function (element) {
      if (element.getAttribute('data-route') === path) {
        element.setAttribute('aria-current', 'page');
      } else {
        element.removeAttribute('aria-current');
      }
    });

    var isPrimary = items.some(function (item) {
      return item.path === path && item.primary;
    });
    var moreButton = document.getElementById('more-button');
    if (moreButton) {
      moreButton.classList.toggle('is-active', !!path && !isPrimary);
    }
  }

  function updateThemeButton() {
    var button = document.getElementById('theme-toggle');
    var isDark = EF.theme.current() === 'dark';
    var text = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    button.innerHTML = EF.icons.get(isDark ? 'sun' : 'moon');
    button.setAttribute('aria-label', text);
    button.setAttribute('title', text);
  }

  // Phase 9 will call this with the real number of active notifications
  function setNotificationCount(count) {
    var badge = document.getElementById('notification-badge');
    var link = document.getElementById('bell-link');
    if (count > 0) {
      badge.hidden = false;
      // Show the exact number (a cap of 9+ hid every change while many reminders were unread)
      badge.textContent = count > 99 ? '99+' : String(count);
      link.setAttribute('aria-label', 'Notifications, ' + count + ' unread');
    } else {
      badge.hidden = true;
      badge.textContent = '';
      link.setAttribute('aria-label', 'Notifications');
    }
  }

  function init() {
    hydrateIcons();
    buildSidebar();
    buildBottomNav();
    updateThemeButton();

    EF.theme.onChange(updateThemeButton);
    document.getElementById('theme-toggle').addEventListener('click', EF.theme.toggle);
    document.getElementById('more-button').addEventListener('click', openMore);

    // The skip link would normally change the URL hash and confuse our router,
    // so we handle it ourselves.
    document.getElementById('skip-link').addEventListener('click', function (event) {
      event.preventDefault();
      document.getElementById('main').focus();
    });

    // Whenever the page changes: close any open sheet and update the highlight
    EF.router.onChange(function (path) {
      EF.modal.close();
      setActive(path);
    });
  }

  window.EF.shell = {
    init: init,
    setNotificationCount: setNotificationCount
  };
})();