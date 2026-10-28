/* =========================================================
   MODAL
   A pop-up dialog. On phones it appears as a bottom sheet.

   Usage:
     EF.modal.open({
       title: 'Hello',
       bodyHtml: '<p>Some content</p>',
       footerHtml: '<button class="btn btn--primary" data-modal-close>OK</button>'
     });

   bodyHtml and footerHtml are inserted as HTML, so escape any
   user-typed text with EF.utils.escapeHtml() first.
   Anything inside the modal with the attribute data-modal-close
   closes it when clicked.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var openDialog = null;
  var lastFocused = null;
  var counter = 0;

  function close() {
    if (openDialog && openDialog.open) {
      openDialog.close();
    }
  }

  function open(options) {
    close(); // only one modal at a time

    counter += 1;
    var titleId = 'modal-title-' + counter;
    var dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.setAttribute('aria-labelledby', titleId);

    dialog.innerHTML =
      '<div class="modal__header">' +
        '<h2 class="modal__title" id="' + titleId + '">' + EF.utils.escapeHtml(options.title) + '</h2>' +
        '<button type="button" class="icon-btn" data-modal-close aria-label="Close dialog">' + EF.icons.get('x') + '</button>' +
      '</div>' +
      '<div class="modal__body">' + (options.bodyHtml || '') + '</div>' +
      (options.footerHtml ? '<div class="modal__footer">' + options.footerHtml + '</div>' : '');

    // Click on the dark backdrop, or on anything marked data-modal-close
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog || event.target.closest('[data-modal-close]')) {
        dialog.close();
      }
    });

    // Runs for every way of closing (button, Escape key, backdrop)
    dialog.addEventListener('close', function () {
      document.documentElement.classList.remove('modal-open');
      if (dialog.parentNode) {
        dialog.parentNode.removeChild(dialog);
      }
      if (openDialog === dialog) {
        openDialog = null;
      }
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus(); // return focus to whatever opened the modal
      }
    });

    lastFocused = document.activeElement;
    document.body.appendChild(dialog);
    document.documentElement.classList.add('modal-open'); // stops the page scrolling behind
    dialog.showModal();
    openDialog = dialog;
    return dialog;
  }

  window.EF.modal = {
    open: open,
    close: close
  };
})();