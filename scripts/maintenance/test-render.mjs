
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
globalThis.window = {
  location: { pathname: "/" },
  addEventListener: () => {},
  removeEventListener: () => {},
  document: { documentElement: { classList: { add: () => {}, remove: () => {} } }, body: {} }
};
globalThis.document = window.document;

import("./dist/index.html").catch(() => {});
