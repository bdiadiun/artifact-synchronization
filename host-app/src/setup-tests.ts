import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Global DOM teardown so component test files do not each need their own afterEach(cleanup).
// sessionStorage persists across `it` blocks within one file's jsdom instance (A-14): cleared here
// so one test's persisted rows never leak into the next.
afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});
