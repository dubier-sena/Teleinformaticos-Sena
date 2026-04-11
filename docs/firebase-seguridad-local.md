# Firebase seguro en entorno local

Este proyecto deja la sincronizacion cloud deshabilitada por defecto para no publicar datos sensibles en GitHub.

## Como activar Firebase solo en tu equipo

Abre la consola del navegador en el PC administrador y ejecuta:

```js
localStorage.setItem(
  "sena_portal_firebase_runtime_v1",
  JSON.stringify({
    enabled: true,
    projectId: "tu-project-id-web",
    apiKey: "tu-api-key-web"
  })
);
location.reload();
```

Para desactivarlo otra vez:

```js
localStorage.removeItem("sena_portal_firebase_runtime_v1");
location.reload();
```

## Opcion alternativa

Si cargas un script propio antes de `js/firebase_db.js`, tambien puedes definir:

```js
window.PORTAL_FIREBASE_CONFIG = {
  enabled: true,
  projectId: "tu-project-id-web",
  apiKey: "tu-api-key-web"
};
```

## Recomendacion de seguridad

No vuelvas a dejar reglas abiertas de Firestore para un cliente estatico con REST publico.
Si mas adelante quieres sincronizacion cloud segura para todos los aprendices, lo correcto es migrar a una de estas opciones:

- Firebase Auth + Firestore SDK con reglas por usuario.
- Backend intermedio o Google Apps Script que firme y valide cada operacion.
