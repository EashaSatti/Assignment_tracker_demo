/* =========================================================
   USER GUIDE SCREEN
   Plain-English help. The text is fixed (no user data is inserted),
   so it is written straight into the page. Each topic is a native
   <details> element: it opens and closes with the keyboard
   (Tab, then Enter or Space) and needs no extra script.
   The two buttons call the same functions as the welcome card.
   DEMO COPY: identical to the full guide, plus one notice near the top.
   ========================================================= */
(function () {
  'use strict';
  window.EF = window.EF || {};

  var icon = EF.icons.get;

  // title, icon, open (first topics start open), html
  var TOPICS = [
    { title: 'Getting started', icon: 'guide', open: true, html:
      '<p>EashaForge keeps your courses, assignments and tasks in one place and turns your due dates into a Dashboard, a Calendar, reminders and charts.</p>' +
      '<ol>' +
        '<li><strong>Courses (optional):</strong> add your classes first so work can be grouped and colour-coded.</li>' +
        '<li><strong>Assignments:</strong> add each piece of work with a title and a due date.</li>' +
        '<li><strong>Tasks:</strong> break an assignment into small steps and tick them off.</li>' +
        '<li><strong>Look around:</strong> the Dashboard, Calendar, bell and Analytics fill in by themselves.</li>' +
      '</ol>' +
      '<p>Use the sidebar on a computer, or the bar at the bottom of the screen (and <em>More</em>) on a phone.</p>' },

    { title: 'Your data stays on this device', icon: 'archive', open: true, html:
      '<p>EashaForge works fully offline. There is no account and nothing is sent anywhere.</p>' +
      '<ul>' +
        '<li>Your information is saved <strong>inside this browser on this device</strong>.</li>' +
        '<li>It does <strong>not</strong> sync to your phone, another computer or another browser. Each one starts empty.</li>' +
        '<li>Clearing your browser\u2019s site data, using a private window, or switching browsers or computers can make your data disappear from view.</li>' +
        '<li>Always open EashaForge in the same browser, and <strong>export a backup</strong> regularly (see Backups below).</li>' +
      '</ul>' },

    { title: 'Courses', icon: 'courses', html:
      '<p>Open <a href="#/courses">Courses</a> and choose <em>Add course</em>. Give it a name and pick a colour. The instructor, room and notes are optional.</p>' +
      '<ul>' +
        '<li>The course colour and name appear on assignments, tasks, the Calendar and Analytics.</li>' +
        '<li><strong>Archive</strong> a finished course to hide it from new choices while keeping its work.</li>' +
        '<li><strong>Delete</strong> removes a course. If it still has work, you are asked whether to move that work to another course or delete it too.</li>' +
      '</ul>' },

    { title: 'Assignments', icon: 'assignments', html:
      '<p>Open <a href="#/assignments">Assignments</a> and choose <em>Add assignment</em>.</p>' +
      '<ul>' +
        '<li>Only the title is required. You can also set a course, due date, optional due time, priority, status, estimated time and notes.</li>' +
        '<li>Status is <em>Not started</em>, <em>In progress</em>, <em>Submitted</em> or <em>Completed</em>. You choose it. EashaForge never changes it to Submitted or Completed for you.</li>' +
        '<li><strong>Overdue</strong> means the due date (and time, if set) has passed and the assignment is not Submitted or Completed. A due date without a time lasts until the end of that day.</li>' +
        '<li>Use the search box (it searches titles), the filters (course, status, priority, deadline) and the sort menu to find things quickly.</li>' +
        '<li>Click an assignment to see its details, edit it, add a task to it, or delete it.</li>' +
      '</ul>' },

    { title: 'Tasks and progress', icon: 'tasks', html:
      '<p>Open <a href="#/tasks">Tasks</a>. A task is a small step that is either <em>To Do</em> or <em>Done</em>.</p>' +
      '<ul>' +
        '<li>A task can be linked to an assignment. It then uses that assignment\u2019s course. A task with no assignment can have a course of its own.</li>' +
        '<li><strong>Progress</strong> of an assignment with tasks is the number of Done tasks divided by all its tasks.</li>' +
        '<li>Ticking the first task on a Not started assignment moves it to In progress.</li>' +
        '<li>Finishing every task does <strong>not</strong> mark the assignment Submitted or Completed. That is your decision.</li>' +
        '<li>Submitted and Completed assignments always show 100%.</li>' +
      '</ul>' },

    { title: 'Dashboard', icon: 'dashboard', html:
      '<p>The <a href="#/dashboard">Dashboard</a> is your daily overview: summary numbers (click one to see that list), upcoming deadlines, overdue work, tasks that need attention, overall progress and recently completed items. The Quick actions buttons add an assignment or task straight away.</p>' },

    { title: 'Calendar', icon: 'calendar', html:
      '<p>The <a href="#/calendar">Calendar</a> shows one month at a time. Use the arrows to change month and <em>Today</em> to come back.</p>' +
      '<ul>' +
        '<li>A <strong>square</strong> marks assignments due that day, a <strong>circle</strong> marks tasks, and <strong>!</strong> means something is overdue.</li>' +
        '<li>Click a day to list its assignments and tasks underneath, then click an item to open its details.</li>' +
        '<li>With the keyboard, use the arrow keys to move between days. Items without a due date never appear.</li>' +
      '</ul>' },

    { title: 'Reminders (the bell)', icon: 'bell', html:
      '<p>The bell at the top shows how many reminders you have not read. Open <a href="#/notifications">Notifications</a> to see them: Overdue, Due Today, Due Tomorrow, High Priority Soon and Upcoming (the next 7 days).</p>' +
      '<ul>' +
        '<li>Click a reminder to open the item. Use <em>Mark read</em>, <em>Mark all as read</em> or <em>Dismiss</em>. <em>Show dismissed</em> brings dismissed ones back.</li>' +
        '<li>Reminders are worked out from your due dates <strong>while EashaForge is open</strong>. Nothing is sent when it is closed, and no phone or browser alerts are used.</li>' +
      '</ul>' },

    { title: 'Analytics', icon: 'analytics', html:
      '<p><a href="#/analytics">Analytics</a> turns your data into numbers and charts: assignments by status, task completion, priority mix, the next 7 days and work completion per course. It updates by itself whenever you change something. It measures how much work you have finished, not grades.</p>' },

    { title: 'Name, theme and week start', icon: 'settings', html:
      '<p>Open <a href="#/settings">Settings</a>.</p>' +
      '<ul>' +
        '<li><strong>Your name</strong> is saved on this device only.</li>' +
        '<li><strong>Theme:</strong> Match my device, Light or Dark. The sun/moon button at the top also switches it.</li>' +
        '<li><strong>Week starts on</strong> Monday or Sunday changes the first column of the Calendar.</li>' +
      '</ul>' },

    { title: 'Backups and restoring', icon: 'restore', html:
      '<p>In <a href="#/settings">Settings</a>, <em>Export backup</em> downloads a file with all your courses, assignments, tasks, settings and reminder choices. Keep it somewhere safe, such as a cloud folder or USB drive.</p>' +
      '<ul>' +
        '<li><em>Restore from backup</em> lets you choose a backup file. EashaForge checks the whole file first and shows what it contains.</li>' +
        '<li>Restoring <strong>replaces everything</strong> currently in EashaForge, so you are asked to confirm. If the file is damaged or from another app, nothing changes.</li>' +
        '<li>Export a backup before clearing browser data, changing browsers or moving to a new computer, then restore it there.</li>' +
      '</ul>' },

    { title: 'Resetting all data', icon: 'trash', html:
      '<p><em>Reset all data</em> in <a href="#/settings">Settings</a> permanently deletes everything on this device. You must type RESET to confirm. It cannot be undone, so export a backup first. Afterwards the welcome card appears again.</p>' }
  ];

  function topicHtml(topic) {
    return '<details class="card guide-topic"' + (topic.open ? ' open' : '') + '>' +
      '<summary class="guide-topic__summary"><span class="guide-topic__icon" aria-hidden="true">' + icon(topic.icon) + '</span>' +
        '<span class="guide-topic__title">' + topic.title + '</span></summary>' +
      '<div class="guide-topic__body">' + topic.html + '</div>' +
    '</details>';
  }

  function render(page) {
    page.innerHTML =
      '<div class="guide-page">' +
        '<section class="card guide-intro" aria-labelledby="guide-intro-title">' +
          '<h2 class="guide-intro__title" id="guide-intro-title">' + icon('guide') + 'New here?</h2>' +
          '<p class="guide-intro__text">Open a topic below, or try EashaForge with example data first. Neither changes your own information.</p>' +
          '<div class="cluster">' +
            '<button type="button" class="btn btn--secondary" data-action="reopen">' + icon('guide') + 'Show the welcome guide again</button>' +
            '<button type="button" class="btn btn--secondary" data-action="sample">' + icon('layers') + 'Load sample data\u2026</button>' +
          '</div>' +
          '<p class="field__hint">Sample data is added next to your own data, never instead of it, and you are asked to confirm first. It is not loaded automatically.</p>' +
        '</section>' +
        '<div class="banner banner--info" role="status">' +
          '<span class="banner__icon">' + icon('info') + '</span>' +
          '<span>You are viewing the live demo. Export, restore and reset are available in the full version and are switched off here, and demo changes reset when you refresh the page.</span>' +
        '</div>' +
        TOPICS.map(topicHtml).join('') +
      '</div>';

    // ONE click listener for the whole screen (event delegation)
    page.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) {
        return;
      }
      var action = target.getAttribute('data-action');
      if (action === 'reopen') {
        EF.onboarding.reopen();
      } else if (action === 'sample') {
        EF.onboarding.loadSample({ goToDashboard: true });
      }
    });
  }

  // Replaces the placeholder (this file loads AFTER placeholders.js)
  EF.router.register('guide', {
    title: 'User Guide',
    render: render
  });
})();