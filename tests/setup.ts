import "@testing-library/jest-dom";

// Mock chrome extension APIs if not present in test environment
if (typeof globalThis.chrome === "undefined") {
  const storageMock = () => {
    let store: Record<string, any> = {};
    return {
      get: (keys: any, cb?: (res: any) => void) => {
        const result: Record<string, any> = {};
        if (typeof keys === "string") {
          result[keys] = store[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach((k) => (result[k] = store[k]));
        } else if (keys && typeof keys === "object") {
          Object.keys(keys).forEach((k) => {
            result[k] = store[k] !== undefined ? store[k] : keys[k];
          });
        } else {
          Object.assign(result, store);
        }
        if (cb) cb(result);
        return Promise.resolve(result);
      },
      set: (items: Record<string, any>, cb?: () => void) => {
        Object.assign(store, items);
        if (cb) cb();
        return Promise.resolve();
      },
      remove: (keys: string | string[], cb?: () => void) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach((k) => delete store[k]);
        if (cb) cb();
        return Promise.resolve();
      },
      clear: (cb?: () => void) => {
        store = {};
        if (cb) cb();
        return Promise.resolve();
      },
    };
  };

  (globalThis as any).chrome = {
    runtime: {
      id: "attendly-test-id",
      sendMessage: () => Promise.resolve(),
      onMessage: {
        addListener: () => {},
        removeListener: () => {},
      },
      getURL: (path: string) => `chrome-extension://attendly-test-id/${path}`,
    },
    storage: {
      session: storageMock(),
      local: storageMock(),
    },
    tabs: {
      query: () => Promise.resolve([]),
      sendMessage: () => Promise.resolve(),
      create: () => Promise.resolve({}),
    },
    action: {
      setBadgeText: () => Promise.resolve(),
      setBadgeBackgroundColor: () => Promise.resolve(),
    },
  };
}
