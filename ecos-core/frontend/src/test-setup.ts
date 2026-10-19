import '@testing-library/jest-dom';

// Radix UI uses ResizeObserver for popover/tooltip positioning
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Radix UI uses window.matchMedia for responsive behavior
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Radix Popper / floating-ui needs a basic getComputedStyle that returns sizes
const _getComputedStyle = window.getComputedStyle;
window.getComputedStyle = (el, pseudo) => {
  const style = _getComputedStyle(el, pseudo);
  return style;
};
