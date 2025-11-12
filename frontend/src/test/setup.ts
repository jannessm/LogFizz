import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock crypto.randomUUID for testing
if (!globalThis.crypto) {
  globalThis.crypto = {} as Crypto;
}

if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Mock navigator.onLine
Object.defineProperty(globalThis.navigator, 'onLine', {
  writable: true,
  value: true,
});
