// Background script for Safari extension
// This runs in the background and can be used for additional features

// Safari uses the browser API (same as Firefox)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

browserAPI.runtime.onInstalled.addListener(() => {
  console.log('TapShift extension installed');
  
  // Set default API URL
  browserAPI.storage.sync.get(['apiUrl']).then((result) => {
    if (!result.apiUrl) {
      browserAPI.storage.sync.set({ apiUrl: 'http://localhost:3000' });
    }
  }).catch(() => {
    // Fallback for older APIs
    browserAPI.storage.sync.get(['apiUrl'], (result) => {
      if (!result.apiUrl) {
        browserAPI.storage.sync.set({ apiUrl: 'http://localhost:3000' });
      }
    });
  });
});

// Listen for messages from popup or content scripts
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  sendResponse({ received: true });
});
