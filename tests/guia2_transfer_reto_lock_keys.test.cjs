const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

const GUIDE2_FILE = "grupo-10a-guia-02-herramientas-informaticas-digitales.html";

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

// Regresion real (jul-15): el Reto final de Guia 2 (transferReto341) usaba DOS
// llaves de bloqueo que nunca se sincronizaban. El boton Guardar del aprendiz
// escribia state["transfer-reto-locked"] (llave suelta, anterior al catalogo),
// pero el checklist del home, el panel "Tu control de avance" y el panel de
// habilitacion del admin solo miraban state["transferReto341-locked"] (la que
// pone reflectGradesIntoGuideState al calificar). Consecuencia: un aprendiz que
// guardaba el reto lo seguia viendo "pendiente" en el home y dentro de la guia,
// y el instructor NO podia rehabilitarselo (no aparecia como bloqueado en el
// panel). El fix declara la llave legacy en el catalogo (legacyLockKeys) y hace
// que todos los consumidores acepten cualquiera de las dos.
function loadActivityStandard() {
  const ctx = {
    console,
    localStorage: {
      getItem: () => null,
      setItem() {},
      removeItem() {},
    },
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener() {},
    },
    window: {},
  };
  vm.createContext(ctx);
  vm.runInContext(read(path.join("js", "activity_standard.js")), ctx, { filename: "activity_standard.js" });
  vm.runInContext(read(path.join("js", "guide_declarations.js")), ctx, { filename: "guide_declarations.js" });
  return ctx;
}

function getRetoActivity(ctx) {
  const config = ctx.window.ActivityStandard.getConfigForGuide(GUIDE2_FILE);
  assert.ok(config, "Guia 2 debe estar declarada en guide_declarations.js");
  const reto = config.activities.find((a) => a.id === "transferReto341");
  assert.ok(reto, "transferReto341 debe existir en el catalogo de Guia 2");
  return reto;
}

test("catalogo: transferReto341 declara la llave legacy y el panel de habilitacion recibe AMBAS", () => {
  const ctx = loadActivityStandard();
  const reto = getRetoActivity(ctx);
  const legacy = Array.from(reto.legacyLockKeys || []);
  assert.deepEqual(legacy, ["transfer-reto-locked"]);

  const activities = ctx.window.ActivityStandard.getActivitiesForGuide(GUIDE2_FILE);
  const entry = activities.find((a) => a.id === "transferReto341");
  assert.ok(entry, "getActivitiesForGuide debe incluir transferReto341");
  const keys = Array.from(entry.keys);
  assert.ok(keys.includes("transferReto341-locked"), "keys debe incluir la llave canonica");
  assert.ok(
    keys.includes("transfer-reto-locked"),
    "keys debe incluir la llave legacy: es la unica forma de que el panel de habilitacion " +
      "detecte un reto guardado por el aprendiz y de que Habilitar borre las DOS llaves"
  );
});

test("getActivityDeliveryInfo: un reto guardado SOLO con la llave legacy cuenta como hecho (home + control de avance)", () => {
  const ctx = loadActivityStandard();
  const reto = getRetoActivity(ctx);
  const info = ctx.window.ActivityStandard.getActivityDeliveryInfo(reto, { "transfer-reto-locked": true });
  assert.equal(info.kind, "saved");
});

test("getActivityDeliveryInfo: la llave canonica sigue funcionando y sin llaves el reto queda pendiente", () => {
  const ctx = loadActivityStandard();
  const reto = getRetoActivity(ctx);
  assert.equal(ctx.window.ActivityStandard.getActivityDeliveryInfo(reto, { "transferReto341-locked": true }).kind, "saved");
  assert.equal(ctx.window.ActivityStandard.getActivityDeliveryInfo(reto, {}).kind, "pending");
});

test("script_guia2: Guardar escribe las dos llaves y el bloqueo visual acepta cualquiera", () => {
  const script = read(path.join("js", "script_guia2.js"));

  const saveMatch = script.match(/function guardarTransferReto341\(\)[\s\S]*?\n\}/);
  assert.ok(saveMatch, "no se encontro guardarTransferReto341 en script_guia2.js");
  assert.match(saveMatch[0], /state\["transfer-reto-locked"\] = true/);
  assert.match(saveMatch[0], /state\["transferReto341-locked"\] = true/);

  const applyMatch = script.match(/function applyTransferRetoLock\(\)[\s\S]*?\n\}/);
  assert.ok(applyMatch, "no se encontro applyTransferRetoLock en script_guia2.js");
  assert.match(applyMatch[0], /state\["transfer-reto-locked"\]/);
  assert.match(
    applyMatch[0],
    /state\["transferReto341-locked"\]/,
    "applyTransferRetoLock debe considerar tambien la llave canonica: es la que pone " +
      "reflectGradesIntoGuideState cuando el instructor califica sin que el aprendiz haya guardado"
  );
});

test("admin_habilitacion: la deteccion de bloqueo revisa TODAS las llaves -locked, no solo la primera", () => {
  const script = read(path.join("js", "admin_habilitacion.js"));
  // Con .find() solo se consultaba la primera llave -locked; una actividad con
  // llave legacy (transferReto341) o con doble llave (quiz312 de Guia 6) nunca
  // aparecia como bloqueada si el estado real vivia en la otra llave.
  assert.match(script, /activity\.keys\.filter\(\(k\) => \/-locked\$\/\.test\(k\)\)/);
  assert.match(script, /lockKeys\.some\(\(k\) => state\[k\] === true\)/);
});

test("admin_usuarios: el fallback GUIDE2_TRANSFER_RETO_KEYS y el desbloqueo cubren ambas llaves", () => {
  const script = read(path.join("js", "admin_usuarios.js"));
  assert.match(script, /GUIDE2_TRANSFER_RETO_KEYS = \["transfer-reto-locked", "transferReto341-locked"\]/);
  // handleUnlockClick borra toda llave -locked que le llegue en data-hab-lock-keys;
  // este candado evita que ese barrido generico se restrinja a una sola llave.
  const unlockMatch = script.match(/async function handleUnlockClick[\s\S]*?patchGuideCloudState/);
  assert.ok(unlockMatch, "no se encontro handleUnlockClick en admin_usuarios.js");
  assert.match(unlockMatch[0], /lockKeys\.forEach\(\(key\) => \{\s*if \(\/-locked\$\/\.test\(key\)\) delete nextState\[key\];/);
});
