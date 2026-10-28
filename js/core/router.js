/* =========================================================
   ROUTER
   Shows the right screen for the current URL hash,
   e.g.  index.html#/assignments

   A screen is registered like this:
     EF.router.register('tasks', {
       title: 'Tasks',
       render: function (page) { page.innerHTML = '...'; }
     });

   IMPORTANT: every time you navigate, the router gives the
   screen a BRAND NEW empty "page" element. Attach event
   listeners to that page element (not to #view), because it
   is thrown away on the next navigation. This prevents
   listeners piling up each time you visit a screen.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var DEFAULT_PATH = 'dashboard';
  var routes = {};
  var listeners = [];
  var hasRenderedOnce = false;

  function register(path, definition) {
    routes[path] = definition;
  }

  // Other files (like the navigation) can ask to hear about page changes
  function onChange(callback) {
    listeners.push(callback);
  }

  // "#/assignments" -> "assignments"
  function getCurrentPath() {
    var match = window.location.hash.match(/^#\/([a-z0-9-]*)/i);
    return match ? match[1].toLowerCase() : '';
  }

  function renderNotFound(page) {
    page.innerHTML =
      '<section class="empty card">' +
        '<div class="empty__icon">' + EF.icons.get('alert') + '</div>' +
        '<h2 class="empty__title">Page not found</h2>' +
        '<p class="empty__text">That page does not exist. Let us take you back to the dashboard.</p>' +
        '<a class="btn btn--primary" href="#/' + DEFAULT_PATH + '">Go to Dashboard</a>' +
      '</section>';
  }

  function render() {
    var path = getCurrentPath();

    // No page in the URL yet: send the user to the default page.
    // (replace() avoids adding an extra Back-button step.)
    if (path === '') {
      window.location.replace('#/' + DEFAULT_PATH);
      return; // the hashchange event will call render() again
    }

    var route = routes[path];
    var title = route ? route.title : 'Page not found';

    // Build the new screen off-page, then swap it in
    var page = document.createElement('div');
    page.className = 'page';
    if (route) {
      route.render(page);
    } else {
      renderNotFound(page);
    }

    var viewRoot = document.getElementById('view');
    viewRoot.innerHTML = '';
    viewRoot.appendChild(page);

    document.title = title + ' \u00B7 ' + EF.config.appName;
    document.getElementById('page-title').textContent = title;

    // After the first load, move focus to the content so keyboard
    // and screen-reader users know the page changed.
    if (hasRenderedOnce) {
      window.scrollTo(0, 0);
      document.getElementById('main').focus({ preventScroll: true });
    }
    hasRenderedOnce = true;

    listeners.forEach(function (callback) {
      callback(route ? path : null);
    });
  }

  function start() {
    window.addEventListener('hashchange', render);
    render();
  }

  window.EF.router = {
    register: register,
    onChange: onChange,
    start: start
  };
})();