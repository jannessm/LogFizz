import { writable } from 'svelte/store';

// Create a store for the current path
export const currentPath = writable(window.location.pathname);

// Navigation function
export function navigate(path: string, options?: { replace?: boolean }) {
  if (options?.replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  currentPath.set(path);
}

// Handle browser back/forward buttons
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    currentPath.set(window.location.pathname);
  });
}
