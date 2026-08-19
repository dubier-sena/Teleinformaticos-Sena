/* js/hardware_lab_3d_monitor.js
 *
 * Monitor de diagnostico dentro de la escena (item 17): un mesh con
 * CanvasTexture que muestra CPU/RAM/temperaturas/discos/POST/voltajes/
 * errores, igual que un tecnico real leeria un panel de diagnostico. El
 * contenido tambien se expone via el HUD lateral (mas legible/accesible que
 * texto diminuto en el mundo 3D), pero el mesh en escena da inmersion.
 */
import * as THREE from "./vendor/three.module.min.js";
import { materialFor } from "./hardware_lab_3d_constants.js";

const CANVAS_W = 512;
const CANVAS_H = 340;
const TONE_COLOR = {
  ok: "#35e07a",
  warn: "#ffb020",
  danger: "#ff4d4f",
  neutral: "#8aa3b8",
};

export function createDiagnosticMonitor(opts = {}) {
  const width = opts.width || 0.28;
  const height = opts.height || 0.19;

  const group = new THREE.Group();
  group.name = "diagnostic-monitor";

  const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.008, 16), materialFor("plasticDark"));
  group.add(standBase);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 10), materialFor("plasticDark"));
  neck.position.y = 0.049;
  group.add(neck);

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.014, height + 0.014, 0.014),
    materialFor("plasticBlack")
  );
  bezel.position.y = 0.1 + height / 2;
  group.add(bezel);

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const screenMat = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.05,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMat);
  screen.position.set(0, 0.1 + height / 2, 0.0075);
  group.add(screen);

  group.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });

  let blinkPhase = 0;
  let poweredOn = true;
  let lastLines = [];

  function draw() {
    ctx.fillStyle = "#050a08";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (!poweredOn) {
      ctx.strokeStyle = "#242a2f";
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, CANVAS_W - 16, CANVAS_H - 16);
      ctx.fillStyle = "#3a4148";
      ctx.font = "600 22px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("SIN SENAL", CANVAS_W / 2, CANVAS_H / 2);
      texture.needsUpdate = true;
      return;
    }

    ctx.strokeStyle = "rgba(53,224,122,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, CANVAS_W - 12, CANVAS_H - 12);

    ctx.textAlign = "left";
    ctx.font = "700 18px 'Courier New', monospace";
    ctx.fillStyle = "#35e07a";
    ctx.fillText("DIAGNOSTICO DEL SISTEMA", 20, 34);
    const cursorOn = blinkPhase % 1 < 0.5;
    if (cursorOn) ctx.fillText("_", 300, 34);

    ctx.font = "600 15px 'Courier New', monospace";
    let y = 62;
    lastLines.forEach((line) => {
      ctx.fillStyle = "#5a6b74";
      ctx.fillText(line.label, 22, y);
      ctx.fillStyle = TONE_COLOR[line.tone] || TONE_COLOR.neutral;
      ctx.fillText(String(line.value), 200, y);
      y += 24;
    });

    texture.needsUpdate = true;
  }

  function setLines(lines) {
    lastLines = lines || [];
    draw();
  }

  function setPowered(value) {
    poweredOn = !!value;
    draw();
  }

  function update(dt) {
    blinkPhase = (blinkPhase + dt) % 2;
    if (poweredOn && Math.floor(blinkPhase * 2) !== Math.floor((blinkPhase - dt) * 2)) draw();
  }

  draw();

  return { group, setLines, setPowered, update, screenMaterial: screenMat };
}
