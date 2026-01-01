// Shared API client for TapShift browser extensions
// This file is used by Chrome, Firefox, and Safari extensions

class TapShiftAPI {
  constructor() {
    // Default to localhost for development, can be configured in extension settings
    this.baseUrl = 'http://localhost:3000';
  }

  async setBaseUrl(url) {
    this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
  }

  async getBaseUrl() {
    return this.baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions = {
      credentials: 'include', // Important for session cookies
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, mergedOptions);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Not authenticated');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth methods
  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  // Button methods
  async getButtons() {
    return this.request('/api/buttons');
  }

  // TimeLog methods
  async startTimer(buttonId) {
    return this.request('/api/timelogs/start', {
      method: 'POST',
      body: JSON.stringify({ button_id: buttonId }),
    });
  }

  async stopTimer(timeLogId) {
    return this.request(`/api/timelogs/stop/${timeLogId}`, {
      method: 'POST',
    });
  }

  async getActiveTasks() {
    // Get timelogs without end_timestamp (active timers)
    const timelogs = await this.request('/api/timelogs');
    return timelogs.filter(log => !log.end_timestamp);
  }
}

// For browsers that support modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TapShiftAPI;
}
