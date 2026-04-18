/**
 * LogFizz Browser Extension – Background / Service Worker
 *
 * Handles the extension icon badge (e.g. showing a running timer indicator)
 * and sets up default storage values on install.
 */
(function () {
  'use strict';

  var DEFAULT_APP_URL = 'https://app.logfizz.magnusso.nz';

  // ── Installation ───────────────────────────────────────────────

  function onInstalled(details) {
    if (details.reason === 'install') {
      // Set default app URL
      var storageApi = (typeof chrome !== 'undefined' && chrome.storage)
        ? chrome.storage.sync
        : (typeof browser !== 'undefined' && browser.storage ? browser.storage.sync : null);

      if (storageApi) {
        storageApi.set({ appUrl: DEFAULT_APP_URL });
      }
    }
  }

  // ── Browser Action Click (fallback if popup fails) ─────────────

  function onBrowserActionClicked(tab) {
    var storageApi = (typeof chrome !== 'undefined' && chrome.storage)
      ? chrome.storage.sync
      : (typeof browser !== 'undefined' && browser.storage ? browser.storage.sync : null);

    if (storageApi) {
      if (storageApi.get && storageApi.get.then) {
        // Firefox promise-based API
        storageApi.get({ appUrl: DEFAULT_APP_URL }).then(function (items) {
          openAppTab(items.appUrl || DEFAULT_APP_URL);
        });
      } else {
        // Chrome callback-based API
        storageApi.get({ appUrl: DEFAULT_APP_URL }, function (items) {
          openAppTab(items.appUrl || DEFAULT_APP_URL);
        });
      }
    } else {
      openAppTab(DEFAULT_APP_URL);
    }
  }

  function openAppTab(url) {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: url });
    } else if (typeof browser !== 'undefined' && browser.tabs) {
      browser.tabs.create({ url: url });
    }
  }

  // ── Register listeners ─────────────────────────────────────────

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onInstalled.addListener(onInstalled);
  } else if (typeof browser !== 'undefined' && browser.runtime) {
    browser.runtime.onInstalled.addListener(onInstalled);
  }
}());
