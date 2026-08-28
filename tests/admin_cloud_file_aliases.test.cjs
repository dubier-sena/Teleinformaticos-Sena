"use strict";
// El nombre del documento de Firestore de una guia se resuelve con un mapa de
// alias (pageFile -> cloudFile) que esta DUPLICADO en varios modulos. La copia
// canonica vive en js/firebase_db.js (guideDataFileName); el panel de admin
// tiene la suya en js/admin_habilitacion.js (CLOUD_FILE_ALIASES). Si una copia
// se queda atras, el admin hace pull del documento equivocado y el grupo
// aparece VACIO en habilitacion, sin error en consola.
//
// Esto ya paso con Redes Santa Barbara Guia 2 / RAP01 (sb_10a/10b_redes.html):
// firebase_db.js tenia el alias pero admin_habilitacion.js no.
//
// Invariante: para TODA guia asignada a una ficha (las unicas que el admin
// recorre via getGuidesForFicha), el cloud-file que resuelve el admin debe ser
// el mismo que resuelve el mapa canonico de firebase_db.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, ...rel.split("/")), "utf8");
}

// Extrae el primer objeto literal { ... } que aparece despues de la ultima de
// las `anchors` (que se buscan en orden), contando llaves balanceadas e
// ignorando cadenas y comentarios (los mapas de alias llevan comentarios con
// llaves, p.ej. "sb_{grupo}_redes.html"). Encadenar anclas permite saltar la
// llave del cuerpo de una funcion y caer en el objeto correcto.
function extractObjectLiteral(source, ...anchors) {
  let from = 0;
  for (const anchor of anchors) {
    const idx = source.indexOf(anchor, from);
    assert.notStrictEqual(idx, -1, "no se encontro el ancla: " + anchor);
    from = idx + anchor.length;
  }
  const start = source.indexOf("{", from);
  assert.notStrictEqual(start, -1, "no hay llave de apertura tras: " + anchors.join(" -> "));

  let depth = 0;
  let i = start;
  for (; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === quote) break;
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "/") {
      const nl = source.indexOf("\n", i);
      i = nl === -1 ? source.length : nl;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return source.slice(start, i);
}

function evalLiteral(literal) {
  // Los literales son datos puros (no referencian variables externas).
  return new Function("return (" + literal + ");")();
}

const adminSrc = read("js/admin_habilitacion.js");
const dbSrc = read("js/firebase_db.js");
const authSrc = read("js/portal_auth.js");

const ADMIN_ALIASES = evalLiteral(extractObjectLiteral(adminSrc, "CLOUD_FILE_ALIASES ="));
const CANON_ALIASES = evalLiteral(extractObjectLiteral(dbSrc, "function guideDataFileName", "var aliases ="));
const FICHA_MAP = evalLiteral(extractObjectLiteral(authSrc, "FICHA_MAP ="));

const adminResolve = (page) => ADMIN_ALIASES[page] || page;
const canonResolve = (page) => CANON_ALIASES[page] || page;

// Conjunto de guias realmente asignadas a alguna ficha (las que el admin recorre).
const fichaGuides = [...new Set(
  Object.values(FICHA_MAP).flatMap((f) => (f && f.guias) || [])
)];

test("los mapas de alias se parsean a objetos no vacios", () => {
  assert.ok(Object.keys(ADMIN_ALIASES).length > 0, "CLOUD_FILE_ALIASES (admin) vacio");
  assert.ok(Object.keys(CANON_ALIASES).length > 0, "aliases canonico (firebase_db) vacio");
  assert.ok(fichaGuides.length > 0, "FICHA_MAP no produjo guias");
});

test("toda guia asignada a una ficha resuelve al mismo cloud-file en admin y en firebase_db", () => {
  for (const page of fichaGuides) {
    const admin = adminResolve(page);
    const canon = canonResolve(page);
    assert.strictEqual(
      admin,
      canon,
      `${page}: el admin resuelve "${admin}" pero el canonico (firebase_db) resuelve "${canon}". ` +
      `Sincroniza CLOUD_FILE_ALIASES en js/admin_habilitacion.js con guideDataFileName en js/firebase_db.js.`
    );
  }
});

test("las claves compartidas entre admin y canonico no se contradicen", () => {
  for (const key of Object.keys(ADMIN_ALIASES)) {
    if (key in CANON_ALIASES) {
      assert.strictEqual(
        ADMIN_ALIASES[key],
        CANON_ALIASES[key],
        `alias en conflicto para ${key}: admin="${ADMIN_ALIASES[key]}" vs firebase_db="${CANON_ALIASES[key]}"`
      );
    }
  }
});

test("regresion: Redes Santa Barbara Guia 2 / RAP01 resuelve al doc con alias sb_*_redes", () => {
  // El bug original: el admin devolvia el nombre crudo y el grupo salia vacio.
  assert.strictEqual(adminResolve("santa-barbara-10a-guia-02-redes-rap01.html"), "sb_10a_redes.html");
  assert.strictEqual(adminResolve("santa-barbara-10b-guia-02-redes-rap01.html"), "sb_10b_redes.html");
});

test("regresion (Bloque G, 2026-08-27): Guia 5 Documentar Gestion (JFK 10) y Guia 8 (SB 11) resuelven a su alias corto, no al nombre crudo", () => {
  // Mismo bug de fondo que Redes: ambas guias faltaban en las dos copias de
  // la tabla (admin_habilitacion.js y firebase_db.js), asi que "Cargar estado
  // desde la nube" buscaba el doc con el pageFile crudo, no encontraba nada, y
  // el grupo salia vacio en Habilitacion SIN error en consola.
  assert.strictEqual(adminResolve("grupo-10a-guia-05-documentar-gestion-informacion.html"), "10a_guia5doc.html");
  assert.strictEqual(adminResolve("grupo-10b-guia-05-documentar-gestion-informacion.html"), "10b_guia5doc.html");
  assert.strictEqual(adminResolve("grupo-11a-guia-08-documentar-gestion-informacion.html"), "11a_guia8.html");
  assert.strictEqual(adminResolve("grupo-11b-guia-08-documentar-gestion-informacion.html"), "11b_guia8.html");
});

test("Bloque G: guide_declarations.js declara cloudFileNames para Guia 5 doc y Guia 8 (fuente unica para guias nuevas)", () => {
  const declSrc = read("js/guide_declarations.js");
  const pairs = [
    ["grupo-10a-guia-05-documentar-gestion-informacion.html", "10a_guia5doc.html"],
    ["grupo-10b-guia-05-documentar-gestion-informacion.html", "10b_guia5doc.html"],
    ["grupo-11a-guia-08-documentar-gestion-informacion.html", "11a_guia8.html"],
    ["grupo-11b-guia-08-documentar-gestion-informacion.html", "11b_guia8.html"],
  ];
  for (const [pageFile, cloudFile] of pairs) {
    const re = new RegExp(
      `"${pageFile.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"\\s*:\\s*"${cloudFile.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"`
    );
    assert.match(declSrc, re, `guide_declarations.js deberia declarar cloudFileNames["${pageFile}"] = "${cloudFile}"`);
  }
});

// ── Cobertura ampliada a TODAS las copias del mapa ──────────────────────────
// El alias pageFile->cloudFile esta duplicado en muchos modulos: firebase_db
// (canonico), admin_habilitacion, admin_usuarios, guia_template, script.js,
// script_guia2/3/5/6.js (directos) y activity_deadlines.js (INVERSO,
// cloudFile->pageFile). Si cualquiera se desincroniza de la canonica, el
// modulo afectado resuelve el documento equivocado (fue el bug de Redes:
// el grupo aparecia vacio sin error). Este test recorre TODOS los js/ y exige
// que ninguna copia contradiga la canonica, en sentido directo o inverso.
function listJsFiles() {
  return fs
    .readdirSync(path.join(ROOT, "js"))
    .filter((n) => n.endsWith(".js") && !n.endsWith(".min.js"))
    .map((n) => "js/" + n);
}

// Extrae todos los pares literales "x.html": "y.html" (ignora ejemplos en
// comentarios como "sb_{grupo}_redes.html" porque la llave rompe el patron).
function extractHtmlAliasPairs(source) {
  const re = /"([a-zA-Z0-9_.-]+\.html)"\s*:\s*"([a-zA-Z0-9_.-]+\.html)"/g;
  const pairs = [];
  let m;
  while ((m = re.exec(source))) {
    pairs.push([m[1], m[2]]);
  }
  return pairs;
}

test("ninguna copia del mapa de alias contradice la canonica de firebase_db", () => {
  const offenders = [];
  for (const rel of listJsFiles()) {
    for (const [key, value] of extractHtmlAliasPairs(read(rel))) {
      if (key in CANON_ALIASES) {
        // Mapa directo (pageFile -> cloudFile): el cloud-file debe coincidir.
        if (CANON_ALIASES[key] !== value) {
          offenders.push(
            `${rel}: directo "${key}" -> "${value}" pero canonico -> "${CANON_ALIASES[key]}"`
          );
        }
      } else if (value in CANON_ALIASES) {
        // Mapa inverso (cloudFile -> pageFile, p.ej. activity_deadlines.js):
        // la clave (cloud-file) debe ser el cloud-file canonico del pageFile.
        if (CANON_ALIASES[value] !== key) {
          offenders.push(
            `${rel}: inverso "${key}" <- "${value}" pero canonico del pageFile -> "${CANON_ALIASES[value]}"`
          );
        }
      }
      // else: alias extra (subpaginas de actividad o plantillas grado-XX) que
      // no toca llaves canonicas; no se valida cobertura, solo no-contradiccion.
    }
  }
  assert.deepStrictEqual(
    offenders,
    [],
    "Copias del alias pageFile<->cloudFile desincronizadas con js/firebase_db.js:\n  " +
      offenders.join("\n  ")
  );
});
