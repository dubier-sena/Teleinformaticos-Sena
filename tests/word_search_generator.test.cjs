"use strict";
// Fase 14 (mantenibilidad): pruebas directas del generador de sopa de letras
// extraido de script_guia2.js. Sin DOM, sin estado de guia.
const test = require("node:test");
const assert = require("node:assert/strict");
const gen = require("../js/word_search_generator.js");

test("normalizeWordSearchText: quita tildes/ñ y caracteres no alfanumericos, mayusculas", () => {
  assert.equal(gen.normalizeWordSearchText("café niño"), "CAFENINO");
  assert.equal(gen.normalizeWordSearchText("PANTALLA AZUL"), "PANTALLAAZUL");
  assert.equal(gen.normalizeWordSearchText(""), "");
  assert.equal(gen.normalizeWordSearchText(null), "");
});

test("hashString: determinista (mismo texto, mismo numero siempre)", () => {
  const a = gen.hashString("guia2-sopa:variant-1:BIOS|LINUX");
  const b = gen.hashString("guia2-sopa:variant-1:BIOS|LINUX");
  assert.equal(a, b);
  assert.notEqual(a, gen.hashString("guia2-sopa:variant-2:BIOS|LINUX"));
});

test("createSeededRandom: misma semilla -> misma secuencia; semillas distintas -> secuencias distintas", () => {
  const seq1 = [];
  const rnd1 = gen.createSeededRandom(12345);
  for (let i = 0; i < 5; i++) seq1.push(rnd1());

  const seq2 = [];
  const rnd2 = gen.createSeededRandom(12345);
  for (let i = 0; i < 5; i++) seq2.push(rnd2());

  assert.deepEqual(seq1, seq2);

  const rnd3 = gen.createSeededRandom(99999);
  assert.notEqual(rnd3(), gen.createSeededRandom(12345)());
});

function targetsFor(words) {
  return words.map((w) => ({ label: w, word: gen.normalizeWordSearchText(w) }));
}

test("buildWordSearchGrid: coloca TODAS las palabras que caben (grilla amplia, pocas palabras)", () => {
  const random = gen.createSeededRandom(gen.hashString("test-seed-1"));
  const targets = targetsFor(["BIOS", "RAM", "SSD"]);
  const { grid, placements } = gen.buildWordSearchGrid(targets, 12, random, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");

  assert.equal(grid.length, 12);
  assert.equal(grid[0].length, 12);
  targets.forEach((t) => {
    assert.ok(placements[t.word], `la palabra ${t.word} deberia haberse colocado`);
    assert.equal(placements[t.word].cells.length, t.word.length);
    assert.equal(placements[t.word].label, t.label);
  });
});

test("buildWordSearchGrid: las celdas devueltas en placements coinciden con lo escrito en la grilla", () => {
  const random = gen.createSeededRandom(gen.hashString("test-seed-2"));
  const targets = targetsFor(["LINUX", "WINDOWS"]);
  const { grid, placements } = gen.buildWordSearchGrid(targets, 15, random, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");

  targets.forEach((t) => {
    const cells = placements[t.word].cells;
    cells.forEach((cell, index) => {
      assert.equal(grid[cell.row][cell.col], t.word[index]);
    });
  });
});

test("buildWordSearchGrid: celdas sin palabra quedan rellenas con una letra del alfabeto dado (nunca vacias)", () => {
  const random = gen.createSeededRandom(gen.hashString("test-seed-3"));
  const targets = targetsFor(["ISO"]);
  const { grid } = gen.buildWordSearchGrid(targets, 10, random, "XYZ");

  grid.forEach((row) => {
    row.forEach((cell) => {
      assert.ok(cell.length === 1, "cada celda debe tener exactamente una letra");
    });
  });
});

test("buildWordSearchGrid: misma semilla y mismos targets -> misma grilla exacta (reproducible)", () => {
  const targets = targetsFor(["BACKUP", "CONSOLA", "TERMINAL"]);
  const random1 = gen.createSeededRandom(gen.hashString("guia2-sopa:variant-1:x"));
  const result1 = gen.buildWordSearchGrid(targets, 15, random1, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");

  const random2 = gen.createSeededRandom(gen.hashString("guia2-sopa:variant-1:x"));
  const result2 = gen.buildWordSearchGrid(targets, 15, random2, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");

  assert.deepEqual(result1.grid, result2.grid);
  assert.deepEqual(result1.placements, result2.placements);
});
