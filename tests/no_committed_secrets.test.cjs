"use strict";
// Fase 15 (CI): guardia LIVIANA y de bajo falso-positivo contra secretos
// reales pegados por error en archivos rastreados por git. Complementa (no
// reemplaza) un escaner generico en CI (gitleaks) -- aqui solo van patrones
// MUY especificos de este proyecto donde un falso positivo es casi
// imposible, para que esta prueba pueda correr siempre en `node --test` sin
// volverse ruidosa.
//
// A proposito NO se marca como secreto (ver CLAUDE.md "Security Notes"):
// - La apiKey publica de Firebase en js/firebase-config.js (intencional,
//   la seguridad depende de Firestore Rules, no de ocultar esta clave).
// - IDs de proyecto/carpetas de Drive publicas necesarias para el frontend.
// - passwordHash (hash SHA-256, no la contraseña real) en portal_auth.js.
// - El NOMBRE "REGISTRATION_CODE_SECRET" usado como CLAVE de Script
//   Property (getScriptProperty("REGISTRATION_CODE_SECRET")) -- el secreto
//   real vive solo en la consola de Apps Script, nunca en git.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");

function trackedFiles() {
  // Solo archivos que git YA rastrea (o que se acaban de agregar al stage) --
  // coherente con "esto protege lo que puede llegar a un commit", no un
  // escaneo de disco completo (que incluiria .env local, node_modules, etc.
  // que .gitignore ya excluye a proposito).
  const out = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function isTextFile(relPath) {
  return /\.(js|cjs|mjs|html|json|gs|md|yml|yaml|css|txt)$/i.test(relPath);
}

const files = trackedFiles().filter(isTextFile);

test("hay archivos rastreados para revisar (evita un falso verde silencioso)", () => {
  assert.ok(files.length > 100, `se esperaban muchos archivos rastreados, se encontraron ${files.length}`);
});

// Patrones de alta confianza: si alguno de estos aparece, es casi seguro un
// secreto real, sin importar el archivo.
const HIGH_CONFIDENCE_PATTERNS = [
  { name: "clave privada PEM", re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: "JSON de cuenta de servicio de Firebase/GCP", re: /"type"\s*:\s*"service_account"/ },
  { name: "campo private_key de cuenta de servicio", re: /"private_key"\s*:\s*"-----BEGIN/ },
  // client_secret con un VALOR asignado (no solo la palabra en un comentario
  // o el nombre de un campo vacio).
  { name: "client_secret con valor", re: /client_secret["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i },
];

test("ningun archivo rastreado contiene una clave privada o un JSON de cuenta de servicio", () => {
  const problems = [];
  files.forEach((relPath) => {
    const fullPath = path.join(ROOT, relPath);
    let content;
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch (e) {
      return; // binario o ilegible como texto: fuera del alcance de esta prueba
    }
    HIGH_CONFIDENCE_PATTERNS.forEach(({ name, re }) => {
      if (re.test(content)) {
        problems.push(`${relPath}: coincide con patron de alto riesgo (${name})`);
      }
    });
  });
  assert.deepEqual(problems, [], problems.join("\n"));
});

// REGISTRATION_CODE_SECRET (Fase 6): el NOMBRE puede aparecer (es publico a
// proposito, documenta donde configurar el secreto real en Apps Script). Lo
// que NUNCA debe aparecer es una ASIGNACION de valor junto a ese nombre.
test("REGISTRATION_CODE_SECRET nunca aparece con un valor asignado, solo como nombre de Script Property", () => {
  const problems = [];
  files.forEach((relPath) => {
    const fullPath = path.join(ROOT, relPath);
    let content;
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch (e) {
      return;
    }
    // Coincide "REGISTRATION_CODE_SECRET" = "algo" o : "algo" (asignacion),
    // pero NO getScriptProperty("REGISTRATION_CODE_SECRET") ni comentarios
    // que solo nombran la property.
    const assignmentRe = /REGISTRATION_CODE_SECRET["']?\s*[:=]\s*["'][^"']{4,}["']/;
    if (assignmentRe.test(content)) {
      problems.push(`${relPath}: REGISTRATION_CODE_SECRET aparece con un valor asignado`);
    }
  });
  assert.deepEqual(problems, [], problems.join("\n"));
});

// Contrasenas administrativas: distingue un HASH (passwordHash: "d3be23...",
// ya documentado como el hash publico del admin bootstrap) de una
// contrasena en texto plano asignada a una variable que se llama password
// (sin "Hash"). No marca `type="password"` (atributo HTML) ni la palabra
// "contraseña" en textos de interfaz.
test("no hay contraseñas en texto plano asignadas a una variable/campo (solo hashes ya documentados)", () => {
  const problems = [];
  // (?<![-\/\w]) evita coincidir dentro de identificadores compuestos como
  // "auth/wrong-password" o "weak-password" (codigos de error de Firebase
  // Auth, no una contraseña real) -- exige que "password" empiece la clave.
  const plainPasswordRe = /(?<![-/\w])password["']?\s*[:=]\s*["'][^"']{4,}["']/gi;
  files.forEach((relPath) => {
    if (relPath.startsWith("tests/")) return; // fixtures de prueba, no credenciales reales
    const fullPath = path.join(ROOT, relPath);
    let content;
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch (e) {
      return;
    }
    let match;
    while ((match = plainPasswordRe.exec(content))) {
      const context = content.slice(Math.max(0, match.index - 20), match.index);
      if (/passwordHash/i.test(context) || /passwordHash/i.test(match[0])) continue;
      problems.push(`${relPath}: posible contraseña en texto plano cerca de "${match[0].slice(0, 40)}"`);
    }
  });
  assert.deepEqual(problems, [], problems.join("\n"));
});
