const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadFirebaseDbForTest() {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  const storage = new Map();
  const window = {
    PORTAL_FIREBASE_CONFIG: { enabled: false, projectId: "", apiKey: "" },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    portalAuth: {
      getCurrentSession: () => null,
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    console,
  };
  const context = vm.createContext({ window, console, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  vm.runInContext(source, context, { filename: "firebase_db.js" });
  return context.window._firebaseDb;
}

test("merge de guia preserva respuestas previas cuando una reapertura trae campos vacios", () => {
  const db = loadFirebaseDbForTest();
  assert.equal(typeof db.mergeGuideDataSnapshotForSave, "function");

  const merged = db.mergeGuideDataSnapshotForSave(
    {
      state: {
        "actividad-1-respuesta": "Respuesta anterior",
        "actividad-1-locked": true,
        "actividad-1-delivery": { driveUrl: "https://drive", status: "delivered" },
      },
      updatedAt: "2026-05-13T10:00:00.000Z",
    },
    {
      state: {
        "actividad-1-respuesta": "",
      },
      updatedAt: "2026-05-14T10:00:00.000Z",
      updatedBy: "admin",
    }
  );

  assert.equal(merged.state["actividad-1-respuesta"], "Respuesta anterior");
  assert.equal("actividad-1-locked" in merged.state, false);
  assert.deepEqual(merged.state["actividad-1-delivery"], { driveUrl: "https://drive", status: "delivered" });
  assert.equal(merged.updatedAt, "2026-05-14T10:00:00.000Z");
});

test("merge de guia combina respuestas nuevas con respuestas anteriores", () => {
  const db = loadFirebaseDbForTest();
  const merged = db.mergeGuideDataSnapshotForSave(
    {
      state: {
        pregunta1: "Ya guardada",
        pregunta2: "Texto anterior",
      },
    },
    {
      state: {
        pregunta1: "",
        pregunta3: "Nueva respuesta",
      },
    }
  );

  assert.equal(merged.state.pregunta1, "Ya guardada");
  assert.equal(merged.state.pregunta2, "Texto anterior");
  assert.equal(merged.state.pregunta3, "Nueva respuesta");
});

test("merge de guia no desbloquea actividades desde un guardado normal del aprendiz", () => {
  const db = loadFirebaseDbForTest();
  const merged = db.mergeGuideDataSnapshotForSave(
    {
      state: {
        pregunta1: "Ya guardada",
        "actividad-1-locked": true,
      },
    },
    {
      state: {
        pregunta2: "Nueva",
      },
      updatedBy: "aprendiz",
    }
  );

  assert.equal(merged.state["actividad-1-locked"], true);
  assert.equal(merged.state.pregunta1, "Ya guardada");
  assert.equal(merged.state.pregunta2, "Nueva");
});
