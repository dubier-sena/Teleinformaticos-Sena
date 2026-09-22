// js/material_apoyo_links.js
//
// Resolvedor de enlaces de material de apoyo (segunda pasada de la migracion a
// Google Drive, 2026-09-21).
//
// Los cuatro catalogos de guia (script_guia2, script, script_guia3, script_guia6)
// ya traducian la ruta local a Drive dentro de buildMaterialHref(). Pero el
// material tambien se enlaza desde otros sitios que escriben el href tal cual:
//
//   · partials/guia-01-induccion-content.html        (y su bundle)
//   · partials/guia-02-herramientas-content.html     (y su bundle)
//   · partials/guia-04-planificar-ciberseguridad-content.html (y su bundle)
//   · partials/guia-06-mantener-equipos-content.html (y su bundle)
//   · js/reinforcement_workshops_catalog.js
//   · js/productive_stage_project_delivery.js
//   · pages/auxiliares/*-guia-02-actividad-322-matriz.html
//
// En vez de reescribir la URL de Drive en cada uno de esos archivos -- que es
// justo lo que se queria evitar -- se conserva la ruta original como CLAVE y se
// traduce aqui, contra el catalogo central data/material_apoyo_drive.js.
//
// Si el catalogo esta desactivado, no esta cargado, o no conoce la ruta, no se
// toca nada y el enlace local sigue funcionando. Por eso es seguro cargar este
// script en una pagina cuyo material aun no se haya migrado.
(function () {
  "use strict";

  function getCatalog() {
    var catalog = window.__MATERIAL_APOYO_DRIVE__;
    if (!catalog || !catalog.enabled || !catalog.files) {
      return null;
    }
    return catalog;
  }

  // Normaliza un href a la clave del catalogo: recorta lo anterior a
  // "assets/materiales/", quita query/fragmento y decodifica el porcentaje
  // (productive_stage_project_delivery.js guarda las rutas con %20).
  function normalize(value) {
    var raw = String(value || "").split("?")[0].split("#")[0];
    var at = raw.indexOf("assets/materiales/");
    if (at < 0) {
      return "";
    }
    raw = raw.slice(at);
    try {
      return decodeURIComponent(raw);
    } catch (error) {
      return raw;
    }
  }

  // Devuelve la URL de Drive para una ruta local, o null si no aplica.
  function resolve(value) {
    var catalog = getCatalog();
    if (!catalog) {
      return null;
    }
    var key = normalize(value);
    if (!key) {
      return null;
    }
    var fileId = catalog.files[key];
    return fileId ? "https://drive.google.com/file/d/" + fileId + "/view?usp=sharing" : null;
  }

  // Igual que resolve(), pero devuelve el valor original cuando no hay
  // traduccion: comodo para asignar directamente a un href.
  function hrefFor(value) {
    return resolve(value) || value;
  }

  // Reescribe los enlaces ya presentes en el DOM. Es idempotente: una vez
  // reescrito el href apunta a drive.google.com y deja de coincidir.
  function rewire(container) {
    var root = container || document;
    if (!root || typeof root.querySelectorAll !== "function") {
      return 0;
    }
    if (!getCatalog()) {
      return 0;
    }
    var changed = 0;
    var links = root.querySelectorAll('a[href*="assets/materiales/"]');
    Array.prototype.forEach.call(links, function (link) {
      var driveUrl = resolve(link.getAttribute("href"));
      if (!driveUrl) {
        return;
      }
      link.setAttribute("href", driveUrl);
      // El documento ya no se sirve desde el mismo origen: "download" no puede
      // forzar la descarga de un recurso de otro dominio y ademas impediria que
      // el visor de Drive se abriera. Se abre en una pestaña nueva.
      link.removeAttribute("download");
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      changed += 1;
    });
    return changed;
  }

  // Recorre un objeto/array de datos y traduce in situ toda cadena que apunte a
  // material migrado. Lo usan los catalogos que guardan las rutas como datos.
  function rewriteDataUrls(value, seen) {
    if (!getCatalog() || !value || typeof value !== "object") {
      return value;
    }
    var visited = seen || new Set();
    if (visited.has(value)) {
      return value;
    }
    visited.add(value);
    Object.keys(value).forEach(function (key) {
      var current = value[key];
      if (typeof current === "string") {
        if (current.indexOf("assets/materiales/") >= 0) {
          var driveUrl = resolve(current);
          if (driveUrl) {
            value[key] = driveUrl;
          }
        }
        return;
      }
      if (current && typeof current === "object") {
        rewriteDataUrls(current, visited);
      }
    });
    return value;
  }

  window.MaterialApoyoLinks = {
    normalize: normalize,
    resolve: resolve,
    hrefFor: hrefFor,
    rewire: rewire,
    rewriteDataUrls: rewriteDataUrls,
  };
})();
