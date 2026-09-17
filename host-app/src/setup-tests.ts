import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Global DOM teardown so component test files do not each need their own afterEach(cleanup).
afterEach(() => {
  cleanup();
});
