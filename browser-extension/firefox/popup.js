// Popup script for TapShift browser extension
// This file handles the UI logic for the extension popup

const api = new TapShiftAPI();
let activeTimerId = null;
let timerInterval = null;
let timerStartTime = null;
let buttons = [];

// Get browser API (works for Chrome, Firefox, and Safari)
const browserAPI = typeof chrome !== 'undefined' ? chrome : browser;

// DOM elements
const elements = {
  notAuthenticated: null,
  authenticated: null,
  settings: null,
  loading: null,
  error: null,
  userName: null,
  activeTimer: null,
  activeButtonName: null,
  timerDuration: null,
  stopTimerBtn: null,
  buttonsGrid: null,
  openWebappBtn: null,
  openWebappBtnAuth: null,
  settingsBtn: null,
  saveSettingsBtn: null,
  cancelSettingsBtn: null,
  apiUrl: null,
  refreshBtn: null,
  logoutBtn: null,
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  attachEventListeners();
  await loadSettings();
  await checkAuthAndLoadData();
});

function initializeElements() {
  elements.notAuthenticated = document.getElementById('notAuthenticated');
  elements.authenticated = document.getElementById('authenticated');
  elements.settings = document.getElementById('settings');
  elements.loading = document.getElementById('loading');
  elements.error = document.getElementById('error');
  elements.userName = document.getElementById('userName');
  elements.activeTimer = document.getElementById('activeTimer');
  elements.activeButtonName = document.getElementById('activeButtonName');
  elements.timerDuration = document.getElementById('timerDuration');
  elements.stopTimerBtn = document.getElementById('stopTimerBtn');
  elements.buttonsGrid = document.getElementById('buttons');
  elements.openWebappBtn = document.getElementById('openWebappBtn');
  elements.openWebappBtnAuth = document.getElementById('openWebappBtnAuth');
  elements.settingsBtn = document.getElementById('settingsBtn');
  elements.saveSettingsBtn = document.getElementById('saveSettingsBtn');
  elements.cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  elements.apiUrl = document.getElementById('apiUrl');
  elements.refreshBtn = document.getElementById('refreshBtn');
  elements.logoutBtn = document.getElementById('logoutBtn');
}

function attachEventListeners() {
  elements.openWebappBtn?.addEventListener('click', openWebapp);
  elements.openWebappBtnAuth?.addEventListener('click', openWebapp);
  elements.settingsBtn?.addEventListener('click', showSettings);
  elements.saveSettingsBtn?.addEventListener('click', saveSettings);
  elements.cancelSettingsBtn?.addEventListener('click', hideSettings);
  elements.refreshBtn?.addEventListener('click', refresh);
  elements.logoutBtn?.addEventListener('click', logout);
  elements.stopTimerBtn?.addEventListener('click', stopActiveTimer);
}

async function loadSettings() {
  try {
    const result = await browserAPI.storage.sync.get(['apiUrl']);
    const savedUrl = result.apiUrl || 'http://localhost:3000';
    await api.setBaseUrl(savedUrl);
    if (elements.apiUrl) {
      elements.apiUrl.value = savedUrl;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

async function saveSettings() {
  const url = elements.apiUrl.value.trim();
  if (!url) {
    showError('Please enter a valid URL');
    return;
  }

  try {
    await browserAPI.storage.sync.set({ apiUrl: url });
    await api.setBaseUrl(url);
    hideSettings();
    showMessage('Settings saved!');
    await checkAuthAndLoadData();
  } catch (error) {
    showError('Failed to save settings: ' + error.message);
  }
}

function showSettings() {
  elements.notAuthenticated?.classList.add('hidden');
  elements.authenticated?.classList.add('hidden');
  elements.settings?.classList.remove('hidden');
}

function hideSettings() {
  elements.settings?.classList.add('hidden');
  checkAuthAndLoadData();
}

async function checkAuthAndLoadData() {
  showLoading();
  hideError();

  try {
    // Check if user is authenticated
    const user = await api.getCurrentUser();
    
    if (user) {
      elements.userName.textContent = user.name || user.email;
      await loadButtons();
      await checkActiveTimer();
      showAuthenticated();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showNotAuthenticated();
  } finally {
    hideLoading();
  }
}

async function loadButtons() {
  try {
    buttons = await api.getButtons();
    renderButtons();
  } catch (error) {
    console.error('Failed to load buttons:', error);
    showError('Failed to load buttons: ' + error.message);
  }
}

function renderButtons() {
  elements.buttonsGrid.innerHTML = '';

  if (buttons.length === 0) {
    elements.buttonsGrid.innerHTML = '<p class="message">No buttons configured. Open the webapp to create buttons.</p>';
    return;
  }

  buttons.forEach(button => {
    const buttonEl = document.createElement('button');
    buttonEl.className = 'timer-button';
    buttonEl.textContent = button.name;
    buttonEl.style.backgroundColor = button.color || '#3b82f6';
    buttonEl.style.color = getContrastColor(button.color || '#3b82f6');
    
    // Disable if there's an active timer
    if (activeTimerId) {
      buttonEl.classList.add('disabled');
    } else {
      buttonEl.addEventListener('click', () => startTimer(button.id));
    }
    
    elements.buttonsGrid.appendChild(buttonEl);
  });
}

async function startTimer(buttonId) {
  showLoading();
  hideError();

  try {
    const timelog = await api.startTimer(buttonId);
    activeTimerId = timelog.id;
    timerStartTime = new Date(timelog.start_timestamp);
    
    const button = buttons.find(b => b.id === buttonId);
    elements.activeButtonName.textContent = button ? button.name : 'Timer';
    
    elements.activeTimer?.classList.remove('hidden');
    startTimerDisplay();
    renderButtons(); // Re-render to disable other buttons
    showMessage('Timer started!');
  } catch (error) {
    console.error('Failed to start timer:', error);
    showError('Failed to start timer: ' + error.message);
  } finally {
    hideLoading();
  }
}

async function stopActiveTimer() {
  if (!activeTimerId) return;

  showLoading();
  hideError();

  try {
    await api.stopTimer(activeTimerId);
    clearActiveTimer();
    showMessage('Timer stopped!');
  } catch (error) {
    console.error('Failed to stop timer:', error);
    showError('Failed to stop timer: ' + error.message);
  } finally {
    hideLoading();
  }
}

async function checkActiveTimer() {
  try {
    const activeTasks = await api.getActiveTasks();
    
    if (activeTasks && activeTasks.length > 0) {
      const activeTask = activeTasks[0];
      activeTimerId = activeTask.id;
      timerStartTime = new Date(activeTask.start_timestamp);
      
      const button = buttons.find(b => b.id === activeTask.button_id);
      elements.activeButtonName.textContent = button ? button.name : 'Timer';
      
      elements.activeTimer?.classList.remove('hidden');
      startTimerDisplay();
      renderButtons(); // Disable other buttons
    } else {
      clearActiveTimer();
    }
  } catch (error) {
    console.error('Failed to check active timer:', error);
  }
}

function startTimerDisplay() {
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  if (!timerStartTime) return;

  const now = new Date();
  const elapsed = Math.floor((now - timerStartTime) / 1000);
  
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  elements.timerDuration.textContent = 
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function clearActiveTimer() {
  activeTimerId = null;
  timerStartTime = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  elements.activeTimer?.classList.add('hidden');
  renderButtons(); // Re-enable buttons
}

async function logout() {
  try {
    await api.logout();
    clearActiveTimer();
    showNotAuthenticated();
  } catch (error) {
    console.error('Logout failed:', error);
    showError('Logout failed: ' + error.message);
  }
}

async function refresh() {
  await checkAuthAndLoadData();
}

function openWebapp() {
  const url = elements.apiUrl.value || 'http://localhost:3000';
  browserAPI.tabs.query({ url: url + '/*' }, (tabs) => {
    if (tabs.length > 0) {
      // Focus existing tab
      browserAPI.tabs.update(tabs[0].id, { active: true });
      browserAPI.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // Open new tab
      browserAPI.tabs.create({ url: url });
    }
  });
}

function showAuthenticated() {
  elements.notAuthenticated?.classList.add('hidden');
  elements.authenticated?.classList.remove('hidden');
  elements.settings?.classList.add('hidden');
}

function showNotAuthenticated() {
  elements.notAuthenticated?.classList.remove('hidden');
  elements.authenticated?.classList.add('hidden');
  elements.settings?.classList.add('hidden');
}

function showLoading() {
  elements.loading?.classList.remove('hidden');
}

function hideLoading() {
  elements.loading?.classList.add('hidden');
}

function showError(message) {
  if (elements.error) {
    elements.error.textContent = message;
    elements.error.classList.remove('hidden');
  }
}

function hideError() {
  elements.error?.classList.add('hidden');
}

function showMessage(message) {
  // Could implement a toast notification here
  console.log(message);
}

// Helper function to get contrasting text color
function getContrastColor(hexColor) {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
