import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { simularEsquemaDeCor } from './ambiente';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  simularEsquemaDeCor('escuro');
  window.scrollTo = vi.fn() as never;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
