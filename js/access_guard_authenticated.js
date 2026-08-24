// Fase 13 (auditoria profunda, CSP): extraido de un bloque <script> inline
// identico (salvo el comentario), duplicado en 3 paginas que solo exigen
// una sesion autenticada (aprendiz o admin), sin depender de ficha/guia
// puntual. Bloqueante a proposito (SIN defer): debe ejecutarse en el mismo
// punto del <head> donde vivia el inline, justo despues de que
// js/portal_auth.js (tambien sin defer) ya definio window.portalAuth.
// Comportamiento identico al original: mismo chequeo, misma redireccion.
(function () {
  function isFileProtocol() {
    return /^file:$/i.test(String(window.location.protocol || ""));
  }
  if (isFileProtocol()) return;
  var auth = window.portalAuth;
  if (!auth || typeof auth.getCurrentSession !== "function") return;
  var session = auth.getCurrentSession();
  if (!session || (session.role !== "student" && session.role !== "admin")) {
    window.location.replace("index.html");
  }
})();
