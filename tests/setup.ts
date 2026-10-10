// Configuration detects mobile capabilities in a browser; tests use a deterministic desktop default.
Object.defineProperty(globalThis, "matchMedia", {
  value: () => ({ matches: false }),
  configurable: true,
});
