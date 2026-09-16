import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Global safety net (Q-5 adjacent): every test file that renders components gets its DOM torn
// down automatically, so component test files do not each need their own afterEach(cleanup).
afterEach(() => {
  cleanup();
});
