// grades_induccion.js — Juicios de evaluación de la Guía 1 (Inducción)
// Generado desde los archivos Excel "Plan de Trabajo Concertado".
// Estructura: ficha → nombreNormalizado → { actividadId: "A"|"D" }
// Normalización: minúsculas, sin tildes, sin espacios dobles.
// Grados: A = Aprobado, D = Desaprobado.
// Solo se incluyen fichas con datos cargados.

(function () {
  "use strict";

  // Actividades evaluadas por grupo institucional (orden de evidencias en el Excel)
  var EVIDENCE_MAP = {
    // Fichas Santa Bárbara (3441944 = 10A, 3441950 = 10B)
    sb: ["arbol312", "sena331", "programa332", "reglamento333"],
    // Fichas Kennedy (3441939 = 10A, 3441942 = 10B)
    jfk: ["arbol312", "sena331", "reglamento333"],
  };

  // Ficha 3441944 — Santa Bárbara 10A
  var SB_10A = {
    "beltran pinilla jhon deiby":               { arbol312: "A" },
    "corredor bernal ashlie sofia":              { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "franco porras jhon alexander":             { arbol312: "A" },
    "garcia rodriguez johanna lizeth":          { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "hernandez guerrero zaira camila":          { arbol312: "A", sena331: "A", programa332: "A" },
    "montana leynor emmanuel":                  { arbol312: "A", sena331: "A", reglamento333: "A" },
    "murcia guerrero laura estefania":          { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "murcia ramos marly yuliana":               { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "orjuela rodriguez yina paola":             { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "ortiz lancheros cristian saul":            { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "ortiz rodriguez brayan esneyder":          { arbol312: "A", sena331: "A" },
    "ortiz sanabria sara yineth":               { arbol312: "A", programa332: "A", reglamento333: "A" },
    "ortiz sanabria yerid adriana":             { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "pinzon romero adrian nicolas":             { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "pineros pinilla jaider alejandro":         { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "rodriguez coca yaney germayori":           { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "rodriguez pinson juan david":              { arbol312: "A", reglamento333: "A" },
    "serrato matamoros emanuel santiago":       { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "vargas torres briyith lizeth":             { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "villamil cuellar liceth fernanda":         { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
  };

  // Ficha 3441950 — Santa Bárbara 10B
  var SB_10B = {
    "arias adan jose david":                    { arbol312: "A", sena331: "A", reglamento333: "A" },
    "candela aguirre zahira mariana":           { arbol312: "A", sena331: "A", reglamento333: "A" },
    "castillo cordoba laura valentina":         { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "castro mozo nicolas alejandro":            { arbol312: "A", sena331: "A", reglamento333: "A" },
    "castro osorio allison daniela":            { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "chala huependo yurany":                    { arbol312: "A" },
    "delgadillo pinilla vania brygith":         { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "escarraga sastre lenis":                   { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "hernandez avendano aylin tehani":          { arbol312: "A", sena331: "A", reglamento333: "A" },
    "martinez sanchez karoll sofia":            { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "neiza garcia kevin samuel":                { arbol312: "A", sena331: "A", reglamento333: "A" },
    "paez espitia johan estiben":               { arbol312: "A", sena331: "A" },
    "salazar virguez luisa fernanda":           { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "sanchez rivera yeiner julian":             { arbol312: "A", sena331: "A" },
    "torres lopez maria paula":                 { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
    "triana cruz yesica natalia":               { arbol312: "A", sena331: "A", programa332: "A" },
    "vasco herrera juan manuel":                { arbol312: "A", sena331: "A", programa332: "A", reglamento333: "A" },
  };

  // Ficha 3441939 — Kennedy 10A
  var JFK_10A = {
    "arciniegas ocampo johan sneider":          { arbol312: "A", sena331: "A", reglamento333: "A" },
    "avila laverde dana sofia":                 { arbol312: "A", sena331: "A", reglamento333: "A" },
    "bonilla vargas jhupson stiwar":            { arbol312: "A", sena331: "A", reglamento333: "A" },
    "diaz oquendo maria fernanda":              { arbol312: "A", sena331: "A", reglamento333: "A" },
    "gomez prada nicol dayana":                 { arbol312: "A", sena331: "A", reglamento333: "A" },
    "gutierrez angel daniela":                  { arbol312: "A", sena331: "A", reglamento333: "A" },
    "isis mariana hernandez rondon":            { arbol312: "A", sena331: "A", reglamento333: "A" },
    "moreno guiza bleidy maried":               { arbol312: "A", sena331: "A", reglamento333: "A" },
    "munoz mahecha nicol dayanna":              { arbol312: "A", sena331: "A", reglamento333: "A" },
    "orozco quintero luisa fernanda":           { arbol312: "A", sena331: "A", reglamento333: "A" },
    "quintero suarez jarrison stiven":          { arbol312: "A", sena331: "A", reglamento333: "A" },
    "restrepo gutierrez karen dayana":          { arbol312: "A", sena331: "A", reglamento333: "A" },
    "riano rojas klein mateo":                  { arbol312: "A", sena331: "A", reglamento333: "A" },
    "sanchez hernandez jhon edwin":             { arbol312: "A", sena331: "A", reglamento333: "A" },
    "suarez amaris anahi shadai":               { arbol312: "A", sena331: "A", reglamento333: "A" },
    "zarate orjuela jesus javier":              { arbol312: "A", sena331: "A", reglamento333: "A" },
  };

  // Ficha 3441942 — Kennedy 10B
  var JFK_10B = {
    "acosta rojas sara jizeth":                 { arbol312: "A", sena331: "A", reglamento333: "A" },
    "aguilar acosta darly banessa":             { arbol312: "A", sena331: "A", reglamento333: "A" },
    "alvarez sanchez eimy dahiana":             { arbol312: "A" },
    "arciniegas bustos eylin katalina":         { arbol312: "A", sena331: "A", reglamento333: "A" },
    "arenas perdomo emanuel":                   { arbol312: "A", sena331: "A", reglamento333: "A" },
    "betancourt trillos danna valentina":       { arbol312: "A", sena331: "A", reglamento333: "A" },
    "cardona salazar angie valentina":          { arbol312: "A" },
    "cardozo parra shary lorena":               { arbol312: "A", sena331: "A", reglamento333: "A" },
    "castellanos hincapie aljsson sofia":       { arbol312: "A", sena331: "A", reglamento333: "A" },
    "ceballos guzman sara valentina":           { arbol312: "A", sena331: "A", reglamento333: "A" },
    "cruz cardona julian santiago":             { arbol312: "A", sena331: "A", reglamento333: "A" },
    "cubillos hernandez maira alejandra":       { arbol312: "A" },
    "gomez restrepo lizeth johana":             { arbol312: "A", sena331: "A", reglamento333: "A" },
    "laguna roldan sahian stacy":               { arbol312: "A", sena331: "A" },
    "martelo sanchez santiago rafael":          { arbol312: "A", sena331: "A", reglamento333: "A" },
    "mendez ortiz angel santiago":              { arbol312: "A" },
    "ospina bernal santiago":                   { arbol312: "A", sena331: "A" },
    "ramos piracoa johan smith":                { arbol312: "A", sena331: "A" },
    "rubiano murcia robinson yandiel":          { arbol312: "A", sena331: "A", reglamento333: "A" },
    "velez vergara johan esteban":              { arbol312: "A" },
  };

  window.__GRADES_INDUCCION__ = {
    evidenceMap: EVIDENCE_MAP,
    "3441944": SB_10A,
    "3441950": SB_10B,
    "3441939": JFK_10A,
    "3441942": JFK_10B,
  };
})();
