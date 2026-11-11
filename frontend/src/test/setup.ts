import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = '';
  vi.restoreAllMocks();
});
