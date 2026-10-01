"use strict";
// Pulido final de la interfaz del laboratorio 3D (sep-26): avisos que no tapan
// la pieza ni su etiqueta, avisos de transicion que se retiran al terminar el
// movimiento, mantenimiento opcional plegado y tarjeta que se compacta por
// espacio. El comportamiento de los avisos se EJECUTA (con reloj simulado),
// no solo se busca en el texto del archivo.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const html = read("laboratorio-virtual-hardware.html");
const css = read("css/page_hardware_lab.css");
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, "");
const stage = read("js/hardware_lab_3d_stage.js");
const ctl = read("js/hardware_lab_3d_controller.js");
const layoutUrl = pathToFileURL(path.join(ROOT, "js/hardware_lab_3d_ui_layout.js")).href;
const stageSection = html.slice(html.indexOf('id="hwlab-stage"'), html.indexOf("</section>", html.indexOf('id="hwlab-stage"')));

/** showFeedback/endTransientFeedback REALES del stage, con DOM y reloj simulados. */
function feedbackHarness({ cover = 0 } = {}) {
  const start = stage.indexOf("  const FEEDBACK_ICONS = {");
  const end = stage.indexOf("  function pushActionLog(");
  assert.ok(start > 0 && end > start, "no se encontro el bloque de avisos del stage");
  let now = 0;
  const timers = [];
  const el = { hidden: true, innerHTML: "", className: "", lastChild: { textContent: "" } };
  const clock = {
    now: () => now,
    setTimeout: (fn, ms) => { const t = { at: now + ms, fn, done: false }; timers.push(t); return t; },
    clearTimeout: (t) => { if (t) t.done = true; },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const next = timers.filter((t) => !t.done && t.at <= until).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        now = next.at; next.done = true; next.fn();
      }
      now = until;
    },
  };
  const api = new Function(
    "document", "placeFeedback", "HardwareLabAudio", "performance", "setTimeout", "clearTimeout",
    "let feedbackTimer = null;\n" + stage.slice(start, end) + "\nreturn { showFeedback, endTransientFeedback };"
  )(
    { getElementById: (id) => (id === "hwlab-feedback" ? el : null) },
    () => cover,
    { playError() {}, playSuccess() {} },
    { now: clock.now },
    clock.setTimeout,
    clock.clearTimeout
  );
  return { api, el, clock };
}

test("P01. aviso de transicion: se retira al TERMINAR el movimiento (con minimo de lectura), no a los 7 s", () => {
  const { api, el, clock } = feedbackHarness();
  const id = api.showFeedback("Preparando: pantalla", "info", { transient: true });
  assert.equal(el.hidden, false);
  clock.advance(1600); // la transicion del portatil termina
  api.endTransientFeedback(id);
  clock.advance(0); // siguiente tarea del navegador
  assert.equal(el.hidden, true, "ya paso el minimo de lectura: se retira de inmediato");

  // Transicion muy corta: se respeta el minimo para poder leerlo.
  const h2 = feedbackHarness();
  const id2 = h2.api.showFeedback("Preparando: teclado", "info", { transient: true });
  h2.clock.advance(300);
  h2.api.endTransientFeedback(id2);
  assert.equal(h2.el.hidden, false, "no desaparece antes del minimo");
  h2.clock.advance(1000);
  assert.equal(h2.el.hidden, true);
});

test("P02. el fin de una transicion NO borra un aviso posterior (p. ej. un error)", () => {
  const { api, el, clock } = feedbackHarness();
  const id = api.showFeedback("Preparando: pantalla", "info", { transient: true });
  clock.advance(400);
  api.showFeedback("No puedes retirar la pantalla todavia.", "error");
  clock.advance(1500);
  api.endTransientFeedback(id);
  clock.advance(1500);
  assert.equal(el.hidden, false, "el error sigue visible");
  assert.match(el.className, /hwlab-feedback--error/);
});

test("P03. exito que tapa la pieza se retira antes; error y seguridad NO se acortan", () => {
  const ok = feedbackHarness({ cover: 0.3 });
  ok.api.showFeedback("Retiro completado: Bateria.", "success");
  ok.clock.advance(1399);
  assert.equal(ok.el.hidden, false, "se puede leer");
  ok.clock.advance(2);
  assert.equal(ok.el.hidden, true, "a los 1,4 s deja libre la pieza");

  const err = feedbackHarness({ cover: 0.3 });
  err.api.showFeedback("Primero debes desconectar la bateria.", "error");
  err.clock.advance(5000);
  assert.equal(err.el.hidden, false, "un bloqueo/error mantiene su duracion completa");

  const free = feedbackHarness({ cover: 0 });
  free.api.showFeedback("Retiro completado: SSD M.2.", "success");
  free.clock.advance(3000);
  assert.equal(free.el.hidden, false, "si no tapa nada, dura lo normal");
});

test("P04. colocacion del aviso: nunca sobre tarjeta/dock; luego pieza > etiqueta > historial", async () => {
  const L = await import(layoutUrl);
  const card = L.rect(8, 8, 374, 52);
  const hist = L.rect(8, 600, 374, 38);
  const spots = [
    { pos: "", rect: L.rect(16, 500, 358, 44) },
    { pos: "top", rect: L.rect(16, 20, 358, 44) },   // encima de la banda de la tarjeta
    { pos: "left", rect: L.rect(16, 300, 358, 44) },
    { pos: "hist", rect: L.rect(16, 596, 358, 44) },
  ];
  const pieza = Object.assign(L.rect(40, 480, 300, 80), { points: [{ x: 100, y: 520 }, { x: 200, y: 530 }, { x: 300, y: 510 }] });
  // Abajo tapa la pieza y arriba pisaria la tarjeta: va al centro.
  assert.equal(L.chooseFeedbackSpot(spots, pieza, [card], { low: [hist] }).pos, "left");
  // La ETIQUETA de la pieza esta en el centro: mejor sobre el historial.
  const etiqueta = L.rect(120, 310, 150, 30);
  assert.equal(L.chooseFeedbackSpot(spots, pieza, [card], { protect: [etiqueta], low: [hist] }).pos, "hist");
  // Sin conflicto se queda donde siempre (consistencia visual).
  const lejos = Object.assign(L.rect(40, 150, 100, 60), { points: [{ x: 60, y: 170 }] });
  assert.equal(L.chooseFeedbackSpot(spots, lejos, [card], { low: [hist] }).pos, "");
  // Nunca texto sobre texto aunque arriba la pieza quede libre.
  assert.notEqual(L.chooseFeedbackSpot(spots, pieza, [card]).pos, "top");
});

test("P05. aviso compacto: ancho propio del texto y mensajes de transicion breves", () => {
  // Con left 50% el ancho disponible era la mitad de la escena (3-4 lineas en el movil).
  assert.match(cssRules, /\.hwlab-feedback \{[^}]*width: max-content;[^}]*max-width: min\(560px, calc\(100% - 2 \* var\(--hwlab-gap, 12px\)\)\)/);
  assert.match(stage, /announce: "Preparando: " \+ label\.toLowerCase\(\),/);
  assert.doesNotMatch(stage, /Preparando el portátil: /);
  // Todas las posiciones de trabajo caben en un aviso breve (<= 2 lineas en 390 px).
  const labels = [...read("js/hardware_lab_3d_layout_laptop.js").matchAll(/^\s+\w+: \{ label: "([^"]+)", yaw:/gm)].map((m) => m[1]);
  assert.ok(labels.length >= 6, "no se encontraron las posiciones del portatil");
  labels.forEach((l) => assert.ok(("Preparando: " + l).length <= 40, `aviso largo: ${l}`));
  // Transicion: se muestra como transitoria y se cierra al terminar (o si no arranca).
  assert.match(stage, /showFeedback\(opts\.announce, "info", \{ transient: true \}\)/);
  assert.equal((stage.match(/if \(announceId\) endTransientFeedback\(announceId\);/g) || []).length, 2);
});

test("P06. mantenimiento de la refrigeracion: plegado cuando no es la accion actual; visible cuando lo es", () => {
  assert.match(ctl, /const required = \(isAssemblyPractice\(\) \|\| isMaintenance\(\)\) && \(!step \|\| \(step\.kind === "action" && step\.partId === "cooler"\)\);/);
  assert.match(ctl, /<details class="hwlab-thermal" id="hwlab-thermal-details"\$\{thermalOpen \? " open" : ""\}><summary class="hwlab-thermal__summary">/);
  assert.match(ctl, /return html \+ \(required \? "<\/div>" : "<\/details>"\);/);
  // Abrirlo a mano se recuerda en la sesion y cuenta como "expandir" (no se re-compacta sola).
  assert.match(ctl, /thermalOpen = thermalDetails\.open; stage\.refreshLayout\(thermalOpen\);/);
  assert.match(stage, /if \(byUser\) userExpandedFor = /);
  // Compactada (o contraida con accion pendiente, Fase B 2026-10-01): la accion obligatoria sigue a la vista; lo opcional no.
  assert.match(cssRules, /\.hwlab-card:is\(\[data-auto-compact="true"\], \[data-state="closed"\]\[data-pending="true"\]\) \.hwlab-card__body \.hwlab-info-block > :not\(#hwlab-safety-confirm-btn\):not\(#hwlab-prepare-btn\):not\(#hwlab-power-check-btn\):not\(\.hwlab-thermal\[data-required\]\):not\(\[data-required-action\]\) \{ display: none; \}/);
  // El resumen muestra la accion completa (hasta 3 lineas, no se corta en 2).
  assert.match(cssRules, /\.hwlab-card__summary \{[^}]*-webkit-line-clamp: 3;/);
  // Resumen plegable accesible por teclado (elemento nativo) con foco visible y 44 px.
  assert.match(cssRules, /\.hwlab-thermal__summary \{[^}]*min-height: var\(--hit-target-min\);/);
  assert.match(cssRules, /\.hwlab-thermal__summary:focus-visible \{/);
});

test("P07. tablet: la tarjeta se compacta por ESPACIO u oclusion, no por tipo de equipo", () => {
  assert.match(stage, /const crowding = uiArea\(pick\.rect\) \/ Math\.max\(1, uiArea\(sceneR\)\) > 0\.4;/);
  assert.match(stage, /if \(\(mobile \|\| crowding \|\| \(target && pick\.cover > 0\.1\)\) && userExpandedFor !== summary\) \{/);
  assert.doesNotMatch(stage, /max-width: (768|1024)px"\)\.matches/, "no hay regla rigida de tablet");
});

test("P08. accesibilidad de avisos y controles: status cortes, sin interrupciones agresivas", () => {
  assert.match(stageSection, /id="hwlab-feedback"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(stageSection, /aria-live="assertive"|role="alert"/, "un aviso temporal no debe interrumpir al lector de pantalla");
  const toggles = stageSection.match(/<button[^>]*class="hwlab-(dock|card|history)__toggle"[^>]*>/g) || [];
  assert.ok(toggles.length >= 6, "faltan controles plegables");
  toggles.forEach((t) => {
    assert.match(t, /aria-expanded="(true|false)"/, t);
    assert.match(t, /aria-controls="[\w-]+"/, t);
  });
});

test("P09. movil: el dock sigue abajo con icono + nombre, y sin desbordes de ancho", () => {
  const mobile = cssRules.slice(cssRules.indexOf("@media (max-width: 600px)"));
  assert.match(mobile, /\.hwlab-dock \{[^}]*top: auto;[^}]*bottom: calc\(/);
  assert.doesNotMatch(mobile.slice(0, mobile.indexOf("\n}\n")), /\.hwlab-dock__label \{[^}]*display: none/);
  // 100vw solo en pantalla completa (sin barra de scroll); nunca en el contenedor normal.
  const vw = cssRules.split("\n").filter((l) => /100vw/.test(l));
  assert.equal(vw.length, 1);
  assert.match(cssRules, /:-webkit-full-screen \{\s*width: 100vw;/);
});

test("P10. histeresis: no retiene una tarjeta RECORTADA si hay una esquina aceptable donde cabe entera", async () => {
  const L = await import(layoutUrl);
  const scene = L.rect(0, 129, 1440, 771);
  const dock = L.rect(12, 141, 190, 447);        // dock desplegado de escritorio (alto)
  const history = L.rect(12, 850, 274, 38);
  const cands = L.cardCandidates({ scene, card: { width: 340, height: 360 }, dock, history, gap: 12 });
  const tl = cands.find((c) => c.slot === "tl");
  assert.ok(tl && !tl.full, "bajo el dock la tarjeta queda recortada");
  const pieza = Object.assign(L.rect(540, 441, 120, 114), { points: [{ x: 600, y: 500 }] });
  const pick = L.chooseSlot(cands, pieza, "tl");
  assert.notEqual(pick.slot, "tl", "no se queda recortada teniendo libre otra esquina");
  assert.ok(pick.full && pick.cover <= 0.1);
  // Sin alternativa entera aceptable, la histeresis se mantiene (no salta).
  const soloTl = cands.filter((c) => c.slot === "tl");
  assert.equal(L.chooseSlot(soloTl, pieza, "tl").slot, "tl");
  // Y una posicion entera y aceptable no se abandona (estabilidad).
  const tr = cands.find((c) => c.slot === "tr");
  assert.equal(L.chooseSlot(cands, Object.assign(L.rect(560, 460, 20, 20), { points: [{ x: 570, y: 470 }] }), "tr").slot, tr.slot);
});
