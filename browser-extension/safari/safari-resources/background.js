// Background service worker for Chrome extension
// This runs in the background and can be used for additional features

chrome.runtime.onInstalled.addListener(() => {
  console.log('TapShift extension installed');
  
  // Set default API URL
  chrome.storage.sync.get(['apiUrl'], (result) => {
    if (!result.apiUrl) {
      chrome.storage.sync.set({ apiUrl: 'http://localhost:3000' });
    }
  });
});

// Handle extension icon click (optional - popup handles this by default)
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked');
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  sendResponse({ received: true });
});
