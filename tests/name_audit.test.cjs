// Logica de auditoria/actualizacion de nombres de aprendices (js/name_audit.js).
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const na = require(path.join("..", "js", "name_audit.js"));

test("normalize: quita acentos y la tilde de la ñ; minusculas", () => {
  assert.equal(na.normalize("[DATO REDACTADO]"), "montana leynor");
  assert.equal(na.normalize("José Andrés Muñoz"), "jose andres munoz");
});

test("wordSetKey: orden, mayusculas y acentos no importan", () => {
  assert.equal(
    na.wordSetKey("[DATO REDACTADO]"),
    na.wordSetKey("Jhon Deiby [DATO REDACTADO]")
  );
  assert.equal(na.wordSetKey("[DATO REDACTADO]"), na.wordSetKey("pineros pinilla"));
});

test("parseOfficialNames: colapsa espacios y descarta vacios", () => {
  const lines = na.parseOfficialNames("  JUAN PEREZ  \n\n  MARIA   LOPEZ \n");
  assert.deepEqual(lines, ["JUAN PEREZ", "MARIA LOPEZ"]);
});

test("match: SEGURO con coincidencia unica de palabras y nombre distinto", () => {
  const users = [
    { usernameKey: "a", username: "a", fullName: "jhon deiby [DATO REDACTADO]", ficha: "3441944" },
    { usernameKey: "b", username: "b", fullName: "Ashlie Sofia [DATO REDACTADO]", ficha: "3441944" },
  ];
  const res = na.matchOfficialNames(
    ["[DATO REDACTADO]", "[DATO REDACTADO]"],
    users
  );
  assert.equal(res.sure.length, 2);
  assert.equal(res.sure[0].official, "[DATO REDACTADO]");
  assert.equal(res.sure[0].user.usernameKey, "a");
  assert.equal(res.uncertain.length, 0);
});

test("match: SIN CAMBIO cuando el nombre ya es identico", () => {
  const users = [{ usernameKey: "a", username: "a", fullName: "[DATO REDACTADO]", ficha: "1" }];
  const res = na.matchOfficialNames(["[DATO REDACTADO]"], users);
  assert.equal(res.sure.length, 0);
  assert.equal(res.noChange.length, 1);
});

test("match: DUDOSO sin coincidencia exacta (apellido faltante) sugiere candidato", () => {
  const users = [{ usernameKey: "a", username: "a", fullName: "Jhon Beltran", ficha: "1" }];
  const res = na.matchOfficialNames(["[DATO REDACTADO]"], users);
  assert.equal(res.sure.length, 0);
  assert.equal(res.uncertain.length, 1);
  assert.equal(res.uncertain[0].candidates.length, 1); // 2 palabras compartidas
  assert.equal(res.uncertain[0].candidates[0].usernameKey, "a");
});

test("match: DUDOSO cuando varios aprendices coinciden (posible duplicado)", () => {
  const users = [
    { usernameKey: "a", username: "a", fullName: "Jhon Deiby [DATO REDACTADO]", ficha: "1" },
    { usernameKey: "b", username: "b", fullName: "[DATO REDACTADO]", ficha: "1" },
  ];
  const res = na.matchOfficialNames(["[DATO REDACTADO]"], users);
  assert.equal(res.sure.length, 0);
  assert.equal(res.uncertain.length, 1);
  assert.equal(res.uncertain[0].candidates.length, 2);
});

test("unmatchedStudents: aprendiz del sistema que no esta en el listado oficial", () => {
  const users = [
    { usernameKey: "a", username: "a", fullName: "Jhon Deiby [DATO REDACTADO]", ficha: "1" },
    { usernameKey: "x", username: "x", fullName: "Persona Extra Que Sobra", ficha: "1" },
  ];
  const res = na.matchOfficialNames(["[DATO REDACTADO]"], users);
  assert.equal(res.unmatchedStudents.length, 1);
  assert.equal(res.unmatchedStudents[0].usernameKey, "x");
});

test("integracion: el listado real 10A no rompe (sin usuarios cargados => todo dudoso)", () => {
  const oficial = na.parseOfficialNames(
    "[DATO REDACTADO]\n[DATO REDACTADO]\n[DATO REDACTADO]"
  );
  assert.equal(oficial.length, 3);
  const res = na.matchOfficialNames(oficial, []);
  assert.equal(res.sure.length, 0);
  assert.equal(res.uncertain.length, 3);
  assert.equal(res.unmatchedStudents.length, 0);
});
