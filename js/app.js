/* =========================================================
   APP START-UP
   Loaded last, so everything it uses already exists.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  // Tell the user when their data could not be loaded or saved normally.
  // Normal states ('ok' and 'first-run') show nothing.
  function showStorageStatus(status) {
    if (status.code === 'ok' || status.code === 'first-run' || !status.message) {
      return;
    }
    var type = status.code === 'recovered' || status.code === 'no-storage' ? 'warning' : 'danger';
    EF.toast.show(status.message, type, 12000);
  }

  // 1. Build the navigation and wire the top bar
  EF.shell.init();

  // 2. Show the screen that matches the URL
  EF.router.start();

  // 3. Report storage problems (now, and if one happens later)
  showStorageStatus(EF.store.getStatus());
  EF.store.onStatusChange(showStorageStatus);
})();