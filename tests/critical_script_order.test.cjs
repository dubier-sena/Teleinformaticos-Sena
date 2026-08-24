"use strict";
// Fase 15 (CI): guardia estatica de orden de carga entre scripts con una
// dependencia critica conocida. Nace de un bug REAL encontrado en Fase 14
// (verificacion en navegador, no la detecto la suite de Node hasta entonces):
// al insertar mecanicamente <script src="js/guide_merge_utils.js"> antes de
// firebase_db.js en 43 paginas, en 7 de ellas la etiqueta original de
// firebase_db.js NO tenia "defer" y la nueva SI -- firebase_db.js (sincrono,
// se ejecuta de inmediato al parsear) terminaba corriendo ANTES que
// guide_merge_utils.js (diferido, espera a que termine de parsear todo el
// documento), y firebase_db.js reventaba con TypeError al arrancar.
//
// Esta prueba cubre exactamente esa clase de bug para las dependencias
// criticas conocidas del proyecto, en TODAS las paginas HTML reales (no
// plantillas) y en las listas de scripts que inyecta js/guia_router.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function listHtmlFiles(dir, out) {
  out = out || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === path.join(ROOT, "sources", "generated")) continue; // plantillas, no paginas reales
      listHtmlFiles(full, out);
    } else if (entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

// { before, after }: `before` debe estar ya cargado/ejecutado cuando `after`
// arranca. Los nombres son tal como aparecen en el atributo src (sin ruta
// relativa ni query de cache-bust).
const CRITICAL_STATIC_ORDER_PAIRS = [
  { before: "guide_merge_utils.js", after: "firebase_db.js" },
  { before: "portal_auth.js", after: "guia_router.js" },
  { before: "portal_auth.js", after: "access_guard_admin.js" },
  { before: "portal_auth.js", after: "access_guard_authenticated.js" },
];

// Encuentra <script ...src="...basename..."...></script> (con o sin "defer",
// con o sin ruta/query) y devuelve {index, deferred} o null si no esta en el
// archivo. index es la posicion del MATCH en el texto (sirve para comparar
// orden entre dos scripts del mismo archivo).
function findScriptTag(html, basename) {
  const re = new RegExp(
    '<script\\b[^>]*\\bsrc="[^"]*/?' + basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '(?:\\?[^"]*)?"[^>]*>',
    "i"
  );
  const match = re.exec(html);
  if (!match) return null;
  return { index: match.index, deferred: /\bdefer\b/i.test(match[0]) };
}

const htmlFiles = listHtmlFiles(ROOT);

test("hay paginas HTML reales para revisar (evita un falso verde silencioso)", () => {
  assert.ok(htmlFiles.length > 50, `se esperaban muchas paginas HTML, se encontraron ${htmlFiles.length}`);
});

CRITICAL_STATIC_ORDER_PAIRS.forEach(({ before, after }) => {
  test(`orden de carga: ${before} debe ejecutarse antes que ${after} en toda pagina que use ambos`, () => {
    const problems = [];
    htmlFiles.forEach((filePath) => {
      const html = fs.readFileSync(filePath, "utf8");
      const beforeTag = findScriptTag(html, before);
      const afterTag = findScriptTag(html, after);
      if (!beforeTag || !afterTag) return; // esta pagina no usa el par, no aplica

      const relPath = path.relative(ROOT, filePath);
      if (beforeTag.index >= afterTag.index) {
        problems.push(`${relPath}: ${before} aparece DESPUES de ${after} (o en la misma etiqueta)`);
        return;
      }
      // Si "after" es sincrono (sin defer), "before" TAMBIEN debe serlo --
      // si "before" quedara diferido, "after" (inmediato) podria ejecutar
      // primero pese a aparecer despues en el documento. Ver comentario de
      // cabecera (bug real de Fase 14).
      if (!afterTag.deferred && beforeTag.deferred) {
        problems.push(
          `${relPath}: ${after} es sincrono (sin defer) pero ${before} esta diferido -- ` +
          `${after} podria ejecutarse ANTES de que ${before} este listo`
        );
      }
    });
    assert.deepEqual(problems, [], problems.join("\n"));
  });
});

// ── guia_router.js: dependencias dentro de las listas "scripts: [...]" que
//    inyecta por ruta. El propio router carga estos scripts en un for-await
//    secuencial (ver loadScript/loop en guia_router.js) -- por eso aqui basta
//    con comparar la POSICION dentro del arreglo, no defer/async.
const CRITICAL_ROUTER_ORDER_PAIRS = [
  { before: "js/activity_standard.js", after: "js/guide_declarations.js" },
  { before: "js/word_search_generator.js", after: "js/script_guia2.js" },
  { before: "js/export_styles.js", after: "js/script_guia_redes.js" },
];

function parseRouterScriptArrays(routerSrc) {
  // Cada ruta declara "scripts: [ ...líneas "archivo?v=...", ... ]". Se
  // extraen los arreglos completos (no todo el archivo es un solo array).
  const arrays = [];
  const re = /scripts:\s*\[([\s\S]*?)\]/g;
  let match;
  while ((match = re.exec(routerSrc))) {
    const items = Array.from(match[1].matchAll(/"([^"]+)"/g)).map((m) => m[1].split("?")[0]);
    arrays.push(items);
  }
  return arrays;
}

test("guia_router.js: dependencias criticas dentro de cada lista de scripts por ruta", () => {
  const routerSrc = fs.readFileSync(path.join(ROOT, "js", "guia_router.js"), "utf8");
  const arrays = parseRouterScriptArrays(routerSrc);
  assert.ok(arrays.length > 5, "se esperaban varias rutas con listas de scripts");

  const problems = [];
  arrays.forEach((scripts, arrayIndex) => {
    CRITICAL_ROUTER_ORDER_PAIRS.forEach(({ before, after }) => {
      const beforeIdx = scripts.indexOf(before);
      const afterIdx = scripts.indexOf(after);
      if (beforeIdx === -1 || afterIdx === -1) return; // esta ruta no usa el par
      if (beforeIdx >= afterIdx) {
        problems.push(`ruta #${arrayIndex}: ${before} debe ir antes que ${after} en el arreglo scripts`);
      }
    });
  });
  assert.deepEqual(problems, [], problems.join("\n"));
});
