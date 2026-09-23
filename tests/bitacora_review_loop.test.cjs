// "Revision de bitacora con IA" (Etapa Productiva, SB 11A/11B, 2026-09-23).
// El portal NO procesa bitacoras ni llama a ninguna IA: entrega el LOOP para
// copiar/descargar. Aqui se verifica:
//   1. Integridad de la fuente unica del LOOP (data/bitacora_review_prompt.js).
//   2. Visibilidad por ficha ejecutando el buildResourcesMarkup REAL
//      (productive_stage_project_delivery.js), aprendiz e instructor.
//   3. Modal: instrucciones, documentos, privacidad, LOOP completo, copiar
//      (con y sin navigator.clipboard), descargar y cerrar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { createDocument, isRendered } = require("./_mini_dom.cjs");

const REPO_ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
const PROMPT_SRC = read("data/bitacora_review_prompt.js");
const LOOP_SRC = read("js/bitacora_review_loop.js");
const DELIVERY_SRC = read("js/productive_stage_project_delivery.js");
const AUTH_SRC = read("js/portal_auth.js");

function makeStorage() {
  const data = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

function loadLoopText() {
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(PROMPT_SRC, ctx);
  return ctx.BITACORA_REVIEW_LOOP;
}

// ─── 1. Integridad del LOOP ────────────────────────────────────────────────
// La huella fija el texto entregado por el instructor: cualquier edicion
// (resumir, reescribir, quitar una regla) rompe esta prueba a proposito.
const LOOP_SHA256 = "a30f1478c6a8eded5f32bc2a361c837a2da56b45e2728a4b4f60d6e215984f37";
const LOOP_LENGTH = 14892;

test("LOOP: el texto coincide byte a byte con el entregado (huella SHA-256 y longitud)", () => {
  const { text } = loadLoopText();
  assert.equal(text.length, LOOP_LENGTH);
  assert.equal(crypto.createHash("sha256").update(text, "utf8").digest("hex"), LOOP_SHA256);
});

test("LOOP: comienza con el titulo correcto y el ROL", () => {
  const { text, title } = loadLoopText();
  assert.equal(title, "LOOP — REVISIÓN Y CORRECCIÓN DE BITÁCORAS SENA CON VALIDACIÓN CURRICULAR");
  assert.ok(text.startsWith(title + "\n\nROL\n\nActúa como instructor SENA encargado de revisar bitácoras de etapa productiva."));
});

test("LOOP: contiene los 33 bloques numerados, en orden y sin repetir", () => {
  const { text } = loadLoopText();
  const numbers = [...text.matchAll(/^={50}\n(\d+)\. .+\n={50}$/gm)].map((m) => Number(m[1]));
  assert.deepEqual(numbers, Array.from({ length: 33 }, (_, i) => i + 1));
});

test("LOOP: conserva la prohibicion de 999999999 en todos sus puntos", () => {
  const { text } = loadLoopText();
  assert.equal((text.match(/999999999/g) || []).length, 22);
  assert.match(text, /4\. PROHIBICIÓN ABSOLUTA DEL CÓDIGO 999999999/);
  assert.match(text, /5\. 999999999 NO ES UNA OPCIÓN/);
  assert.match(text, /NO utilizar 999999999 bajo ninguna circunstancia como competencia final\./);
  assert.match(text, /1\. ¿Aparece 999999999\?\n\nSI → ERROR\./);
});

test("LOOP: formato obligatorio, DATOS POR CONFIRMAR, CONTROL FINAL y cierre completo", () => {
  const { text } = loadLoopText();
  assert.match(text, /29\. FORMATO OBLIGATORIO/);
  assert.match(text, /### ACTIVIDAD 1\n\n\*\*Descripción de la actividad:\*\*/);
  assert.match(text, /\*\*Competencia:\*\*\n\[código oficial\] — \[denominación oficial exacta\]/);
  assert.match(text, /30\. DATOS POR CONFIRMAR/);
  assert.match(text, /### DATOS POR CONFIRMAR\n\nSin datos pendientes\./);
  assert.match(text, /32\. CONTROL FINAL/);
  assert.match(text, /11\. PRINCIPIO DE CONSERVACIÓN/);
  assert.match(text, /31\. REGLAS ABSOLUTAS/);
  // Termina en "20. DETENTE." (ignorando solo espacios/saltos finales).
  assert.ok(text.trimEnd().endsWith("20. DETENTE."));
});

// Bloque 33 tal como lo entrego el instructor (correccion 2026-09-23: la
// primera version quedo truncada en el paso 15). Se compara literalmente.
const EXPECTED_BLOCK_33 = `==================================================
33. INICIO
==================================================

Comienza ahora.

Para CADA actividad:

1. Lee la actividad.
2. Lee la evidencia.
3. Identifica la competencia actual.

4. SI ES 999999999:
   - DESCÁRTALA INMEDIATAMENTE.
   - NO LA CONSERVES.
   - NO LA USES COMO OPCIÓN.
   - BUSCA LA COMPETENCIA REAL EN EL DISEÑO CURRICULAR.

5. Si es otra competencia:
   - busca su código;
   - verifica denominación;
   - revisa TODOS sus RAP;
   - comprueba RAP ↔ actividad ↔ evidencia.

6. Si corresponde:
   CONSERVAR Y DETENER.

7. Si no corresponde:
   buscar otra competencia mediante RAP.

8. Si falta información:
   REQUIERE ACLARAR LA ACTIVIDAD REALIZADA.

9. Si existe información suficiente pero ningún RAP aplica:
   NO SE IDENTIFICA COMPETENCIA APLICABLE.

10. Verifica fechas.
11. Revisa evidencia.
12. Revisa observaciones.
13. Corrige únicamente lo necesario.
14. Ejecuta el CONTROL FINAL.
15. NO muestres el análisis interno.
16. NO hagas auditoría.
17. NO modifiques el Excel.
18. ENTREGA DIRECTAMENTE LOS CAMPOS LISTOS PARA COPIAR Y PEGAR.
19. Muestra únicamente los datos realmente pendientes.
20. DETENTE.`;

function getBlock33(text) {
  const start = text.indexOf("==================================================\n33. INICIO");
  assert.ok(start > 0, "no se encontro el bloque 33");
  return text.slice(start);
}

test("LOOP: el bloque 33 coincide literalmente con el texto maestro completo (20 pasos)", () => {
  const { text } = loadLoopText();
  assert.equal(getBlock33(text).trimEnd(), EXPECTED_BLOCK_33);
});

test("LOOP: el bloque 33 contiene explicitamente los pasos 15 a 20 y numera 1..20", () => {
  const block = getBlock33(loadLoopText().text);
  for (const line of [
    "15. NO muestres el análisis interno.",
    "16. NO hagas auditoría.",
    "17. NO modifiques el Excel.",
    "18. ENTREGA DIRECTAMENTE LOS CAMPOS LISTOS PARA COPIAR Y PEGAR.",
    "19. Muestra únicamente los datos realmente pendientes.",
    "20. DETENTE.",
  ]) {
    assert.ok(block.split("\n").includes(line), `falta en el bloque 33: ${line}`);
  }
  const steps = [...block.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1])).slice(1);
  assert.deepEqual(steps, Array.from({ length: 20 }, (_, i) => i + 1));
});

test("LOOP: una sola fuente -- el texto no esta duplicado en otros archivos", () => {
  assert.doesNotMatch(LOOP_SRC, /PROHIBICIÓN ABSOLUTA DEL CÓDIGO/);
  assert.doesNotMatch(DELIVERY_SRC, /PROHIBICIÓN ABSOLUTA DEL CÓDIGO/);
  assert.match(LOOP_SRC, /window\.BITACORA_REVIEW_LOOP/);
});

test("sin integracion de IA: no hay llamadas de red ni claves, ni una IA impuesta", () => {
  for (const src of [LOOP_SRC, PROMPT_SRC]) {
    assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon|api[_-]?key/i);
    assert.doesNotMatch(src, /chatgpt|openai|gemini|anthropic|claude\.ai|copilot/i);
  }
});

// ─── 2. Visibilidad por ficha (buildResourcesMarkup real) ──────────────────
function renderResources({ session, search = "", previewStudents = {} }) {
  const document = createDocument();
  const body = document.createElement("div");
  body.id = "student-project-resources-body";
  document.body.appendChild(body);
  const ctx = {
    document,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    location: { protocol: "https:", hostname: "dubier-sena.github.io", pathname: "/Teleinformaticos-Sena/etapa-productiva-estudiante.html", href: "", search },
    navigator: {},
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    addEventListener() {},
    removeEventListener() {},
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(AUTH_SRC, ctx, { filename: "portal_auth.js" });
  ctx.portalAuth.getStudentByUsernameKey = (key) => previewStudents[key] || null;
  vm.runInContext(PROMPT_SRC, ctx, { filename: "bitacora_review_prompt.js" });
  vm.runInContext(LOOP_SRC, ctx, { filename: "bitacora_review_loop.js" });
  vm.runInContext(DELIVERY_SRC, ctx, { filename: "productive_stage_project_delivery.js" });
  ctx.productiveStageProjectDelivery.render({ snapshot: null, viewModel: { projects: [] }, session });
  return { ctx, document, body };
}

function loopCardVisible(body) {
  return body.querySelectorAll("[data-bitacora-loop-card]").filter(isRendered).length === 1;
}

const student = (ficha) => ({ role: "student", user: { ficha, usernameKey: "aprendiz.prueba", fullName: "Aprendiz Prueba" } });
const admin = { role: "admin", user: { username: "dubier", usernameKey: "dubier" } };

for (const ficha of ["3168850", "3168852"]) {
  test(`visibilidad: aprendiz ${ficha} (11°) VE la tarjeta, al lado del Diseño Curricular`, () => {
    const { body } = renderResources({ session: student(ficha) });
    assert.ok(loopCardVisible(body));
    const group = body.querySelector(".student-document-group--reference");
    assert.ok(group, "falta la seccion 5");
    const cards = group.querySelectorAll(".student-project-download-card");
    assert.equal(cards.length, 2);
    assert.match(cards[0].textContent, /Diseno Curricular del programa/);
    assert.match(cards[0].textContent, /Descargar formato/);
    assert.match(cards[1].textContent, /Herramienta de apoyo/);
    assert.match(cards[1].textContent, /Revisión de bitácora con IA/);
    assert.match(cards[1].textContent, /Ver y copiar LOOP/);
  });
}

for (const ficha of ["3441939", "3441942", "3441944", "3441950"]) {
  test(`visibilidad: aprendiz ${ficha} (10°) NO tiene la tarjeta en el HTML (no es solo CSS)`, () => {
    const { body } = renderResources({ session: student(ficha) });
    assert.equal(body.innerHTML.includes("data-bitacora-loop-card"), false);
    assert.equal(body.innerHTML.includes("Ver y copiar LOOP"), false);
  });
}

test("visibilidad: instructor consultando a un aprendiz de 11° (?student=) VE la tarjeta", () => {
  const { body } = renderResources({
    session: admin,
    search: "?student=ana.11a",
    previewStudents: { "ana.11a": { usernameKey: "ana.11a", ficha: "3168850" } },
  });
  assert.ok(loopCardVisible(body));
});

test("visibilidad: instructor consultando a un aprendiz de 10° NO ve la tarjeta", () => {
  for (const ficha of ["3441939", "3441942", "3441944", "3441950"]) {
    const { body } = renderResources({
      session: admin,
      search: "?student=luis.10",
      previewStudents: { "luis.10": { usernameKey: "luis.10", ficha } },
    });
    assert.equal(body.innerHTML.includes("data-bitacora-loop-card"), false, ficha);
  }
});

test("visibilidad: instructor sin aprendiz consultado NO ve la tarjeta", () => {
  const { body } = renderResources({ session: admin });
  assert.equal(body.innerHTML.includes("data-bitacora-loop-card"), false);
});

test("la tarjeta del Diseño Curricular no cambia (mismo texto y enlace para 11°)", () => {
  const { body } = renderResources({ session: student("3168850") });
  const card = body.querySelector(".student-document-group--reference .student-project-download-card");
  assert.match(card.textContent, /Documento de referencia/);
  const link = card.querySelector("a");
  assert.match(link.getAttribute("href"), /Diseno%20Curricular%20Sistemas%20Teleinformaticos\.pdf$/);
});

// ─── 3. Modal, copiar, descargar, cerrar ───────────────────────────────────
function openModalFromCard(extra = {}) {
  const env = renderResources({ session: student("3168850") });
  const { ctx, document, body } = env;
  Object.assign(ctx, extra);
  ctx.getSelection = () => ({ removeAllRanges() {}, addRange() {} });
  const btn = body.querySelector("[data-bitacora-loop-open]");
  btn.click();
  const modal = document.getElementById("bitacora-loop-modal");
  return Object.assign(env, { modal });
}

test("modal: 'Ver y copiar LOOP' abre el panel con instrucciones, documentos, privacidad y LOOP completo", () => {
  const { modal, ctx } = openModalFromCard();
  assert.ok(modal && !modal.hidden, "el modal no abrio");
  const text = modal.textContent;
  assert.match(text, /¿Cómo utilizar este LOOP\?/);
  assert.match(text, /Abre la herramienta de inteligencia artificial que vayas a utilizar\./);
  assert.match(text, /¿Qué documentos necesitas\?/);
  assert.match(text, /Bitácora de Etapa Productiva/);
  assert.match(text, /Diseño Curricular oficial del programa/);
  assert.match(text, /Evidencias o soportes/);
  assert.match(text, /No compartas innecesariamente documentos de identidad, firmas, datos bancarios, contraseñas u otra información sensible\./);
  assert.match(text, /La IA NO debe modificar directamente tu archivo original\./);
  const steps = modal.querySelectorAll(".bitacora-loop__steps li");
  assert.equal(steps.length, 10);
  // El LOOP visible es el completo (sin truncar).
  const pre = modal.querySelector("[data-bitacora-loop-text]");
  assert.equal(pre.textContent, ctx.BITACORA_REVIEW_LOOP.text);
});

test("modal: 'Copiar LOOP' copia EXACTAMENTE el texto de la fuente unica y confirma", async () => {
  let copied = null;
  const { modal, ctx } = openModalFromCard();
  ctx.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
  modal.querySelector("[data-bitacora-loop-copy]").click();
  await new Promise((r) => setImmediate(r));
  assert.equal(copied, ctx.BITACORA_REVIEW_LOOP.text);
  assert.equal(copied.length, LOOP_LENGTH);
  assert.equal(
    modal.querySelector("[data-bitacora-loop-status]").textContent,
    "✓ LOOP copiado. Ahora pégalo en la herramienta de IA que vayas a utilizar."
  );
});

test("modal: sin navigator.clipboard usa el respaldo (textarea + execCommand) con el texto completo", async () => {
  const { modal, ctx, document } = openModalFromCard();
  delete ctx.navigator.clipboard;
  let areaValue = null;
  document.execCommand = (cmd) => {
    const area = document.body.querySelector("textarea");
    areaValue = area ? area.value : null;
    return cmd === "copy";
  };
  modal.querySelector("[data-bitacora-loop-copy]").click();
  await new Promise((r) => setImmediate(r));
  assert.equal(areaValue, ctx.BITACORA_REVIEW_LOOP.text);
  assert.equal(document.body.querySelector("textarea"), null, "el textarea temporal debe retirarse");
  assert.match(modal.querySelector("[data-bitacora-loop-status]").textContent, /LOOP copiado/);
});

test("modal: si ninguna copia funciona, lo dice y ofrece la descarga (no finge exito)", async () => {
  const { modal, ctx, document } = openModalFromCard();
  ctx.navigator.clipboard = { writeText: () => Promise.reject(new Error("denegado")) };
  document.execCommand = () => false;
  modal.querySelector("[data-bitacora-loop-copy]").click();
  await new Promise((r) => setImmediate(r));
  const status = modal.querySelector("[data-bitacora-loop-status]").textContent;
  assert.doesNotMatch(status, /LOOP copiado/);
  assert.match(status, /Descargar LOOP/);
});

test("modal: 'Descargar LOOP' genera un .txt con el mismo texto", () => {
  let blobParts = null;
  let downloadName = null;
  const { modal, ctx, document } = openModalFromCard();
  ctx.Blob = function (parts, opts) { blobParts = parts; this.type = opts.type; };
  ctx.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
  const origCreate = document.createElement;
  document.createElement = function (tag) {
    const el = origCreate.call(document, tag);
    if (tag === "a") el.click = function () { downloadName = el.download; };
    return el;
  };
  modal.querySelector("[data-bitacora-loop-download]").click();
  assert.equal(blobParts.join(""), ctx.BITACORA_REVIEW_LOOP.text);
  assert.equal(downloadName, "LOOP_Revision_Bitacora_SENA.txt");
});

test("modal: se cierra con el boton X, con 'Cerrar' y con Escape", () => {
  const { modal, document, body } = openModalFromCard();
  modal.querySelector(".c-modal__close").click();
  assert.equal(modal.hidden, true);
  body.querySelector("[data-bitacora-loop-open]").click();
  assert.equal(modal.hidden, false);
  modal.querySelectorAll("[data-bitacora-loop-close]")[1].click();
  assert.equal(modal.hidden, true);
  body.querySelector("[data-bitacora-loop-open]").click();
  document.dispatchEvent({ type: "keydown", key: "Escape" });
  assert.equal(modal.hidden, true);
});

test("la pagina carga la fuente del LOOP, el modulo y su CSS antes del modulo de documentos", () => {
  const html = read("etapa-productiva-estudiante.html");
  const iPrompt = html.indexOf("data/bitacora_review_prompt.js");
  const iLoop = html.indexOf("js/bitacora_review_loop.js");
  const iDelivery = html.indexOf("js/productive_stage_project_delivery.js");
  assert.ok(iPrompt > 0 && iLoop > iPrompt && iDelivery > iLoop);
  assert.match(html, /css\/page_bitacora_review\.css\?v=/);
});

test("modal: queda por encima del aviso de sincronizacion (z-index 99999) para no tapar la X de cerrar", () => {
  const css = read("css/page_bitacora_review.css");
  const m = css.match(/\.bitacora-loop\.c-modal\s*\{[^}]*z-index:\s*(\d+)/);
  assert.ok(m, "falta z-index del modal");
  const banner = read("js/firebase_status_banner.js").match(/z-index:(\d+)/);
  assert.ok(Number(m[1]) > Number(banner[1]));
});

test("fuente = texto copiado = texto del .txt descargado (una sola version, 20. DETENTE.)", async () => {
  const sourceText = loadLoopText().text; // leido directo de data/bitacora_review_prompt.js
  let copied = null;
  let downloaded = null;
  const { modal, ctx } = openModalFromCard();
  ctx.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
  ctx.Blob = function (parts) { downloaded = parts.join(""); };
  ctx.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
  modal.querySelector("[data-bitacora-loop-copy]").click();
  await new Promise((r) => setImmediate(r));
  modal.querySelector("[data-bitacora-loop-download]").click();
  assert.equal(copied, sourceText);
  assert.equal(downloaded, sourceText);
  assert.equal(copied.length, LOOP_LENGTH);
  assert.ok(downloaded.trimEnd().endsWith("20. DETENTE."));
});

test("texto visible: flujo completo claro y sin insinuar que el portal ejecuta la IA", () => {
  const { modal, body } = openModalFromCard();
  const text = modal.textContent;
  assert.match(text, /El portal no revisa tu bitácora ni se conecta con ninguna IA/);
  const steps = modal.querySelectorAll(".bitacora-loop__steps li").map((li) => li.textContent);
  const flow = [
    /Descarga el Diseño Curricular del programa/,
    /Ten disponible tu bitácora/,
    /evidencias o soportes/,
    /Pulsa “Copiar LOOP”/,
    /Abre la herramienta de inteligencia artificial que vayas a utilizar/,
    /Pega el LOOP completo en una conversación nueva/,
    /Adjunta en esa misma conversación: tu bitácora; el Diseño Curricular oficial; y, cuando sea necesario, las evidencias/,
    /Envía el mensaje y espera que la IA realice la revisión/,
    /listas para copiar y pegar/,
    /DATOS POR CONFIRMAR.*misma conversación/,
  ];
  flow.forEach((re, i) => assert.match(steps[i], re, `paso ${i + 1}`));
  const visible = body.textContent + text;
  assert.doesNotMatch(visible, /chatgpt|gemini|copilot|claude/i);
  assert.doesNotMatch(visible, /el portal (revisa|analiza|procesa|ejecuta)/i);
});

test("modal: la tarjeta no es un grid (en un contenedor con max-height las filas se comprimian y los botones tapaban 'LOOP copiado')", () => {
  const css = read("css/page_bitacora_review.css");
  const rule = css.match(/\.bitacora-loop__card\s*\{([^}]*)\}/);
  assert.ok(rule);
  assert.doesNotMatch(rule[1], /display:\s*grid/);
  assert.doesNotMatch(css, /\.bitacora-loop__status\s*\{[^}]*margin:\s*0;/);
});
