// js/word_search_generator.js
// Fase 14 (mantenibilidad): generador de sopa de letras extraido de
// script_guia2.js sin cambiar su comportamiento (mismo algoritmo, mismo
// orden de intentos, mismo resultado para la misma semilla). Es un
// "componente reutilizable" puro: no toca el DOM ni el estado de ninguna
// guia -- recibe la lista de palabras + una funcion aleatoria YA SEMBRADA
// (para que el resultado sea reproducible por variante, como antes) y
// devuelve la grilla + las posiciones donde quedo cada palabra.
//
// Quien llama decide la semilla (script_guia2.js sigue calculandola con su
// propio activityId + variante, igual que antes) -- este modulo solo sabe
// generar la grilla, no de que actividad/guia viene.
//
// Expuesto como window.wordSearchGenerator (uso en pagina) y module.exports
// (tests).
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.wordSearchGenerator = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var DEFAULT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var DIRECTIONS = [
    [0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1],
  ];

  function normalizeWordSearchText(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
  }

  // FNV-1a de 32 bits. Determinista: mismo texto, mismo numero, siempre.
  function hashString(value) {
    var hash = 2166136261;
    String(value || "").split("").forEach(function (char) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    });
    return hash >>> 0;
  }

  // PRNG determinista (mulberry32) a partir de una semilla numerica -- misma
  // semilla siempre produce la misma secuencia, por eso una variante de sopa
  // de letras se ve igual cada vez que se recalcula (no se guarda la grilla,
  // solo la semilla implicita en el nombre de la variante).
  function createSeededRandom(seed) {
    var value = seed >>> 0;
    return function () {
      value += 0x6d2b79f5;
      var next = value;
      next = Math.imul(next ^ (next >>> 15), next | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  }

  // targets: [{ label, word }] ya normalizados y ordenados (mas largas
  // primero) por quien llama -- este modulo no decide el orden de colocacion.
  // random: funcion 0..1 YA SEMBRADA (ver createSeededRandom).
  // Devuelve { grid, placements } -- placements[word] = { label, cells }.
  function buildWordSearchGrid(targets, gridSize, random, alphabet) {
    var size = gridSize || 15;
    var letters = alphabet || DEFAULT_ALPHABET;
    var grid = Array.from({ length: size }, function () { return Array(size).fill(""); });
    var placements = {};

    function canPlace(word, row, col, rowStep, colStep) {
      for (var index = 0; index < word.length; index += 1) {
        var nextRow = row + rowStep * index;
        var nextCol = col + colStep * index;
        if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) {
          return false;
        }
        if (grid[nextRow][nextCol] && grid[nextRow][nextCol] !== word[index]) {
          return false;
        }
      }
      return true;
    }

    function place(target, row, col, rowStep, colStep) {
      placements[target.word] = { label: target.label, cells: [] };
      for (var index = 0; index < target.word.length; index += 1) {
        var nextRow = row + rowStep * index;
        var nextCol = col + colStep * index;
        grid[nextRow][nextCol] = target.word[index];
        placements[target.word].cells.push({ row: nextRow, col: nextCol });
      }
    }

    (targets || []).forEach(function (target) {
      var placed = false;

      for (var attempt = 0; attempt < 2000 && !placed; attempt += 1) {
        var dir = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
        var row = Math.floor(random() * size);
        var col = Math.floor(random() * size);
        if (canPlace(target.word, row, col, dir[0], dir[1])) {
          place(target, row, col, dir[0], dir[1]);
          placed = true;
        }
      }

      for (var r = 0; r < size && !placed; r += 1) {
        for (var c = 0; c < size && !placed; c += 1) {
          for (var d = 0; d < DIRECTIONS.length && !placed; d += 1) {
            var step = DIRECTIONS[d];
            if (canPlace(target.word, r, c, step[0], step[1])) {
              place(target, r, c, step[0], step[1]);
              placed = true;
            }
          }
        }
      }
    });

    for (var row = 0; row < size; row += 1) {
      for (var col = 0; col < size; col += 1) {
        if (!grid[row][col]) {
          grid[row][col] = letters[Math.floor(random() * letters.length)];
        }
      }
    }

    return { grid: grid, placements: placements };
  }

  return {
    normalizeWordSearchText: normalizeWordSearchText,
    hashString: hashString,
    createSeededRandom: createSeededRandom,
    buildWordSearchGrid: buildWordSearchGrid,
  };
});
