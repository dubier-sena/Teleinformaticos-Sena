# Firebase runtime setup

Este proyecto puede seguir funcionando como sitio estatico en GitHub Pages.
La parte publica puede permanecer 100% estatica, pero los datos privados
necesitan una autoridad segura: Firebase Auth/Functions o un backend pequeno.

## Modo recomendado

- GitHub Pages conserva `index.html`, `guia.html`, paginas auxiliares, recursos
  publicos y navegacion local.
- Firebase Auth identifica aprendices y administrador.
- Firestore guarda usuarios, avances, calendario y tutorias con reglas cerradas.
- Firebase Functions o un backend pequeno valida acciones administrativas,
  cambios de rol/ficha, reinicios de avance y cargas sensibles.
- `localStorage` queda como cache local/offline, no como fuente de autoridad.

Un cliente estatico publico no debe escribir directamente datos privados de
aprendices sin Auth, reglas estrictas o una funcion/backend que valide cada
operacion.

## Identidad academica obligatoria

Para la migracion segura, cada aprendiz debe quedar identificado con estos
campos:

- `fullName`: nombre completo.
- `ficha`: numero de ficha.
- `inst`: nombre de la institucion educativa.
- `grado`: grado academico, por ejemplo `10` u `11`.
- `grupo`: grupo/seccion, por ejemplo `10A`, `10B`, `11A` o `11B`.
- `usernameKey`: identificador tecnico usado para permisos y progreso.

La ficha es la llave academica: desde ella se derivan institucion, grado, grupo
y guias permitidas. En Firebase Auth, `usernameKey`, `ficha`, `grado` y rol
pueden vivir como claims o en un documento protegido; las acciones
administrativas deben verificar esos datos antes de leer o escribir avances.

## Activacion local legacy

La sincronizacion REST actual sirve para pruebas locales controladas o copias de
trabajo, pero no reemplaza seguridad real. Para probarla localmente puedes
habilitar la configuracion desde la consola del navegador:

```js
localStorage.setItem("sena_portal_firebase_runtime_v1", JSON.stringify({
  enabled: true,
  projectId: "tu-project-id-web",
  apiKey: "tu-api-key-web"
}));
```

Luego recarga la pagina y verifica:

```js
_firebaseDb.checkAvailability()
```

## Advertencia de seguridad

La API key web de Firebase no es una credencial secreta. La seguridad real debe
venir de Firebase Auth, reglas de Firestore cerradas por usuario/rol, o un
backend/Firebase Functions que valide las operaciones administrativas.

No uses reglas `allow read, write: if true` para datos reales de aprendices.
Mientras esas reglas existan, cualquier persona con acceso al proyecto/API key
puede leer o modificar usuarios, avances, calendarios o tutorias.

El archivo `firestore.rules` del repositorio ya queda como plantilla cerrada.
Antes de desplegarlo debes reemplazar `admin@example.com` por el correo real del
administrador y configurar el claim `usernameKey` en los usuarios de Firebase
Auth, o mover esas validaciones a Functions/backend.

## Ruta de migracion

1. Mantener GitHub Pages para paginas, guias y recursos publicos.
2. Agregar Firebase Auth para iniciar sesion.
3. Guardar roles administrativos en claims o en documentos protegidos.
4. Reemplazar escrituras directas desde cliente por reglas estrictas o Functions.
5. Mantener `localStorage` solo como cache local/offline, no como autoridad.
