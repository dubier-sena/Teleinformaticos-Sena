// Fase 13 (auditoria profunda, CSP): extraido de un bloque <script> inline
// identico, duplicado en 6 paginas administrativas. Bloqueante a proposito
// (SIN defer): debe ejecutarse en el mismo punto del <head> donde vivia el
// inline, justo despues de que js/portal_auth.js (tambien sin defer) ya
// definio window.portalAuth, y ANTES de que el resto de la pagina se
// parsee/renderice. Comportamiento identico al original: mismo chequeo,
// misma redireccion, mismo vaciado del documento.
if (!window.portalAuth || !window.portalAuth.requireAdminAccess({ redirectUrl: "index.html" })) {
  document.documentElement.innerHTML = "";
  throw new Error("Acceso administrativo requerido.");
}
