import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { LARGURA_DESKTOP, simularEsquemaDeCor, simularLargura } from './ambiente';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  simularEsquemaDeCor('escuro');
  simularLargura(LARGURA_DESKTOP);
  window.scrollTo = vi.fn() as never;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
