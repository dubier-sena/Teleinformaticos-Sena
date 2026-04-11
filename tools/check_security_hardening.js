const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const firebaseJs = read(path.join("js", "firebase_db.js"));
const firestoreRules = read("firestore.rules");
const indexHtml = read("index.html");

assert(
  !firebaseJs.includes('var FIREBASE_PROJECT_ID = "sena-portal"'),
  "firebase_db.js aun expone un projectId real en el repositorio."
);

assert(
  !/AIzaSy[0-9A-Za-z_-]{20,}/.test(firebaseJs),
  "firebase_db.js aun expone una apiKey real en el repositorio."
);

assert(
  firebaseJs.includes('sena_portal_firebase_runtime_v1'),
  "firebase_db.js debe leer configuracion segura desde runtime local."
);

assert(
  firebaseJs.includes("window.PORTAL_FIREBASE_CONFIG"),
  "firebase_db.js debe aceptar configuracion inyectada en runtime."
);

assert(
  !firebaseJs.includes("cloudGetUser:") &&
    !firebaseJs.includes("cloudListUsers:") &&
    !firebaseJs.includes("cloudGetProgress:"),
  "window._firebaseDb aun expone metodos innecesarios para la UI publica."
);

assert(
  !/allow\s+read\s*,\s*write\s*:\s*if\s+true\s*;/.test(firestoreRules),
  "Las reglas de Firestore siguen abiertas con allow read, write: if true."
);

assert(
  /allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/.test(firestoreRules),
  "Las reglas de Firestore deben quedar cerradas por defecto."
);

assert(
  !indexHtml.includes('endpoint.searchParams.set("token", session.token);'),
  "index.html aun envia el token del administrador por la URL."
);

console.log("OK: la pasada de limpieza y endurecimiento elimina datos sensibles visibles y cierra Firebase por defecto.");
