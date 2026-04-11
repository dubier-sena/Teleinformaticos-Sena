# Integracion de entregas con Google Apps Script

## Objetivo

Permitir que el aprendiz entregue un archivo desde el portal y que se guarde automaticamente en Drive con esta estructura:

`Ficha 3441939 / Guia 2 / Actividad 4 / Nombre del aprendiz`

## Archivos del proyecto

- `js/project_integrations.js`
- `js/activity_delivery.js`
- `apps-script/entregas_actividades.gs`

## Paso 1. Crear las carpetas base en Drive

Crea una carpeta principal por cada ficha y copia su ID:

- `3441939`
- `3441942`
- `3441944`
- `3441950`
- `3168850`
- `3168852`

## Paso 2. Configurar el Apps Script

1. Entra a [script.google.com](https://script.google.com).
2. Crea un proyecto nuevo.
3. Copia el contenido de `apps-script/entregas_actividades.gs`.
4. Reemplaza los valores `PEGAR_FOLDER_ID_*` por los IDs reales de cada carpeta.
5. Implementa el proyecto como **Aplicacion web**.
6. Copia la URL publicada.

## Paso 3. Configurar el portal localmente

Abre `js/project_integrations.js` y completa:

```js
window.PROJECT_INTEGRATIONS = {
  googleAppsScriptUrl: "PEGAR_AQUI_LA_URL_DE_LA_WEB_APP",
};
```

## Paso 4. Flujo en el portal

En la Actividad 4:

1. El aprendiz escribe nombre completo y ficha.
2. Selecciona el archivo.
3. Pulsa `Entregar actividad`.
4. El portal envia el archivo al Apps Script.
5. El Apps Script crea la ruta:

`Ficha / Guia / Actividad / Aprendiz`

6. El archivo queda guardado y el portal devuelve el enlace a Drive.

## Recomendaciones de seguridad

- No publiques IDs de carpetas dentro del cliente si no es necesario.
- Mantén la logica de carpetas en el Apps Script, no en el HTML.
- Si luego activamos un backend propio, podremos firmar las solicitudes y mejorar la seguridad del envio.
- Si vas a subir este proyecto a GitHub, revisa la URL del Apps Script antes de publicar.
