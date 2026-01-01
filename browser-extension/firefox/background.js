// Background script for Firefox extension
// This runs in the background and can be used for additional features

browser.runtime.onInstalled.addListener(() => {
  console.log('TapShift extension installed');
  
  // Set default API URL
  browser.storage.sync.get(['apiUrl']).then((result) => {
    if (!result.apiUrl) {
      browser.storage.sync.set({ apiUrl: 'http://localhost:3000' });
    }
  });
});

// Listen for messages from popup or content scripts
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  sendResponse({ received: true });
});
