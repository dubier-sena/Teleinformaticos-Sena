(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.redesLockSync = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function syncRemoteLockFlagsRedes(localState, remoteData, lockKeys) {
    const safeLocalState =
      localState && typeof localState === "object" ? localState : {};
    const safeRemoteData =
      remoteData && typeof remoteData === "object" ? remoteData : {};
    const safeLockKeys = Array.isArray(lockKeys) ? lockKeys : [];
    const nextState = { ...safeLocalState, ...safeRemoteData };

    safeLockKeys.forEach((key) => {
      if (safeRemoteData[key]) {
        nextState[key] = true;
      } else {
        delete nextState[key];
      }
    });

    return nextState;
  }

  return {
    syncRemoteLockFlagsRedes,
  };
});
