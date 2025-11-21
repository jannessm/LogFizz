import { writable } from 'svelte/store';

export interface SnackbarMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number; // Duration in ms, 0 for indefinite
  action?: {
    label: string;
    callback: () => void;
  };
}

interface SnackbarStore {
  messages: SnackbarMessage[];
}

function createSnackbarStore() {
  const { subscribe, update } = writable<SnackbarStore>({
    messages: [],
  });

  let messageIdCounter = 0;

  function addMessage(
    message: string,
    type: SnackbarMessage['type'],
    duration: number = 5000,
    action?: SnackbarMessage['action']
  ): string {
    const id = `snackbar-${++messageIdCounter}-${Date.now()}`;
    
    update(state => ({
      messages: [...state.messages, { id, message, type, duration, action }],
    }));

    // Auto-dismiss after duration if not indefinite
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }

  return {
    subscribe,
    
    success(message: string, duration?: number): string {
      return addMessage(message, 'success', duration);
    },

    error(message: string, duration?: number): string {
      return addMessage(message, 'error', duration);
    },

    info(message: string, duration?: number): string {
      return addMessage(message, 'info', duration);
    },

    warning(message: string, duration?: number, action?: SnackbarMessage['action']): string {
      return addMessage(message, 'warning', duration, action);
    },

    withAction(
      message: string, 
      type: SnackbarMessage['type'],
      actionLabel: string,
      actionCallback: () => void,
      duration: number = 0
    ): string {
      return addMessage(message, type, duration, {
        label: actionLabel,
        callback: actionCallback,
      });
    },

    dismiss(id: string): void {
      update(state => ({
        messages: state.messages.filter(msg => msg.id !== id),
      }));
    },

    clear(): void {
      update(() => ({ messages: [] }));
    },
  };
}

export const snackbar = createSnackbarStore();

// Helper function to dismiss by id
export function dismiss(id: string): void {
  snackbar.dismiss(id);
}
