import '@testing-library/jest-dom';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Set timezone to UTC for consistent test results
process.env.TZ = 'UTC';

// Mock Intl.DateTimeFormat to return UTC timezone
const OriginalDateTimeFormat = Intl.DateTimeFormat;
(Intl as any).DateTimeFormat = function (...args: any[]) {
  const instance = new OriginalDateTimeFormat(...args);
  const originalResolvedOptions = instance.resolvedOptions.bind(instance);
  instance.resolvedOptions = function () {
    const options = originalResolvedOptions();
    return { ...options, timeZone: 'UTC' };
  };
  return instance;
};

// Mock crypto.randomUUID for testing
if (!globalThis.crypto) {
  globalThis.crypto = {} as Crypto;
}

if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as `${string}-${string}-${string}-${string}-${string}`;
  };
}

// Add File.text() method support for testing
const originalFile = globalThis.File;
class MockFile extends originalFile {
  async text(): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(this);
    });
  }
  
  async arrayBuffer(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  }
}
globalThis.File = MockFile as typeof File;

// Mock navigator.onLine
Object.defineProperty(globalThis.navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock HCaptcha component
vi.mock('../components/HCaptcha.svelte', () => ({
  default: class HCaptchaMock {
    constructor() {}
    reset() {}
  },
}));

// Mock window.hcaptcha
if (!globalThis.window) {
  (globalThis as any).window = {};
}

if (!(globalThis.window as any).hcaptcha) {
  (globalThis.window as any).hcaptcha = {
    render: vi.fn().mockReturnValue('widget-id'),
    reset: vi.fn(),
    remove: vi.fn(),
    execute: vi.fn(),
    getResponse: vi.fn().mockReturnValue('mock-token'),
    getRespKey: vi.fn(),
  };
}
