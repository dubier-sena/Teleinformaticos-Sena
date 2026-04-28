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

  function syncAuthoritativeLockFlagsOnlyRedes(localState, remoteData, lockKeys) {
    const safeLocalState =
      localState && typeof localState === "object" ? localState : {};
    const safeRemoteData =
      remoteData && typeof remoteData === "object" ? remoteData : {};
    const safeLockKeys = Array.isArray(lockKeys) ? lockKeys : [];
    const nextState = { ...safeLocalState };
    let changed = false;

    safeLockKeys.forEach((key) => {
      if (safeRemoteData[key]) {
        if (!nextState[key]) {
          changed = true;
        }
        nextState[key] = true;
        return;
      }

      if (Object.prototype.hasOwnProperty.call(nextState, key)) {
        changed = true;
        delete nextState[key];
      }
    });

    return {
      state: nextState,
      changed,
    };
  }

  function buildRedesGuideSnapshot(snapshot, nextState, options) {
    const safeSnapshot =
      snapshot && typeof snapshot === "object" ? { ...snapshot } : {};
    const safeState =
      nextState && typeof nextState === "object" ? { ...nextState } : {};
    const updatedAt = String(
      options?.updatedAt || safeSnapshot.updatedAt || new Date().toISOString()
    ).trim();
    const updatedBy = String(
      options?.updatedBy || safeSnapshot.updatedBy || ""
    ).trim();

    return {
      ...safeSnapshot,
      data: safeState,
      state: safeState,
      updatedAt,
      updatedBy,
    };
  }

  function clearSelectedRedesGuideLocks(snapshotState, lockKeys) {
    const nextState =
      snapshotState && typeof snapshotState === "object" ? { ...snapshotState } : {};
    const safeLockKeys = Array.isArray(lockKeys) ? lockKeys : [];
    let changed = false;

    safeLockKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(nextState, key)) {
        changed = true;
        delete nextState[key];
      }
    });

    return {
      state: nextState,
      changed,
    };
  }

  return {
    buildRedesGuideSnapshot,
    clearSelectedRedesGuideLocks,
    syncAuthoritativeLockFlagsOnlyRedes,
    syncRemoteLockFlagsRedes,
  };
});
