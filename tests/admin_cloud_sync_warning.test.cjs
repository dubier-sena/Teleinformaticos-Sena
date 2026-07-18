const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, fileName), "utf8");
}

// El gate de pre-fetch de firebase_db.js suprime las peticiones a Firestore
// cuando no hay sesion Firebase: sin fetch no hay 401 y el banner reactivo no
// se entera. Estas piezas hacen visible al admin la sesion sin sync y le dan
// recuperacion autoservicio (incidente del 02-jun-2026).

test("el banner expone una API directa para estados que el hook de fetch no ve", () => {
  const banner = read(path.join("js", "firebase_status_banner.js"));

  assert.match(banner, /window\.portalSyncBanner\s*=\s*\{/);
  assert.match(banner, /warn:\s*function/);
  assert.match(banner, /hide:\s*function/);
});

test("el login admin registra el estado de sync y avisa cuando el bridge falla", () => {
  const auth = read(path.join("js", "portal_auth.js"));

  assert.match(auth, /ADMIN_CLOUD_SYNC_KEY\s*=\s*"sena_portal_admin_cloud_sync_v1"/);
  assert.match(auth, /status:\s*"broken"/);
  assert.match(auth, /buildAdminNoSyncMessage/);
  assert.match(auth, /portalSyncBanner\?\.warn\(buildAdminNoSyncMessage/);
});

test("existe recuperacion autoservicio sin bump de version para el admin", () => {
  const auth = read(path.join("js", "portal_auth.js"));

  assert.match(auth, /auth\.recoverAdminCloudAccess\s*=\s*async function/);
  // Reusa la primitiva del bridge que entra con la contrasena vieja y la
  // actualiza a la actual (misma cuenta, mismo uid, mismo doc role).
  assert.match(auth, /b\.changePassword\(profile\.usernameKey,\s*oldPwd,\s*newPwd\)/);
  // Valida la contrasena actual contra el hash local antes de escribirla en
  // la nube, para no dejar Firebase desalineado otra vez.
  assert.match(auth, /prevLoginAdmin\.call\(auth,\s*newPwd\)/);
  // La memoria de la contrasena es SOLO en memoria: jamas debe persistirse.
  assert.doesNotMatch(auth, /localStorage\.setItem\([^)]*adminPasswordForRecovery/);
});

test("las paginas admin detectan proactivamente la sesion sin token", () => {
  const auth = read(path.join("js", "portal_auth.js"));

  assert.match(auth, /scheduleAdminCloudSyncCheck/);
  assert.match(auth, /waitForAuthHydration\(3000\)/);
});

test("el bridge conserva la primitiva changePassword que usa la recuperacion", () => {
  const bridge = read(path.join("js", "firebase_auth_bridge.js"));

  assert.match(bridge, /async function changePassword\(usernameKey, oldPassword, newPassword, version\)/);
  assert.match(bridge, /changePassword:\s*changePassword/);
});
