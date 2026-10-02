/* js/hardware_lab_3d_laptop_screen.js
 *
 * Pantalla VIVA del portatil (LOOP portatil, Fase F, 2026-10-01).
 *
 * Antes, "Encender y comprobar" solo cambiaba un texto en la tarjeta: el
 * equipo no reaccionaba y el aprendiz leia el sintoma en vez de OBSERVARLO.
 * Ahora la pantalla del modelo muestra lo que se veria en un portatil real:
 * arranque, pantalla negra con el equipo encendido, "no se encuentra
 * dispositivo de arranque", escritorio con el aviso del subsistema que falla,
 * etc. Nunca nombra la pieza responsable: muestra el SINTOMA.
 *
 * El contenido se dibuja en un lienzo 2D y se aplica como textura a la cara
 * del panel (malla "laptop-screen-emitter" del conjunto de pantalla). La
 * malla original no se modifica: se le asigna un material propio y se
 * restaura al salir.
 *
 * screenModel(stateId) es PURO (se prueba en Node): describe que se dibuja.
 */
import * as THREE from "./vendor/three.module.min.js";

const W = 640;
const H = 400;

/** Estados de pantalla. `powered`: el equipo tiene energia; `image`: hay imagen. */
const STATES = {
  off: { powered: false, image: false, kind: "off" },
  "no-power": { powered: false, image: false, kind: "off" },
  "no-post": { powered: true, image: false, kind: "black", note: "Enciende · sin imagen" },
  "no-image": { powered: true, image: false, kind: "black", note: "Arranca · sin imagen" },
  crash: { powered: true, image: true, kind: "text", bg: "#0a3a8c", lines: ["El equipo se detuvo por", "un error y se va a reiniciar.", "", "Esto se repite durante el uso."] },
  "no-boot": { powered: true, image: true, kind: "text", lines: ["No se encontró un dispositivo", "de arranque.", "", "Revise el almacenamiento y", "reinicie el equipo."] },
  desktop: { powered: true, image: true, kind: "desktop", banner: null, title: "Sistema iniciado", ok: true },
  "wifi-fail": { powered: true, image: true, kind: "desktop", wifi: "fail", title: "Sin redes Wi-Fi", banner: "No hay conexión inalámbrica" },
  "wifi-weak": { powered: true, image: true, kind: "desktop", wifi: "weak", title: "Señal Wi-Fi muy débil", banner: "Conexión inestable" },
  overheat: { powered: true, image: true, kind: "desktop", temp: "hot", title: "Temperatura muy alta", banner: "97 °C · rendimiento reducido" },
  "touchpad-fail": { powered: true, image: true, kind: "desktop", title: "El puntero no se mueve", banner: "El panel táctil no responde" },
  "keyboard-fail": { powered: true, image: true, kind: "desktop", title: "No se puede escribir", banner: "El teclado no responde" },
  "battery-fail": { powered: true, image: true, kind: "desktop", battery: "fail", title: "La batería no carga", banner: "0 % · solo funciona con cargador" },
};

/** Descripcion pura del estado (o la de "off" si no existe). */
export function screenModel(stateId) {
  const s = STATES[stateId] || STATES.off;
  return Object.assign({ id: STATES[stateId] ? stateId : "off" }, s);
}

export const SCREEN_STATE_IDS = Object.keys(STATES);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWifi(ctx, x, y, mode) {
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  [26, 17, 8].forEach((r, i) => {
    ctx.strokeStyle = mode === "fail" ? "#5b6676" : mode === "weak" && i < 2 ? "#5b6676" : "#e8edf5";
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 1.22, Math.PI * 1.78);
    ctx.stroke();
  });
  ctx.fillStyle = mode === "fail" ? "#5b6676" : "#e8edf5";
  ctx.beginPath();
  ctx.arc(x, y - 1, 3.5, 0, Math.PI * 2);
  ctx.fill();
  if (mode === "fail") {
    ctx.strokeStyle = "#ff4d4f";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 26);
    ctx.lineTo(x + 20, y + 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBattery(ctx, x, y, mode) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = mode === "fail" ? "#ff4d4f" : "#e8edf5";
  roundRect(ctx, x, y, 46, 22, 4);
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fillRect(x + 48, y + 7, 4, 8);
  if (mode !== "fail") ctx.fillRect(x + 5, y + 5, 30, 12);
  else {
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", x + 23, y + 18);
  }
  ctx.restore();
}

function drawDesktop(ctx, m) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, m.temp === "hot" ? "#4a1420" : "#0f3d68");
  g.addColorStop(1, m.temp === "hot" ? "#1c0a10" : "#0a1c33");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Barra de tareas con los indicadores del sistema.
  ctx.fillStyle = "rgba(6, 10, 18, 0.82)";
  ctx.fillRect(0, H - 62, W, 62);
  drawWifi(ctx, W - 150, H - 20, m.wifi || "ok");
  drawBattery(ctx, W - 100, H - 42, m.battery || "ok");
  // Mensaje central: grande, para leerlo tambien en un telefono.
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 46px sans-serif";
  ctx.fillText(m.title, W / 2, 150, W - 40);
  if (m.banner) {
    ctx.fillStyle = "rgba(255, 77, 79, 0.92)";
    roundRect(ctx, 50, 190, W - 100, 74, 14);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(m.banner, W / 2, 238, W - 130);
  } else if (m.ok) {
    ctx.fillStyle = "rgba(53, 224, 122, 0.92)";
    roundRect(ctx, 150, 190, W - 300, 74, 14);
    ctx.fill();
    ctx.fillStyle = "#06220f";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("Todo funciona", W / 2, 238);
  }
}

/** Dibuja un estado. `progress` (0..1) solo se usa en el arranque. */
export function drawScreen(ctx, stateId, progress) {
  const m = screenModel(stateId);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textBaseline = "alphabetic";
  if (stateId === "boot") {
    ctx.fillStyle = "#03050a";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8edf5";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText("Iniciando…", W / 2, 180);
    ctx.fillStyle = "#1c2634";
    roundRect(ctx, 170, 220, 300, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#35d0ff";
    roundRect(ctx, 170, 220, Math.max(16, 300 * Math.max(0, Math.min(1, progress || 0))), 16, 8);
    ctx.fill();
  } else if (m.kind === "off") {
    ctx.fillStyle = "#020305";
    ctx.fillRect(0, 0, W, H);
  } else if (m.kind === "black") {
    // Retroiluminacion encendida sin imagen: negro "lavado", no apagado.
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, "#161b26");
    g.addColorStop(1, "#080a10");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (m.kind === "text") {
    ctx.fillStyle = m.bg || "#000000";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e6e6e6";
    ctx.font = "bold 34px monospace";
    ctx.textAlign = "left";
    m.lines.forEach((line, i) => ctx.fillText(line, 36, 96 + i * 48, W - 72));
    ctx.fillRect(36, 96 + m.lines.length * 48 - 28, 22, 6);
  } else {
    drawDesktop(ctx, m);
  }
  ctx.restore();
}

/**
 * @param {object} o
 * @param {THREE.Object3D} o.root   conjunto de pantalla del rig
 * @param {function} [o.keepAwake]  despierta el render (render bajo demanda)
 */
export function createLaptopScreen({ root, keepAwake }) {
  let mesh = null;
  if (root) root.traverse((n) => { if (!mesh && n.isMesh && n.name === "laptop-screen-emitter") mesh = n; });
  if (!mesh || typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // El panel se autora boca abajo (mira al teclado con la tapa cerrada): la
  // imagen va en la cara -Y, que con la tapa abierta queda de frente al
  // usuario y derecha (comprobado con captura real).
  const lit = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const edge = new THREE.MeshBasicMaterial({ color: 0x020305 });
  const original = mesh.material;
  mesh.material = [edge, edge, edge, lit, edge, edge];

  // LED de encendido en el borde inferior del marco: verde con el equipo
  // encendido, apagado si no hay energia. Se ve tambien con la pantalla negra
  // (asi se distingue "encendido sin imagen" de "apagado").
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 12), new THREE.MeshBasicMaterial({ color: 0x1a2a1f, toneMapped: false, side: THREE.DoubleSide }));
  led.name = "laptop-power-led";
  led.rotation.x = Math.PI / 2;
  led.position.set(mesh.position.x + mesh.scale.x * 0.44, mesh.position.y - 0.0006, mesh.position.z - mesh.scale.z / 2 - 0.0045);
  led.raycast = () => {};
  if (mesh.parent) mesh.parent.add(led);
  const setLed = (on) => { led.material.color.setHex(on ? 0x35e07a : 0x1a2a1f); };

  let state = "off";
  let timers = [];
  let raf = 0;
  const wake = () => { if (keepAwake) keepAwake(600, { shadows: false }); };

  function paint(id, progress) {
    drawScreen(ctx, id, progress);
    texture.needsUpdate = true;
    wake();
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function setState(id) {
    clearTimers();
    const m = screenModel(id);
    state = m.id;
    setLed(m.powered);
    paint(state);
  }

  /**
   * Secuencia de encendido y resultado. Devuelve una promesa que se resuelve
   * cuando la pantalla muestra el resultado (para dar el aviso DESPUES de
   * que el aprendiz lo vea).
   */
  function powerOn(resultId, opts = {}) {
    clearTimers();
    const m = screenModel(resultId);
    const reduced = !!opts.instant;
    return new Promise((resolve) => {
      const finish = () => { state = m.id; setLed(m.powered); paint(m.id); resolve(m); };
      if (reduced || !m.powered) { finish(); return; }
      // 1) LED de encendido; 2) retroiluminacion (pantalla negra iluminada).
      setLed(true);
      paint("off");
      timers.push(setTimeout(() => {
        paint("no-post");
        // Sin imagen: la retroiluminacion enciende y no pasa nada mas.
        if (!m.image) { timers.push(setTimeout(finish, 700)); return; }
        // Mensaje de arranque del propio equipo (sin sistema operativo).
        if (m.kind === "text") { timers.push(setTimeout(finish, 500)); return; }
        // 3) Arranque; 4) resultado (escritorio, con el aviso si algo falla).
        timers.push(setTimeout(() => {
          const t0 = performance.now();
          const dur = 1000;
          const step = () => {
            const p = (performance.now() - t0) / dur;
            if (p >= 1) { finish(); return; }
            paint("boot", p);
            raf = requestAnimationFrame(step);
          };
          step();
        }, 300));
      }, 250));
    });
  }

  function dispose() {
    clearTimers();
    mesh.material = original;
    if (led.parent) led.parent.remove(led);
    led.geometry.dispose();
    led.material.dispose();
    texture.dispose();
    lit.dispose();
    edge.dispose();
  }

  paint("off");
  return { setState, powerOn, dispose, get state() { return state; }, get ledOn() { return led.material.color.getHex() === 0x35e07a; }, canvas };
}
