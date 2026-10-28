/* =========================================================
   COURSES SCREEN
   - Reads courses ONLY from EF.store (no second copy).
   - Re-draws the list whenever the store reports that
     courses changed.
   - All changes go through store actions.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var esc = EF.utils.escapeHtml;
  var icon = EF.icons.get;

  // Screen settings (NOT data). They last until the page is refreshed.
  var view = { filter: 'active', query: '' };

  // ---------- small helpers ----------

  function plural(count, singular) {
    return count + ' ' + singular + (count === 1 ? '' : 's');
  }

  // “Biology” with curly quotes. quoted() = plain text (for toasts),
  // quotedHtml() = safe for placing inside HTML.
  function quoted(name) {
    return '\u201C' + name + '\u201D';
  }
  function quotedHtml(name) {
    return quoted(esc(name));
  }

  // Active courses first, then alphabetical (ignoring capital letters)
  function compareCourses(a, b) {
    if (a.archived !== b.archived) {
      return a.archived ? 1 : -1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  }

  // "  intro   Smith " -> ['intro', 'smith']
  function searchTerms(query) {
    return query.toLowerCase().split(/\s+/).filter(Boolean);
  }

  // Every typed word must appear in the name, instructor or room
  function matchesTerms(course, terms) {
    if (terms.length === 0) {
      return true;
    }
    var haystack = (course.name + ' ' + course.instructor + ' ' + course.room).toLowerCase();
    return terms.every(function (term) {
      return haystack.indexOf(term) !== -1;
    });
  }

  function inCurrentFilter(course) {
    if (view.filter === 'active') {
      return !course.archived;
    }
    if (view.filter === 'archived') {
      return course.archived;
    }
    return true;
  }

  // After a change the card you were using may disappear (or be redrawn).
  // This puts keyboard focus somewhere sensible instead of losing it.
  function focusAfterChange(ui, selector) {
    setTimeout(function () {
      var active = document.activeElement;
      if (active && active !== document.body) {
        return; // focus is already somewhere sensible
      }
      var target = (selector && ui.page.querySelector(selector)) ||
        ui.page.querySelector('[data-filter][aria-pressed="true"]');
      if (target) {
        target.focus();
      }
    }, 0);
  }

  // ---------- HTML builders ----------

  function addButtonHtml() {
    return '<button type="button" class="btn btn--primary" data-action="add">' + icon('plus') + 'Add Course</button>';
  }

  function cardHtml(course) {
    var id = esc(course.id);
    var name = esc(course.name);

    var meta = '';
    if (course.instructor) {
      meta += '<li>' + icon('user') + '<span><span class="visually-hidden">Instructor: </span>' +
        esc(course.instructor) + '</span></li>';
    }
    if (course.room) {
      meta += '<li>' + icon('pin') + '<span><span class="visually-hidden">Room: </span>' +
        esc(course.room) + '</span></li>';
    }

    var toggleButton = course.archived
      ? '<button type="button" class="btn btn--ghost btn--sm" data-action="restore" data-id="' + id +
          '" aria-label="Restore ' + name + '">' + icon('restore') + 'Restore</button>'
      : '<button type="button" class="btn btn--ghost btn--sm" data-action="archive" data-id="' + id +
          '" aria-label="Archive ' + name + '">' + icon('archive') + 'Archive</button>';

    return '<article class="card card--course course-card' + (course.archived ? ' course-card--archived' : '') +
        '" style="--course-color: ' + esc(course.color) + '">' +
      '<div class="course-card__header">' +
        '<h2 class="course-card__name">' + name + '</h2>' +
        (course.archived ? '<span class="badge badge--neutral">' + icon('archive') + 'Archived</span>' : '') +
      '</div>' +
      (meta ? '<ul class="course-card__meta">' + meta + '</ul>' : '') +
      (course.notes ? '<p class="course-card__notes">' + esc(course.notes) + '</p>' : '') +
      '<div class="course-card__actions">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="edit" data-id="' + id +
          '" aria-label="Edit ' + name + '">' + icon('edit') + 'Edit</button>' +
        toggleButton +
        '<button type="button" class="btn btn--ghost btn--ghost-danger btn--sm" data-action="delete" data-id="' + id +
          '" aria-label="Delete ' + name + '">' + icon('trash') + 'Delete</button>' +
      '</div>' +
    '</article>';
  }

  // `text` is trusted HTML (callers escape anything user-typed)
  function emptyStateHtml(iconName, title, text, buttonHtml, compact) {
    return '<div class="empty card' + (compact ? ' empty--compact' : '') + '">' +
      '<div class="empty__icon">' + icon(iconName) + '</div>' +
      '<h2 class="empty__title">' + esc(title) + '</h2>' +
      '<p class="empty__text">' + text + '</p>' +
      (buttonHtml || '') +
    '</div>';
  }

  function listHtml(totalCourses, shown, searching) {
    if (totalCourses === 0) {
      return emptyStateHtml('courses', 'No courses yet',
        'Add your first course to start organizing assignments and tasks.', addButtonHtml(), false);
    }

    if (shown.length === 0) {
      if (searching) {
        return emptyStateHtml('search', 'No matching courses',
          'Nothing matches <strong>' + quotedHtml(view.query.trim()) + '</strong> in this view. Try a different word, or clear the search.',
          '<button type="button" class="btn btn--secondary" data-action="clear-search">Clear search</button>', true);
      }
      if (view.filter === 'archived') {
        return emptyStateHtml('archive', 'No archived courses',
          'Courses you archive will appear here. Archiving keeps all of their assignments and tasks.', '', true);
      }
      return emptyStateHtml('courses', 'No active courses',
        'All of your courses are archived. Restore one from the Archived view, or add a new course.',
        addButtonHtml(), true);
    }

    return '<div class="course-grid">' + shown.map(cardHtml).join('') + '</div>';
  }

  function statusText(shownCount, baseCount, searching) {
    var noun = view.filter === 'active' ? 'active course' : (view.filter === 'archived' ? 'archived course' : 'course');
    if (searching) {
      return shownCount + ' of ' + plural(baseCount, noun) + ' match your search.';
    }
    return plural(shownCount, noun) + '.';
  }

  // ---------- Add / Edit course form ----------

  var COURSE_COLORS = [
    { name: 'Forest green', value: '#2F7D5B' },
    { name: 'Royal blue',   value: '#3B63C9' },
    { name: 'Burnt orange', value: '#B45F2B' },
    { name: 'Plum',         value: '#8A4FB0' },
    { name: 'Teal',         value: '#0F7F8C' },
    { name: 'Rose',         value: '#C2417A' },
    { name: 'Gold',         value: '#9A7A0A' },
    { name: 'Slate',        value: '#5B6B7F' }
  ];

  // The first preset color no other course is using yet
  function nextDefaultColor() {
    var courses = EF.store.getState().courses;
    var used = {};
    courses.forEach(function (course) {
      used[course.color.toLowerCase()] = true;
    });
    for (var i = 0; i < COURSE_COLORS.length; i += 1) {
      if (!used[COURSE_COLORS[i].value.toLowerCase()]) {
        return COURSE_COLORS[i].value;
      }
    }
    return COURSE_COLORS[courses.length % COURSE_COLORS.length].value;
  }

  // course === null  -> "Add course"      course = {...} -> "Edit course"
  function openCourseForm(ui, course) {
    var isEdit = !!course;

    var swatchButtons = COURSE_COLORS.map(function (color) {
      return '<button type="button" class="swatch-btn" data-color="' + color.value + '"' +
        ' style="--swatch: ' + color.value + '" aria-pressed="false"' +
        ' aria-label="' + color.name + '" title="' + color.name + '">' + icon('check') + '</button>';
    }).join('');

    var bodyHtml =
      '<form id="course-form" class="stack" novalidate>' +
        '<div class="field">' +
          '<label class="field__label" for="course-name">Course name <span class="field__required">(required)</span></label>' +
          '<input class="input" id="course-name" type="text" maxlength="100" autocomplete="off" aria-required="true">' +
          '<span class="field__error" id="course-name-error" hidden>' + icon('alert') + '<span class="field__error-text"></span></span>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field">' +
            '<label class="field__label" for="course-instructor">Instructor</label>' +
            '<input class="input" id="course-instructor" type="text" maxlength="100" autocomplete="off">' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="course-room">Room</label>' +
            '<input class="input" id="course-room" type="text" maxlength="50" autocomplete="off">' +
          '</div>' +
        '</div>' +
        '<fieldset class="field">' +
          '<legend class="field__label">Color</legend>' +
          '<div class="color-picker">' + swatchButtons +
            '<label class="color-picker__custom" for="course-color"><span>Custom</span>' +
              '<input type="color" id="course-color"></label>' +
          '</div>' +
          '<span class="field__hint">Helps you spot this course across the app. The course name is always shown too.</span>' +
        '</fieldset>' +
        '<div class="field">' +
          '<label class="field__label" for="course-notes">Notes</label>' +
          '<textarea class="textarea" id="course-notes" maxlength="5000"></textarea>' +
        '</div>' +
      '</form>';

    var footerHtml =
      '<button type="button" class="btn btn--secondary" data-modal-close>Cancel</button>' +
      '<button type="submit" class="btn btn--primary" form="course-form">' + (isEdit ? 'Save Changes' : 'Add Course') + '</button>';

    var dialog = EF.modal.open({
      title: isEdit ? 'Edit course' : 'Add course',
      bodyHtml: bodyHtml,
      footerHtml: footerHtml
    });

    var form = dialog.querySelector('#course-form');
    var nameInput = dialog.querySelector('#course-name');
    var nameError = dialog.querySelector('#course-name-error');
    var instructorInput = dialog.querySelector('#course-instructor');
    var roomInput = dialog.querySelector('#course-room');
    var colorInput = dialog.querySelector('#course-color');
    var notesInput = dialog.querySelector('#course-notes');

    // Starting values
    if (isEdit) {
      nameInput.value = course.name;
      instructorInput.value = course.instructor;
      roomInput.value = course.room;
      notesInput.value = course.notes;
    }
    colorInput.value = (isEdit ? course.color : nextDefaultColor()).toLowerCase();

    // Mark the swatch that matches the current color (if any)
    function syncSwatches() {
      EF.utils.qsa('.swatch-btn', dialog).forEach(function (swatch) {
        var isChosen = swatch.getAttribute('data-color').toLowerCase() === colorInput.value.toLowerCase();
        swatch.setAttribute('aria-pressed', isChosen ? 'true' : 'false');
      });
    }
    syncSwatches();

    form.addEventListener('click', function (event) {
      var swatch = event.target.closest('.swatch-btn');
      if (swatch) {
        colorInput.value = swatch.getAttribute('data-color').toLowerCase();
        syncSwatches();
      }
    });
    colorInput.addEventListener('input', syncSwatches);

    function showNameError(message) {
      nameError.querySelector('.field__error-text').textContent = message;
      nameError.hidden = false;
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.setAttribute('aria-describedby', 'course-name-error');
    }
    function clearNameError() {
      nameError.hidden = true;
      nameInput.removeAttribute('aria-invalid');
      nameInput.removeAttribute('aria-describedby');
    }
    nameInput.addEventListener('input', clearNameError);

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var values = {
        name: nameInput.value.trim(),
        instructor: instructorInput.value.trim(),
        room: roomInput.value.trim(),
        color: colorInput.value,
        notes: notesInput.value.trim()
      };

      if (values.name === '') {
        showNameError('Please enter a course name.');
        nameInput.focus();
        return;
      }

      // A new course must not be hidden by the current filter or search
      if (!isEdit && (view.filter === 'archived' || view.query.trim() !== '')) {
        ui.resetFilters();
      }

      var result = isEdit ? EF.store.updateCourse(course.id, values) : EF.store.addCourse(values);

      if (!result.ok) {
        if (result.reason === 'name-required') {
          showNameError(result.message);
          nameInput.focus();
        } else {
          EF.toast.show(result.message, 'danger');
        }
        return;
      }

      EF.modal.close();

      if (result.unchanged) {
        EF.toast.show('No changes to save.', 'info');
      } else if (isEdit) {
        EF.toast.show('Saved changes to ' + quoted(values.name) + '.', 'success');
      } else {
        EF.toast.show(quoted(values.name) + ' added.', 'success');
      }

      focusAfterChange(ui, isEdit ? '[data-action="edit"][data-id="' + course.id + '"]' : null);
    });

    nameInput.focus();
  }

  // ---------- Archive, Restore, Delete ----------

  // "3 assignments and 5 tasks" (bold), only mentioning what exists
  function describeImpact(impact) {
    var parts = [];
    if (impact.assignments > 0) {
      parts.push('<strong>' + plural(impact.assignments, 'assignment') + '</strong>');
    }
    if (impact.tasks > 0) {
      parts.push('<strong>' + plural(impact.tasks, 'task') + '</strong>');
    }
    return parts.join(' and ');
  }

  function openArchiveConfirm(ui, course) {
    var impact = EF.store.getCourseImpact(course.id);
    var bodyHtml = impact.total === 0
      ? '<p>' + quotedHtml(course.name) + ' will move to your Archived list. You can restore it at any time.</p>'
      : '<p>' + quotedHtml(course.name) + ' has ' + describeImpact(impact) + '.</p>' +
        '<p>Archiving <strong>keeps all of them</strong>. Nothing is deleted. The course moves to your Archived list, and you can restore it at any time.</p>';

    EF.confirm.open({
      title: 'Archive course?',
      bodyHtml: bodyHtml,
      confirmLabel: 'Archive Course',
      onConfirm: function () {
        var result = EF.store.archiveCourse(course.id, true);
        if (result.ok) {
          EF.toast.show(quoted(course.name) + ' archived.', 'success');
          focusAfterChange(ui, null);
        } else {
          EF.toast.show(result.message, 'warning');
        }
      }
    });
  }

  // Restoring is safe and reversible, so it needs no confirmation
  function restoreCourse(ui, course) {
    var result = EF.store.archiveCourse(course.id, false);
    if (result.ok) {
      EF.toast.show(quoted(course.name) + ' restored to Active.', 'success');
      focusAfterChange(ui, null);
    } else {
      EF.toast.show(result.message, 'warning');
    }
  }

  function openDeleteDialog(ui, course) {
    var impact = EF.store.getCourseImpact(course.id);

    // 1. Nothing linked: a plain confirmation is enough
    if (impact.total === 0) {
      EF.confirm.open({
        title: 'Delete course?',
        bodyHtml:
          '<p>Delete ' + quotedHtml(course.name) + ' permanently? It has no assignments or tasks. This cannot be undone.</p>' +
          (course.archived ? '' : '<p class="field__hint">If you might need it again, archive it instead.</p>'),
        confirmLabel: 'Delete Course',
        danger: true,
        onConfirm: function () {
          var result = EF.store.deleteCourse(course.id);
          if (result.ok) {
            EF.toast.show(quoted(course.name) + ' deleted.', 'success');
            focusAfterChange(ui, null);
          } else {
            EF.toast.show(result.message, 'warning');
          }
        }
      });
      return;
    }

    // 2. Linked work exists: offer the three safe options in ONE dialog
    var targets = EF.store.getState().courses
      .filter(function (other) { return other.id !== course.id && !other.archived; })
      .sort(compareCourses);
    var canArchive = !course.archived;
    var canMove = targets.length > 0;
    var mode = canArchive ? 'archive' : (canMove ? 'move' : 'delete');

    var archiveChoice = !canArchive ? '' :
      '<div class="choice" data-choice="archive">' +
        '<label class="choice__label">' +
          '<input type="radio" name="delete-mode" value="archive">' +
          '<span>' +
            '<span class="choice__title">Archive course ' +
              '<span class="badge badge--success">' + icon('check-circle') + 'Recommended</span></span>' +
            '<span class="choice__text">Keeps all assignments and tasks. The course moves to Archived and can be restored.</span>' +
          '</span>' +
        '</label>' +
      '</div>';

    var moveOptions = targets.map(function (other) {
      return '<option value="' + esc(other.id) + '">' + esc(other.name) + '</option>';
    }).join('');

    var moveChoice =
      '<div class="choice' + (canMove ? '' : ' is-disabled') + '" data-choice="move">' +
        '<label class="choice__label">' +
          '<input type="radio" name="delete-mode" value="move"' + (canMove ? '' : ' disabled') + '>' +
          '<span>' +
            '<span class="choice__title">Move items to another course</span>' +
            '<span class="choice__text">' + (canMove
              ? 'Assignments and tasks are moved first, then this course is deleted.'
              : 'You need another active course to use this option.') + '</span>' +
          '</span>' +
        '</label>' +
        (canMove
          ? '<div class="choice__extra" data-extra="move" hidden>' +
              '<div class="field"><label class="field__label" for="move-target">Move items to</label>' +
              '<select class="select" id="move-target">' + moveOptions + '</select></div>' +
            '</div>'
          : '') +
      '</div>';

    var deleteChoice =
      '<div class="choice choice--danger" data-choice="delete">' +
        '<label class="choice__label">' +
          '<input type="radio" name="delete-mode" value="delete">' +
          '<span>' +
            '<span class="choice__title">Delete course and linked data ' +
              '<span class="badge badge--danger">' + icon('alert') + 'Permanent</span></span>' +
            '<span class="choice__text">Permanently deletes this course, ' + describeImpact(impact) +
              '. This cannot be undone.</span>' +
          '</span>' +
        '</label>' +
        '<div class="choice__extra" data-extra="delete" hidden>' +
          '<div class="field">' +
            '<label class="field__label" for="delete-confirm-name">Type <strong>' + esc(course.name) + '</strong> to confirm</label>' +
            '<input class="input" id="delete-confirm-name" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">' +
            '<span class="field__hint">The Delete button turns on when the name matches.</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    var bodyHtml =
      '<div class="stack">' +
        '<p>' + quotedHtml(course.name) + ' has ' + describeImpact(impact) + '. Choose what should happen to ' +
          (impact.total === 1 ? 'it' : 'them') + (canArchive ? '.' : ', or close this dialog to keep the course archived.') + '</p>' +
        '<fieldset class="choice-group">' +
          '<legend class="visually-hidden">What should happen to the linked items?</legend>' +
          archiveChoice + moveChoice + deleteChoice +
        '</fieldset>' +
        '<p class="field__error" id="delete-error" role="alert" hidden></p>' +
      '</div>';

    var dialog = EF.modal.open({
      title: 'Delete course',
      bodyHtml: bodyHtml,
      footerHtml:
        '<button type="button" class="btn btn--secondary" data-modal-close>Cancel</button>' +
        '<button type="button" class="btn btn--primary" id="delete-go"></button>'
    });

    var go = dialog.querySelector('#delete-go');
    var nameInput = dialog.querySelector('#delete-confirm-name');
    var targetSelect = dialog.querySelector('#move-target');
    var errorEl = dialog.querySelector('#delete-error');
    var choices = EF.utils.qsa('[data-choice]', dialog);
    var extras = EF.utils.qsa('[data-extra]', dialog);

    var buttonLabels = { archive: 'Archive Course', move: 'Move Items and Delete Course', delete: 'Delete Course and Data' };

    function nameMatches() {
      return nameInput.value.trim().toLowerCase() === course.name.trim().toLowerCase();
    }

    function updateGo() {
      go.disabled = mode === 'delete' && !nameMatches();
    }

    function applyMode() {
      choices.forEach(function (choice) {
        choice.classList.toggle('is-selected', choice.getAttribute('data-choice') === mode);
      });
      extras.forEach(function (extra) {
        extra.hidden = extra.getAttribute('data-extra') !== mode;
      });
      go.textContent = buttonLabels[mode];
      go.className = 'btn ' + (mode === 'delete' ? 'btn--danger' : 'btn--primary');
      errorEl.hidden = true;
      updateGo();
    }

    dialog.querySelector('input[value="' + mode + '"]').checked = true;
    applyMode();

    dialog.addEventListener('change', function (event) {
      if (event.target.name === 'delete-mode') {
        mode = event.target.value;
        applyMode();
      }
    });
    nameInput.addEventListener('input', updateGo);

    go.addEventListener('click', function () {
      if (mode === 'delete' && !nameMatches()) {
        return;
      }

      var result;
      var message;
      if (mode === 'archive') {
        result = EF.store.archiveCourse(course.id, true);
        message = quoted(course.name) + ' archived. Its assignments and tasks were kept.';
      } else if (mode === 'move') {
        var targetCourse = EF.store.getCourse(targetSelect.value);
        result = EF.store.deleteCourse(course.id, { linkedItems: 'move', moveToCourseId: targetSelect.value });
        message = 'Moved the items to ' + quoted(targetCourse ? targetCourse.name : 'the other course') +
          ' and deleted ' + quoted(course.name) + '.';
      } else {
        result = EF.store.deleteCourse(course.id, { linkedItems: 'delete' });
        message = quoted(course.name) + ' and its linked assignments and tasks were deleted.';
      }

      if (!result.ok) {
        errorEl.innerHTML = icon('alert') + '<span>' + esc(result.message) + '</span>';
        errorEl.hidden = false;
        return; // keep the dialog open so nothing is lost
      }

      EF.modal.close();
      EF.toast.show(message, 'success', 6000);
      focusAfterChange(ui, null);
    });
  }

  // ---------- the screen ----------

  function render(page) {
    page.innerHTML =
      '<div class="page-header">' +
        '<p class="page-header__text">Your classes in one place. Give each one a color so it is easy to spot across the app.</p>' +
        '<button type="button" class="btn btn--primary page-header__action" id="courses-add" data-action="add">' +
          icon('plus') + 'Add Course</button>' +
      '</div>' +

      '<div class="courses-toolbar" id="courses-toolbar" hidden>' +
        '<div class="search-field">' +
          '<span class="search-field__icon" aria-hidden="true">' + icon('search') + '</span>' +
          '<label class="visually-hidden" for="courses-search">Search courses</label>' +
          '<input class="input search-field__input" id="courses-search" type="search" ' +
            'placeholder="Search by name, instructor or room" autocomplete="off">' +
        '</div>' +
        '<div class="segmented" role="group" aria-label="Show courses">' +
          '<button type="button" class="segmented__btn" data-filter="active" aria-pressed="true">Active <span class="segmented__count">0</span></button>' +
          '<button type="button" class="segmented__btn" data-filter="archived" aria-pressed="false">Archived <span class="segmented__count">0</span></button>' +
          '<button type="button" class="segmented__btn" data-filter="all" aria-pressed="false">All <span class="segmented__count">0</span></button>' +
        '</div>' +
      '</div>' +

      '<p class="courses-status" id="courses-status" aria-live="polite"></p>' +
      '<div id="courses-list"></div>';

    var addButton = page.querySelector('#courses-add');
    var toolbar = page.querySelector('#courses-toolbar');
    var searchInput = page.querySelector('#courses-search');
    var statusEl = page.querySelector('#courses-status');
    var listEl = page.querySelector('#courses-list');

    // Handed to the dialogs so they can talk back to this screen
    var ui = { page: page, resetFilters: resetFilters };

    // Show everything again (used after adding a course that a filter/search would hide)
    function resetFilters() {
      view.filter = 'active';
      view.query = '';
      searchInput.value = '';
      refresh();
    }

    // Reads the store and draws. Called on first show and on every course change.
    function refresh() {
      var courses = EF.store.getState().courses.slice().sort(compareCourses);

      var activeCount = 0;
      courses.forEach(function (course) {
        if (!course.archived) {
          activeCount += 1;
        }
      });
      var counts = { active: activeCount, archived: courses.length - activeCount, all: courses.length };

      // With no courses at all, the empty state carries the "Add Course" button
      toolbar.hidden = courses.length === 0;
      addButton.hidden = courses.length === 0;

      EF.utils.qsa('[data-filter]', toolbar).forEach(function (button) {
        var key = button.getAttribute('data-filter');
        button.setAttribute('aria-pressed', key === view.filter ? 'true' : 'false');
        button.querySelector('.segmented__count').textContent = String(counts[key]);
      });

      var terms = searchTerms(view.query);
      var inFilter = courses.filter(inCurrentFilter);
      var shown = inFilter.filter(function (course) {
        return matchesTerms(course, terms);
      });

      statusEl.textContent = courses.length === 0 ? '' : statusText(shown.length, inFilter.length, terms.length > 0);
      listEl.innerHTML = listHtml(courses.length, shown, terms.length > 0);
    }

    searchInput.value = view.query;
    searchInput.addEventListener('input', function () {
      view.query = searchInput.value;
      refresh();
    });

    // ONE click listener for the whole screen (event delegation)
    page.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action], [data-filter]');
      if (!target) {
        return;
      }

      if (target.hasAttribute('data-filter')) {
        view.filter = target.getAttribute('data-filter');
        refresh();
        return;
      }

      var action = target.getAttribute('data-action');

      if (action === 'add') {
        openCourseForm(ui, null);
        return;
      }
      if (action === 'clear-search') {
        view.query = '';
        searchInput.value = '';
        refresh();
        searchInput.focus();
        return;
      }

      var course = EF.store.getCourse(target.getAttribute('data-id'));
      if (!course) {
        EF.toast.show('That course no longer exists.', 'warning');
        return;
      }
      if (action === 'edit') {
        openCourseForm(ui, course);
      } else if (action === 'archive') {
        openArchiveConfirm(ui, course);
      } else if (action === 'restore') {
        restoreCourse(ui, course);
      } else if (action === 'delete') {
        openDeleteDialog(ui, course);
      }
    });

    // Store -> screen. The router throws this page away when you leave,
    // so we stop listening once it is no longer on screen.
    var stop = EF.store.subscribe(function (state, change) {
      if (!page.isConnected) {
        stop();
        return;
      }
      if (change.changed.indexOf('courses') !== -1) {
        refresh();
      }
    });

    refresh();
  }

  // Replaces the placeholder (this file loads AFTER placeholders.js)
  EF.router.register('courses', {
    title: 'Courses',
    render: render
  });
})();