# Publicar en GitHub Pages

## Flujo recomendado desde la PC

La forma más simple es trabajar desde la carpeta raíz del proyecto y subir todo a un repositorio de GitHub. Puedes hacerlo con GitHub Desktop o con Git desde `C:\Users\PC\Downloads\Pagina_Web`.

## 1. Crear el repositorio

1. Entra a GitHub y crea un repositorio nuevo.
2. Elige un nombre claro, por ejemplo `pagina-web`.
3. No hace falta crear carpetas especiales ni usar una carpeta llamada `HTML`.

## 2. Subir el proyecto completo

1. Abre el proyecto local desde la carpeta raíz.
2. Si usas GitHub Desktop, selecciona `Add existing repository` y apunta a esa carpeta.
3. Si usas Git, inicializa el repo, haz commit y envíalo a GitHub.
4. Sube todos los archivos del proyecto tal como están en la raíz: `index.html`, CSS, JS, `assets`, `data` y demás recursos.

## 3. Activar GitHub Pages

1. En el repositorio de GitHub, entra a `Settings`.
2. Abre `Pages`.
3. En `Build and deployment`, elige `Deploy from a branch`.
4. Selecciona la rama `main`.
5. En la carpeta, deja `/ (root)`.
6. Guarda los cambios.

GitHub te mostrará una URL pública similar a:

`https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`

## 4. Cómo actualizar después

1. Edita los archivos en tu PC.
2. Guarda los cambios en la carpeta raíz del proyecto.
3. Haz commit.
4. Haz push a `main`.

GitHub Pages se actualiza solo después de cada push.

## 5. Qué funciona en la web y qué no

- Sí funciona: contenido estático, navegación, estilos, JavaScript del frontend y archivos públicos.
- Sí funciona si ya está integrado: llamadas a servicios en la nube o APIs públicas.
- No funciona por sí solo en GitHub Pages: procesos locales, scripts de `cmd` o PowerShell, rutas de tu PC y flujos que dependan de archivos solo disponibles en tu máquina.
- Si una función depende de administración interna o de red local, debe tener una alternativa web o un backend externo.
