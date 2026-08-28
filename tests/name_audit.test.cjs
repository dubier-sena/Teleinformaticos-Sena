const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const na = require(path.join("..", "js", "name_audit.js"));

test("normalize: quita acentos y la tilde de la ñ; minusculas", () => {
  assert.equal(na.normalize("PEÑA Andrade"), "pena andrade");
  assert.equal(na.normalize("José Andrés Muñoz"), "jose andres munoz");
});

test("wordSetKey: orden, mayusculas y acentos no importan", () => {
  assert.equal(
    na.wordSetKey("GUTIERREZ PARDO JHON DAVID"),
    na.wordSetKey("Jhon David Gutierrez Pardo")
  );
  assert.equal(na.wordSetKey("CAMPIÑA MOLINA"), na.wordSetKey("campina molina"));
});

test("parseOfficialNames: colapsa espacios y descarta vacios", () => {
  const lines = na.parseOfficialNames("  JUAN PEREZ  \n\n  MARIA   LOPEZ \n");
  assert.deepEqual(lines, ["JUAN PEREZ", "MARIA LOPEZ"]);
});

test("match: SEGURO con coincidencia unica de palabras y nombre distinto", () => {
  const users = [
    { usernameKey: "a", username: "a", fullName: "jhon david gutierrez pardo", ficha: "3441944" },
    { usernameKey: "b", username: "b", fullName: "Ashley Sofia Medina Rojas", ficha: "3441944" },
  ];
  const res = na.matchOfficialNames(
    ["GUTIERREZ PARDO JHON DAVID", "MEDINA ROJAS ASHLEY SOFIA"],
    users
  );
  assert.equal(res.sure.length, 2);
  assert.equal(res.sure[0].official, "GUTIERREZ PARDO JHON DAVID");
  assert.equal(res.sure[0].user.usernameKey, "a");
  assert.equal(res.uncertain.length, 0);
});

test("match: SIN CAMBIO cuando el nombre ya es identico", () => {
  const users = [{ usernameKey: "a", username: "a", fullName: "GUTIERREZ PARDO JHON DAVID", ficha: "1" }];
  const res = na.matchOfficialNames(["GUTIERREZ PARDO JHON DAVID"], users);
  assert.equal(res.sure.length, 0);
  assert.equal(res.noChange.length, 1);
});

test("match: DUDOSO sin coincidencia exacta (apellido faltante) sugiere candidato", () => {
  const users = [{ usernameKey: "a", username: "a", fullName: "Jhon Gutierrez", ficha: "1" }];
  const res = na.matchOfficialNames(["GUTIERREZ PARDO JHON DAVID"], users);
  assert.equal(res.sure.length, 0);
  assert.equal(res.uncertain.length, 1);
  assert.equal(res.uncertain[0].candidates.length, 1); // 2 palabras compartidas
  assert.equal(res.uncertain[0].candidates[0].usernameKey, "a");
});

test("match: DUDOSO cuando varios aprendices coinciden (posible duplicado)", () => {
  const users = [
    { usernameKey: "a", username: "a", fullName: "Jhon David Gutierrez Pardo", ficha: "1" },
    { usernameKey: "b", username: "b", fullName: "Gutierrez Pardo Jhon David", ficha: "1" },
  ];
  const res = na.matchOfficialNames(["GUTIERREZ PARDO JHON DAVID"], users);
  assert.equal(res.sure.length, 0);
  assert.equal(res.uncertain.length, 1);
  assert.equal(res.uncertain[0].candidates.length, 2);
});

test("unmatchedStudents: aprendiz del sistema que no esta en el listado oficial", () => {
  const users = [
    { usernameKey: "a", username: "a", fullName: "Jhon David Gutierrez Pardo", ficha: "1" },
    { usernameKey: "x", username: "x", fullName: "Persona Extra Que Sobra", ficha: "1" },
  ];
  const res = na.matchOfficialNames(["GUTIERREZ PARDO JHON DAVID"], users);
  assert.equal(res.unmatchedStudents.length, 1);
  assert.equal(res.unmatchedStudents[0].usernameKey, "x");
});

test("integracion: un listado con acentos/ene no rompe (sin usuarios cargados => todo dudoso)", () => {
  const oficial = na.parseOfficialNames(
    "GUTIERREZ PARDO JHON DAVID\nMEDINA ROJAS ASHLEY SOFIA\nPEÑA ANDRADE EMMANUEL DAVID"
  );
  assert.equal(oficial.length, 3);
  const res = na.matchOfficialNames(oficial, []);
  assert.equal(res.sure.length, 0);
  assert.equal(res.uncertain.length, 3);
  assert.equal(res.unmatchedStudents.length, 0);
});
