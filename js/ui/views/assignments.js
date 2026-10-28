/* =========================================================
   ASSIGNMENTS SCREEN
   - Reads assignments and courses ONLY from EF.store (no second copy).
   - Re-draws the list whenever the store reports a change to
     assignments or courses.
   - All changes go through store actions.
   - Dates, deadlines, search, filters and sorting come from
     EF.assignmentSelectors (pure helpers).
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var esc = EF.utils.escapeHtml;
  var icon = EF.icons.get;
  var sel = EF.assignmentSelectors;
  var tsel = EF.taskSelectors;

  // Screen settings (NOT data). They last until the page is refreshed.
  var view = { query: '', courseId: 'all', status: 'all', priority: 'all', deadline: 'all', sort: 'due' };

  var STATUS_ORDER = ['not_started', 'in_progress', 'submitted', 'completed'];
  var PRIORITY_ORDER = ['low', 'medium', 'high'];
  var STATUS_ICONS = { not_started: 'circle', in_progress: 'half-circle', submitted: 'send', completed: 'check-circle' };
  var STATUS_CLASSES = {
    not_started: 'badge--not-started', in_progress: 'badge--in-progress',
    submitted: 'badge--submitted', completed: 'badge--completed'
  };

  // ---------- small helpers ----------

  function plural(count, singular) {
    return count + ' ' + singular + (count === 1 ? '' : 's');
  }

  function quoted(text) {
    return '“' + text + '”';
  }

  function quotedHtml(text) {
    return quoted(esc(text));
  }

  function compareByName(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  }

  function courseMap() {
    var map = Object.create(null);
    EF.store.getState().courses.forEach(function (course) {
      map[course.id] = course;
    });
    return map;
  }

  function currentFilters() {
    return { query: view.query, courseId: view.courseId, status: view.status, priority: view.priority, deadline: view.deadline };
  }

  function optionsHtml(list, selected) {
    return list.map(function (item) {
      return '<option value="' + esc(item.value) + '"' + (item.value === selected ? ' selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');
  }

  function statusOptions(allLabel) {
    return [{ value: 'all', label: allLabel }].concat(STATUS_ORDER.map(function (status) {
      return { value: status, label: sel.statusLabel(status) };
    }));
  }

  function priorityOptions(allLabel) {
    return [{ value: 'all', label: allLabel }].concat(PRIORITY_ORDER.map(function (priority) {
      return { value: priority, label: sel.priorityLabel(priority) };
    }));
  }

  // After a dialog closes, focus normally returns to the button that opened it.
  // If the list was redrawn meanwhile, that button no longer exists, so we pick a sensible place.
  // Our 'close' listener is added after the modal's own one, so it runs second.
  function guardFocus(dialog, ui, getSelector) {
    dialog.addEventListener('close', function () {
      var active = document.activeElement;
      if (active && active !== document.body && active.isConnected) {
        return;
      }
      var wanted = typeof getSelector === 'function' ? getSelector() : null;
      var candidates = [wanted, '#assignments-search', '#assignments-add', '[data-action="add"]'];
      for (var i = 0; i < candidates.length; i += 1) {
        var element = candidates[i] ? ui.page.querySelector(candidates[i]) : null;
        if (element && !element.hidden && !element.closest('[hidden]')) {
          element.focus();
          return;
        }
      }
    });
  }

  // Close the open dialog, and run `next` once it has fully closed (so two dialogs never overlap)
  function closeThen(dialog, next) {
    dialog.addEventListener('close', function () {
      next();
    }, { once: true });
    EF.modal.close();
  }

  // ---------- HTML builders ----------

  function statusBadge(status) {
    return '<span class="badge ' + STATUS_CLASSES[status] + '">' + icon(STATUS_ICONS[status]) +
      esc(sel.statusLabel(status)) + '</span>';
  }

  function priorityBadge(priority) {
    return '<span class="badge badge--priority-' + esc(priority) + '">' + icon('flag') +
      esc(sel.priorityLabel(priority)) + ' priority</span>';
  }

  // Overdue / due today / due tomorrow / due soon. Always an icon AND words.
  function deadlineBadge(info) {
    if (info.state === 'overdue') {
      return '<span class="badge badge--overdue">' + icon('alert') + esc(info.label) + '</span>';
    }
    if (info.state === 'today' || info.state === 'tomorrow') {
      return '<span class="badge badge--due-soon">' + icon('clock') + esc(info.label) + '</span>';
    }
    if (info.state === 'soon') {
      return '<span class="badge badge--neutral">' + icon('clock') + esc(info.label) + '</span>';
    }
    return '';
  }

  function courseTagHtml(course) {
    if (!course) {
      return '<span class="course-tag course-tag--none"><span class="course-tag__dot" aria-hidden="true"></span>No course</span>';
    }
    return '<span class="course-tag" style="--course-color: ' + esc(course.color) + '">' +
      '<span class="course-tag__dot" aria-hidden="true"></span>' + esc(course.name) +
      (course.archived ? ' <span class="course-tag__note">(archived)</span>' : '') + '</span>';
  }

  // Progress bar. Always shown with a number and words (never colour alone).
  function progressHtml(progress, label) {
    var note = progress.total > 0 ? progress.done + ' of ' + plural(progress.total, 'task') + ' done' : 'No tasks linked';
    return '<div class="assignment-card__progress">' +
      '<div class="progress-row">' +
        '<div class="progress" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress.percent + '">' +
          '<div class="progress__bar" style="width: ' + progress.percent + '%' +
            (progress.percent === 100 ? '; --progress-color: var(--color-success)' : '') + '"></div>' +
        '</div>' +
        '<span class="progress-row__value">' + progress.percent + '%</span>' +
      '</div>' +
      '<p class="assignment-card__progress-note">' + esc(note) + '</p>' +
    '</div>';
  }

  // The "Tasks" part of the details dialog
  function linkedTasksHtml(linkedTasks) {
    var list = linkedTasks.length === 0
      ? '<p class="detail-text detail-text--empty">No tasks yet.</p>'
      : '<ul class="detail-tasks">' + tsel.sortTasks(linkedTasks, 'due').map(function (task) {
          var done = tsel.isDone(task);
          return '<li class="detail-tasks__item' + (done ? ' is-done' : '') + '">' +
            icon(done ? 'check-circle' : 'circle') +
            '<span class="detail-tasks__title">' + esc(task.title) + '</span>' +
            '<span class="visually-hidden">' + (done ? ' (done)' : ' (to do)') + '</span>' +
            (task.dueDate && !done ? '<span class="detail-tasks__due">' + esc(sel.formatDueDate(task.dueDate)) + '</span>' : '') +
          '</li>';
        }).join('') + '</ul>';
    return '<section class="detail-section"><h4 class="detail-heading">Tasks</h4>' + list +
      '<div class="detail-tasks__actions">' +
        '<button type="button" class="btn btn--secondary btn--sm" id="detail-add-task">' + icon('plus') + 'Add task</button>' +
        (linkedTasks.length > 0 ? '<button type="button" class="btn btn--ghost btn--sm" id="detail-view-tasks">View in Tasks</button>' : '') +
      '</div></section>';
  }

  function dueTextOf(assignment) {
    if (!assignment.dueDate) {
      return 'No due date';
    }
    return sel.formatDueDate(assignment.dueDate) + (assignment.dueTime ? ' at ' + sel.formatDueTime(assignment.dueTime) : '');
  }

  function cardHtml(assignment, courses, now) {
    var course = assignment.courseId ? courses[assignment.courseId] || null : null;
    var info = sel.getDeadlineInfo(assignment, now);
    var id = esc(assignment.id);
    var title = esc(assignment.title);
    var finished = EF.schema.isAssignmentFinished(assignment.status);

    var meta =
      '<li>' + courseTagHtml(course) + '</li>' +
      '<li>' + icon('calendar') + '<span><span class="visually-hidden">Due: </span>' + esc(dueTextOf(assignment)) + '</span></li>';
    if (assignment.estimatedMinutes !== null) {
      meta += '<li>' + icon('clock') + '<span><span class="visually-hidden">Estimated time: </span>' +
        esc(sel.formatDuration(assignment.estimatedMinutes)) + '</span></li>';
    }

    return '<article class="card card--course assignment-card' + (finished ? ' assignment-card--finished' : '') + '"' +
        (course ? ' style="--course-color: ' + esc(course.color) + '"' : '') + '>' +
      '<div class="assignment-card__header">' +
        '<h2 class="assignment-card__title">' +
          '<button type="button" class="link-btn" data-action="view" data-id="' + id + '">' + title + '</button>' +
        '</h2>' +
        '<div class="assignment-card__badges">' + deadlineBadge(info) + statusBadge(assignment.status) + '</div>' +
      '</div>' +
      '<ul class="assignment-card__meta">' + meta +  progressHtml(tsel.getAssignmentProgress(assignment, EF.store.getState().tasks), 'Progress for ' + assignment.title) + '<li>' + priorityBadge(assignment.priority) + '</li></ul>' +
      '<div class="assignment-card__actions">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="view" data-id="' + id +
          '" aria-label="View details for ' + title + '">' + icon('assignments') + 'View</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="edit" data-id="' + id +
          '" aria-label="Edit ' + title + '">' + icon('edit') + 'Edit</button>' +
        '<button type="button" class="btn btn--ghost btn--ghost-danger btn--sm" data-action="delete" data-id="' + id +
          '" aria-label="Delete ' + title + '">' + icon('trash') + 'Delete</button>' +
      '</div>' +
    '</article>';
         
  }

  // `text` is trusted HTML (callers escape anything user-typed)
  function emptyStateHtml(iconName, title, text, buttonsHtml, compact) {
    return '<div class="empty card' + (compact ? ' empty--compact' : '') + '">' +
      '<div class="empty__icon">' + icon(iconName) + '</div>' +
      '<h2 class="empty__title">' + esc(title) + '</h2>' +
      '<p class="empty__text">' + text + '</p>' +
      (buttonsHtml ? '<div class="cluster empty__actions">' + buttonsHtml + '</div>' : '') +
    '</div>';
  }

  function addButtonHtml() {
    return '<button type="button" class="btn btn--primary" data-action="add">' + icon('plus') + 'Add Assignment</button>';
  }

  function listHtml(total, shown, courses, now) {
    if (total === 0) {
      var activeCourses = EF.store.getState().courses.filter(function (course) { return !course.archived; }).length;
      var tip = activeCourses === 0
        ? 'Tip: add your courses first on the Courses page so you can link assignments to them. You can also add assignments without a course.'
        : 'Add your first assignment to start tracking deadlines.';
      var buttons = addButtonHtml() +
        (activeCourses === 0 ? '<a class="btn btn--secondary" href="#/courses">' + icon('courses') + 'Go to Courses</a>' : '');
      return emptyStateHtml('assignments', 'No assignments yet', tip, buttons, false);
    }
    if (shown.length === 0) {
      return emptyStateHtml('search', 'No matching assignments',
        'Nothing matches your current search and filters. Try changing them, or clear them to see everything.',
        '<button type="button" class="btn btn--secondary" data-action="clear-filters">Clear filters</button>', true);
    }
    return '<div class="assignment-list">' + shown.map(function (assignment) {
      return cardHtml(assignment, courses, now);
    }).join('') + '</div>';
  }

  // ---------- details (read-only) ----------

  function detailRow(label, valueHtml) {
    return '<div class="detail-list__row"><dt>' + esc(label) + '</dt><dd>' + valueHtml + '</dd></div>';
  }

  function detailText(label, text) {
    return '<section class="detail-section"><h4 class="detail-heading">' + esc(label) + '</h4>' +
      (text ? '<p class="detail-text">' + esc(text) + '</p>' : '<p class="detail-text detail-text--empty">None</p>') +
    '</section>';
  }

  function openDetails(ui, assignment) {
    var course = assignment.courseId ? EF.store.getCourse(assignment.courseId) : null;
    var info = sel.getDeadlineInfo(assignment);
    var finishedLabel = assignment.status === 'submitted' ? 'Submitted on' : 'Completed on';

        var allTasks = EF.store.getState().tasks;
    var linkedTasks = tsel.tasksOfAssignment(assignment.id, allTasks);
    var progress = tsel.getAssignmentProgress(assignment, allTasks);

    var rows =
      detailRow('Course', courseTagHtml(course)) +
      detailRow('Due', esc(dueTextOf(assignment)) + (info.label ? ' ' + deadlineBadge(info) : '')) +
      detailRow('Status', statusBadge(assignment.status)) +
      detailRow('Priority', priorityBadge(assignment.priority)) +       detailRow('Progress', progressHtml(progress, 'Progress')) +
      detailRow('Estimated time', assignment.estimatedMinutes !== null ? esc(sel.formatDuration(assignment.estimatedMinutes)) : 'Not set') +
      (assignment.completedAt ? detailRow(finishedLabel, esc(sel.formatDateTime(assignment.completedAt))) : '') +
      detailRow('Created', esc(sel.formatDateTime(assignment.createdAt))) +
      detailRow('Last updated', esc(sel.formatDateTime(assignment.updatedAt)));

    var dialog = EF.modal.open({
      title: 'Assignment details',
      bodyHtml:
        '<div class="stack">' +
          '<h3 class="detail-title">' + esc(assignment.title) + '</h3>' +
          '<dl class="detail-list">' + rows + '</dl>' +
          detailText('Description', assignment.description) +
          detailText('Notes', assignment.notes) +           linkedTasksHtml(linkedTasks) +
        '</div>',
      footerHtml:
        '<button type="button" class="btn btn--ghost btn--ghost-danger" id="detail-delete">' + icon('trash') + 'Delete</button>' +
        '<button type="button" class="btn btn--secondary" data-modal-close>Close</button>' +
        '<button type="button" class="btn btn--primary" id="detail-edit">' + icon('edit') + 'Edit</button>'
    });

    guardFocus(dialog, ui, function () {
      return '[data-action="view"][data-id="' + assignment.id + '"]';
    });

    dialog.querySelector('#detail-edit').addEventListener('click', function () {
      closeThen(dialog, function () {
        var latest = EF.store.getAssignment(assignment.id);
        if (latest) {
          openForm(ui, latest);
        }
      });
    });
    dialog.querySelector('#detail-delete').addEventListener('click', function () {
      closeThen(dialog, function () {
        var latest = EF.store.getAssignment(assignment.id);
        if (latest) {
          openDeleteDialog(ui, latest);
        }
      });
    });
    
    // Add a task already linked to this assignment, then come back to these details
    dialog.querySelector('#detail-add-task').addEventListener('click', function () {
      closeThen(dialog, function () {
        EF.tasksUi.openForm({
          assignmentId: assignment.id,
          onClosed: function () {
            var latest = EF.store.getAssignment(assignment.id);
            if (latest) {
              openDetails(ui, latest);
            }
          }
        });
      });
    });

    var viewTasksButton = dialog.querySelector('#detail-view-tasks');
    if (viewTasksButton) {
      viewTasksButton.addEventListener('click', function () {
        closeThen(dialog, function () {
          EF.tasksUi.showAssignment(assignment.id);
        });
      });
    }
  }

  // ---------- add / edit form ----------

  // "No course", then every active course, plus the assignment's own course if it is archived
  function courseSelectHtml(currentCourse) {
    var courses = EF.store.getState().courses.filter(function (course) {
      return !course.archived;
    }).sort(compareByName);

    var html = '<option value="">No course</option>' + courses.map(function (course) {
      return '<option value="' + esc(course.id) + '">' + esc(course.name) + '</option>';
    }).join('');

    if (currentCourse && currentCourse.archived) {
      html += '<option value="' + esc(currentCourse.id) + '">' + esc(currentCourse.name) + ' (Archived)</option>';
    }
    return { html: html, activeCount: courses.length };
  }

  // course === undefined/null -> "Add"      assignment object -> "Edit"
  function openForm(ui, assignment) {
    var isEdit = !!assignment;
    var current = isEdit && assignment.courseId ? EF.store.getCourse(assignment.courseId) : null;
    var courseSelect = courseSelectHtml(current);

    var bodyHtml =
      '<form id="assignment-form" class="stack" novalidate>' +
        '<div class="field">' +
          '<label class="field__label" for="af-title">Title <span class="field__required">(required)</span></label>' +
          '<input class="input" id="af-title" type="text" maxlength="200" autocomplete="off" aria-required="true">' +
          '<span class="field__error" id="af-title-error" hidden>' + icon('alert') + '<span class="field__error-text"></span></span>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="af-course">Course</label>' +
          '<select class="select" id="af-course"' + (courseSelect.activeCount === 0 ? ' data-hint="af-course-hint" aria-describedby="af-course-hint"' : '') + '>' + courseSelect.html + '</select>' +
          (courseSelect.activeCount === 0
            ? '<span class="field__hint" id="af-course-hint">No active courses yet. You can add one on the <a href="#/courses">Courses page</a>.</span>'
            : '') +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field">' +
            '<label class="field__label" for="af-date">Due date</label>' +
            '<input class="input" id="af-date" type="date">' +
            '<span class="field__error" id="af-date-error" hidden>' + icon('alert') + '<span class="field__error-text"></span></span>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="af-time">Due time</label>' +
            '<input class="input" id="af-time" type="time" data-hint="af-time-hint" aria-describedby="af-time-hint">' +
            '<span class="field__hint" id="af-time-hint">Optional. Needs a due date.</span>' +
            '<span class="field__error" id="af-time-error" hidden>' + icon('alert') + '<span class="field__error-text"></span></span>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field">' +
            '<label class="field__label" for="af-priority">Priority</label>' +
            '<select class="select" id="af-priority">' + optionsHtml(priorityOptions('').slice(1), 'medium') + '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="af-status">Status</label>' +
            '<select class="select" id="af-status">' + optionsHtml(statusOptions('').slice(1), 'not_started') + '</select>' +
          '</div>' +
        '</div>' +
        '<fieldset class="field">' +
          '<legend class="field__label">Estimated time</legend>' +
          '<div class="duration-fields">' +
            '<div class="field">' +
              '<label class="field__sublabel" for="af-hours">Hours</label>' +
              '<input class="input" id="af-hours" type="number" min="0" max="999" step="1" inputmode="numeric" placeholder="0">' +
            '</div>' +
            '<div class="field">' +
              '<label class="field__sublabel" for="af-minutes">Minutes</label>' +
              '<input class="input" id="af-minutes" type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="0">' +
            '</div>' +
          '</div>' +
          '<span class="field__hint">Optional. For example 1 hour 30 minutes.</span>' +
          '<span class="field__error" id="af-duration-error" hidden>' + icon('alert') + '<span class="field__error-text"></span></span>' +
        '</fieldset>' +
        '<div class="field">' +
          '<label class="field__label" for="af-description">Description</label>' +
          '<textarea class="textarea" id="af-description" maxlength="5000"></textarea>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="af-notes">Notes</label>' +
          '<textarea class="textarea" id="af-notes" maxlength="5000"></textarea>' +
        '</div>' +
      '</form>';

    var dialog = EF.modal.open({
      title: isEdit ? 'Edit assignment' : 'Add assignment',
      bodyHtml: bodyHtml,
      footerHtml:
        '<button type="button" class="btn btn--secondary" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn--primary" form="assignment-form">' + (isEdit ? 'Save Changes' : 'Add Assignment') + '</button>'
    });

    var form = dialog.querySelector('#assignment-form');
    var titleInput = dialog.querySelector('#af-title');
    var courseInput = dialog.querySelector('#af-course');
    var dateInput = dialog.querySelector('#af-date');
    var timeInput = dialog.querySelector('#af-time');
    var priorityInput = dialog.querySelector('#af-priority');
    var statusInput = dialog.querySelector('#af-status');
    var hoursInput = dialog.querySelector('#af-hours');
    var minutesInput = dialog.querySelector('#af-minutes');
    var descriptionInput = dialog.querySelector('#af-description');
    var notesInput = dialog.querySelector('#af-notes');

    var targetId = isEdit ? assignment.id : null;
    guardFocus(dialog, ui, function () {
      return targetId ? '[data-action="view"][data-id="' + targetId + '"]' : null;
    });

    // Starting values (set with .value, never pasted into HTML, so quotes and < are safe)
    if (isEdit) {
      titleInput.value = assignment.title;
      courseInput.value = assignment.courseId || '';
      dateInput.value = assignment.dueDate;
      timeInput.value = assignment.dueTime;
      priorityInput.value = assignment.priority;
      statusInput.value = assignment.status;
      var parts = sel.splitMinutes(assignment.estimatedMinutes);
      hoursInput.value = parts.hours;
      minutesInput.value = parts.minutes;
      descriptionInput.value = assignment.description;
      notesInput.value = assignment.notes;
    } else {
      // If the list is filtered to one active course, start with that course
      if (view.courseId !== 'all' && view.courseId !== 'none') {
        courseInput.value = view.courseId;
        if (courseInput.value !== view.courseId) {
          courseInput.value = '';
        }
      }
    }

    // ----- inline errors -----
    function errorElement(name) {
      return dialog.querySelector('#af-' + name + '-error');
    }

    function clearError(input, name) {
      var element = errorElement(name);
      element.hidden = true;
      input.removeAttribute('aria-invalid');
      var hint = input.getAttribute('data-hint');
      if (hint) {
        input.setAttribute('aria-describedby', hint);
      } else {
        input.removeAttribute('aria-describedby');
      }
    }

    function showError(input, name, message) {
      var element = errorElement(name);
      element.querySelector('.field__error-text').textContent = message;
      element.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      var hint = input.getAttribute('data-hint');
      input.setAttribute('aria-describedby', (hint ? hint + ' ' : '') + element.id);
    }

    function clearAllErrors() {
      clearError(titleInput, 'title');
      clearError(dateInput, 'date');
      clearError(timeInput, 'time');
      clearError(hoursInput, 'duration');
      clearError(minutesInput, 'duration');
    }

    titleInput.addEventListener('input', function () { clearError(titleInput, 'title'); });
    dateInput.addEventListener('input', function () { clearError(dateInput, 'date'); clearError(timeInput, 'time'); });
    timeInput.addEventListener('input', function () { clearError(timeInput, 'time'); });
    hoursInput.addEventListener('input', function () { clearError(hoursInput, 'duration'); clearError(minutesInput, 'duration'); });
    minutesInput.addEventListener('input', function () { clearError(hoursInput, 'duration'); clearError(minutesInput, 'duration'); });

    // Shows a refusal from the store next to the field it is about. Returns the field to focus.
    function showStoreError(result) {
      if (result.reason === 'title-required') {
        showError(titleInput, 'title', result.message);
        return titleInput;
      }
      if (result.reason === 'invalid-date') {
        showError(dateInput, 'date', result.message);
        return dateInput;
      }
      if (result.reason === 'invalid-time' || result.reason === 'time-without-date') {
        showError(timeInput, 'time', result.message);
        return timeInput;
      }
      if (result.reason === 'invalid-estimate') {
        showError(hoursInput, 'duration', result.message);
        return hoursInput;
      }
      EF.toast.show(result.message, 'danger');
      return null;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearAllErrors();

      var firstBad = null;
      function flag(input, name, message) {
        showError(input, name, message);
        firstBad = firstBad || input;
      }

      var title = titleInput.value.trim();
      if (title === '') {
        flag(titleInput, 'title', 'Please enter an assignment title.');
      }

      var date = dateInput.value;
      var time = timeInput.value;
      if (dateInput.validity.badInput) {
        flag(dateInput, 'date', 'Please enter a complete, valid date.');
      }
      if (timeInput.validity.badInput) {
        flag(timeInput, 'time', 'Please enter a complete, valid time.');
      } else if (time !== '' && date === '' && !dateInput.validity.badInput) {
        flag(timeInput, 'time', 'A due time needs a due date. Add a date or clear the time.');
      }

      // A number box holding something unreadable reports an empty value, so mark it explicitly
      var duration = sel.parseDuration(
        hoursInput.validity.badInput ? 'x' : hoursInput.value,
        minutesInput.validity.badInput ? 'x' : minutesInput.value
      );
      if (!duration.ok) {
        flag(duration.field === 'minutes' ? minutesInput : hoursInput, 'duration', duration.message);
      }

      if (firstBad) {
        firstBad.focus();
        return;
      }

      var values = {
        title: title,
        courseId: courseInput.value === '' ? null : courseInput.value,
        description: descriptionInput.value.trim(),
        dueDate: date,
        dueTime: time,
        priority: priorityInput.value,
        status: statusInput.value,
        estimatedMinutes: duration.value,
        notes: notesInput.value.trim()
      };

      var result = isEdit ? EF.store.updateAssignment(assignment.id, values) : EF.store.addAssignment(values);

      if (!result.ok) {
        var bad = showStoreError(result);
        if (bad) {
          bad.focus();
        }
        return;
      }

      targetId = result.item.id;
      EF.modal.close();

      if (result.unchanged) {
        EF.toast.show('No changes to save.', 'info');
        return;
      }

      // Is the saved assignment visible under the current search and filters?
      var visible = sel.filterAssignments([result.item], currentFilters()).length === 1;
      var message = isEdit ? 'Saved changes to ' + quoted(title) + '.' : quoted(title) + ' added.';
      if (!visible && !isEdit) {
        ui.resetFilters();
        message += ' Filters were cleared so you can see it.';
      } else if (!visible) {
        message += ' It is hidden by your current search or filters.';
      }
      EF.toast.show(message, 'success');
    });

    titleInput.focus();
  }

  // ---------- delete ----------

  function finishDelete(result, successMessage, errorEl) {
    if (result.ok) {
      EF.modal.close();
      EF.toast.show(successMessage, 'success', 6000);
      return;
    }
    errorEl.innerHTML = icon('alert') + '<span>' + esc(result.message) + '</span>';
    errorEl.hidden = false;
  }

  function openDeleteDialog(ui, assignment) {
    var linked = EF.store.getAssignmentUsage(assignment.id).tasks;

    // 1. No linked tasks: a plain confirmation
    if (linked === 0) {
      var confirmDialog = EF.confirm.open({
        title: 'Delete assignment?',
        bodyHtml: '<p>Delete ' + quotedHtml(assignment.title) + ' permanently? This cannot be undone.</p>',
        confirmLabel: 'Delete Assignment',
        danger: true,
        onConfirm: function () {
          var result = EF.store.deleteAssignment(assignment.id);
          if (result.ok) {
            EF.toast.show(quoted(assignment.title) + ' deleted.', 'success');
          } else {
            EF.toast.show(result.message, 'warning');
          }
        }
      });
      guardFocus(confirmDialog, ui, null);
      return;
    }

    // 2. Linked tasks exist: ask what should happen to them (the store requires a choice)
    var taskWord = plural(linked, 'task');
    var dialog = EF.modal.open({
      title: 'Delete assignment',
      bodyHtml:
        '<div class="stack">' +
          '<p>' + quotedHtml(assignment.title) + ' has <strong>' + taskWord + '</strong> linked to it. Choose what should happen to ' +
            (linked === 1 ? 'it' : 'them') + '.</p>' +
          '<fieldset class="choice-group">' +
            '<legend class="visually-hidden">What should happen to the linked tasks?</legend>' +
            '<div class="choice is-selected" data-choice="detach">' +
              '<label class="choice__label">' +
                '<input type="radio" name="task-mode" value="detach" checked>' +
                '<span><span class="choice__title">Keep the tasks ' +
                  '<span class="badge badge--success">' + icon('check-circle') + 'Recommended</span></span>' +
                  '<span class="choice__text">Only the assignment is deleted. The ' + taskWord + ' stay in your list as standalone tasks and keep this assignment’s course.</span></span>' +
              '</label>' +
            '</div>' +
            '<div class="choice choice--danger" data-choice="delete">' +
              '<label class="choice__label">' +
                '<input type="radio" name="task-mode" value="delete">' +
                '<span><span class="choice__title">Delete the tasks too ' +
                  '<span class="badge badge--danger">' + icon('alert') + 'Permanent</span></span>' +
                  '<span class="choice__text">The assignment and its ' + taskWord + ' are permanently deleted. This cannot be undone.</span></span>' +
              '</label>' +
            '</div>' +
          '</fieldset>' +
          '<p class="field__error" id="delete-error" role="alert" hidden></p>' +
        '</div>',
      footerHtml:
        '<button type="button" class="btn btn--secondary" data-modal-close>Cancel</button>' +
        '<button type="button" class="btn btn--danger" id="delete-go">Delete Assignment</button>'
    });
    guardFocus(dialog, ui, null);

    var mode = 'detach';
    var errorEl = dialog.querySelector('#delete-error');

    dialog.addEventListener('change', function (event) {
      if (event.target.name === 'task-mode') {
        mode = event.target.value;
        EF.utils.qsa('[data-choice]', dialog).forEach(function (choice) {
          choice.classList.toggle('is-selected', choice.getAttribute('data-choice') === mode);
        });
      }
    });

    dialog.querySelector('#delete-go').addEventListener('click', function () {
      var result = EF.store.deleteAssignment(assignment.id, { linkedTasks: mode });
      var message = mode === 'delete'
        ? quoted(assignment.title) + ' and its ' + taskWord + (linked === 1 ? ' was' : ' were') + ' deleted.'
        : quoted(assignment.title) + ' deleted. Its ' + taskWord + (linked === 1 ? ' was' : ' were') + ' kept.';
      finishDelete(result, message, errorEl);
    });
  }

  // ---------- the screen ----------

  function render(page) {
    page.innerHTML =
      '<div class="page-header">' +
        '<p class="page-header__text">Every assignment in one place, with deadlines, priorities and status.</p>' +
        '<button type="button" class="btn btn--primary page-header__action" id="assignments-add" data-action="add">' +
          icon('plus') + 'Add Assignment</button>' +
      '</div>' +

      '<div class="assignments-toolbar" id="assignments-toolbar" hidden>' +
        '<div class="search-field">' +
          '<span class="search-field__icon" aria-hidden="true">' + icon('search') + '</span>' +
          '<label class="visually-hidden" for="assignments-search">Search assignments by title</label>' +
          '<input class="input search-field__input" id="assignments-search" type="search" ' +
            'placeholder="Search by title" autocomplete="off">' +
        '</div>' +
        '<div class="filter-grid">' +
          '<div class="field"><label class="field__label" for="filter-course">Course</label>' +
            '<select class="select" id="filter-course" data-filter="courseId"></select></div>' +
          '<div class="field"><label class="field__label" for="filter-status">Status</label>' +
            '<select class="select" id="filter-status" data-filter="status">' + optionsHtml(statusOptions('All statuses'), view.status) + '</select></div>' +
          '<div class="field"><label class="field__label" for="filter-priority">Priority</label>' +
            '<select class="select" id="filter-priority" data-filter="priority">' + optionsHtml(priorityOptions('All priorities'), view.priority) + '</select></div>' +
          '<div class="field"><label class="field__label" for="filter-deadline">Deadline</label>' +
            '<select class="select" id="filter-deadline" data-filter="deadline">' + optionsHtml(sel.DEADLINE_OPTIONS, view.deadline) + '</select></div>' +
          '<div class="field"><label class="field__label" for="filter-sort">Sort by</label>' +
            '<select class="select" id="filter-sort" data-filter="sort">' + optionsHtml(sel.SORT_OPTIONS, view.sort) + '</select></div>' +
        '</div>' +
        '<div><button type="button" class="btn btn--secondary btn--sm" id="assignments-clear" data-action="clear-filters" hidden>' +
          icon('x') + 'Clear filters</button></div>' +
      '</div>' +

      '<p class="assignments-status" id="assignments-status" aria-live="polite"></p>' +
      '<div id="assignments-list"></div>';

    var addButton = page.querySelector('#assignments-add');
    var toolbar = page.querySelector('#assignments-toolbar');
    var searchInput = page.querySelector('#assignments-search');
    var courseFilter = page.querySelector('#filter-course');
    var clearButton = page.querySelector('#assignments-clear');
    var statusEl = page.querySelector('#assignments-status');
    var listEl = page.querySelector('#assignments-list');
    var lastCourseOptions = null;

    var ui = { page: page, resetFilters: resetFilters };

    // Show everything again (keeps the chosen sort order)
    function resetFilters() {
      view.query = '';
      view.courseId = 'all';
      view.status = 'all';
      view.priority = 'all';
      view.deadline = 'all';
      searchInput.value = '';
      ['status', 'priority', 'deadline'].forEach(function (key) {
        page.querySelector('#filter-' + key).value = 'all';
      });
      refresh();
    }

    // The course filter lists every course, so it is rebuilt only when the courses change
    function syncCourseFilter(courses, map) {
      if (view.courseId !== 'all' && view.courseId !== 'none' && !map[view.courseId]) {
        view.courseId = 'all'; // the filtered course was deleted
      }
      var active = courses.filter(function (course) { return !course.archived; }).sort(compareByName);
      var archived = courses.filter(function (course) { return course.archived; }).sort(compareByName);
      var options = [{ value: 'all', label: 'All courses' }, { value: 'none', label: 'No course' }]
        .concat(active.map(function (course) { return { value: course.id, label: course.name }; }))
        .concat(archived.map(function (course) { return { value: course.id, label: course.name + ' (Archived)' }; }));
      var signature = JSON.stringify(options);
      if (signature !== lastCourseOptions) {
        courseFilter.innerHTML = optionsHtml(options, view.courseId);
        lastCourseOptions = signature;
      }
      courseFilter.value = view.courseId;
    }

    // Reads the store and draws. Called on first show and on every relevant change.
    function refresh() {
      var state = EF.store.getState();
      var map = courseMap();
      syncCourseFilter(state.courses, map);

      var total = state.assignments.length;
      toolbar.hidden = total === 0;
      addButton.hidden = total === 0; // with nothing yet, the empty state carries the Add button
      clearButton.hidden = !sel.hasActiveFilters(currentFilters());

      var now = new Date();
      var shown = sel.sortAssignments(sel.filterAssignments(state.assignments, currentFilters(), now), view.sort);

      statusEl.textContent = total === 0 ? '' : 'Showing ' + shown.length + ' of ' + plural(total, 'assignment') + '.';
      listEl.innerHTML = listHtml(total, shown, map, now);
    }

    searchInput.value = view.query;
    searchInput.addEventListener('input', function () {
      view.query = searchInput.value;
      refresh();
    });

    page.addEventListener('change', function (event) {
      var key = event.target.getAttribute('data-filter');
      if (key) {
        view[key] = event.target.value;
        refresh();
      }
    });

    // ONE click listener for the whole screen (event delegation)
    page.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) {
        return;
      }
      var action = target.getAttribute('data-action');

      if (action === 'add') {
        openForm(ui, null);
        return;
      }
      if (action === 'clear-filters') {
        resetFilters();
        searchInput.focus();
        return;
      }

      var assignment = EF.store.getAssignment(target.getAttribute('data-id'));
      if (!assignment) {
        EF.toast.show('That assignment no longer exists.', 'warning');
        return;
      }
      if (action === 'view') {
        openDetails(ui, assignment);
      } else if (action === 'edit') {
        openForm(ui, assignment);
      } else if (action === 'delete') {
        openDeleteDialog(ui, assignment);
      }
    });

    // Store -> screen. The router throws this page away when you leave,
    // so we stop listening once it is no longer on screen.
    var stop = EF.store.subscribe(function (state, change) {
      if (!page.isConnected) {
        stop();
        return;
      }
            if (change.changed.indexOf('assignments') !== -1 || change.changed.indexOf('courses') !== -1 ||
          change.changed.indexOf('tasks') !== -1) {
        refresh();
      }
    });

    // Deadline labels depend on today's date, so redraw when the tab is shown again
    function onVisible() {
      if (!page.isConnected) {
        document.removeEventListener('visibilitychange', onVisible);
        return;
      }
      if (document.visibilityState === 'visible') {
        refresh();
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    refresh();
  }

  // Replaces the placeholder (this file loads AFTER placeholders.js)
  EF.router.register('assignments', {
    title: 'Assignments',
    render: render
  });

  // ---------- used by the Dashboard (same form, same dialogs, same filter state) ----------

  function resetViewFilters() {
    view.query = '';
    view.courseId = 'all';
    view.status = 'all';
    view.priority = 'all';
    view.deadline = 'all';
  }

  // The dashboard has no filter boxes, so "reset filters" only clears the saved screen settings
  function externalUi(ui) {
    return { page: ui.page, resetFilters: resetViewFilters };
  }

  EF.assignmentsUi = {
    openForm: function (ui) {
      openForm(externalUi(ui), null);
    },
    openDetails: function (ui, assignmentId) {
      var assignment = EF.store.getAssignment(assignmentId);
      if (assignment) {
        openDetails(externalUi(ui), assignment);
      }
    },
    // Opens the Assignments screen with these filters (anything not given is cleared)
    showFilter: function (filters) {
      resetViewFilters();
      Object.assign(view, filters || {});
      window.location.hash = '#/assignments';
    }
  };
})();