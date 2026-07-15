const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

const USERNAME_KEY = "prueba.aprendiz";
const GUIDE2_FILE = "grupo-10a-guia-02-herramientas-informaticas-digitales.html";
const GUIDE2_STATE_KEY = "guia_interactiva_10a_guia2_html";
const GUIDE2_CLOUD_ALIAS = "10a_guia2.html";

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

// Reporte real (jul-15): entrando desde una ventana privada (equivalente a un
// PC nuevo) el home mostraba "0% / todo pendiente" en todas las guias aunque
// el aprendiz tuviera Induccion 100% calificada; los datos solo aparecian tras
// entrar a cada modulo y volver. Dos causas: (1) el estado local de cada guia
// solo se copiaba al ABRIR esa guia -> hydrateMissingGuideStates lo baja desde
// el home para las guias sin copia local; (2) la restauracion de usuario+% que
// firebase_db corre ~500ms despues de cargar terminaba DESPUES del render del
// home y nadie re-pintaba -> ahora dispara "portal-student-restored" y el home
// lo escucha.

function getStudentStorageKey(usernameKey, key, options) {
  const area = (options && options.area) || "app";
  return `sena_portal:student:${usernameKey}:${area}:${key}`;
}

function loadPortalHome(opts) {
  const options = opts || {};
  const localStorageStub = {
    _data: Object.assign({}, options.localStorageData || {}),
    getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
  };

  const cloudCalls = [];
  const ctx = {
    console,
    localStorage: localStorageStub,
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    window: {},
  };
  ctx.window.portalAuth = {
    getCurrentSession: () => null,
    getStudentStorageKey: getStudentStorageKey,
  };
  ctx.window._firebaseDb = {
    guideDataFileName: (file) => (file === GUIDE2_FILE ? GUIDE2_CLOUD_ALIAS : file),
    cloudGetGuideData: async (scope, cloudFile) => {
      cloudCalls.push({ scope, cloudFile });
      return options.snapshotByCloudFile ? (options.snapshotByCloudFile[cloudFile] || null) : null;
    },
  };
  vm.createContext(ctx);

  vm.runInContext(read(path.join("js", "activity_standard.js")), ctx, { filename: "activity_standard.js" });
  vm.runInContext(read(path.join("js", "guide_declarations.js")), ctx, { filename: "guide_declarations.js" });

  let code = read(path.join("js", "portal_home.js"));
  assert.match(code, /\n\}\)\(\);\s*$/);
  code = code.replace(/\n\}\)\(\);\s*$/, "\n  window.hydrateMissingGuideStates = hydrateMissingGuideStates;\n})();");
  vm.runInContext(code, ctx, { filename: "portal_home.js" });

  return { ctx, cloudCalls, localStorageStub };
}

test("equipo nuevo: baja el estado de la guia sin copia local (scope y alias reales) y lo deja bajo la clave local real", async () => {
  const snapshot = {
    state: { "extensiones331-locked": true, updatedAt: "2026-07-10T10:00:00.000Z" },
    updatedAt: "2026-07-10T10:00:00.000Z",
  };
  const { ctx, cloudCalls, localStorageStub } = loadPortalHome({
    snapshotByCloudFile: { [GUIDE2_CLOUD_ALIAS]: snapshot },
  });

  const changed = await ctx.window.hydrateMissingGuideStates({ usernameKey: USERNAME_KEY }, [GUIDE2_FILE]);

  assert.equal(changed, true);
  assert.equal(cloudCalls.length, 1);
  assert.equal(cloudCalls[0].scope, "student:" + USERNAME_KEY, "mismo scope que usa la propia guia");
  assert.equal(cloudCalls[0].cloudFile, GUIDE2_CLOUD_ALIAS, "el doc de la nube vive bajo el alias canonico");

  const storageKey = getStudentStorageKey(USERNAME_KEY, GUIDE2_STATE_KEY, { area: "guide-data" });
  const written = JSON.parse(localStorageStub.getItem(storageKey));
  assert.equal(written["extensiones331-locked"], true);
  const meta = JSON.parse(localStorageStub.getItem(storageKey + "__meta"));
  assert.equal(meta.updatedAt, "2026-07-10T10:00:00.000Z", "el __meta conserva el updatedAt del snapshot (LWW de la guia)");
});

test("con copia local existente NO se lee la nube (visitas normales siguen siendo 0 lecturas)", async () => {
  const storageKey = getStudentStorageKey(USERNAME_KEY, GUIDE2_STATE_KEY, { area: "guide-data" });
  const { ctx, cloudCalls } = loadPortalHome({
    localStorageData: { [storageKey]: JSON.stringify({ "extensiones331-locked": true }) },
  });

  const changed = await ctx.window.hydrateMissingGuideStates({ usernameKey: USERNAME_KEY }, [GUIDE2_FILE]);

  assert.equal(changed, false);
  assert.equal(cloudCalls.length, 0);
});

test("snapshot ausente o vacio: no escribe nada, y no se reintenta la lectura en el mismo home (anti-bucle)", async () => {
  const { ctx, cloudCalls, localStorageStub } = loadPortalHome({ snapshotByCloudFile: {} });

  const first = await ctx.window.hydrateMissingGuideStates({ usernameKey: USERNAME_KEY }, [GUIDE2_FILE]);
  assert.equal(first, false);
  assert.equal(cloudCalls.length, 1);
  const storageKey = getStudentStorageKey(USERNAME_KEY, GUIDE2_STATE_KEY, { area: "guide-data" });
  assert.equal(localStorageStub.getItem(storageKey), null);

  const second = await ctx.window.hydrateMissingGuideStates({ usernameKey: USERNAME_KEY }, [GUIDE2_FILE]);
  assert.equal(second, false);
  assert.equal(cloudCalls.length, 1, "hydrateTriedFiles debe impedir lecturas repetidas");
});

test("cableado: firebase_db avisa al terminar la restauracion y el home escucha y re-pinta", () => {
  const dbScript = read(path.join("js", "firebase_db.js"));
  const restore = dbScript.match(/async function restoreStudentFromCloud[\s\S]*?\n  \}/);
  assert.ok(restore, "no se encontro restoreStudentFromCloud");
  assert.match(restore[0], /portal-student-restored/);
  assert.match(dbScript, /guideDataFileName: guideDataFileName,/, "guideDataFileName debe estar exportado");

  const homeScript = read(path.join("js", "portal_home.js"));
  assert.match(homeScript, /document\.addEventListener\("portal-student-restored"/);
  assert.match(homeScript, /hydrateMissingGuideStates\(user, files\)\.then\(function \(changed\) \{\s*if \(changed\) renderStudent\(session\);/);
});
