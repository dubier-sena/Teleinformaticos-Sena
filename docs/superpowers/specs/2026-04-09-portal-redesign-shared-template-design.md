# Portal Redesign Shared Template Design

## Objetivo

Redisenar el proyecto `Pagina_Web` con una `nueva plantilla compartida` para `portal`, `guias`, `panel administrativo` y `calendario`, elevando la calidad visual, la interactividad y la consistencia sin perder compatibilidad con el contenido actual ni con el flujo de trabajo del instructor.

## Contexto

El proyecto hoy mezcla dos niveles visuales:

- [`index.html`](C:/Users/PC/Downloads/Pagina_Web/index.html) ya tiene una direccion mas cuidada y moderna.
- Las guias y modulos auxiliares siguen una base mas rigida, con estilos dispersos y una experiencia menos consistente.

El usuario aprobo estas decisiones de diseno:

- Enfoque de trabajo: `Nueva plantilla compartida para portal + guias`.
- Nivel de cambio: `amplio`.
- Direccion visual: `Laboratorio tecnologico`.
- Variante cromatica: `B1. SENA tecnico`.
- Respaldo del proyecto: ya existe una copia previa, por lo que se puede avanzar en implementacion despues de planificar.

## Resultado esperado

Al finalizar el rediseno:

- el `portal`, las `guias`, el `panel admin` y el `calendario` se percibiran como partes de un mismo sistema;
- las guias se sentiran mas interactivas y faciles de recorrer para los aprendices;
- el codigo visual quedara concentrado en una base compartida, mas simple de mantener;
- el proyecto quedara listo para despliegue estatico gratuito, con `GitHub Pages` como opcion recomendada.

## No objetivos

Este rediseno no busca:

- cambiar el contenido pedagogico aprobado de las guias;
- convertir el proyecto en una SPA o en una app con framework pesado;
- reemplazar el almacenamiento actual por una arquitectura nueva;
- rehacer de cero toda la logica de actividades, progreso o sincronizacion.

## Principios de diseno

1. `Consistencia sistémica`
   Portal, guias, admin y calendario deben compartir el mismo lenguaje visual, no solo colores parecidos.

2. `Lectura primero, interaccion despues`
   Las guias son largas y formativas; la interfaz debe ayudar a leer, orientarse y completar actividades sin fatiga.

3. `Tecnico, no frio`
   La estetica debe transmitir laboratorio, criterio tecnico y formacion profesional, sin caer en un panel oscuro generico.

4. `Interacciones con proposito`
   Animaciones y estados visuales solo cuando mejoren comprension, progreso o respuesta del usuario.

5. `Migracion segura`
   El rediseno debe entrar por capas, validando una pagina piloto antes de extenderse al resto del sitio.

## Direccion visual aprobada

### Identidad general

La nueva experiencia tomara la ruta `Laboratorio tecnologico` con variante `B1. SENA tecnico`. Esto implica:

- base cromatica oscura para encabezados, navegacion y zonas de control;
- superficies claras para lectura prolongada;
- verde SENA como color dominante;
- verde brillante para progreso, foco y actividad;
- dorado como acento puntual en indicadores, badges y acciones destacadas.

### Paleta propuesta

- `--bg-canvas`: fondo general claro con tinte frio-verde
- `--surface-1`: tarjetas principales
- `--surface-2`: bloques secundarios
- `--surface-dark`: zonas de control y navegacion
- `--brand-700`: verde SENA profundo
- `--brand-500`: verde activo
- `--brand-300`: verde suave de apoyo
- `--accent-gold`: dorado de enfasis
- `--text-strong`: texto principal
- `--text-muted`: texto secundario
- `--border-soft`: bordes suaves
- `--state-success`, `--state-warn`, `--state-info`: estados reutilizables

### Tipografia

- Titulares: una fuente con mas caracter tecnico y buena presencia en pantalla.
- Texto de lectura: una fuente mas comoda para parrafos largos y formularios.
- Jerarquia estricta para: titulo de pagina, titulo de seccion, subtitulo, actividad, etiqueta, ayuda y evidencia.

### Animacion

Se incorporaran microanimaciones cortas y funcionales:

- entrada suave de bloques;
- expansion fluida de acordeones;
- transicion en barras de progreso;
- realce hover/focus de botones y tarjetas;
- indicadores de completado y avance por seccion.

No se usaran animaciones largas, brillantes o decorativas sin funcion.

## Arquitectura de la plantilla compartida

### Capa 1: tokens compartidos

Crear una base unica de diseno para todo el sistema:

- colores;
- tipografia;
- radios;
- espaciado;
- sombras;
- estados;
- breakpoints;
- duraciones y curvas de animacion.

Esta capa debe ser la unica fuente de verdad del look and feel.

### Capa 2: shell comun

Crear una estructura comun de pagina para reutilizar entre modulos:

- encabezado de pagina;
- navegacion principal;
- cuerpo de contenido;
- barra de progreso o estado cuando aplique;
- zona de acciones rapidas;
- pie o bloque de cierre comun.

Este shell debe poder adaptarse a:

- `index.html`
- guias HTML
- `panel-administrativo-usuarios.html`
- `calendario-academico-2026.html`

### Capa 3: componentes reutilizables

Definir componentes visuales reutilizables, aunque sigan montados con HTML/CSS/JS del proyecto actual:

- `hero` de pagina
- `guide-card` para portal
- `module-shell` para guias
- `activity-card` o `mission-card`
- `resource-card`
- `evidence-card`
- `progress-chip` y `progress-bar`
- `info-panel` para avisos y ayudas
- `modal`
- `toolbar`
- `status-badge`
- `form-block`
- `table-shell`

### Capa 4: patrones de interaccion

Normalizar patrones que hoy aparecen resueltos de forma distinta:

- acordeones de secciones;
- modales;
- tarjetas con CTA;
- bloques QR;
- botones primarios y secundarios;
- estados de completado;
- mensajes de ayuda;
- retroalimentacion visual al guardar o responder.

## Rediseno de experiencia por modulo

### 1. Portal principal

Objetivo:
volver el portal mas claro, mas visual y mas facil de usar al seleccionar grupo, ficha y guias.

Cambios esperados:

- hero mas sintetico y mejor jerarquizado;
- tarjetas de guia con estado, descripcion breve y CTA;
- accesos rapidos a calendario, admin y recursos;
- mayor claridad entre grupos, instituciones y guias disponibles;
- mejor contraste y menor sensacion de formulario plano.

### 2. Guias

Objetivo:
transformar cada guia en una experiencia de taller formativo, no solo en una pagina larga con actividades incrustadas.

Cambios esperados:

- cabecera compacta y mas fuerte visualmente;
- indice de navegacion mas claro;
- actividades presentadas como bloques de mision;
- mejor separacion entre lectura, accion, recurso y evidencia;
- progreso por secciones mas visible;
- bloques de apoyo y formularios mejor contenidos;
- descansos visuales para lectura larga;
- responsive mas cuidado en celular.

### 3. Panel administrativo

Objetivo:
mantener seriedad y claridad operativa, pero alineado visualmente al resto del sistema.

Cambios esperados:

- tarjetas de usuario mas consistentes;
- acciones administrativas con mejor jerarquia;
- modales y tablas alineados al nuevo sistema;
- estados de error, exito y lectura mejor presentados.

### 4. Calendario

Objetivo:
integrarlo visualmente al sistema sin perder su funcion de consulta rapida.

Cambios esperados:

- shell compartido;
- filtros y acciones mejor presentados;
- tarjetas o bloques temporales consistentes con el resto del sitio;
- colores y tipografia alineados al nuevo sistema.

## Interactividad aprobada para las guias

La interactividad debe subir de nivel, pero sin depender de librerias complejas. Se priorizaran estas mejoras:

- progreso por seccion y por actividad con feedback inmediato;
- tarjetas de actividad con tiempo estimado y accion principal visible;
- recursos y archivos con acceso mas directo;
- modales consistentes para QR, ayudas y detalles;
- estados visuales mas claros al completar respuestas;
- feedback de guardado, sincronizacion y recuperacion de datos;
- mejor soporte visual para celular en momentos de clase.

## Estrategia de migracion

La implementacion no debe hacerse en todos los archivos al mismo tiempo.

### Fase 1

Crear la base compartida:

- tokens;
- utilidades;
- shell comun;
- componentes principales.

### Fase 2

Aplicar el rediseno a una pagina piloto:

- `index.html`
- una guia piloto recomendada: `grupo-10a-guia-02-herramientas-informaticas-digitales.html`

Esta fase valida el lenguaje visual y el impacto tecnico real.

### Fase 3

Extender a:

- guia espejo del mismo modulo;
- resto de guias;
- panel admin;
- calendario.

### Fase 4

Pulir consistencia, responsive, animaciones y estados.

## Riesgos y mitigacion

### Riesgo: romper logica existente de actividades o guardado

Mitigacion:

- separar primero lo visual de lo funcional;
- migrar con una guia piloto;
- evitar reescribir JS de negocio si no es necesario.

### Riesgo: demasiada complejidad para mantener

Mitigacion:

- limitar el numero de componentes;
- documentar tokens y patrones;
- centralizar estilos en una base comun.

### Riesgo: perder rendimiento en equipos modestos

Mitigacion:

- usar CSS y JS nativo;
- animaciones cortas y livianas;
- evitar fondos pesados y efectos excesivos.

### Riesgo: inconsistencia entre paginas viejas y nuevas durante migracion

Mitigacion:

- definir primero la plantilla final;
- migrar por lotes cortos;
- validar una pagina piloto antes de escalar.

## Verificacion requerida

Antes de considerar terminado el rediseno, debera comprobarse:

- consistencia visual entre portal, guias, admin y calendario;
- legibilidad de textos largos en PC y movil;
- funcionamiento de progresos, modales y formularios existentes;
- ausencia de regresiones en rutas, recursos y enlaces;
- estabilidad del servidor local actual;
- compatibilidad con despliegue estatico.

## Publicacion recomendada

La plataforma recomendada para publicar el proyecto es `GitHub Pages` porque:

- el proyecto es estatico;
- no tiene costo;
- permite actualizacion simple desde el PC;
- se integra bien con un flujo de repositorio;
- facilita seguir trabajando localmente y publicar por push.

Alternativa secundaria:

- `Cloudflare Pages`, si luego se requiere mas control sobre despliegue o dominio.

## Entregable de la siguiente etapa

La siguiente etapa no es implementar todavia todo el rediseno, sino escribir un `plan de implementacion por fases`, empezando por:

- respaldo verificado;
- base compartida de diseno;
- pagina piloto;
- migracion progresiva del resto del sistema.
