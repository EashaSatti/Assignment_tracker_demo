/* =========================================================
   CONFIRM DIALOG
   A "Are you sure?" dialog built on top of EF.modal.

   Usage:
     EF.confirm.open({
       title: 'Archive course?',
       bodyHtml: '<p>Some explanation.</p>',   // trusted HTML: escape user text first
       confirmLabel: 'Archive Course',
       cancelLabel: 'Cancel',                  // optional
       danger: false,                          // true = red confirm button
       onConfirm: function () { ... }          // runs after the dialog closes
     });
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  function open(options) {
    var cancelLabel = options.cancelLabel || 'Cancel';
    var confirmClass = options.danger ? 'btn btn--danger' : 'btn btn--primary';

    var dialog = EF.modal.open({
      title: options.title,
      bodyHtml: options.bodyHtml,
      footerHtml:
        '<button type="button" class="btn btn--secondary" data-modal-close>' + EF.utils.escapeHtml(cancelLabel) + '</button>' +
        '<button type="button" class="' + confirmClass + '" data-confirm>' + EF.utils.escapeHtml(options.confirmLabel) + '</button>'
    });

    // Tell assistive technology this is a question that needs an answer
    dialog.setAttribute('role', 'alertdialog');
    var body = dialog.querySelector('.modal__body');
    body.id = 'confirm-description';
    dialog.setAttribute('aria-describedby', 'confirm-description');

    dialog.querySelector('[data-confirm]').addEventListener('click', function () {
      EF.modal.close();
      if (typeof options.onConfirm === 'function') {
        options.onConfirm();
      }
    });

    return dialog;
  }

  window.EF.confirm = { open: open };
})();