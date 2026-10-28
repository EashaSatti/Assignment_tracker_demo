/* =========================================================
   ICONS
   Small inline SVG icons. They use "currentColor", so they
   automatically match the text color around them.

   Usage:  EF.icons.get('bell')
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var ICONS = {
    'dashboard':    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    'assignments':  '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    'tasks':        '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12.5 2.8 2.8 5.7-5.8"/>',
    'calendar':     '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
        'chevron-left':  '<path d="m15 6-6 6 6 6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    'courses':      '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>',
    'analytics':    '<path d="M5 20v-9M12 20V4M19 20v-6"/><path d="M3 20.5h18"/>',
    'bell':         '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    'settings':     '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    'guide':        '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><path d="M12 17h.01"/>',
    'sun':          '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    'moon':         '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    'plus':         '<path d="M12 5v14M5 12h14"/>',
    'check':        '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
    'alert':        '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
    'clock':        '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'more':         '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    'x':            '<path d="M6 6l12 12M18 6 6 18"/>',
    'circle':       '<circle cx="12" cy="12" r="8"/>',
    'half-circle':  '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
    'send':         '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
    'flag':         '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    'info':         '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    'inbox':        '<path d="M3 13 5.5 5h13L21 13v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
    'layers':       '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/>',
        'edit':         '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    'archive':      '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    'trash':        '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    'restore':      '<path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    'search':       '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    'user':         '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'pin':          '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'
  };

  function get(name, extraClass) {
    var inner = ICONS[name];
    if (!inner) {
      if (window.console) {
        console.warn('EF.icons: unknown icon "' + name + '"');
      }
      return '';
    }
    return '<svg class="icon' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 24 24"' +
      ' fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"' +
      ' stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  window.EF.icons = { get: get };
})();