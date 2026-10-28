/* =========================================================
   DESIGN SYSTEM PREVIEW  (open with  index.html#/design)
   A developer-only page that shows every component in one
   place. All numbers and names here are DESIGN SAMPLES, not
   real data. We will remove this page before selling the
   product.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var icon = EF.icons.get;

  var SAMPLE_COURSES = [
    { name: 'Biology', color: '#2F7D5B' },
    { name: 'History', color: '#B45F2B' },
    { name: 'Mathematics', color: '#3B63C9' },
    { name: 'Literature', color: '#8A4FB0' },
    { name: 'Chemistry', color: '#0F7F8C' },
    { name: 'Art', color: '#C2417A' }
  ];

  function swatches(names) {
    return '<div class="swatch-grid">' + names.map(function (name) {
      return '<div class="swatch">' +
        '<span class="swatch__color" style="background: var(--color-' + name + ')"></span>' +
        '<span class="swatch__name">--color-' + name + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function section(title, content, note) {
    return '<section class="ds-section">' +
      '<h2 class="ds-section__title">' + title + '</h2>' +
      (note ? '<p class="ds-note">' + note + '</p>' : '') +
      content +
    '</section>';
  }

  function render(page) {
    var html = '';

    html += '<div class="banner banner--info" role="note">' +
      '<span class="banner__icon">' + icon('info') + '</span>' +
      '<div>This is the design system preview. It is for checking colors, type and components while we build. ' +
      'Try the theme button in the top bar to compare light and dark.</div></div>' +
      '<div style="height: var(--space-8)"></div>';

    // ----- Colors -----
    html += section('Colors',
      '<div class="stack">' +
        swatches(['bg', 'surface', 'surface-2', 'border', 'border-strong']) +
        swatches(['text', 'text-muted', 'text-subtle']) +
        swatches(['accent', 'accent-hover', 'accent-soft']) +
        swatches(['success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'info', 'info-soft']) +
      '</div>',
      'Colors are named by purpose (for example "danger"), not by shade, so the dark theme can swap the values.');

    // ----- Typography -----
    html += section('Typography',
      '<div class="type-sample">' +
        '<div style="font-size: var(--text-3xl); font-weight: var(--weight-bold)">Heading large</div>' +
        '<div style="font-size: var(--text-2xl); font-weight: var(--weight-semibold)">Heading medium</div>' +
        '<div style="font-size: var(--text-xl); font-weight: var(--weight-semibold)">Section title</div>' +
        '<div>Body text is 16px with comfortable line spacing. Assignments, tasks and course names will use this style.</div>' +
        '<div style="font-size: var(--text-sm); color: var(--color-text-muted)">Small muted text for hints, dates and secondary details.</div>' +
        '<div style="font-size: var(--text-xs); color: var(--color-text-muted)">Extra small text for captions and labels.</div>' +
      '</div>',
      'System font stack: no downloads, works offline.');

    // ----- Buttons -----
    html += section('Buttons',
      '<div class="cluster">' +
        '<button type="button" class="btn btn--primary">' + icon('plus') + 'Primary</button>' +
        '<button type="button" class="btn btn--secondary">Secondary</button>' +
        '<button type="button" class="btn btn--ghost">Ghost</button>' +
        '<button type="button" class="btn btn--danger">Delete</button>' +
        '<button type="button" class="btn btn--primary" disabled>Disabled</button>' +
        '<button type="button" class="btn btn--secondary btn--sm">Small</button>' +
        '<button type="button" class="icon-btn" aria-label="Add example">' + icon('plus') + '</button>' +
      '</div>');

    // ----- Badges -----
    html += section('Status, priority and deadline badges',
      '<div class="stack">' +
        '<div class="cluster">' +
          '<span class="badge badge--not-started">' + icon('circle') + 'Not Started</span>' +
          '<span class="badge badge--in-progress">' + icon('half-circle') + 'In Progress</span>' +
          '<span class="badge badge--submitted">' + icon('send') + 'Submitted</span>' +
          '<span class="badge badge--completed">' + icon('check-circle') + 'Completed</span>' +
        '</div>' +
        '<div class="cluster">' +
          '<span class="badge badge--priority-high">' + icon('flag') + 'High</span>' +
          '<span class="badge badge--priority-medium">' + icon('flag') + 'Medium</span>' +
          '<span class="badge badge--priority-low">' + icon('flag') + 'Low</span>' +
        '</div>' +
        '<div class="cluster">' +
          '<span class="badge badge--due-soon">' + icon('clock') + 'Due soon</span>' +
          '<span class="badge badge--overdue">' + icon('alert') + 'Overdue</span>' +
        '</div>' +
      '</div>',
      'Every badge has an icon AND a word, so meaning never depends on color alone. Submitted and Completed are both "finished" (green family) but look different.');

    // ----- Course tags -----
    html += section('Course tags',
      '<div class="cluster">' + SAMPLE_COURSES.map(function (course) {
        return '<span class="course-tag" style="--course-color: ' + course.color + '">' +
          '<span class="course-tag__dot" aria-hidden="true"></span>' + course.name + '</span>';
      }).join('') + '</div>',
      'Sample course names and colors. Real course colors come in Phase 3, with contrast checks. The color is a small marker; the name is always shown as text.');

    // ----- Cards -----
    html += section('Cards, stats and progress',
      '<div class="stack">' +
        '<div class="grid-auto">' +
          '<div class="card stat"><span class="stat__label">' + icon('clock') + 'Due Today</span><span class="stat__value">2</span></div>' +
          '<div class="card stat"><span class="stat__label">' + icon('calendar') + 'Next 7 Days</span><span class="stat__value">5</span></div>' +
          '<div class="card stat"><span class="stat__label">' + icon('calendar') + 'Next 14 Days</span><span class="stat__value">9</span></div>' +
          '<div class="card stat stat--danger"><span class="stat__label">' + icon('alert') + 'Overdue</span><span class="stat__value">1</span></div>' +
        '</div>' +
        '<article class="card card--course card--interactive" style="--course-color: #2F7D5B">' +
          '<div class="stack" style="gap: var(--space-3)">' +
            '<div class="cluster" style="justify-content: space-between">' +
              '<h3 class="card__title">Sample: Research Paper</h3>' +
              '<span class="badge badge--in-progress">' + icon('half-circle') + 'In Progress</span>' +
            '</div>' +
            '<div class="cluster">' +
              '<span class="course-tag" style="--course-color: #2F7D5B"><span class="course-tag__dot" aria-hidden="true"></span>Biology</span>' +
              '<span class="badge badge--priority-high">' + icon('flag') + 'High</span>' +
              '<span class="badge badge--due-soon">' + icon('clock') + 'Due soon</span>' +
            '</div>' +
            '<div class="progress-row">' +
              '<div class="progress" role="progressbar" aria-label="Sample progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="40">' +
                '<div class="progress__bar" style="width: 40%"></div>' +
              '</div>' +
              '<span class="progress-row__value">40%</span>' +
            '</div>' +
          '</div>' +
        '</article>' +
      '</div>',
      'These numbers are design samples only. The real dashboard in Phase 7 will calculate them from your data.');

    // ----- Forms -----
    html += section('Form fields',
      '<form class="stack" id="ds-form" novalidate style="max-width: 32rem">' +
        '<div class="field">' +
          '<label class="field__label" for="ds-title">Title</label>' +
          '<input class="input" id="ds-title" type="text" placeholder="e.g. Research paper draft" aria-describedby="ds-title-hint">' +
          '<span class="field__hint" id="ds-title-hint">A short, clear name for the assignment.</span>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="ds-priority">Priority</label>' +
          '<select class="select" id="ds-priority"><option>Low</option><option selected>Medium</option><option>High</option></select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="ds-date">Due date</label>' +
          '<input class="input" id="ds-date" type="date">' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="ds-progress">Progress</label>' +
          '<input id="ds-progress" type="range" min="0" max="100" value="40">' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="ds-notes">Notes</label>' +
          '<textarea class="textarea" id="ds-notes" placeholder="Anything you want to remember"></textarea>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="ds-error">Field with an error</label>' +
          '<input class="input" id="ds-error" type="text" aria-invalid="true" aria-describedby="ds-error-msg">' +
          '<span class="field__error" id="ds-error-msg">' + icon('alert') + 'Please enter a title.</span>' +
        '</div>' +
      '</form>');

    // ----- Banners -----
    html += section('Banners',
      '<div class="stack">' +
        '<div class="banner banner--info" role="note"><span class="banner__icon">' + icon('info') + '</span><div>A neutral information message.</div></div>' +
        '<div class="banner banner--warning" role="note"><span class="banner__icon">' + icon('alert') + '</span><div>A warning message.</div></div>' +
        '<div class="banner banner--demo" role="note"><span class="banner__icon">' + icon('layers') + '</span>' +
          '<div><strong>Sample data is loaded.</strong> These items are examples, not your real data. ' +
          'Later, a button here will remove all sample data in one action.</div></div>' +
      '</div>',
      'The dashed "sample data" banner is how we will make demo data unmistakable.');

    // ----- Empty state -----
    html += section('Empty state',
      '<div class="empty card">' +
        '<div class="empty__icon">' + icon('inbox') + '</div>' +
        '<h3 class="empty__title">No assignments yet</h3>' +
        '<p class="empty__text">When you add your first assignment, it will appear here.</p>' +
        '<button type="button" class="btn btn--primary">' + icon('plus') + 'Add assignment</button>' +
      '</div>');

    // ----- Overlays -----
    html += section('Modal and toasts',
      '<div class="cluster">' +
        '<button type="button" class="btn btn--secondary" data-demo="modal">Open modal</button>' +
        '<button type="button" class="btn btn--secondary" data-demo="toast-success">Success toast</button>' +
        '<button type="button" class="btn btn--secondary" data-demo="toast-info">Info toast</button>' +
        '<button type="button" class="btn btn--secondary" data-demo="toast-warning">Warning toast</button>' +
        '<button type="button" class="btn btn--secondary" data-demo="toast-danger">Error toast</button>' +
      '</div>',
      'On a phone-sized screen the modal slides up as a bottom sheet.');

    page.innerHTML = html;

    // Listeners go on `page`, which is replaced on every navigation
    page.addEventListener('click', function (event) {
      var button = event.target.closest('[data-demo]');
      if (!button) {
        return;
      }
      var demo = button.getAttribute('data-demo');

      if (demo === 'modal') {
        EF.modal.open({
          title: 'Example dialog',
          bodyHtml: '<p>This is how dialogs will look. Press Escape, click outside, or use a button to close it.</p>',
          footerHtml:
            '<button type="button" class="btn btn--secondary" data-modal-close>Cancel</button>' +
            '<button type="button" class="btn btn--primary" data-modal-close>Save</button>'
        });
        return;
      }

      var messages = {
        'toast-success': ['Assignment saved (demo message).', 'success'],
        'toast-info': ['This is an information message.', 'info'],
        'toast-warning': ['Careful: this is a warning message.', 'warning'],
        'toast-danger': ['Something went wrong (demo message).', 'danger']
      };
      if (messages[demo]) {
        EF.toast.show(messages[demo][0], messages[demo][1]);
      }
    });

    // The demo form must never actually submit
    var form = page.querySelector('#ds-form');
    if (form) {
      form.addEventListener('submit', function (event) { event.preventDefault(); });
    }
  }

  EF.router.register('design', {
    title: 'Design System',
    render: render
  });
})();