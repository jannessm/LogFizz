/**
 * LogFizz Browser Extension – Popup Script
 *
 * Checks login state via the LogFizz API, shows timer buttons for logged-in
 * users, and allows starting/stopping timers or opening the app in a new tab.
 *
 * The APP_URL is read from the extension's storage (set via the background
 * script or options page). Falls back to a reasonable default.
 */
(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────
  const DEFAULT_APP_URL = 'https://app.logfizz.magnusso.nz';

  // ── DOM References ─────────────────────────────────────────────
  const $loading     = document.getElementById('loading');
  const $loggedOut   = document.getElementById('logged-out');
  const $loggedIn    = document.getElementById('logged-in');
  const $errorState  = document.getElementById('error-state');

  const $userName    = document.getElementById('user-name');
  const $userEmail   = document.getElementById('user-email');

  const $timersLoading = document.getElementById('timers-loading');
  const $timersEmpty   = document.getElementById('timers-empty');
  const $timersList    = document.getElementById('timers-list');

  // ── Helpers ────────────────────────────────────────────────────

  /** Get the configured app URL from extension storage. */
  function getAppUrl() {
    return new Promise(function (resolve) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL }, function (items) {
          resolve(items.appUrl || DEFAULT_APP_URL);
        });
      } else if (typeof browser !== 'undefined' && browser.storage && browser.storage.sync) {
        browser.storage.sync.get({ appUrl: DEFAULT_APP_URL }).then(function (items) {
          resolve(items.appUrl || DEFAULT_APP_URL);
        });
      } else {
        resolve(DEFAULT_APP_URL);
      }
    });
  }

  /** Build an API URL from the app base URL. */
  function apiUrl(appUrl, path) {
    // The API is on the same origin as the app
    var base = appUrl.replace(/\/+$/, '');
    return base + '/' + path.replace(/^\/+/, '');
  }

  /** Show one state panel and hide the others. */
  function showState(panel) {
    [$loading, $loggedOut, $loggedIn, $errorState].forEach(function (el) {
      el.hidden = el !== panel;
    });
  }

  /** Open a URL in a new tab. */
  function openTab(url) {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: url });
    } else if (typeof browser !== 'undefined' && browser.tabs) {
      browser.tabs.create({ url: url });
    } else {
      window.open(url, '_blank');
    }
  }

  /** Format seconds into HH:MM:SS */
  function formatElapsed(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    var parts = [];
    if (h > 0) parts.push(String(h));
    parts.push(String(m).padStart(2, '0'));
    parts.push(String(s).padStart(2, '0'));
    return parts.join(':');
  }

  // ── API Calls ──────────────────────────────────────────────────

  function fetchCurrentUser(appUrl) {
    return fetch(apiUrl(appUrl, 'api/auth/me'), {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function fetchTimers(appUrl) {
    // Use a very old date to get all timers
    var since = '2000-01-01T00:00:00Z';
    return fetch(apiUrl(appUrl, 'api/timers/sync?since=' + encodeURIComponent(since)), {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      return (data.timers || []).filter(function (t) {
        return !t.deleted_at && !t.archived;
      });
    });
  }

  function fetchActiveTimeLogs(appUrl) {
    // Get recent timelogs to check which timers are active
    var since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return fetch(apiUrl(appUrl, 'api/timelogs/sync?since=' + encodeURIComponent(since)), {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      return (data.timeLogs || []).filter(function (tl) {
        return !tl.deleted_at && tl.start_timestamp && !tl.end_timestamp;
      });
    });
  }

  function startTimer(appUrl, timer) {
    var now = new Date().toISOString();
    var timelog = {
      id: crypto.randomUUID(),
      timer_id: timer.id,
      user_id: timer.user_id,
      type: 'normal',
      whole_day: false,
      start_timestamp: now,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      apply_break_calculation: timer.auto_subtract_breaks,
      created_at: now,
      updated_at: now
    };

    return fetch(apiUrl(appUrl, 'api/timelogs/sync'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ timeLogs: [timelog] })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function stopTimer(appUrl, activeTimelog) {
    var now = new Date().toISOString();
    var updated = {
      id: activeTimelog.id,
      user_id: activeTimelog.user_id,
      timer_id: activeTimelog.timer_id,
      type: activeTimelog.type,
      whole_day: activeTimelog.whole_day,
      start_timestamp: activeTimelog.start_timestamp,
      end_timestamp: now,
      timezone: activeTimelog.timezone,
      apply_break_calculation: activeTimelog.apply_break_calculation,
      created_at: activeTimelog.created_at,
      updated_at: now
    };

    return fetch(apiUrl(appUrl, 'api/timelogs/sync'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ timeLogs: [updated] })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  // ── Timer Rendering ────────────────────────────────────────────

  var activeTimeLogs = [];
  var updateIntervals = [];

  function renderTimers(appUrl, timers) {
    $timersLoading.hidden = true;

    if (!timers || timers.length === 0) {
      $timersEmpty.hidden = false;
      $timersList.hidden = true;
      return;
    }

    $timersEmpty.hidden = true;
    $timersList.hidden = false;
    $timersList.innerHTML = '';

    // Clear any existing intervals
    updateIntervals.forEach(function (id) { clearInterval(id); });
    updateIntervals = [];

    timers.forEach(function (timer) {
      var activeLog = activeTimeLogs.find(function (tl) {
        return tl.timer_id === timer.id;
      });

      var btn = document.createElement('button');
      btn.className = 'timer-btn' + (activeLog ? ' active' : '');

      // Emoji or color dot
      var leading = '';
      if (timer.emoji) {
        leading = '<span class="timer-emoji">' + escapeHtml(timer.emoji) + '</span>';
      } else {
        leading = '<span class="timer-color-dot" style="background:' + sanitizeColor(timer.color) + '"></span>';
      }

      // Status text
      var statusClass = activeLog ? 'timer-status running' : 'timer-status';
      var statusId = 'status-' + timer.id;
      var statusText = activeLog ? 'Running' : 'Tap to start';

      // Action button
      var actionClass = activeLog ? 'timer-action stop' : 'timer-action start';
      var actionIcon = activeLog ? '⏹' : '▶';

      btn.innerHTML =
        leading +
        '<div class="timer-info">' +
          '<div class="timer-name">' + escapeHtml(timer.name) + '</div>' +
          '<div class="' + statusClass + '" id="' + statusId + '">' + statusText + '</div>' +
        '</div>' +
        '<span class="' + actionClass + '">' + actionIcon + '</span>';

      // Update running timer elapsed time
      if (activeLog) {
        var statusEl;
        var intervalId = setInterval(function () {
          statusEl = statusEl || document.getElementById(statusId);
          if (!statusEl) return;
          var elapsed = Math.floor((Date.now() - new Date(activeLog.start_timestamp).getTime()) / 1000);
          statusEl.textContent = '● ' + formatElapsed(elapsed);
        }, 1000);
        updateIntervals.push(intervalId);
      }

      btn.addEventListener('click', function () {
        handleTimerClick(appUrl, timer, activeLog);
      });

      $timersList.appendChild(btn);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Validate that a value looks like a CSS color (hex, rgb, hsl, named). */
  function sanitizeColor(value) {
    if (!value || typeof value !== 'string') return '#3B82F6';
    // Allow hex, rgb(), hsl(), and simple named colors only
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
    if (/^(rgb|hsl)a?\(\s*[\d.,\s%]+\)$/.test(value)) return value;
    if (/^[a-zA-Z]{1,20}$/.test(value)) return value;
    return '#3B82F6';
  }

  function handleTimerClick(appUrl, timer, activeLog) {
    // Disable all buttons to prevent double-clicks
    var buttons = $timersList.querySelectorAll('.timer-btn');
    buttons.forEach(function (b) { b.disabled = true; });

    var promise;
    if (activeLog) {
      promise = stopTimer(appUrl, activeLog);
    } else {
      // Stop any currently active timers first, then start this one
      var stopPromises = activeTimeLogs.map(function (tl) {
        return stopTimer(appUrl, tl);
      });
      promise = Promise.all(stopPromises).then(function () {
        return startTimer(appUrl, timer);
      });
    }

    promise.then(function () {
      // Refresh the state
      return init();
    }).catch(function (err) {
      console.error('Timer action failed:', err);
      // Re-enable buttons on error
      buttons.forEach(function (b) { b.disabled = false; });
    });
  }

  // ── Init ───────────────────────────────────────────────────────

  function init() {
    showState($loading);

    getAppUrl().then(function (appUrl) {
      // Wire up static buttons
      document.getElementById('btn-open-login').onclick = function () { openTab(appUrl + '/login'); };
      document.getElementById('btn-open-app').onclick = function () { openTab(appUrl); };
      document.getElementById('btn-open-dashboard').onclick = function () { openTab(appUrl); };
      document.getElementById('btn-open-app-error').onclick = function () { openTab(appUrl); };
      document.getElementById('btn-retry').onclick = function () { init(); };

      return fetchCurrentUser(appUrl).then(function (user) {
        // User is logged in
        $userName.textContent = user.name || 'User';
        $userEmail.textContent = user.email || '';
        showState($loggedIn);

        // Load timers and active time logs
        return Promise.all([
          fetchTimers(appUrl),
          fetchActiveTimeLogs(appUrl)
        ]).then(function (results) {
          var timers = results[0];
          activeTimeLogs = results[1];
          renderTimers(appUrl, timers);
        }).catch(function () {
          // Show timers as empty if fetch fails
          $timersLoading.hidden = true;
          $timersEmpty.hidden = false;
        });
      }).catch(function (err) {
        if (err.message && err.message.indexOf('401') !== -1) {
          showState($loggedOut);
        } else {
          showState($errorState);
        }
      });
    });
  }

  // ── Start ──────────────────────────────────────────────────────
  init();
}());
