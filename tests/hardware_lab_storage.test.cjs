"use strict";

// Capa de almacenamiento del Laboratorio Virtual de Hardware: gate por ficha
// (optionalModules.hardwareLab) y guardado local+nube reusando
// cloudGetGuideData/cloudSaveGuideData con una llave plana por practica (ver
// comentario de cabecera en js/hardware_lab_storage.js para el porque).

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeLocalStorage() {
  var store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    _dump: () => store,
  };
}

function loadStorageModule(sandboxOverrides) {
  const sandbox = Object.assign(
    {
      window: {},
      localStorage: makeLocalStorage(),
      console: { warn() {}, error() {}, info() {} },
    },
    sandboxOverrides || {}
  );
  sandbox.window.portalAuth = sandbox.portalAuth;
  sandbox.window._firebaseDb = sandbox._firebaseDb;
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "hardware_lab_storage.js"), "utf8");
  vm.runInContext(code, sandbox);
  return sandbox;
}

function fakeAuth(overrides) {
  return Object.assign(
    {
      getCurrentSession: () => ({
        role: "student",
        user: { usernameKey: "juan.perez", ficha: "3441939" },
      }),
      getFichaInfo: (ficha) =>
        ficha === "3441939" ? { optionalModules: { hardwareLab: true } } : { optionalModules: {} },
      getStudentStorageKey: (usernameKey, key, opts) =>
        "sena_portal:student:" + usernameKey + ":" + (opts && opts.area) + ":" + key,
    },
    overrides || {}
  );
}

test("practiceKey genera una llave plana segura para Firestore (solo [A-Za-z0-9_])", () => {
  const sandbox = loadStorageModule({ portalAuth: fakeAuth() });
  const Storage = sandbox.window.HardwareLab.Storage;
  const key = Storage.practiceKey("desktop", "disassembly-guided");
  assert.strictEqual(key, "hwlab_desktop_disassembly_guided");
  assert.match(key, /^[A-Za-z0-9_]+$/);
});

test("canAccess es true solo si la ficha del aprendiz tiene optionalModules.hardwareLab", () => {
  const okSandbox = loadStorageModule({ portalAuth: fakeAuth() });
  assert.strictEqual(okSandbox.window.HardwareLab.Storage.canAccess(), true);

  const blockedAuth = fakeAuth({
    getCurrentSession: () => ({
      role: "student",
      user: { usernameKey: "otro", ficha: "9999999" },
    }),
  });
  const blockedSandbox = loadStorageModule({ portalAuth: blockedAuth });
  assert.strictEqual(blockedSandbox.window.HardwareLab.Storage.canAccess(), false);
});

test("canAccess es false para sesion admin o sin sesion", () => {
  const adminAuth = fakeAuth({ getCurrentSession: () => ({ role: "admin" }) });
  const adminSandbox = loadStorageModule({ portalAuth: adminAuth });
  assert.strictEqual(adminSandbox.window.HardwareLab.Storage.canAccess(), false);

  const noSessionAuth = fakeAuth({ getCurrentSession: () => null });
  const noSessionSandbox = loadStorageModule({ portalAuth: noSessionAuth });
  assert.strictEqual(noSessionSandbox.window.HardwareLab.Storage.canAccess(), false);
});

test("saveLocal/loadLocal guardan bajo la llave del estudiante y son legibles de vuelta", () => {
  const sandbox = loadStorageModule({ portalAuth: fakeAuth() });
  const Storage = sandbox.window.HardwareLab.Storage;
  const session = { stepIndex: 3, errors: 1 };
  const ok = Storage.saveLocal("desktop", "disassembly-guided", session);
  assert.strictEqual(ok, true);
  const loaded = Storage.loadLocal("desktop", "disassembly-guided");
  // deepEqual (no deepStrictEqual): "loaded" viene de JSON.parse ejecutado
  // dentro del sandbox vm, con su propio Object.prototype (otro realm) --
  // deepStrictEqual comparia tambien el prototipo y fallaria pese a ser
  // estructuralmente identico.
  assert.deepEqual(loaded, session);
});

test("persist guarda local de inmediato y llama a cloudSaveGuideData con una llave plana dentro de state (no anida 'practices')", async () => {
  var savedCalls = [];
  const fakeDb = {
    cloudSaveGuideData: async (scope, fileName, snapshot) => {
      savedCalls.push({ scope, fileName, snapshot });
      return true;
    },
  };
  const sandbox = loadStorageModule({ portalAuth: fakeAuth(), _firebaseDb: fakeDb });
  const Storage = sandbox.window.HardwareLab.Storage;
  const session = { stepIndex: 5, errors: 0 };

  Storage.persist("desktop", "disassembly-guided", session);
  // syncToCloud es async y no se espera dentro de persist(); dale un tick.
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.strictEqual(Storage.loadLocal("desktop", "disassembly-guided").stepIndex, 5);
  assert.strictEqual(savedCalls.length, 1);
  assert.strictEqual(savedCalls[0].scope, "student:juan.perez");
  assert.strictEqual(savedCalls[0].fileName, "laboratorio-virtual-hardware.html");
  assert.deepStrictEqual(savedCalls[0].snapshot.state.hwlab_desktop_disassembly_guided, session);
  assert.ok(!("practices" in savedCalls[0].snapshot.state));
});
