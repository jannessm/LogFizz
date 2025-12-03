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
