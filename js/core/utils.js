/* =========================================================
   UTILS
   Small helper functions used across the app.
   Phase 2 added: isPlainObject, generateId, nowISO.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  // Turns text into HTML-safe text. ALWAYS use this before placing
  // user-typed text (like an assignment title) into HTML.
  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).replace(/[&<>"']/g, function (character) {
      return HTML_ESCAPES[character];
    });
  }

  // Short names for finding elements on the page
  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  // Returns a real array (easier to loop over than a NodeList)
  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  // True for {...} objects. False for null, arrays, strings, numbers...
  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // ---------- IDs ----------
  // The ONE place that creates ids. Example result: "a_lq3x9k_1_f2ab"
  //   prefix  = what kind of record (c = course, a = assignment, t = task)
  //   time    = when it was made (base 36)
  //   counter = increases for every id made while the page is open,
  //             so two ids made in the same millisecond still differ
  //   random  = a few random characters as extra protection
  var idCounter = 0;

  function generateId(prefix) {
    idCounter += 1;
    var time = Date.now().toString(36);
    var count = idCounter.toString(36);
    var random = Math.random().toString(36).slice(2, 6);
    return prefix + '_' + time + '_' + count + '_' + random;
  }

  // ---------- Timestamps ----------
  // The ONE place that creates "now". ISO text such as "2026-10-08T14:30:00.000Z".
  function nowISO() {
    return new Date().toISOString();
  }

  window.EF.utils = {
    escapeHtml: escapeHtml,
    qs: qs,
    qsa: qsa,
    isPlainObject: isPlainObject,
    generateId: generateId,
    nowISO: nowISO
  };
})();