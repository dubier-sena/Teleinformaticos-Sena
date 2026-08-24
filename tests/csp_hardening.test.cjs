"use strict";

// Fase 13 (auditoria profunda, CSP): endurecimiento progresivo, sin quitar
// 'unsafe-inline' de golpe (quedan bloques inline grandes y fragiles fuera
// de alcance de esta fase -- ver comentario mas abajo). Esta suite es el
// "trinquete" (ratchet) pedido por el usuario: los numeros de aqui son la
// foto EXACTA del estado tras consolidar los 6 guardias de acceso
// duplicados en js/access_guard_admin.js / js/access_guard_authenticated.js
// (2026-08-23). Una modificacion futura puede volver a REDUCIR estos
// numeros (mas consolidacion) sin problema, pero si los AUMENTA, esta
// suite falla -- asi una edicion futura no puede reabrir la superficie CSP
// sin que alguien lo note aqui primero.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const EXCLUDED_DIRS = new Set([
  ".git", "tmp", ".superpowers", "node_modules", ".claude", ".agents", ".firebase", "__pycache__",
]);

function findHtmlFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

function countInlineSurface() {
  const files = findHtmlFiles(ROOT, []);
  let scriptBlocks = 0;
  let styleAttrs = 0;
  let styleTags = 0;
  const perFileScripts = [];

  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    const scripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi) || [];
    const realScripts = scripts.filter((block) => {
      const inner = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
      if (!inner) return false; // <script></script> vacio, nada que auditar
      if (/type\s*=\s*["']application\/ld\+json["']/i.test(block)) return false;
      return true;
    });
    if (realScripts.length) perFileScripts.push([path.relative(ROOT, file), realScripts.length]);
    scriptBlocks += realScripts.length;
    styleAttrs += (html.match(/\sstyle\s*=\s*"/gi) || []).length;
    styleTags += (html.match(/<style[\s>]/gi) || []).length;
  }

  return { files, scriptBlocks, styleAttrs, styleTags, perFileScripts };
}

// Baseline congelado el 2026-08-23, justo despues de mover los 6 guardias de
// acceso duplicados a js/access_guard_admin.js / access_guard_authenticated.js
// (61 -> 55 bloques de script inline). NO subir estos numeros sin una razon
// documentada -- si una guia nueva agrega su propio <script> inline en vez de
// reusar un archivo .js existente, esta prueba debe fallar.
//
// styleAttrs 2745 -> 2748 (2026-08-24, Fase 15/CI): sources/generated/
// guia-02-matriz-322.template.html estaba MUY desactualizado (windows-build-
// check lo detecto por primera vez -- nunca habia corrido en CI antes de esta
// fase) y le faltaba el mecanismo de entrega a Drive que las paginas YA
// publicadas (pages/auxiliares/grupo-{10a,10b}-guia-02-actividad-322-matriz.html)
// tenian desde hace tiempo. Al restaurar ese bloque en la plantilla (para que
// el build vuelva a coincidir con lo que ya esta en produccion) se
// reincorporaron 3 atributos style="..." que ya eran parte del sitio real,
// nunca contados aqui porque la plantilla nunca se habia regenerado/auditado.
// No es una superficie nueva: es la plantilla alcanzando la realidad.
const BASELINE = {
  scriptBlocks: 55,
  styleAttrs: 2748,
  styleTags: 23,
};

test("CSP ratchet: los scripts <script> inline (reales) no deben AUMENTAR respecto al baseline", () => {
  const { scriptBlocks, perFileScripts } = countInlineSurface();
  assert.ok(
    scriptBlocks <= BASELINE.scriptBlocks,
    `bloques de script inline = ${scriptBlocks}, supera el baseline (${BASELINE.scriptBlocks}). ` +
    `Archivos con mas scripts inline: ${JSON.stringify(perFileScripts.sort((a, b) => b[1] - a[1]).slice(0, 10))}`
  );
});

test("CSP ratchet: los atributos style=\"...\" inline no deben AUMENTAR respecto al baseline", () => {
  const { styleAttrs } = countInlineSurface();
  assert.ok(styleAttrs <= BASELINE.styleAttrs, `atributos style inline = ${styleAttrs}, supera el baseline (${BASELINE.styleAttrs})`);
});

test("CSP ratchet: los bloques <style> inline no deben AUMENTAR respecto al baseline", () => {
  const { styleTags } = countInlineSurface();
  assert.ok(styleTags <= BASELINE.styleTags, `bloques <style> inline = ${styleTags}, supera el baseline (${BASELINE.styleTags})`);
});

// ── connect-src: hosts explicitos, nunca un comodin generico ────────────────

function allHtmlFiles() {
  return findHtmlFiles(ROOT, []);
}

function cspOf(html) {
  const match = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  return match ? match[1] : null;
}

const EXPECTED_CONNECT_HOSTS = [
  "https://firestore.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://script.google.com",
  "https://script.googleusercontent.com",
  "https://cdn.jsdelivr.net",
];

test("CSP: ninguna pagina debe volver a usar connect-src con un comodin generico (https: o *)", () => {
  const offenders = [];
  for (const file of allHtmlFiles()) {
    const html = fs.readFileSync(file, "utf8");
    const csp = cspOf(html);
    if (!csp) continue;
    const connectMatch = csp.match(/connect-src([^;]*);/);
    if (!connectMatch) continue;
    const connectSrc = connectMatch[1];
    // "https:" genérico (sin ir seguido de "//dominio-especifico") o "*".
    if (/(^|\s)https:(\s|$)/.test(connectSrc) || /(^|\s)\*(\s|$)/.test(connectSrc)) {
      offenders.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(offenders, [], "estas paginas usan un comodin generico en connect-src: " + offenders.join(", "));
});

test("CSP: las paginas que llaman a Firebase/Apps Script declaran EXPLICITAMENTE los 6 hosts confirmados en connect-src", () => {
  // Solo se exige en paginas que realmente cargan portal_auth.js (todas las
  // que necesitan red autenticada) -- la unica pagina 100% estatica sin
  // portal_auth.js puede seguir con connect-src 'self' a secas.
  const missing = [];
  for (const file of allHtmlFiles()) {
    const html = fs.readFileSync(file, "utf8");
    if (!/portal_auth\.js/.test(html)) continue;
    const csp = cspOf(html);
    if (!csp) { missing.push(path.relative(ROOT, file) + " (sin CSP)"); continue; }
    const connectMatch = csp.match(/connect-src([^;]*);/);
    const connectSrc = connectMatch ? connectMatch[1] : "";
    const missingHosts = EXPECTED_CONNECT_HOSTS.filter((host) => connectSrc.indexOf(host) === -1);
    if (missingHosts.length) {
      missing.push(path.relative(ROOT, file) + " (falta: " + missingHosts.join(", ") + ")");
    }
  }
  assert.deepEqual(missing, [], "paginas con connect-src incompleto: " + missing.join(" | "));
});

test("CSP: la pagina 100% estatica conserva connect-src 'self' (mas estricto que el resto, no se afloja)", () => {
  const html = fs.readFileSync(
    path.join(ROOT, "pages", "auxiliares", "santa-barbara-guia-02-contenido-teorico-redes.html"),
    "utf8"
  );
  assert.doesNotMatch(html, /portal_auth\.js/, "si esta pagina alguna vez necesita portal_auth.js, su CSP debe revisarse (ya no es 100% estatica)");
  const csp = cspOf(html);
  assert.match(csp, /connect-src 'self';/);
});

// ── Guardias de acceso: consolidadas, sin duplicados, sin paginas huerfanas ─

test("Fase 13 -- los 6 guardias de acceso duplicados quedaron consolidados en 2 archivos compartidos", () => {
  const adminGuardFiles = [
    "calendario-academico-2026.html",
    "etapa-productiva-admin.html",
    "panel-administrativo-usuarios.html",
  ];
  const authGuardFiles = [
    "pages/auxiliares/talleres-refuerzo.html",
    "pages/auxiliares/autorizacion-firma.html",
    "pages/auxiliares/calendario-aprendiz.html",
  ];

  adminGuardFiles.forEach((rel) => {
    const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.match(html, /<script src="js\/access_guard_admin\.js\?v=[^"]+"><\/script>/, rel + " debe referenciar access_guard_admin.js");
    assert.doesNotMatch(html, /requireAdminAccess\(\{ redirectUrl: "index\.html" \}\)/, rel + " no debe conservar el guardia inline duplicado");
  });

  authGuardFiles.forEach((rel) => {
    const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.match(html, /<script src="js\/access_guard_authenticated\.js\?v=[^"]+"><\/script>/, rel + " debe referenciar access_guard_authenticated.js");
    assert.doesNotMatch(html, /session\.role !== "student" && session\.role !== "admin"/, rel + " no debe conservar el guardia inline duplicado");
  });

  const adminGuardSource = fs.readFileSync(path.join(ROOT, "js", "access_guard_admin.js"), "utf8");
  assert.match(adminGuardSource, /requireAdminAccess\(\{ redirectUrl: "index\.html" \}\)/);
  const authGuardSource = fs.readFileSync(path.join(ROOT, "js", "access_guard_authenticated.js"), "utf8");
  assert.match(authGuardSource, /session\.role !== "student" && session\.role !== "admin"/);
});

// ── Deuda tecnica documentada (NO se toca en esta fase) ─────────────────────
// Bloques inline grandes identificados como fragiles/riesgosos de mover sin
// una pasada dedicada con su propia regresion:
//   - calendario-academico-2026.html: motor completo del calendario admin
//     (~1350 lineas) -- historial reciente de bugs de horario, ver memoria
//     "calendario-horario-lunes-recuperado-jul21".
//   - partials/guia-01-induccion-content.html: motor de la Guia 1
//     (~1878 lineas) -- historial de doble-init fragil, ver memoria
//     "fix-jul8-induccion-arbol-curricular".
//   - pages/auxiliares/grupo-{10a,10b}-guia-02-actividad-322-matriz.html:
//     generados desde sources/generated/guia-02-matriz-322.template.html
//     (tests/generated_pages_build.test.cjs) -- moverlos exige tocar el
//     template, no las paginas generadas.
// Este test.todo es el recordatorio permanente en la suite; no falla la
// build, solo queda visible en el conteo de "todo".
test.todo(
  "Deuda tecnica CSP: mover a archivos externos el motor inline del calendario admin " +
  "(~1350 lineas) y el motor inline de la Guia 1 (~1878 lineas) requiere una fase dedicada " +
  "con regresion propia -- fuera de alcance de la Fase 13."
);
