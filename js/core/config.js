/* =========================================================
   CONFIG
   App-wide settings. The nav list below is the single place
   that defines which pages exist. The sidebar, bottom
   navigation, "More" sheet and placeholder screens are all
   built from it.
   ========================================================= */
(function () {
  'use strict';

  // Create the shared namespace if it does not exist yet
  window.EF = window.EF || {};

  window.EF.config = {
    appName: 'EashaForge Assignment Tracker',

    // primary: true  -> shown in the mobile bottom bar
    // primary: false -> shown inside the mobile "More" sheet
    // phase          -> which build phase will deliver this screen
    nav: [
      { path: 'dashboard',     label: 'Dashboard',     icon: 'dashboard',   primary: true,  section: 'main',   phase: 7,
        blurb: 'Your daily overview: what is due today, what is overdue and how your work is progressing.' },
      { path: 'assignments',   label: 'Assignments',   icon: 'assignments', primary: true,  section: 'main',   phase: 4,
        blurb: 'Create, edit and track every assignment with deadlines, priorities and progress.' },
      { path: 'tasks',         label: 'Tasks',         icon: 'tasks',       primary: true,  section: 'main',   phase: 5,
        blurb: 'Break assignments into small steps, or keep general study tasks.' },
      { path: 'calendar',      label: 'Calendar',      icon: 'calendar',    primary: true,  section: 'main',   phase: 8,
        blurb: 'See every deadline on a calendar, with an easy agenda view on phones.' },
      { path: 'courses',       label: 'Courses',       icon: 'courses',     primary: false, section: 'main',   phase: 3,
        blurb: 'Add your classes, give each one a color, and see everything linked to it.' },
      { path: 'analytics',     label: 'Analytics',     icon: 'analytics',   primary: false, section: 'main',   phase: 10,
        blurb: 'Charts that show your workload and progress, built from your real data.' },
      { path: 'notifications', label: 'Notifications', icon: 'bell',        primary: false, section: 'system', phase: 9,
        blurb: 'Reminders about overdue and upcoming deadlines, created from your data.' },
      { path: 'settings',      label: 'Settings',      icon: 'settings',    primary: false, section: 'system', phase: 11,
        blurb: 'Appearance, backup and restore, and sample data controls.' },
      { path: 'guide',         label: 'User Guide',    icon: 'guide',       primary: false, section: 'system', phase: 12,
        blurb: 'A short, built-in guide to using EashaForge.' }
    ]
  };
})();