const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const adminScript = fs.readFileSync(
  path.join(__dirname, "..", "js", "admin_usuarios.js"),
  "utf8"
);

// La tabla "Respuestas" y el modulo "Entregas" leen readStudentGuideState
// (localStorage del admin). Para mostrar datos cross-device sin N×M lecturas por
// render, el admin baja el guide_state de cada aprendiz UNA vez por sesion al
// abrir esos modulos y lo cachea en localStorage.

test("existe la hidratacion perezosa del guide_state al localStorage del admin", () => {
  assert.match(adminScript, /let guideStatesHydrated = false;/);
  assert.match(adminScript, /async function ensureGuideStatesHydrated\(\)/);
  // Reusa el mismo doc de nube que "ver respuestas" y la llave de almacenamiento del aprendiz.
  assert.match(adminScript, /db\.cloudGetGuideData\(getStudentCloudScope\(task\.usernameKey\)/);
  assert.match(adminScript, /auth\.getStudentStorageKey\(task\.usernameKey, task\.stateKey, \{ area: "guide-data" \}\)/);
  assert.match(adminScript, /getGuideCloudConfig\(fileName\)/);
});

test("la hidratacion no pisa ediciones locales mas nuevas (merge por updatedAt)", () => {
  // pickLatestSnapshot prefiere la nube solo si es >= que lo local.
  assert.match(adminScript, /pickLatestSnapshot\(\s*cloudSnapshot,/);
});

test("se dispara al abrir Respuestas/Entregas y se re-renderiza", () => {
  assert.match(adminScript, /moduleName === "respuestas" \|\| moduleName === "entregas"/);
  assert.match(adminScript, /ensureGuideStatesHydrated\(\)\s*\.then\(\(changed\) =>/);
  assert.match(adminScript, /if \(state\.activeModule === moduleName && changed\) rerender\(\);/);
});

test("se re-hidrata con datos frescos en cada loadUsers", () => {
  assert.match(adminScript, /guideStatesHydrated = false; \/\/ datos frescos/);
});

test("la hidratacion limita la concurrencia para no saturar la cuota", () => {
  assert.match(adminScript, /async function runWithConcurrency\(items, limit, worker\)/);
  assert.match(adminScript, /runWithConcurrency\(tasks, 6,/);
});
