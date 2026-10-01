"use strict";
// Interfaz v2 del laboratorio 3D (sep-26): escena dominante con controles
// flotantes, tarjeta de instrucciones plegable, avisos con icono e historial
// plegable. Estas pruebas protegen la ESTRUCTURA; los recorridos con clic real
// (banco headless) protegen el comportamiento.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const html = read("laboratorio-virtual-hardware.html");
const css = read("css/page_hardware_lab.css");
// Reglas sin comentarios (los comentarios pueden citar la regla ANTIGUA).
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, "");
const stage = read("js/hardware_lab_3d_stage.js");
const stageSection = html.slice(html.indexOf('id="hwlab-stage"'), html.indexOf("</section>", html.indexOf('id="hwlab-stage"')));

test("U01. ya no hay columnas laterales fijas ni pie de historial permanente", () => {
  for (const cls of ["hwlab-hud--left", "hwlab-hud--right", "hwlab-hud--bottom", "hwlab-hud-body"]) {
    assert.ok(!html.includes(cls), `HTML conserva ${cls}`);
    assert.ok(!css.includes("." + cls), `CSS conserva .${cls}`);
  }
});

test("U02. controles flotantes DENTRO de la escena: 4 grupos con los ids que usa la logica", () => {
  const scene = stageSection.slice(stageSection.indexOf('id="hwlab-scene"'));
  assert.ok(scene.length > 0, "no hay contenedor de escena");
  const dock = scene.slice(scene.indexOf('id="hwlab-dock"'), scene.indexOf("</nav>"));
  for (const g of ["camera", "pose", "focus", "display"]) assert.match(dock, new RegExp(`data-group="${g}"`));
  for (const id of ["hwlab-view-buttons", "hwlab-pose-panel", "hwlab-pose-buttons", "hwlab-work-view-btn", "hwlab-pose-status", "hwlab-focus-buttons", "hwlab-explode-btn", "hwlab-didactic-btn"]) {
    assert.ok(dock.includes(`id="${id}"`), `falta ${id} en el dock`);
  }
  // Cada boton de grupo es accesible y se puede abrir/cerrar.
  const toggles = dock.match(/class="hwlab-dock__toggle"[^>]*>/g) || [];
  assert.equal(toggles.length, 4);
  toggles.forEach((t) => { assert.match(t, /aria-expanded="false"/); assert.match(t, /aria-label="[^"]+"/); assert.match(t, /aria-controls="[^"]+"/); });
  // Vista explotada / Modo didactico: botones con estado pulsado.
  assert.match(dock, /id="hwlab-explode-btn"[^>]*aria-pressed="false"/);
  assert.match(dock, /id="hwlab-didactic-btn"[^>]*aria-pressed="false"/);
});

test("U03. tarjeta de instrucciones plegable con resumen siempre visible, y el panel de contenido dentro", () => {
  const card = stageSection.slice(stageSection.indexOf('id="hwlab-card"'), stageSection.indexOf("</aside>", stageSection.indexOf('id="hwlab-card"')));
  assert.match(card, /data-state="open"/);
  assert.match(card, /id="hwlab-card-summary"[^>]*aria-live="polite"/);
  assert.match(card, /id="hwlab-card-toggle"[^>]*aria-expanded="true"[^>]*aria-controls="hwlab-info-panel"/);
  assert.match(card, /id="hwlab-card-more"/);
  assert.ok(card.includes('id="hwlab-info-panel"'), "el contenido del paso no esta dentro de la tarjeta");
  // Contraida solo se oculta el CUERPO; el resumen (Paso X · accion) queda.
  // Fase B (2026-10-01): y el cuerpo NO se oculta si el paso tiene una accion pendiente.
  assert.match(css, /\.hwlab-card\[data-state="closed"\]:not\(\[data-pending="true"\]\) \.hwlab-card__body/);
  assert.doesNotMatch(css, /\.hwlab-card\[data-state="closed"\][^{]*\.hwlab-card__summary/);
  // Un paso que se completa con un boton de la tarjeta la vuelve a abrir.
  assert.match(stage, /#hwlab-safety-confirm-btn, #hwlab-prepare-btn, \.hwlab-thermal\[data-required\] \[data-thermal-task\]/);
});

test("U04. historial plegable: cerrado por defecto, boton accesible con contador, sin alterar el layout", () => {
  assert.match(stageSection, /id="hwlab-history"[^>]*data-open="false"/);
  assert.match(stageSection, /id="hwlab-history-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="hwlab-action-log"/);
  assert.match(stageSection, /id="hwlab-action-log"[^>]*hidden/);
  assert.match(stageSection, /id="hwlab-history-count"/);
  const rule = css.slice(css.indexOf(".hwlab-history {"), css.indexOf("}", css.indexOf(".hwlab-history {")));
  assert.match(rule, /position: absolute/, "el historial debe superponerse, no empujar el layout");
  assert.match(stage, /time\.textContent = /, "cada entrada del historial lleva su hora");
});

test("U05. avisos flotantes con ICONO por tipo (no solo color) y prioridad", () => {
  for (const kind of ["success", "info", "warning", "error"]) {
    assert.match(stage, new RegExp(`${kind}: '<svg`), `aviso ${kind} sin icono`);
    assert.match(css, new RegExp(`\\.hwlab-feedback--${kind}`), `aviso ${kind} sin estilo`);
  }
  assert.match(stageSection, /id="hwlab-feedback"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(stage, /FEEDBACK_RANK = \{ success: 1, info: 2, warning: 3, error: 4 \}/);
});

test("U06. textos de los iconos orientados al aprendiz (no identificadores internos)", () => {
  for (const t of ["Vista frontal", "Vista lateral", "Vista superior", "Vista posterior", "Vista interna", "Vista general"]) assert.ok(stage.includes(`"${t}"`), t);
  assert.match(stage, /aria-label="\$\{VIEW_TIPS\[v\]\}"/);
  assert.match(stage, /aria-label="Enfocar: \$\{esc\(p\.label\)\}"/);
  assert.match(stage, /"Girar el portátil 90° a la izquierda"/);
  // Tooltip con raton y con teclado.
  assert.match(css, /\[data-tip\]:hover::after/);
  assert.match(css, /\[data-tip\]:focus-visible::after/);
});

test("U07. alto y ancho REALES: sin 100vw, alto = ventana - navbar, sin ocultar desbordes", () => {
  assert.doesNotMatch(cssRules, /100vw\s*;[^}]*\n?[^}]*margin-left: calc\(50% - 50vw\)/);
  assert.doesNotMatch(cssRules, /calc\(50% - 50vw\)/);
  const st = (cssRules.match(/(^|\n)\.hwlab-stage \{[^}]*\}/g) || []).join("\n");
  assert.match(st, /height: calc\(100dvh - var\(--navbar-height, 60px\)\)/);
  assert.doesNotMatch(st, /min-height: 640px/);
  assert.doesNotMatch(cssRules, /overflow-x:\s*(hidden|clip)/);
  assert.doesNotMatch(cssRules, /body\s*\{[^}]*overflow:\s*hidden/);
});

test("U08. no vuelve la seleccion manual de herramientas", () => {
  for (const re of [/hwlab-tools-panel/, /Ninguna seleccionada/, /data-tool=/, /<h3>Herramientas<\/h3>/]) assert.doesNotMatch(html + stage, re);
});

test("U09. pantallas compactas: grupos desplegables con etiqueta visible (sin depender del hover)", () => {
  assert.match(css, /@media \(max-width: 900px\), \(max-height: 700px\)/);
  const compact = css.slice(css.indexOf("@media (max-width: 900px), (max-height: 700px)"));
  assert.match(compact, /\.hwlab-dock__group\[data-open\] \.hwlab-dock__items \{ display: block; \}/);
  assert.match(compact, /\.hwlab-dock__items \.hwlab-dock__label \{[^}]*position: static/);
  assert.match(css, /@media \(max-width: 600px\)/);
});

// ── Correccion final (sep-26): la interfaz se coloca ALREDEDOR del trabajo ──
const { pathToFileURL } = require("node:url");
const layoutUrl = pathToFileURL(path.join(ROOT, "js/hardware_lab_3d_ui_layout.js")).href;

test("U10. la tarjeta cambia de esquina si tapa la pieza, y no salta si la actual ya sirve (histeresis)", async () => {
  const L = await import(layoutUrl);
  const scene = L.rect(0, 0, 1024, 500);
  const dock = L.rect(8, 8, 240, 48);          // dock compacto arriba a la izquierda
  const history = L.rect(8, 454, 274, 38);     // barra del historial abajo a la izquierda
  const cands = L.cardCandidates({ scene, card: { width: 320, height: 300 }, dock, history, gap: 8 });
  assert.deepEqual(cands.map((c) => c.slot), ["tr", "tl", "br", "bl"]);
  // Pieza arriba a la derecha (como la antena Wi-Fi en 1024x625): se evita "tr".
  const target = L.rect(760, 60, 120, 80);
  const pick = L.chooseSlot(cands, target, "tr");
  assert.notEqual(pick.slot, "tr");
  assert.ok(pick.cover <= 0.1, `sigue tapando ${Math.round(pick.cover * 100)} %`);
  // Histeresis: si la posicion actual ya deja la pieza libre, no se cambia.
  const centro = L.rect(450, 200, 80, 60);
  assert.equal(L.chooseSlot(cands, centro, "tl").slot, "tl");
  assert.equal(L.chooseSlot(cands, centro, "br").slot, "br");
});

test("U11. ninguna posicion candidata pisa el dock ni el historial (y se descartan las que no caben)", async () => {
  const L = await import(layoutUrl);
  const scene = L.rect(0, 0, 1440, 770);
  const dock = L.rect(12, 12, 190, 430);        // dock desplegado, alto
  const history = L.rect(12, 720, 274, 38);
  const cands = L.cardCandidates({ scene, card: { width: 340, height: 420 }, dock, history, gap: 12 });
  cands.forEach((c) => {
    assert.equal(L.intersection(c.rect, dock), 0, `${c.slot} pisa el dock`);
    assert.equal(L.intersection(c.rect, history), 0, `${c.slot} pisa el historial`);
    assert.ok(c.rect.left >= 0 && c.rect.right <= 1440 && c.rect.top >= 0 && c.rect.bottom <= 770, `${c.slot} se sale de la escena`);
  });
  // Movil: banda arriba o encima de la barra de controles.
  const m = L.cardCandidates({ scene: L.rect(0, 0, 390, 644), card: { width: 374, height: 215 }, dock: null, history: L.rect(8, 598, 374, 38), gap: 8, mobile: true });
  assert.deepEqual(m.map((c) => c.slot), ["top", "bottom"]);
});

test("U12. el aviso se aparta de la pieza sin pisar la tarjeta ni el dock", async () => {
  const L = await import(layoutUrl);
  const spots = [
    { pos: "", rect: L.rect(380, 420, 260, 44) },
    { pos: "top", rect: L.rect(380, 12, 260, 44) },
    { pos: "side", rect: L.rect(752, 420, 260, 44) },
  ];
  const target = L.rect(400, 400, 150, 80);     // pieza bajo el aviso por defecto
  assert.equal(L.chooseFeedbackSpot(spots, target, []).pos, "top");
  assert.equal(L.chooseFeedbackSpot(spots, target, [L.rect(360, 0, 320, 80)]).pos, "side", "arriba estaba la tarjeta");
  assert.equal(L.chooseFeedbackSpot(spots, L.rect(50, 50, 60, 60), []).pos, "", "sin conflicto se queda abajo");
});

test("U13. compactacion automatica: resumen visible y, si el paso lo necesita, su boton de accion", () => {
  assert.match(css, /\.hwlab-card:is\(\[data-auto-compact="true"\], \[data-state="closed"\]\[data-pending="true"\]\) \.hwlab-card__body \.hwlab-info-block > :not\(#hwlab-safety-confirm-btn\):not\(#hwlab-prepare-btn\):not\(#hwlab-power-check-btn\):not\(\.hwlab-thermal\[data-required\]\):not\(\[data-required-action\]\)/);
  assert.doesNotMatch(css, /\[data-auto-compact="true"\][^{]*\.hwlab-card__summary/);
  assert.match(stage, /card\.setAttribute\("data-auto-compact", "true"\)/);
  assert.match(stage, /userExpandedFor = /, "el aprendiz puede expandirla a mano y se respeta en ese paso");
});

test("U14. estabilidad: la colocacion NO corre en cada cuadro, solo con disparadores concretos", () => {
  // En cada cuadro solo se compara una firma de movimiento; la colocacion se
  // PROGRAMA una vez cuando el movimiento termina (nunca placeCard directo).
  const onTickBodies = stage.split("onTick(").slice(1).map((c) => c.slice(0, 700));
  onTickBodies.forEach((b) => assert.doesNotMatch(b, /[^e]placeCard\(|placeFeedback\(/));
  assert.match(stage, /if \(moving && now - stillSince > 300\) \{\n\s+moving = false;\n\s+schedulePlaceCard\(60\);/);
  assert.doesNotMatch(stage, /requestAnimationFrame\([^)]*placeCard/);
  for (const trig of [/schedulePlaceCard\(CAMERA_SETTLE_MS\);\n\s*\}\n\n\s*\/\/ ── Encuadre por pieza objetivo/, /addEventListener\("resize", \(\) => \{\n\s+schedulePlaceCard\(200\);/, /addEventListener\("end", \(\) => schedulePlaceCard/]) assert.match(stage, trig);
});

test("U15. nombres claros de grupos, paso sin duplicar y textos con tildes", () => {
  assert.match(html, /hwlab-dock__toggle-label">Posición</);
  assert.match(html, /hwlab-dock__toggle-label">Visualización</);
  assert.doesNotMatch(html, /toggle-label">(Equipo|Ver)</);
  // El paso visible vive en la tarjeta; en la barra solo para lectores de pantalla.
  assert.match(html, /class="hwlab-stat hwlab-visually-hidden" id="hwlab-stat-step"/);
  const ctl = read("js/hardware_lab_3d_controller.js");
  const layoutLaptop = read("js/hardware_lab_3d_layout_laptop.js");
  const dataLaptop = read("js/hardware_lab_data_laptop.js");
  assert.match(stage, /"Posición actual: "/);
  assert.match(ctl, /Posición de trabajo: <strong>/);
  assert.match(ctl, /"Dejar el portátil abierto \(posición normal\)"/);
  assert.match(layoutLaptop, /label: "Abierto \(posición normal\)"/);
  assert.match(dataLaptop, /distinto tamaño: no los mezcles/);
  assert.doesNotMatch(stage + ctl, /"Posicion (actual|de trabajo)/);
  // Camara: nombre visible bajo cada icono en el dock desplegado.
  assert.match(css, /\.hwlab-dock__group\[data-group="camera"\] \.hwlab-dock__label \{[^}]*position: static/);
});

test("U16. cobertura por PUNTOS de la geometria visible (cable fino) y dock compacto que se aparta", async () => {
  const L = await import(layoutUrl);
  // Cable fino en diagonal: su rectangulo envolvente es grande y casi vacio.
  const pts = []; for (let i = 0; i <= 20; i++) pts.push({ x: 300 + i * 20, y: 300 + i * 5 });
  const cable = Object.assign(L.rect(300, 300, 400, 100), { points: pts });
  const aviso = L.rect(290, 290, 210, 60); // tapa la primera mitad del cable
  const porRect = L.coverRatio(aviso, L.rect(300, 300, 400, 100));
  const porPuntos = L.coverRatio(aviso, cable);
  assert.ok(porRect < 0.3, `por rectangulo ${porRect}`);
  assert.ok(porPuntos >= 0.45, `por puntos ${porPuntos}: debe reflejar la mitad del cable tapada`);
  // Dock compacto sobre la pieza: baja sobre el historial; si no tapa, se queda.
  const spots = [{ pos: "", rect: L.rect(8, 8, 240, 52) }, { pos: "bottom", rect: L.rect(8, 400, 240, 52) }];
  const arriba = Object.assign(L.rect(20, 10, 60, 40), { points: [{ x: 30, y: 20 }, { x: 60, y: 40 }] });
  assert.equal(L.chooseDockSpot(spots, arriba, "").pos, "bottom");
  const centro = Object.assign(L.rect(400, 200, 60, 40), { points: [{ x: 420, y: 220 }] });
  assert.equal(L.chooseDockSpot(spots, centro, "").pos, "");
  assert.equal(L.chooseDockSpot(spots, centro, "bottom").pos, "bottom", "histeresis: no vuelve arriba si abajo ya sirve");
});

test("U17. la columna izquierda sigue disponible si el dock bajo (y el panel termico opcional no infla la tarjeta)", async () => {
  const L = await import(layoutUrl);
  const scene = L.rect(0, 0, 1024, 504);
  const dockAbajo = L.rect(8, 400, 258, 56);    // dock compacto apartado abajo a la izquierda
  const history = L.rect(8, 458, 274, 38);
  const cands = L.cardCandidates({ scene, card: { width: 320, height: 300 }, dock: dockAbajo, history, gap: 12 });
  const tl = cands.find((c) => c.slot === "tl");
  assert.ok(tl, "sin columna izquierda con el dock abajo");
  assert.equal(tl.rect.top, 12, "con el dock abajo, arriba a la izquierda empieza en el borde");
  cands.forEach((c) => assert.equal(L.intersection(c.rect, dockAbajo), 0, `${c.slot} pisa el dock`));
  const ctl = read("js/hardware_lab_3d_controller.js");
  // Solo es obligatorio (y visible compactada) en ensamble/mantenimiento y, en el guiado, en el paso del disipador.
  assert.match(ctl, /const required = \(isAssemblyPractice\(\) \|\| isMaintenance\(\)\) && \(!step \|\| \(step\.kind === "action" && step\.partId === "cooler"\)\);/);
});

test("U18. movil: la tarjeta es una banda compacta por defecto y el detalle se abre a mano", () => {
  assert.match(stage, /if \(\(mobile \|\| crowding \|\| \(target && pick\.cover > 0\.1\)\) && userExpandedFor !== summary\) \{/);
  // Expandir a mano se respeta durante ese paso.
  assert.match(stage, /userExpandedFor = \(document\.getElementById\("hwlab-card-summary"\) \|\| \{\}\)\.textContent/);
});
