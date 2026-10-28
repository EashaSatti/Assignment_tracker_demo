/* =========================================================
   TASKS SCREEN
   - Reads tasks, assignments and courses ONLY from EF.store.
   - All changes go through store actions (addTask, updateTask, deleteTask).
   - A task linked to an assignment has no course of its own: it follows
     the assignment's course. A task with no assignment may have its own course.
   - Search, filters, sorting and progress come from EF.taskSelectors
     and EF.assignmentSelectors (pure helpers).
   - EF.tasksUi lets the Assignments screen open the same task form.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var esc = EF.utils.escapeHtml;
  var icon = EF.icons.get;
  var asel = EF.assignmentSelectors;
  var tsel = EF.taskSelectors;

  // Screen settings (NOT data). They last until the page is refreshed.
  var view = { query: '', status: 'all', courseId: 'all', assignmentId: 'all', priority: 'all', deadline: 'all', sort: 'due' };

  var PRIORITY_ORDER = ['low', 'medium', 'high'];

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

  function compareByTitle(a, b) {
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  }

  function currentFilters() {
    return {
      query: view.query, status: view.status, courseId: view.courseId,
      assignmentId: view.assignmentId, priority: view.priority, deadline: view.deadline
    };
  }

  function optionsHtml(list, selected) {
    return list.map(function (item) {
      return '<option value="' + esc(item.value) + '"' + (item.value === selected ? ' selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');
  }

  function statusOptions(allLabel) {
    var list = [{ value: 'todo', label: tsel.statusLabel('todo') }, { value: 'done', label: tsel.statusLabel('done') }];
    return allLabel ? [{ value: 'all', label: allLabel }].concat(list) : list;
  }

  function priorityOptions(allLabel) {
    var list = PRIORITY_ORDER.map(function (priority) {
      return { value: priority, label: asel.priorityLabel(priority) };
    });
    return allLabel ? [{ value: 'all', label: allLabel }].concat(list) : list;
  }

  // The assignment's course (or the task's own course), looked up fresh from the store
  function courseOfTask(task) {
    var courseId = task.assignmentId !== null
      ? (EF.store.getAssignment(task.assignmentId) || {}).courseId
      : task.courseId;
    return courseId ? EF.store.getCourse(courseId) : null;
  }

  // After a dialog closes, focus normally returns to the button that opened it.
  // If the list was redrawn meanwhile, that button is gone, so we pick a sensible place.
  function guardFocus(dialog, page, getSelector) {
    if (!page) {
      return;
    }
    dialog.addEventListener('close', function () {
      var active = document.activeElement;
      if (active && active !== document.body && active.isConnected) {
        return;
      }
      var wanted = typeof getSelector === 'function' ? getSelector() : null;
      var candidates = [wanted, '#tasks-search', '#tasks-add', '[data-action="add"]'];
      for (var i = 0; i < candidates.length; i += 1) {
        var element = candidates[i] ? page.querySelector(candidates[i]) : null;
        if (element && !element.hidden && !element.closest('[hidden]')) {
          element.focus();
          return;
        }
      }
    });
  }

  function closeThen(dialog, next) {
    dialog.addEventListener('close', function () {
      next();
    }, { once: true });
    EF.modal.close();
  }

  // ---------- HTML builders ----------

  function statusBadge(status) {
    return status === 'done'
      ? '<span class="badge badge--completed">' + icon('check-circle') + 'Done</span>'
      : '<span class="badge badge--not-started">' + icon('circle') + 'To Do</span>';
  }

  function priorityBadge(priority) {
    return '<span class="badge badge--priority-' + esc(priority) + '">' + icon('flag') +
      esc(asel.priorityLabel(priority)) + ' priority</span>';
  }

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

  function dueTextOf(task) {
    return task.dueDate ? asel.formatDueDate(task.dueDate) : 'No due date';
  }

  function cardHtml(task, assignments, now) {
    var assignment = task.assignmentId !== null ? assignments[task.assignmentId] || null : null;
    var courseId = tsel.effectiveCourseId(task, assignments);
    var course = courseId ? EF.store.getCourse(courseId) : null;
    var info = tsel.getDeadlineInfo(task, now);
    var id = esc(task.id);
    var title = esc(task.title);
    var done = tsel.isDone(task);

    var meta =
      '<li>' + courseTagHtml(course) + '</li>' +
      (assignment
        ? '<li>' + icon('assignments') + '<span><span class="visually-hidden">Assignment: </span>' + esc(assignment.title) + '</span></li>'
        : '<li class="task-card__standalone">' + icon('assignments') + '<span>No assignment</span></li>') +
      '<li>' + icon('calendar') + '<span><span class="visually-hidden">Due: </span>' + esc(dueTextOf(task)) + '</span></li>';
    if (task.estimatedMinutes !== null) {
      meta += '<li>' + icon('clock') + '<span><span class="visually-hidden">Estimated time: </span>' +
        esc(asel.formatDuration(task.estimatedMinutes)) + '</span></li>';
    }

    return '<article class="card card--course assignment-card task-card' + (done ? ' task-card--done' : '') + '"' +
        (course ? ' style="--course-color: ' + esc(course.color) + '"' : '') + '>' +
      '<div class="assignment-card__header">' +
        '<div class="task-card__lead">' +
          '<input type="checkbox" class="task-check" data-action="toggle" data-id="' + id + '"' + (done ? ' checked' : '') +
            ' aria-label="' + (done ? 'Reopen ' : 'Mark as done: ') + title + '">' +
          '<h2 class="assignment-card__title task-card__title">' +
            '<button type="button" class="link-btn" data-action="view" data-id="' + id + '">' + title + '</button>' +
          '</h2>' +
        '</div>' +
        '<div class="assignment-card__badges">' + deadlineBadge(info) + statusBadge(task.status) + '</div>' +
      '</div>' +
      '<ul class="assignment-card__meta">' + meta + '<li>' + priorityBadge(task.priority) + '</li></ul>' +
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

  function emptyStateHtml(iconName, title, text, buttonsHtml, compact) {
    return '<div class="empty card' + (compact ? ' empty--compact' : '') + '">' +
      '<div class="empty__icon">' + icon(iconName) + '</div>' +
      '<h2 class="empty__title">' + esc(title) + '</h2>' +
      '<p class="empty__text">' + text + '</p>' +
      (buttonsHtml ? '<div class="cluster empty__actions">' + buttonsHtml + '</div>' : '') +
    '</div>';
  }

  function listHtml(total, shown, assignments, now) {
    if (total === 0) {
      return emptyStateHtml('tasks', 'No tasks yet',
        'Break an assignment into small steps, or keep general study tasks. Tick a task when it is done.',
        '<button type="button" class="btn btn--primary" data-action="add">' + icon('plus') + 'Add Task</button>', false);
    }
    if (shown.length === 0) {
      return emptyStateHtml('search', 'No matching tasks',
        'Nothing matches your current search and filters. Try changing them, or clear them to see everything.',
        '<button type="button" class="btn btn--secondary" data-action="clear-filters">Clear filters</button>', true);
    }
    return '<div class="assignment-list">' + shown.map(function (task) {
      return cardHtml(task, assignments, now);
    }).join('') + '</div>';
  }

  // ---------- details (read-only) ----------

  function detailRow(label, valueHtml) {
    return '<div class="detail-list__row"><dt>' + esc(label) + '</dt><dd>' + valueHtml + '</dd></div>';
  }

  function openDetails(page, task) {
    var assignment = task.assignmentId !== null ? EF.store.getAssignment(task.assignmentId) : null;
    var course = courseOfTask(task);
    var info = tsel.getDeadlineInfo(task);

    var rows =
      detailRow('Assignment', assignment ? esc(assignment.title) : 'None (standalone task)') +
      detailRow('Course', courseTagHtml(course) + (assignment ? ' <span class="course-tag__note">from the assignment</span>' : '')) +
      detailRow('Due', esc(dueTextOf(task)) + (info.label ? ' ' + deadlineBadge(info) : '')) +
      detailRow('Status', statusBadge(task.status)) +
      detailRow('Priority', priorityBadge(task.priority)) +
      detailRow('Estimated time', task.estimatedMinutes !== null ? esc(asel.formatDuration(task.estimatedMinutes)) : 'Not set') +
      (task.completedAt ? detailRow('Completed on', esc(asel.formatDateTime(task.completedAt))) : '') +
      detailRow('Created', esc(asel.formatDateTime(task.createdAt))) +
      detailRow('Last updated', esc(asel.formatDateTime(task.updatedAt)));

    var dialog = EF.modal.open({
      title: 'Task details',
      bodyHtml:
        '<div class="stack">' +
          '<h3 class="detail-title">' + esc(task.title) + '</h3>' +
          '<dl class="detail-list">' + rows + '</dl>' +
          '<section class="detail-section"><h4 class="detail-heading">Notes</h4>' +
            (task.notes ? '<p class="detail-text">' + esc(task.notes) + '</p>' : '<p class="detail-text detail-text--empty">None</p>') +
          '</section>' +
        '</div>',
      footerHtml:
        '<button type="button" class="btn btn--ghost btn--ghost-danger" id="detail-delete">' + icon('trash') + 'Delete</button>' +
        '<button type="button" class="btn btn--secondary" data-modal-close>Close</button>' +
        '<button type="button" class="btn btn--primary" id="detail-edit">' + icon('edit') + 'Edit</button>'
    });

    guardFocus(dialog, page, function () {
      return '[data-action="view"][data-id="' + task.id + '"]';
    });

    dialog.querySelector('#detail-edit').addEventListener('click', function () {
      closeThen(dialog, function () {
        var latest = EF.store.getTask(task.id);
        if (latest) {
          openForm({ page: page, task: latest });
        }
      });
    });
    dialog.querySelector('#detail-delete').addEventListener('click', function () {
      closeThen(dialog, function () {
        var latest = EF.store.getTask(task.id);
        if (latest) {
          openDeleteDialog(page, latest);
        }
      });
    });
  }

  // ---------- add / edit form ----------

  // options: { page, task (edit), assignmentId (preset for a new task),
  //            courseId (preset for a new task), onClosed (runs after the dialog closes) }
  function openForm(options) {
    var opts = options || {};
    var page = opts.page || null;
    var task = opts.task || null;
    var isEdit = !!task;

    var state = EF.store.getState();
    var assignmentsById = tsel.mapById(state.assignments);
    var startAssignmentId = isEdit ? task.assignmentId : (opts.assignmentId && assignmentsById[opts.assignmentId] ? opts.assignmentId : null);
    var startCourseId = isEdit ? task.courseId : (opts.courseId || null);

    // Course choices: No course, every active course, plus an archived course this task already uses
    var courseList = state.courses.filter(function (course) {
      return !course.archived || course.id === startCourseId;
    }).sort(compareByName);
    var courseOptionsHtml = '<option value="">No course</option>' + courseList.map(function (course) {
      return '<option value="' + esc(course.id) + '">' + esc(course.name) + (course.archived ? ' (Archived)' : '') + '</option>';
    }).join('');

    // Assignment choices: None, then every assignment A to Z (with its course for context)
    var assignmentOptionsHtml = '<option value="">None (standalone task)</option>' +
      state.assignments.slice().sort(compareByTitle).map(function (assignment) {
        var course = assignment.courseId ? EF.store.getCourse(assignment.courseId) : null;
        var note = (course ? ' · ' + course.name : '') +
          (EF.schema.isAssignmentFinished(assignment.status) ? ' · ' + asel.statusLabel(assignment.status) : '');
        return '<option value="' + esc(assignment.id) + '">' + esc(assignment.title + note) + '</option>';
      }).join('');

    var bodyHtml =
      '<form id="task-form" class="stack" novalidate>' +
        '<div class="field">' +
          '<label class="field__label" for="tf-title">Title <span class="field__required">(required)</span></label>' +
          '<input class="input" id="tf-title" type="text" maxlength="200" autocomplete="off" aria-required="true">' +
          '<span class="field__error" id="tf-title-error" hidden>' + icon('alert') + '<span class="field__error-text"></span></span>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="tf-assignment">Assignment</label>' +
          '<select class="select" id="tf-assignment" aria-describedby="tf-assignment-hint">' + assignmentOptionsHtml + '</select>' +
          '<span class="field__hint" id="tf-assignment-hint">Optional. A task linked to an assignment counts towards its progress.</span>' +
        '</div>' +
        '<div class="field" id="tf-course-field">' +
          '<label class="field__label" for="tf-course">Course</label>' +
          '<select class="select" id="tf-course">' + courseOptionsHtml + '</select>' +
        '</div>' +
        '<div class="field" id="tf-course-derived" hidden>' +
          '<span class="field__label">Course</span>' +
          '<p class="field__static" id="tf-course-derived-text"></p>' +
          '<span class="field__hint">Taken from the assignment, so they always match.</span>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field">' +
            '<label class="field__label" for="tf-date">Due date</label>' +
            '<input class="input" id="tf-date" type="date">' +
            '<span class="field__error" id="tf-date-error" hidden>' + icon('alert') + '<span class="field__error-text"></span></span>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="tf-priority">Priority</label>' +
            '<select class="select" id="tf-priority">' + optionsHtml(priorityOptions(''), 'medium') + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="tf-status">Status</label>' +
          '<select class="select" id="tf-status">' + optionsHtml(statusOptions(''), 'todo') + '</select>' +
        '</div>' +
        '<fieldset class="field">' +
          '<legend class="field__label">Estimated time</legend>' +
          '<div class="duration-fields">' +
            '<div class="field">' +
              '<label class="field__sublabel" for="tf-hours">Hours</label>' +
              '<input class="input" id="tf-hours" type="number" min="0" max="999" step="1" inputmode="numeric" placeholder="0">' +
            '</div>' +
            '<div class="field">' +
              '<label class="field__sublabel" for="tf-minutes">Minutes</label>' +
              '<input class="input" id="tf-minutes" type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="0">' +
            '</div>' +
          '</div>' +
          '<span class="field__hint">Optional. For example 45 minutes.</span>' +
          '<span class="field__error" id="tf-duration-error" hidden>' + icon('alert') + '<span class="field__error-text"></span></span>' +
        '</fieldset>' +
        '<div class="field">' +
          '<label class="field__label" for="tf-notes">Notes</label>' +
          '<textarea class="textarea" id="tf-notes" maxlength="5000"></textarea>' +
        '</div>' +
      '</form>';

    var dialog = EF.modal.open({
      title: isEdit ? 'Edit task' : 'Add task',
      bodyHtml: bodyHtml,
      footerHtml:
        '<button type="button" class="btn btn--secondary" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn--primary" form="task-form">' + (isEdit ? 'Save Changes' : 'Add Task') + '</button>'
    });

    var form = dialog.querySelector('#task-form');
    var titleInput = dialog.querySelector('#tf-title');
    var assignmentInput = dialog.querySelector('#tf-assignment');
    var courseInput = dialog.querySelector('#tf-course');
    var courseField = dialog.querySelector('#tf-course-field');
    var derivedField = dialog.querySelector('#tf-course-derived');
    var derivedText = dialog.querySelector('#tf-course-derived-text');
    var dateInput = dialog.querySelector('#tf-date');
    var priorityInput = dialog.querySelector('#tf-priority');
    var statusInput = dialog.querySelector('#tf-status');
    var hoursInput = dialog.querySelector('#tf-hours');
    var minutesInput = dialog.querySelector('#tf-minutes');
    var notesInput = dialog.querySelector('#tf-notes');

    var targetId = isEdit ? task.id : null;
    guardFocus(dialog, page, function () {
      return targetId ? '[data-action="view"][data-id="' + targetId + '"]' : null;
    });
    if (typeof opts.onClosed === 'function') {
      dialog.addEventListener('close', function () {
        opts.onClosed();
      }, { once: true });
    }

    // Starting values (set with .value, never pasted into HTML, so quotes and < are safe)
    assignmentInput.value = startAssignmentId || '';
    courseInput.value = startCourseId || '';
    if (courseInput.value !== (startCourseId || '')) {
      courseInput.value = '';
    }
    if (isEdit) {
      titleInput.value = task.title;
      dateInput.value = task.dueDate;
      priorityInput.value = task.priority;
      statusInput.value = task.status;
      var parts = asel.splitMinutes(task.estimatedMinutes);
      hoursInput.value = parts.hours;
      minutesInput.value = parts.minutes;
      notesInput.value = task.notes;
    }

    // Linked task: the course comes from the assignment, so show it as text instead of a choice.
    // Un-linking offers the course the task had through its assignment.
    var lastAssignmentCourseId = null;
    function syncCourseField() {
      var assignment = assignmentInput.value ? assignmentsById[assignmentInput.value] : null;
      if (assignment) {
        lastAssignmentCourseId = assignment.courseId;
        var course = assignment.courseId ? EF.store.getCourse(assignment.courseId) : null;
        derivedText.textContent = course ? course.name + (course.archived ? ' (Archived)' : '') : 'No course';
        courseField.hidden = true;
        derivedField.hidden = false;
      } else {
        // Never overwrite a course the user already chose
        if (lastAssignmentCourseId !== null && courseInput.value === '') {
          courseInput.value = lastAssignmentCourseId;
          if (courseInput.value !== lastAssignmentCourseId) {
            courseInput.value = '';
          }
        }
        lastAssignmentCourseId = null;
        courseField.hidden = false;
        derivedField.hidden = true;
      }
    }
    assignmentInput.addEventListener('change', syncCourseField);
    syncCourseField();

    // ----- inline errors -----
    function errorElement(name) {
      return dialog.querySelector('#tf-' + name + '-error');
    }

    function clearError(input, name) {
      errorElement(name).hidden = true;
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }

    function showError(input, name, message) {
      var element = errorElement(name);
      element.querySelector('.field__error-text').textContent = message;
      element.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', element.id);
    }

    function clearAllErrors() {
      clearError(titleInput, 'title');
      clearError(dateInput, 'date');
      clearError(hoursInput, 'duration');
      clearError(minutesInput, 'duration');
    }

    titleInput.addEventListener('input', function () { clearError(titleInput, 'title'); });
    dateInput.addEventListener('input', function () { clearError(dateInput, 'date'); });
    hoursInput.addEventListener('input', function () { clearError(hoursInput, 'duration'); clearError(minutesInput, 'duration'); });
    minutesInput.addEventListener('input', function () { clearError(hoursInput, 'duration'); clearError(minutesInput, 'duration'); });

    // Shows a refusal from the store next to its field. Returns the field to focus.
    function showStoreError(result) {
      if (result.reason === 'title-required') {
        showError(titleInput, 'title', result.message);
        return titleInput;
      }
      if (result.reason === 'invalid-date') {
        showError(dateInput, 'date', result.message);
        return dateInput;
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
        flag(titleInput, 'title', 'Please enter a task title.');
      }
      if (dateInput.validity.badInput) {
        flag(dateInput, 'date', 'Please enter a complete, valid date.');
      }
      // A number box holding something unreadable reports an empty value, so mark it explicitly
      var duration = asel.parseDuration(
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

      var linkedTo = assignmentInput.value === '' ? null : assignmentInput.value;
      var values = {
        title: title,
        assignmentId: linkedTo,
        // A linked task takes its course from the assignment; the store keeps it empty
        courseId: linkedTo !== null || courseInput.value === '' ? null : courseInput.value,
        dueDate: dateInput.value,
        priority: priorityInput.value,
        status: statusInput.value,
        estimatedMinutes: duration.value,
        notes: notesInput.value.trim()
      };

      var result = isEdit ? EF.store.updateTask(task.id, values) : EF.store.addTask(values);

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

      var message = isEdit ? 'Saved changes to ' + quoted(title) + '.' : quoted(title) + ' added.';
      if (result.assignmentStarted) {
        message += ' Its assignment was moved to In Progress.';
      }
      if (page && opts.resetFilters) {
        var visible = tsel.filterTasks([result.item], currentFilters(), EF.store.getState().assignments).length === 1;
        if (!visible && !isEdit) {
          opts.resetFilters();
          message += ' Filters were cleared so you can see it.';
        } else if (!visible) {
          message += ' It is hidden by your current search or filters.';
        }
      }
      EF.toast.show(message, 'success');
    });

    titleInput.focus();
  }

  // ---------- complete / reopen ----------

  function toggleTask(task) {
    var nextStatus = tsel.isDone(task) ? 'todo' : 'done';
    var result = EF.store.updateTask(task.id, { status: nextStatus });
    if (!result.ok) {
      EF.toast.show(result.message, 'warning');
      return result;
    }
    var message = nextStatus === 'done' ? quoted(task.title) + ' marked done.' : quoted(task.title) + ' reopened.';
    if (result.assignmentStarted) {
      message += ' Its assignment was moved to In Progress.';
    }
    EF.toast.show(message, 'success');
    return result;
  }

  // ---------- delete ----------

  function openDeleteDialog(page, task) {
    var dialog = EF.confirm.open({
      title: 'Delete task?',
      bodyHtml: '<p>Delete ' + quotedHtml(task.title) + ' permanently? This cannot be undone.' +
        (task.assignmentId !== null ? ' The assignment’s progress will be recalculated.' : '') + '</p>',
      confirmLabel: 'Delete Task',
      danger: true,
      onConfirm: function () {
        var result = EF.store.deleteTask(task.id);
        if (result.ok) {
          EF.toast.show(quoted(task.title) + ' deleted.', 'success');
        } else {
          EF.toast.show(result.message, 'warning');
        }
      }
    });
    guardFocus(dialog, page, null);
  }

  // ---------- the screen ----------

  function render(page) {
    page.innerHTML =
      '<div class="page-header">' +
        '<p class="page-header__text">Break assignments into small steps, or keep general study tasks.</p>' +
        '<button type="button" class="btn btn--primary page-header__action" id="tasks-add" data-action="add">' +
          icon('plus') + 'Add Task</button>' +
      '</div>' +

      '<div class="assignments-toolbar" id="tasks-toolbar" hidden>' +
        '<div class="search-field">' +
          '<span class="search-field__icon" aria-hidden="true">' + icon('search') + '</span>' +
          '<label class="visually-hidden" for="tasks-search">Search tasks by title</label>' +
          '<input class="input search-field__input" id="tasks-search" type="search" placeholder="Search by title" autocomplete="off">' +
        '</div>' +
        '<div class="filter-grid filter-grid--tasks">' +
          '<div class="field"><label class="field__label" for="tfilter-status">Status</label>' +
            '<select class="select" id="tfilter-status" data-filter="status">' + optionsHtml(statusOptions('All statuses'), view.status) + '</select></div>' +
          '<div class="field"><label class="field__label" for="tfilter-course">Course</label>' +
            '<select class="select" id="tfilter-course" data-filter="courseId"></select></div>' +
          '<div class="field"><label class="field__label" for="tfilter-assignment">Assignment</label>' +
            '<select class="select" id="tfilter-assignment" data-filter="assignmentId"></select></div>' +
          '<div class="field"><label class="field__label" for="tfilter-priority">Priority</label>' +
            '<select class="select" id="tfilter-priority" data-filter="priority">' + optionsHtml(priorityOptions('All priorities'), view.priority) + '</select></div>' +
          '<div class="field"><label class="field__label" for="tfilter-deadline">Deadline</label>' +
            '<select class="select" id="tfilter-deadline" data-filter="deadline">' + optionsHtml(asel.DEADLINE_OPTIONS, view.deadline) + '</select></div>' +
          '<div class="field"><label class="field__label" for="tfilter-sort">Sort by</label>' +
            '<select class="select" id="tfilter-sort" data-filter="sort">' + optionsHtml(tsel.SORT_OPTIONS, view.sort) + '</select></div>' +
        '</div>' +
        '<div><button type="button" class="btn btn--secondary btn--sm" id="tasks-clear" data-action="clear-filters" hidden>' +
          icon('x') + 'Clear filters</button></div>' +
      '</div>' +

      '<p class="assignments-status" id="tasks-status" aria-live="polite"></p>' +
      '<div id="tasks-list"></div>';

    var addButton = page.querySelector('#tasks-add');
    var toolbar = page.querySelector('#tasks-toolbar');
    var searchInput = page.querySelector('#tasks-search');
    var courseFilter = page.querySelector('#tfilter-course');
    var assignmentFilter = page.querySelector('#tfilter-assignment');
    var clearButton = page.querySelector('#tasks-clear');
    var statusEl = page.querySelector('#tasks-status');
    var listEl = page.querySelector('#tasks-list');
    var lastCourseOptions = null;
    var lastAssignmentOptions = null;

    // Show everything again (keeps the chosen sort order)
    function resetFilters() {
      view.query = '';
      view.status = 'all';
      view.courseId = 'all';
      view.assignmentId = 'all';
      view.priority = 'all';
      view.deadline = 'all';
      searchInput.value = '';
      ['status', 'priority', 'deadline'].forEach(function (key) {
        page.querySelector('#tfilter-' + key).value = 'all';
      });
      refresh();
    }

    // The course and assignment filters list real items, so they are rebuilt only when those change
    function syncFilterLists(state) {
      var courseIds = tsel.mapById(state.courses);
      var assignmentIds = tsel.mapById(state.assignments);
      if (view.courseId !== 'all' && view.courseId !== 'none' && !courseIds[view.courseId]) {
        view.courseId = 'all'; // that course was deleted
      }
      if (view.assignmentId !== 'all' && view.assignmentId !== 'none' && !assignmentIds[view.assignmentId]) {
        view.assignmentId = 'all'; // that assignment was deleted
      }

      var active = state.courses.filter(function (course) { return !course.archived; }).sort(compareByName);
      var archived = state.courses.filter(function (course) { return course.archived; }).sort(compareByName);
      var courseOptions = [{ value: 'all', label: 'All courses' }, { value: 'none', label: 'No course' }]
        .concat(active.map(function (course) { return { value: course.id, label: course.name }; }))
        .concat(archived.map(function (course) { return { value: course.id, label: course.name + ' (Archived)' }; }));
      var courseSignature = JSON.stringify(courseOptions);
      if (courseSignature !== lastCourseOptions) {
        courseFilter.innerHTML = optionsHtml(courseOptions, view.courseId);
        lastCourseOptions = courseSignature;
      }
      courseFilter.value = view.courseId;

      var assignmentOptions = [{ value: 'all', label: 'All assignments' }, { value: 'none', label: 'No assignment' }]
        .concat(state.assignments.slice().sort(compareByTitle).map(function (assignment) {
          return { value: assignment.id, label: assignment.title };
        }));
      var assignmentSignature = JSON.stringify(assignmentOptions);
      if (assignmentSignature !== lastAssignmentOptions) {
        assignmentFilter.innerHTML = optionsHtml(assignmentOptions, view.assignmentId);
        lastAssignmentOptions = assignmentSignature;
      }
      assignmentFilter.value = view.assignmentId;
    }

    // Reads the store and draws. Called on first show and on every relevant change.
    function refresh() {
      var state = EF.store.getState();
      syncFilterLists(state);

      var total = state.tasks.length;
      toolbar.hidden = total === 0;
      addButton.hidden = total === 0; // with nothing yet, the empty state carries the Add button
      clearButton.hidden = !tsel.hasActiveFilters(currentFilters());

      var now = new Date();
      var shown = tsel.sortTasks(tsel.filterTasks(state.tasks, currentFilters(), state.assignments, now), view.sort);

      statusEl.textContent = total === 0 ? '' : 'Showing ' + shown.length + ' of ' + plural(total, 'task') + '.';
      listEl.innerHTML = listHtml(total, shown, tsel.mapById(state.assignments), now);
    }

    var formDefaults = function () {
      var preset = {};
      if (view.assignmentId !== 'all' && view.assignmentId !== 'none') {
        preset.assignmentId = view.assignmentId;
      } else if (view.courseId !== 'all' && view.courseId !== 'none') {
        var course = EF.store.getCourse(view.courseId);
        if (course && !course.archived) {
          preset.courseId = course.id;
        }
      }
      return preset;
    };

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
        var preset = formDefaults();
        openForm({ page: page, assignmentId: preset.assignmentId, courseId: preset.courseId, resetFilters: resetFilters });
        return;
      }
      if (action === 'clear-filters') {
        resetFilters();
        searchInput.focus();
        return;
      }

      var id = target.getAttribute('data-id');
      var task = EF.store.getTask(id);
      if (!task) {
        EF.toast.show('That task no longer exists.', 'warning');
        return;
      }
      if (action === 'toggle') {
        toggleTask(task);
        // The list was redrawn, so put keyboard focus back on the same task's checkbox if it is still shown
        var again = page.querySelector('input[data-action="toggle"][data-id="' + id + '"]');
        if (again) {
          again.focus();
        } else {
          statusEl.setAttribute('tabindex', '-1');
          statusEl.focus();
        }
      } else if (action === 'view') {
        openDetails(page, task);
      } else if (action === 'edit') {
        openForm({ page: page, task: task, resetFilters: resetFilters });
      } else if (action === 'delete') {
        openDeleteDialog(page, task);
      }
    });

    // Store -> screen. The router throws this page away when you leave,
    // so we stop listening once it is no longer on screen.
    var stop = EF.store.subscribe(function (state, change) {
      if (!page.isConnected) {
        stop();
        return;
      }
      var changed = change.changed;
      if (changed.indexOf('tasks') !== -1 || changed.indexOf('assignments') !== -1 || changed.indexOf('courses') !== -1) {
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

  EF.router.register('tasks', {
    title: 'Tasks',
    render: render
  });

  // Used by the Assignments screen
  EF.tasksUi = {
    // Opens the Add Task form (optionally linked to an assignment). `onClosed` runs after the dialog closes.
    openForm: function (options) {
      openForm(options || {});
    },
        // Opens the read-only details dialog for one task
    openDetails: function (page, taskId) {
      var task = EF.store.getTask(taskId);
      if (task) {
        openDetails(page, task);
      }
    },
    // Ticks or un-ticks a task: the same rule and toast as the Tasks screen
    toggle: function (taskId) {
      var task = EF.store.getTask(taskId);
      if (task) {
        toggleTask(task);
      }
    },
    // Opens the Tasks screen with these filters (anything not given is cleared)
    showFilter: function (filters) {
      view.query = '';
      view.status = 'all';
      view.courseId = 'all';
      view.assignmentId = 'all';
      view.priority = 'all';
      view.deadline = 'all';
      Object.assign(view, filters || {});
      window.location.hash = '#/tasks';
    },
    // Shows the Tasks screen filtered to one assignment
    showAssignment: function (assignmentId) {
      view.query = '';
      view.status = 'all';
      view.courseId = 'all';
      view.priority = 'all';
      view.deadline = 'all';
      view.assignmentId = assignmentId;
      location.hash = '#/tasks';
    }
  };
})();