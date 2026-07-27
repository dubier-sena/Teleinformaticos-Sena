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
  // (la llamada es multilinea desde jul-17: agrega la opcion skipDriveOn404
  // cuando la recuperacion Drive→Firestore ya corrio en este navegador)
  assert.match(adminScript, /db\.cloudGetGuideData\(\s*getStudentCloudScope\(task\.usernameKey\)/);
  assert.match(adminScript, /skipDriveOn404: true/);
  assert.match(adminScript, /isDrivePromotionDone/);
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

test("la hidratacion es una vez por sesion; 'Actualizar datos' la repite", () => {
  // Cambio (jun-2026): antes se reseteaba el flag en CADA loadUsers; ahora la
  // hidratacion ocurre UNA vez por sesion (para poblar el dashboard de entregas
  // sin N×M lecturas por cada accion del admin) y solo se repite al pulsar el
  // boton "Actualizar datos" (refresh-users), que tambien limpia la marca de
  // throttle del dashboard para forzar una re-sincronizacion real (jul-27).
  assert.match(adminScript, /guideStatesHydrated = false;/);
  assert.match(adminScript, /localStorage\.removeItem\(DASHBOARD_HYDRATE_THROTTLE_KEY\)/);
  assert.doesNotMatch(adminScript, /guideStatesHydrated = false; \/\/ datos frescos/);
});

test("la hidratacion limita la concurrencia para no saturar la cuota", () => {
  assert.match(adminScript, /async function runWithConcurrency\(items, limit, worker\)/);
  assert.match(adminScript, /runWithConcurrency\(tasks, 6,/);
});

test("dashboard: tarjeta 'Entregas recientes' (render existe; se puebla bajo demanda)", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "panel-administrativo-usuarios.html"),
    "utf8"
  );
  // UI en el dashboard: tarjeta + contenedor + boton "Ver todas" al modulo Entregas.
  assert.match(html, /<h2>Entregas recientes<\/h2>/);
  assert.match(html, /id="dashboard-deliveries"/);
  assert.match(html, /data-jump-module="entregas">Ver todas/);
  // Logica: render en el dashboard + orden recientes primero.
  assert.match(adminScript, /function renderRecentDeliveries\(\)/);
  assert.match(adminScript, /renderRecentDeliveries\(\);/);
  assert.match(adminScript, /function getRecentDeliveries\(limit\)/);
  assert.match(adminScript, /b\.submittedAt[\s\S]*localeCompare[\s\S]*a\.submittedAt/);
  // Optimizacion de cuota (jul-2026): loadUsers NO hidrata eager en bloque. Bajar el
  // guide_state de todos los aprendices costaba cientos de lecturas en CADA carga del
  // panel y acercaba la cuota diaria gratis al limite. La hidratacion sigue BAJO DEMANDA
  // al abrir Respuestas/Entregas (ver setActiveModule).
  assert.doesNotMatch(adminScript, /ensureGuideStatesHydrated\(\)\.then\(\(changed\) => \{ if \(changed\) renderAll\(\); \}\)/);
  assert.match(adminScript, /guideStatesHydrated = false;/);
});

test("dashboard: la tarjeta se auto-hidrata sola, limitada por throttle (jul-27)", () => {
  // Fix (jul-27): la tarjeta quedaba en "Cargando entregas recientes..." para
  // siempre, porque desde el fix de cuota de jul-2 la hidratacion SOLO corria
  // al entrar a Respuestas/Entregas, nunca al caer en el Dashboard (la pestana
  // activa por defecto al iniciar sesion). Ahora el dashboard se auto-hidrata,
  // pero acotado a una vez cada 30 min por navegador (localStorage) para no
  // repetir el barrido N aprendices x M guias en cada apertura del panel.
  assert.match(adminScript, /const DASHBOARD_HYDRATE_THROTTLE_KEY = "sena_admin_dashboard_hydrate_last_v1";/);
  assert.match(adminScript, /const DASHBOARD_HYDRATE_THROTTLE_MS = 30 \* 60 \* 1000;/);
  assert.match(adminScript, /function maybeAutoHydrateDashboard\(\)/);
  assert.match(adminScript, /if \(state\.activeModule !== "dashboard"\) return;/);
  assert.match(adminScript, /if \(guideStatesHydrated \|\| isDashboardHydrateThrottled\(\)\) return;/);
  // Se llama desde renderDashboard() (la vista inicial del panel admin).
  assert.match(adminScript, /renderRecentDeliveries\(\);\s*\n\s*maybeAutoHydrateDashboard\(\);/);
  // markDashboardHydrateNow() se marca en ambos caminos de exito de
  // ensureGuideStatesHydrated (con y sin Firebase disponible).
  assert.match(adminScript, /markDashboardHydrateNow\(\);\s*\n\s*return false;/);
  assert.match(adminScript, /guideStatesHydrated = true;\s*\n\s*markDashboardHydrateNow\(\);\s*\n\s*return changed;/);
});
