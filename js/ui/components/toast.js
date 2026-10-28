/* =========================================================
   TOAST
   Short messages that appear and disappear by themselves.

   Usage:  EF.toast.show('Saved!', 'success');
   Types:  'success' | 'info' | 'warning' | 'danger'
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var ICON_FOR_TYPE = {
    success: 'check-circle',
    info: 'info',
    warning: 'alert',
    danger: 'alert'
  };

  var LABEL_FOR_TYPE = {
    success: 'Success',
    info: 'Information',
    warning: 'Warning',
    danger: 'Error'
  };

  var MAX_TOASTS = 3;

  function show(message, type, duration) {
    type = ICON_FOR_TYPE[type] ? type : 'info';
    duration = duration === undefined ? 4000 : duration;

    var region = document.getElementById('toast-region');
    if (!region) {
      return;
    }

    // Keep the screen tidy: remove the oldest if too many
    while (region.children.length >= MAX_TOASTS) {
      region.removeChild(region.firstChild);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.innerHTML =
      '<span class="toast__icon">' + EF.icons.get(ICON_FOR_TYPE[type]) + '</span>' +
      '<p class="toast__message"><span class="visually-hidden">' + LABEL_FOR_TYPE[type] + ': </span>' +
        EF.utils.escapeHtml(message) + '</p>' +
      '<button type="button" class="icon-btn" aria-label="Dismiss message">' + EF.icons.get('x') + '</button>';

    region.appendChild(toast);

    var timer = null;

    function dismiss() {
      clearTimeout(timer);
      if (!toast.parentNode) {
        return;
      }
      toast.classList.add('is-leaving');
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 200);
    }

    toast.querySelector('button').addEventListener('click', dismiss);
    timer = setTimeout(dismiss, duration);
  }

  window.EF.toast = { show: show };
})();