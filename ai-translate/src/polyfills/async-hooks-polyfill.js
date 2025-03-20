// 简单的async_hooks polyfill
export default {
  // 提供空的实现
  createHook: () => ({ enable: () => {}, disable: () => {} }),
  executionAsyncId: () => 0,
  triggerAsyncId: () => 0,
  AsyncLocalStorage: class AsyncLocalStorage {
    getStore() { return null; }
    run(store, callback) { return callback(); }
    exit(callback) { return callback(); }
    disable() { return null; }
    enterWith() {}
  }
};
