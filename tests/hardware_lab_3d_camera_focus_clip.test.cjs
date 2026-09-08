// Fase "Laboratorio Virtual 3D: cierre" (2026-09-08).
//
// Bug real encontrado con clic real: los botones de "Enfoque rapido" para
// grupos de piezas pequenos cercanos a una pared externa del equipo
// (Almacenamiento, Energia -- ver FOCUS_PRESETS en hardware_lab_3d_stage.js)
// usan un distanceFactor mas ajustado que el default (2.3 en vez de 3.4).
// Visto desde la vista "Lateral" con el gabinete CERRADO (estado inicial real
// de los modos Desensamble guiado/Evaluacion/Practica libre), ese
// distanceFactor colocaba la camara mas cerca del grupo enfocado que la
// propia tapa lateral -- atravesandola. El resultado no era un error de
// consola: la camara quedaba pegada a la cara interna de la tapa (clipping),
// mostrando una superficie de color solido en vez de la pieza enfocada.
//
// Confirmado con clic real en ambos botones ("Almacenamiento" y "Energia"),
// y confirmado que "Placa base"/"Refrigeracion" (mismo distanceFactor, mismo
// mecanismo) tambien atravesaban la tapa una vez probados en el mismo estado
// cerrado -- no es exclusivo de un boton, es un problema del calculo general
// de flyToBox() cuando el punto resultante cae dentro del volumen del propio
// equipo.
//
// Fix: flyToBox() en hardware_lab_3d_camera.js ahora empuja la posicion
// calculada hacia afuera si queda a menos de rigRadius*1.05 del rigCenter
// (la esfera envolvente completa del equipo, ya trackeada por setRigBounds()
// para los presets de vista nombrados) -- sin tocar el objetivo ni el
// encuadre de los casos que ya funcionaban bien (esos ya caen fuera de esa
// esfera).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function extractFunctionSource(src, marker) {
  const start = src.indexOf(marker);
  if (start === -1) return null;
  // Salta la lista de parametros contando parentesis (no solo buscando el
  // primer "{"): un default como "opts = {}" pone una llave ANTES de la
  // llave real del cuerpo, y truncaria la extraccion ahi mismo.
  const parenStart = src.indexOf("(", start);
  if (parenStart === -1) return null;
  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < src.length; i++) {
    if (src[i] === "(") parenDepth++;
    else if (src[i] === ")") {
      parenDepth--;
      if (parenDepth === 0) {
        parenEnd = i;
        break;
      }
    }
  }
  if (parenEnd === -1) return null;
  const braceStart = src.indexOf("{", parenEnd);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

test("flyToBox() empuja la camara fuera de la esfera envolvente del equipo (rigRadius) antes de volar hacia la pieza enfocada", () => {
  const src = read("js/hardware_lab_3d_camera.js");
  const fn = extractFunctionSource(src, "function flyToBox(box, opts");
  assert.ok(fn, "no se encontro el cuerpo de flyToBox");

  const rigRadiusIdx = fn.indexOf("rigRadius");
  const rigCenterIdx = fn.indexOf("rigCenter");
  const flyToCallIdx = fn.lastIndexOf("flyTo(pos, sphere.center, opts)");
  assert.notEqual(rigRadiusIdx, -1, "flyToBox debe comparar contra rigRadius (la esfera envolvente completa del equipo), no solo contra el tamano del grupo enfocado (sphere.radius)");
  assert.notEqual(rigCenterIdx, -1, "flyToBox debe usar rigCenter como referencia del volumen del equipo");
  assert.notEqual(flyToCallIdx, -1, "no se encontro la llamada real a flyTo() al final de flyToBox");
  assert.ok(
    rigRadiusIdx < flyToCallIdx && rigCenterIdx < flyToCallIdx,
    "la comprobacion contra rigRadius/rigCenter debe ejecutarse ANTES de flyTo(pos, ...) -- si se mueve despues, pos ya fue usado para volar y el ajuste llega tarde"
  );

  // La correccion debe modificar "pos" (la variable que flyTo() realmente
  // usa), no una copia sin usar -- si no reasigna pos, el clamp no tiene
  // efecto real sobre el vuelo de camara.
  assert.match(
    fn,
    /pos\.copy\(rigCenter\)\.addScaledVector\([^)]*,\s*minDistFromRig\)/,
    "el ajuste debe reescribir pos.copy(rigCenter).addScaledVector(direccion, distanciaMinima) -- de lo contrario el punto calculado original (que puede caer dentro del equipo) sigue siendo el que se usa para volar"
  );
});

test("el margen minimo se basa en rigRadius (no en un numero fijo arbitrario), para escalar con equipos de escritorio y portatil", () => {
  const src = read("js/hardware_lab_3d_camera.js");
  const fn = extractFunctionSource(src, "function flyToBox(box, opts");
  assert.match(
    fn,
    /minDistFromRig\s*=\s*rigRadius\s*\*/,
    "minDistFromRig debe derivarse de rigRadius (proporcional al tamano real del equipo cargado) -- un valor fijo en metros se veria mal (muy cerca o muy lejos) entre el escritorio y el portatil, que usan escalas distintas"
  );
});
