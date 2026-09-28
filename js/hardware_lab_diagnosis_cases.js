/* js/hardware_lab_diagnosis_cases.js
 *
 * Los 10 casos del modulo "Diagnostico y reparacion" (items 19-29). Cada
 * caso referencia piezas REALES del PC de escritorio (ver
 * hardware_lab_data_desktop.js) mas las dos piezas externas propias del
 * diagnostico (power-cable-wall, cable-video, ver
 * hardware_lab_diagnosis_engine.js). No son preguntas de opcion multiple: el
 * aprendiz interactua con el equipo (abrir, inspeccionar, reconectar,
 * reinstalar) igual que en las practicas de ensamble.
 *
 * "fault.overrides" fija el estado inicial de las piezas afectadas.
 * "fault.fixCondition" es lo que el motor evalua al pulsar "Encender y
 * comprobar":
 *   {type:"stateEquals", partId, present}  -> la pieza debe quedar en ese
 *                                              estado (conectada/instalada).
 *   {type:"reseated", partId}              -> la pieza ya estaba presente,
 *                                              pero debe RETIRARSE e
 *                                              INSTALARSE de nuevo (estaba
 *                                              mal asentada, no ausente).
 */
(function (root) {
  "use strict";

  var CASES = [
    {
      id: "caso-01",
      equipmentId: "desktop",
      number: 1,
      name: "Cable de alimentacion",
      level: "muy-facil",
      requiresCaseOpenHint: false,
      symptom: "El computador no enciende: no hay luces ni giro de ventiladores.",
      fault: {
        overrides: [{ partId: "power-cable-wall", present: false }],
        fixCondition: { type: "stateEquals", partId: "power-cable-wall", present: true },
        relevantPartIds: ["power-cable-wall"],
        symptomBroken: "El computador no enciende: no hay luces ni giro de ventiladores.",
        symptomFixed: "El computador enciende: luces y ventiladores activos, arranca con normalidad.",
      },
      hints: [
        "Antes de abrir el gabinete, revisa las conexiones externas del equipo.",
        "Sigue el cable de poder desde la pared hasta la parte trasera de la fuente.",
        "Verifica que el cable este firmemente conectado en ambos extremos.",
      ],
      explanation: {
        whatWasHappening: "El equipo no recibia energia electrica en absoluto.",
        why: "El cable de alimentacion estaba desconectado de la toma de corriente (o mal conectado a la fuente).",
        howToDiagnose: "Antes de abrir el gabinete, siempre se revisa la alimentacion externa: cable, toma de corriente y switch de la fuente.",
        howToFix: "Conectar firmemente el cable de poder en ambos extremos.",
        optimalProcedure: "Inspeccion visual del cable -> conectar -> encender y comprobar. No hacia falta abrir el equipo.",
      },
    },

    {
      id: "caso-02",
      equipmentId: "desktop",
      number: 2,
      name: "Memoria RAM mal instalada",
      level: "facil",
      requiresCaseOpenHint: true,
      symptom: "El computador enciende (luces y ventiladores activos), pero no completa el arranque ni da imagen.",
      fault: {
        overrides: [{ partId: "ram", present: true }],
        fixCondition: { type: "reseated", partId: "ram" },
        relevantPartIds: ["side-panel", "ram"],
        symptomBroken: "El computador enciende, pero no completa el arranque ni da imagen (posibles pitidos repetitivos).",
        symptomFixed: "El computador enciende y arranca con normalidad hasta el sistema operativo.",
      },
      hints: [
        "El equipo enciende (hay energia), asi que el problema esta adentro: abre el gabinete.",
        "Revisa los modulos de memoria RAM: los seguros laterales deben quedar bien cerrados.",
        "Retira el modulo de RAM por completo y vuelve a instalarlo asegurandote de que quede firme.",
      ],
      explanation: {
        whatWasHappening: "El equipo encendia pero no lograba completar el arranque.",
        why: "El modulo de RAM no estaba completamente asentado en su slot (contacto electrico intermitente).",
        howToDiagnose: "Cuando el equipo enciende (hay alimentacion) pero no da imagen, la RAM es de las primeras sospechosas.",
        howToFix: "Abrir el gabinete, retirar el modulo y reinstalarlo asegurando que los seguros laterales cierren por completo.",
        optimalProcedure: "Abrir gabinete -> localizar RAM -> retirar -> reinstalar firme -> cerrar -> encender y comprobar.",
      },
    },

    {
      id: "caso-03",
      equipmentId: "desktop",
      number: 3,
      name: "Monitor sin señal",
      level: "facil",
      requiresCaseOpenHint: false,
      symptom: 'El computador enciende con normalidad, pero el monitor muestra "SIN SEÑAL".',
      fault: {
        overrides: [{ partId: "cable-video", present: false }],
        fixCondition: { type: "stateEquals", partId: "cable-video", present: true },
        relevantPartIds: ["cable-video"],
        symptomBroken: 'El computador enciende con normalidad, pero el monitor muestra "SIN SEÑAL".',
        symptomFixed: "El monitor muestra imagen con normalidad.",
      },
      hints: [
        "El equipo enciende bien: el problema probablemente no esta adentro del gabinete.",
        "Revisa primero las conexiones externas antes de pensar en abrir el equipo.",
        "Comprueba el dispositivo encargado de generar la señal de video y su cable hacia el monitor.",
      ],
      explanation: {
        whatWasHappening: "El equipo funcionaba, pero la señal de video no llegaba al monitor.",
        why: "El cable de video (HDMI/DisplayPort) estaba desconectado.",
        howToDiagnose: "No siempre hay que abrir el computador: primero se descartan las conexiones externas visibles.",
        howToFix: "Conectar firmemente el cable de video entre la tarjeta grafica y el monitor.",
        optimalProcedure: "Inspeccion visual externa -> conectar cable de video -> comprobar. Abrir el gabinete aqui habria sido innecesario.",
      },
    },

    {
      id: "caso-04",
      equipmentId: "desktop",
      number: 4,
      name: "Cable SATA desconectado",
      level: "facil-intermedio",
      requiresCaseOpenHint: true,
      symptom: "El computador enciende y arranca, pero no detecta la unidad de almacenamiento SSD SATA.",
      fault: {
        overrides: [{ partId: "cable-sata-data", present: false }],
        fixCondition: { type: "stateEquals", partId: "cable-sata-data", present: true },
        relevantPartIds: ["side-panel", "cable-sata-data"],
        symptomBroken: "El sistema arranca pero el SSD SATA no aparece en el listado de almacenamiento.",
        symptomFixed: "El SSD SATA aparece detectado con normalidad.",
      },
      hints: [
        "El equipo arranca: revisa la unidad de almacenamiento que no aparece, no la alimentacion general.",
        "Revisa ambos cables de la unidad: el de datos y el de alimentacion.",
        "El cable de datos SATA es el mas delgado, con forma de L en los conectores.",
      ],
      explanation: {
        whatWasHappening: "El sistema arrancaba, pero una unidad de almacenamiento no era detectada.",
        why: "El cable SATA de datos estaba desconectado entre la placa y la unidad.",
        howToDiagnose: "Revisar alimentacion general -> SATA de datos -> SATA de alimentacion -> puerto de la placa -> la unidad misma (en ese orden, de lo mas simple a lo mas dificil de comprobar).",
        howToFix: "Reconectar el cable SATA de datos firmemente en ambos extremos.",
        optimalProcedure: "Abrir gabinete -> revisar cables SATA de la unidad -> reconectar el que falte -> comprobar deteccion.",
      },
    },

    {
      id: "caso-05",
      equipmentId: "desktop",
      number: 5,
      name: "Ventilador CPU (CPU_FAN) desconectado",
      level: "intermedio",
      requiresCaseOpenHint: true,
      symptom: "El equipo enciende, pero muestra advertencias relacionadas con el ventilador del procesador o con la temperatura.",
      fault: {
        overrides: [{ partId: "cable-cpu-fan", present: false }],
        fixCondition: { type: "stateEquals", partId: "cable-cpu-fan", present: true },
        relevantPartIds: ["side-panel", "cable-cpu-fan"],
        symptomBroken: "El sistema muestra una advertencia de CPU FAN ERROR o temperatura elevada al arrancar.",
        symptomFixed: "El sistema arranca sin advertencias; el ventilador del procesador gira con normalidad.",
      },
      hints: [
        "La advertencia menciona el ventilador del procesador: abre el gabinete y localizalo.",
        "Revisa el conector pequeño de 4 pines junto al socket del procesador (header CPU_FAN).",
        "Conecta el cable del ventilador asegurandote de que asiente por completo en el header.",
      ],
      explanation: {
        whatWasHappening: "La placa detectaba que el ventilador del procesador no giraba.",
        why: "El cable del ventilador CPU estaba desconectado del header CPU_FAN.",
        howToDiagnose: "Una advertencia especifica de ventilador/temperatura apunta directo al sistema de refrigeración, no a la alimentacion general.",
        howToFix: "Reconectar el cable del ventilador en el header CPU_FAN.",
        optimalProcedure: "Abrir gabinete -> localizar el header CPU_FAN -> reconectar -> comprobar que la advertencia desaparece.",
      },
    },

    {
      id: "caso-06",
      equipmentId: "desktop",
      number: 6,
      name: "Tarjeta grafica mal instalada",
      level: "intermedio",
      requiresCaseOpenHint: true,
      symptom: "El computador enciende, pero no entrega imagen a traves de la tarjeta grafica dedicada.",
      fault: {
        overrides: [{ partId: "gpu", present: true }],
        fixCondition: { type: "reseated", partId: "gpu" },
        relevantPartIds: ["side-panel", "gpu"],
        symptomBroken: "El equipo enciende (ventiladores activos), pero el monitor conectado a la GPU no recibe imagen.",
        symptomFixed: "El monitor conectado a la GPU recibe imagen con normalidad.",
      },
      hints: [
        "El equipo enciende bien: el problema esta en como quedo asentada la tarjeta grafica, no en la alimentacion general.",
        "Revisa que la GPU este completamente encajada en la ranura PCIe, con el seguro cerrado.",
        "Retira la tarjeta grafica por completo y vuelve a instalarla asegurando que quede firme y a nivel.",
      ],
      explanation: {
        whatWasHappening: "La tarjeta grafica no daba imagen aunque el equipo encendia.",
        why: "La GPU no estaba completamente asentada en la ranura PCIe (contacto electrico intermitente).",
        howToDiagnose: "Cuando el equipo enciende pero una tarjeta de expansion no responde, se revisa primero si esta bien asentada antes de sospechar que esta danada.",
        howToFix: "Retirar la GPU y reinstalarla verificando que el seguro de la ranura PCIe cierre por completo.",
        optimalProcedure: "Abrir gabinete -> retirar GPU -> reinstalar firme -> verificar seguro -> comprobar imagen.",
      },
    },

    {
      id: "caso-07",
      equipmentId: "desktop",
      number: 7,
      name: "Alimentacion CPU (CPU/EPS) desconectada",
      level: "intermedio",
      requiresCaseOpenHint: true,
      symptom: "El computador parece recibir alimentacion (luces, ventiladores) pero no completa el arranque.",
      fault: {
        overrides: [{ partId: "cable-cpu-eps", present: false }],
        fixCondition: { type: "stateEquals", partId: "cable-cpu-eps", present: true },
        relevantPartIds: ["side-panel", "cable-cpu-eps"],
        symptomBroken: "El equipo enciende brevemente (luces, ventiladores) pero se apaga o no completa el POST.",
        symptomFixed: "El equipo completa el arranque con normalidad.",
      },
      hints: [
        "El equipo tiene alimentacion general (ATX), pero no arranca del todo: hay OTRO conector de alimentacion que revisar.",
        "Diferencia el conector ATX de 24 pines (alimentacion general) del conector CPU/EPS de 8 pines (solo para el procesador).",
        "El conector CPU/EPS esta junto al socket del procesador, en la esquina superior de la placa.",
      ],
      explanation: {
        whatWasHappening: "El equipo tenia alimentacion general pero el procesador no recibia la suya propia.",
        why: "El conector CPU/EPS de 8 pines estaba desconectado (distinto del ATX principal de 24 pines).",
        howToDiagnose: "Diferenciar los dos circuitos de alimentacion de la placa (ATX general vs. CPU/EPS) es clave para no confundir este caso con uno de alimentacion general.",
        howToFix: "Conectar el cable CPU/EPS de 8 pines junto al socket del procesador.",
        optimalProcedure: "Abrir gabinete -> revisar ATX (ya conectado) -> revisar CPU/EPS -> reconectar -> comprobar arranque completo.",
      },
    },

    {
      id: "caso-08",
      equipmentId: "desktop",
      number: 8,
      name: "Sobrecalentamiento por disipador mal instalado",
      level: "intermedio",
      requiresCaseOpenHint: true,
      symptom: "El equipo funciona al inicio, pero la temperatura sube rapido y luego reduce rendimiento o se apaga.",
      fault: {
        overrides: [{ partId: "cooler", present: true }],
        fixCondition: { type: "reseated", partId: "cooler" },
        relevantPartIds: ["side-panel", "cable-cpu-fan", "cooler"],
        symptomBroken: "La temperatura del procesador sube muy rapido bajo carga y el sistema reduce el rendimiento o se apaga.",
        symptomFixed: "La temperatura se mantiene estable; el sistema funciona sin apagados por proteccion termica.",
      },
      hints: [
        "El ventilador puede estar girando y aun asi sobrecalentarse: revisa el contacto del disipador con el procesador, no solo el cable.",
        "Retira el disipador con cuidado (recuerda desconectar primero su cable) e inspecciona el contacto con el procesador.",
        "Vuelve a instalar el disipador asegurando que quede bien asentado y a nivel sobre el procesador.",
      ],
      explanation: {
        whatWasHappening: "La temperatura subia progresivamente hasta forzar una reduccion de rendimiento o apagado.",
        why: "El disipador no estaba correctamente asentado sobre el procesador (mal contacto termico).",
        howToDiagnose: "Un sobrecalentamiento progresivo (no un apagado instantaneo) apunta al sistema de refrigeración: flujo de aire, instalacion del disipador o pasta termica.",
        howToFix: "Retirar el disipador y reinstalarlo verificando que quede bien asentado y a nivel.",
        optimalProcedure: "Abrir gabinete -> desconectar cable del ventilador -> retirar disipador -> reinstalar firme -> reconectar cable -> comprobar temperatura.",
      },
    },

    {
      id: "caso-09",
      equipmentId: "desktop",
      number: 9,
      name: "SSD M.2 mal instalado",
      level: "intermedio-moderado",
      requiresCaseOpenHint: true,
      symptom: "El computador funciona con normalidad, pero el SSD M.2 no aparece en el sistema.",
      fault: {
        overrides: [{ partId: "ssd-m2", present: true }],
        fixCondition: { type: "reseated", partId: "ssd-m2" },
        relevantPartIds: ["side-panel", "ssd-m2"],
        symptomBroken: "El sistema arranca con normalidad (desde otra unidad), pero el SSD M.2 no aparece en el listado de almacenamiento.",
        symptomFixed: "El SSD M.2 aparece detectado con normalidad.",
      },
      hints: [
        "El SSD M.2 no usa cables: si no aparece, revisa como quedo asentado en su ranura.",
        "Retira el tornillo de fijacion y levanta la unidad con cuidado.",
        "Reinstala la unidad en angulo, respetando la muesca de la ranura, y asegura bien el tornillo.",
      ],
      explanation: {
        whatWasHappening: "Una unidad de almacenamiento M.2 no era detectada por el sistema.",
        why: "El SSD M.2 no estaba completamente asentado en su ranura (a diferencia del SATA, esta unidad no usa cables).",
        howToDiagnose: "Al no haber cables involucrados, un M.2 no detectado casi siempre es un problema de asentamiento en la ranura, no de conexion.",
        howToFix: "Retirar la unidad e instalarla de nuevo asegurando el tornillo de fijacion.",
        optimalProcedure: "Abrir gabinete -> localizar el SSD M.2 -> retirar -> reinstalar en angulo correcto -> asegurar tornillo -> comprobar deteccion.",
      },
    },

    {
      id: "caso-10",
      equipmentId: "desktop",
      number: 10,
      name: "Falla desconocida",
      level: "moderado",
      requiresCaseOpenHint: true,
      symptom: "El computador enciende, pero no muestra imagen.",
      // Sin "fault" fijo: cada intento elige aleatoriamente una de estas
      // variantes (item 29), por lo que la respuesta cambia entre intentos.
      faultPool: [
        {
          overrides: [{ partId: "ram", present: true }],
          fixCondition: { type: "reseated", partId: "ram" },
          relevantPartIds: ["side-panel", "ram"],
          symptomBroken: "El equipo enciende, pero no da imagen (posibles pitidos repetitivos).",
          symptomFixed: "El equipo enciende y da imagen con normalidad.",
        },
        {
          overrides: [{ partId: "cable-gpu-power", present: false }],
          fixCondition: { type: "stateEquals", partId: "cable-gpu-power", present: true },
          relevantPartIds: ["side-panel", "cable-gpu-power"],
          symptomBroken: "El equipo enciende, pero la GPU dedicada no entrega imagen.",
          symptomFixed: "La GPU dedicada entrega imagen con normalidad.",
        },
        {
          overrides: [{ partId: "cable-cpu-eps", present: false }],
          fixCondition: { type: "stateEquals", partId: "cable-cpu-eps", present: true },
          relevantPartIds: ["side-panel", "cable-cpu-eps"],
          symptomBroken: "El equipo enciende brevemente, pero no completa el arranque ni da imagen.",
          symptomFixed: "El equipo completa el arranque y da imagen con normalidad.",
        },
        {
          overrides: [{ partId: "cable-video", present: false }],
          fixCondition: { type: "stateEquals", partId: "cable-video", present: true },
          relevantPartIds: ["cable-video"],
          symptomBroken: "El equipo enciende con normalidad, pero el monitor no recibe señal.",
          symptomFixed: "El monitor recibe señal con normalidad.",
        },
      ],
      hints: [
        "Revisa primero las conexiones externas del monitor antes de abrir el equipo.",
        "Si las conexiones externas estan bien, revisa la memoria RAM.",
        "Si la RAM esta bien asentada, revisa las conexiones de alimentacion de la GPU y del procesador (CPU/EPS).",
      ],
      explanation: {
        whatWasHappening: "Este caso tiene una causa distinta cada vez que se intenta: no memorices la solucion, aplica el metodo.",
        why: "Puede ser RAM mal asentada, alimentacion de GPU desconectada, alimentacion de CPU desconectada, o el cable de video externo desconectado.",
        howToDiagnose: "Metodo: revisar primero lo externo (cable de video), luego lo interno de lo mas simple a lo mas especifico (RAM, alimentacion GPU, alimentacion CPU).",
        howToFix: "Depende de la causa real de este intento: revisa el resumen de tu practica para ver cual fue.",
        optimalProcedure: "Inspeccion externa -> abrir gabinete si es necesario -> revisar RAM -> revisar alimentacion GPU -> revisar alimentacion CPU -> comprobar.",
      },
    },
  ];

  // ── Portatil (sep-27) ──────────────────────────────────────────────────────
  // IDs propios ("laptop-case-NN") para no chocar con los del escritorio en el
  // almacenamiento ni en el panel del instructor. Todas las fallas son de
  // pieza MAL ASENTADA: la pieza esta en su sitio (no en la bandeja), asi que
  // el aprendiz debe razonar desde el sintoma e inspeccionar. Los sintomas
  // describen lo que se observa, nunca la pieza. "relevantPartIds" incluye el
  // procedimiento de acceso (tapa inferior y bateria) para no penalizar como
  // "innecesario" el trabajo seguro. Piezas e IDs reales de
  // hardware_lab_data_laptop.js.
  var LAPTOP_ACCESS = ["bottom-cover", "cable-battery"];
  var LAPTOP_PROCEDURE =
    "Posición de trabajo boca abajo → retirar los tornillos y la tapa inferior → desconectar la batería → ";
  var LAPTOP_CLOSE =
    " → reconectar la batería → colocar la tapa inferior y sus tornillos → dejar el portátil derecho y abierto → encender y comprobar.";

  // Fase C: piezas que forman cada subsistema. Todas cuentan como inspeccion
  // razonable en su caso (la puntuacion no delata la variante).
  var WIFI_RELEVANT = LAPTOP_ACCESS.concat(["wifi-card", "wifi-antenna-1", "wifi-antenna-2"]);
  var WIFI_BROKEN = "El sistema funciona, pero la conexión inalámbrica sigue fallando o con señal muy débil.";
  var WIFI_FIXED = "El portátil detecta las redes inalámbricas y se conecta con una señal normal.";
  var THERMAL_RELEVANT = LAPTOP_ACCESS.concat(["cable-cpu-fan-laptop", "cooler"]);
  var THERMAL_BROKEN = "El equipo funciona, pero bajo carga la temperatura sigue subiendo demasiado y el rendimiento cae.";
  var THERMAL_FIXED = "Bajo carga, la temperatura se mantiene en valores normales y el rendimiento es estable.";

  var LAPTOP_CASES = [
    {
      id: "laptop-case-01",
      equipmentId: "laptop",
      number: 1,
      name: "Enciende, pero no arranca",
      level: "facil",
      requiresCaseOpenHint: true,
      symptom:
        "El portátil enciende (se ilumina el indicador y gira el ventilador), pero no llega a arrancar: no hay sonido de inicio, el indicador de disco no parpadea y la pantalla sigue negra.",
      fault: {
        overrides: [{ partId: "ram", present: true }],
        relevantPartIds: LAPTOP_ACCESS.concat(["ram"]),
        fixCondition: { type: "reseated", partId: "ram" },
        symptomBroken:
          "El portátil enciende y el ventilador gira, pero sigue sin arrancar: sin sonido de inicio, sin actividad de disco y sin imagen.",
        symptomFixed: "El portátil completa el arranque y muestra imagen con normalidad.",
      },
      hints: [
        "El equipo recibe energía, pero se detiene antes de arrancar. Piensa qué componentes necesita para superar la prueba de arranque, antes incluso de mostrar imagen.",
        "La memoria es indispensable para arrancar: si no hace buen contacto, muchos equipos se quedan encendidos sin imagen y sin cargar el sistema.",
        "Revisa el módulo de memoria RAM (SO-DIMM) bajo la tapa inferior: libéralo de sus pestañas y vuelve a insertarlo hasta que quede asegurado.",
      ],
      explanation: {
        whatWasHappening: "El módulo de memoria SO-DIMM estaba mal asentado: no hacía contacto completo con la ranura.",
        why: "Un golpe, la dilatación por calor o una instalación apresurada pueden dejar la memoria ligeramente fuera de su ranura. El equipo recibe energía, pero no supera la prueba de memoria del arranque.",
        howToDiagnose:
          "Energía sí (indicador y ventilador) pero sin arranque, sin actividad de disco y sin imagen apunta a un componente esencial del arranque. La memoria es la causa más frecuente y la más sencilla de verificar.",
        howToFix: "Con la batería desconectada, liberar las pestañas laterales, retirar la memoria e insertarla de nuevo inclinada hasta que las pestañas la aseguren.",
        optimalProcedure: LAPTOP_PROCEDURE + "reasentar la memoria RAM" + LAPTOP_CLOSE,
        prevention: "Manipula la memoria por los bordes, con pulsera antiestática, y comprueba que las pestañas encajen solas: nunca la fuerces.",
      },
    },
    {
      id: "laptop-case-02",
      equipmentId: "laptop",
      number: 2,
      name: "No encuentra desde dónde arrancar",
      level: "facil",
      requiresCaseOpenHint: true,
      symptom:
        "El portátil enciende y muestra imagen, pero indica que no encuentra ningún dispositivo de arranque y no carga el sistema operativo.",
      fault: {
        overrides: [{ partId: "ssd-m2", present: true }],
        relevantPartIds: LAPTOP_ACCESS.concat(["ssd-m2"]),
        fixCondition: { type: "reseated", partId: "ssd-m2" },
        symptomBroken: "El equipo muestra imagen, pero sigue indicando que no hay un dispositivo de arranque disponible.",
        symptomFixed: "El sistema detecta la unidad de almacenamiento y carga el sistema operativo.",
      },
      hints: [
        "El equipo funciona hasta el momento de buscar el sistema operativo. Piensa dónde está guardado.",
        "Si el equipo no encuentra desde dónde arrancar, revisa la unidad de almacenamiento y su conexión.",
        "Revisa el SSD M.2: retira su tornillo, sácalo de la ranura y vuelve a insertarlo firmemente antes de atornillarlo.",
      ],
      explanation: {
        whatWasHappening: "El SSD M.2 estaba mal asentado en su ranura: el equipo no lo detectaba como dispositivo de arranque.",
        why: "El conector M.2 es muy fino: si la unidad queda levemente inclinada o sin su tornillo, pierde contacto con algunos pines.",
        howToDiagnose:
          "Si hay imagen y el mensaje dice que no hay dispositivo de arranque, el equipo funciona pero no ve la unidad donde está el sistema. Se revisa primero la unidad y su conexión.",
        howToFix: "Con la batería desconectada, retirar el tornillo del SSD, sacarlo, insertarlo de nuevo a fondo en la ranura y fijarlo con su tornillo.",
        optimalProcedure: LAPTOP_PROCEDURE + "reasentar el SSD M.2 y colocar su tornillo" + LAPTOP_CLOSE,
        prevention: "Inserta el SSD inclinado y a fondo, y fíjalo siempre con su tornillo: un SSD sin fijar se desconecta con los movimientos del equipo.",
      },
    },
    {
      id: "laptop-case-03",
      equipmentId: "laptop",
      number: 3,
      name: "El puntero no se mueve",
      level: "facil-intermedio",
      requiresCaseOpenHint: true,
      symptom: "El equipo inicia normalmente, pero el touchpad no responde.",
      fault: {
        overrides: [{ partId: "cable-touchpad-flex", present: true }],
        relevantPartIds: LAPTOP_ACCESS.concat(["cable-touchpad-flex"]),
        fixCondition: { type: "reseated", partId: "cable-touchpad-flex" },
        symptomBroken: "El sistema funciona, pero el touchpad sigue sin responder.",
        symptomFixed: "El touchpad responde con normalidad.",
      },
      hints: [
        "El sistema arranca y lo demás funciona: la falla está en un único dispositivo de entrada.",
        "Un dispositivo de entrada integrado depende de su conexión interna con la tarjeta madre.",
        "Revisa la conexión flex que une el touchpad con la tarjeta madre: libera el seguro del conector, retira el cable y vuelve a insertarlo recto.",
      ],
      explanation: {
        whatWasHappening: "El cable flex del touchpad estaba mal asentado en su conector de la tarjeta madre.",
        why: "Los cables flex son planos y se sujetan con un seguro pequeño. Si el cable entra torcido o el seguro no se cierra, pierde contacto aunque parezca conectado.",
        howToDiagnose:
          "Si el equipo funciona y solo falla un dispositivo integrado, se descarta el resto del sistema y se revisa la conexión interna de ese dispositivo.",
        howToFix: "Con la batería desconectada, abrir el seguro del conector, retirar el flex, insertarlo recto y a fondo, y cerrar el seguro.",
        optimalProcedure: LAPTOP_PROCEDURE + "reasentar el flex del touchpad" + LAPTOP_CLOSE,
        prevention: "Nunca tires del cable flex: abre primero el seguro del conector e insértalo recto, sin doblarlo.",
      },
    },
    {
      id: "laptop-case-04",
      equipmentId: "laptop",
      number: 4,
      name: "Las teclas no escriben",
      level: "facil-intermedio",
      requiresCaseOpenHint: true,
      symptom: "El portátil inicia, pero el teclado integrado no responde.",
      fault: {
        overrides: [{ partId: "cable-keyboard-flex", present: true }],
        relevantPartIds: LAPTOP_ACCESS.concat(["cable-keyboard-flex"]),
        fixCondition: { type: "reseated", partId: "cable-keyboard-flex" },
        symptomBroken: "El sistema funciona, pero el teclado integrado sigue sin responder.",
        symptomFixed: "El teclado integrado responde con normalidad.",
      },
      hints: [
        "El equipo arranca con normalidad: la falla está localizada en un dispositivo de entrada.",
        "Un teclado integrado se comunica con la tarjeta madre a través de un cable interno.",
        "Revisa el cable flex del teclado en la tarjeta madre: con la herramienta plástica de apertura, libera el seguro, retira el cable y vuelve a conectarlo.",
      ],
      explanation: {
        whatWasHappening: "El cable flex del teclado estaba mal asentado en su conector de la tarjeta madre.",
        why: "El flex del teclado suele moverse cuando se abre el equipo para limpieza o cambio de piezas; si el seguro no queda cerrado, el contacto se pierde.",
        howToDiagnose:
          "Si el sistema arranca y solo el teclado integrado no responde, el problema está en el teclado o en su conexión interna. La conexión es lo primero que se revisa.",
        howToFix: "Con la batería desconectada, usar la herramienta plástica para abrir el seguro, retirar el flex, insertarlo recto y cerrar el seguro.",
        optimalProcedure: LAPTOP_PROCEDURE + "reasentar el flex del teclado con la herramienta plástica" + LAPTOP_CLOSE,
        prevention: "Usa herramientas plásticas en los conectores flex: una herramienta metálica puede romper el seguro o hacer un cortocircuito.",
      },
    },
    {
      id: "laptop-case-05",
      equipmentId: "laptop",
      number: 5,
      name: "El sistema arranca, pero la pantalla sigue negra",
      level: "intermedio",
      requiresCaseOpenHint: true,
      symptom:
        "El portátil enciende y arranca (se escucha el sonido de inicio y el indicador de disco parpadea), pero la pantalla integrada no muestra imagen.",
      fault: {
        overrides: [{ partId: "cable-screen-flex", present: true }],
        relevantPartIds: LAPTOP_ACCESS.concat(["cable-screen-flex"]),
        fixCondition: { type: "reseated", partId: "cable-screen-flex" },
        symptomBroken: "El sistema sigue arrancando con normalidad, pero la pantalla integrada no muestra imagen.",
        symptomFixed: "La pantalla integrada muestra imagen con normalidad.",
      },
      hints: [
        "El sistema sí arranca: lo que falla es cómo llega la imagen a la pantalla.",
        "La pantalla integrada recibe la señal de video por un cable interno que viene de la tarjeta madre.",
        "Revisa la conexión del cable de pantalla (eDP) en la tarjeta madre: desconéctalo y vuelve a conectarlo firmemente.",
      ],
      explanation: {
        whatWasHappening: "El cable de pantalla (eDP) estaba mal asentado en su conector de la tarjeta madre.",
        why: "El conector eDP puede soltarse con el movimiento de la bisagra o después de un mantenimiento; sin él, la tarjeta madre funciona pero la imagen no llega al panel.",
        howToDiagnose:
          "Que el sistema arranque (sonido de inicio, actividad de disco) descarta memoria, almacenamiento y energía. Lo que queda es la ruta de la imagen hasta la pantalla: su conexión interna.",
        howToFix: "Con la batería desconectada, desconectar el cable eDP de la tarjeta madre y volver a conectarlo recto y a fondo.",
        optimalProcedure: LAPTOP_PROCEDURE + "reasentar el cable eDP" + LAPTOP_CLOSE,
        prevention: "Al abrir o cerrar el equipo, no fuerces la bisagra ni tenses el cable de pantalla, y comprueba sus conectores antes de cerrar.",
      },
    },
    // ── Fase C (sep-27): casos con VARIAS causas posibles ────────────────────
    // Cada intento elige una variante (faultPool, igual que el caso 10 del
    // escritorio) y la mantiene hasta reiniciar. El nombre, el sintoma y las
    // pistas 1-2 son los mismos para todas: la variante solo se revela en el
    // repaso final. Todas se reparan con una accion REAL sobre el estado de la
    // pieza (reasentar) o del sistema termico (hardware_lab_thermal.js).
    {
      id: "laptop-case-06",
      equipmentId: "laptop",
      number: 6,
      name: "Problemas de conexión Wi-Fi",
      level: "intermedio",
      requiresCaseOpenHint: true,
      symptom:
        "El portátil funciona con normalidad, pero no logra conectarse a las redes inalámbricas o la señal es anormalmente débil, incluso cerca del punto de acceso.",
      observations: {
        broken: [
          { label: "SISTEMA OPERATIVO", value: "Iniciado", tone: "ok" },
          { label: "CONECTIVIDAD INALÁMBRICA", value: "Anormal", tone: "danger" },
        ],
        fixed: [
          { label: "SISTEMA OPERATIVO", value: "Iniciado", tone: "ok" },
          { label: "CONECTIVIDAD INALÁMBRICA", value: "Normal", tone: "ok" },
        ],
      },
      faultPool: [
        {
          variantId: "wifi-card",
          overrides: [{ partId: "wifi-card", present: true }],
          relevantPartIds: WIFI_RELEVANT,
          fixCondition: { type: "reseated", partId: "wifi-card" },
          symptomBroken: WIFI_BROKEN,
          symptomFixed: WIFI_FIXED,
          explanation: {
            whatWasHappening: "En este intento, la tarjeta Wi-Fi M.2 estaba mal asentada en su ranura: no hacía contacto completo con la tarjeta madre.",
            why: "Si la tarjeta queda inclinada o su tornillo no la sujeta, algunos contactos del conector M.2 se separan. El sistema deja de ver el adaptador inalámbrico o lo ve de forma intermitente.",
            howToFix: "Con la batería desconectada: desconectar las dos antenas con pinzas, retirar el tornillo, sacar la tarjeta, insertarla de nuevo a fondo, atornillarla y volver a conectar las antenas.",
            optimalProcedure: LAPTOP_PROCEDURE + "desconectar las antenas → reasentar la tarjeta Wi-Fi y su tornillo → reconectar las antenas" + LAPTOP_CLOSE,
          },
        },
        {
          variantId: "wifi-antenna-1",
          overrides: [{ partId: "wifi-antenna-1", present: true }],
          relevantPartIds: WIFI_RELEVANT,
          fixCondition: { type: "reseated", partId: "wifi-antenna-1" },
          symptomBroken: WIFI_BROKEN,
          symptomFixed: WIFI_FIXED,
          explanation: {
            whatWasHappening: "En este intento, la antena principal (MAIN) estaba mal conectada a su conector u.FL de la tarjeta Wi-Fi.",
            why: "El conector u.FL es diminuto y encaja a presión: basta un tirón del cable o un cierre apresurado para que quede a medio encajar. La tarjeta funciona, pero recibe poca señal.",
            howToFix: "Con la batería desconectada: desconectar la antena principal con pinzas, alinearla sobre su conector y presionar verticalmente hasta sentir el clic.",
            optimalProcedure: LAPTOP_PROCEDURE + "revisar las conexiones de antena → reconectar la antena principal" + LAPTOP_CLOSE,
          },
        },
        {
          variantId: "wifi-antenna-2",
          overrides: [{ partId: "wifi-antenna-2", present: true }],
          relevantPartIds: WIFI_RELEVANT,
          fixCondition: { type: "reseated", partId: "wifi-antenna-2" },
          symptomBroken: WIFI_BROKEN,
          symptomFixed: WIFI_FIXED,
          explanation: {
            whatWasHappening: "En este intento, la antena auxiliar (AUX) estaba mal conectada a su conector u.FL de la tarjeta Wi-Fi.",
            why: "El conector u.FL es diminuto y encaja a presión: basta un tirón del cable o un cierre apresurado para que quede a medio encajar. La tarjeta funciona, pero pierde parte de la señal.",
            howToFix: "Con la batería desconectada: desconectar la antena auxiliar con pinzas, alinearla sobre su conector y presionar verticalmente hasta sentir el clic.",
            optimalProcedure: LAPTOP_PROCEDURE + "revisar las conexiones de antena → reconectar la antena auxiliar" + LAPTOP_CLOSE,
          },
        },
      ],
      hints: [
        "Todo lo demás funciona: el problema está solo en la comunicación inalámbrica. Piensa qué partes del equipo intervienen para enviar y recibir la señal de radio.",
        "La conexión inalámbrica depende de un subsistema interno: un adaptador instalado en la tarjeta madre y el cableado que lleva la señal hasta el marco de la pantalla.",
        "Revisa la tarjeta Wi-Fi (que esté bien asentada y atornillada) y las dos conexiones de antena sobre ella (que encajen a fondo en sus conectores).",
      ],
      explanation: {
        howToDiagnose:
          "Si el sistema funciona y solo falla la red inalámbrica, se descartan energía, memoria y almacenamiento. Se revisa el subsistema Wi-Fi: primero que la tarjeta esté bien asentada y luego cada conexión de antena. Una tarjeta mal asentada suele hacer desaparecer el adaptador; una antena floja, dar señal débil.",
        background:
          "La tarjeta Wi-Fi es el adaptador de radio: convierte los datos en señal de radio y al revés. Las antenas (principal y auxiliar) están en el marco de la pantalla, lo más alto y despejado del equipo, y llegan a la tarjeta por cables coaxiales delgados con conectores u.FL.",
        prevention:
          "Conecta y desconecta las antenas con pinzas y en vertical, nunca tirando del cable; al cerrar, comprueba que ningún cable quede pisado por la tapa ni tenso junto a las bisagras.",
      },
    },
    {
      id: "laptop-case-07",
      equipmentId: "laptop",
      number: 7,
      name: "Sobrecalentamiento",
      level: "intermedio-moderado",
      requiresCaseOpenHint: true,
      symptom:
        "El portátil enciende y funciona, pero tras varios minutos de uso se calienta demasiado, el rendimiento baja y a veces se apaga solo.",
      observations: {
        broken: [
          { label: "SISTEMA OPERATIVO", value: "Iniciado", tone: "ok" },
          { label: "TEMPERATURA BAJO CARGA", value: "Muy alta", tone: "danger" },
          { label: "RENDIMIENTO", value: "Reducido", tone: "warn" },
        ],
        fixed: [
          { label: "SISTEMA OPERATIVO", value: "Iniciado", tone: "ok" },
          { label: "TEMPERATURA BAJO CARGA", value: "Normal", tone: "ok" },
          { label: "RENDIMIENTO", value: "Normal", tone: "ok" },
        ],
      },
      faultPool: [
        {
          variantId: "dust",
          overrides: [],
          thermal: { dust: "dirty", paste: "new", amount: "adecuada" },
          relevantPartIds: THERMAL_RELEVANT,
          fixCondition: { type: "thermalReady" },
          symptomBroken: THERMAL_BROKEN,
          symptomFixed: THERMAL_FIXED,
          explanation: {
            whatWasHappening: "En este intento, las aletas del disipador y el ventilador tenían polvo acumulado: el aire no circulaba y el calor no salía del equipo.",
            why: "El ventilador aspira polvo y pelusa que se compacta entre las aletas de cobre. Con el paso del aire bloqueado, el procesador se calienta y reduce su velocidad para protegerse.",
            howToFix: "Con la batería desconectada: desconectar el ventilador, retirar el módulo de refrigeración, aflojar el polvo con la brocha, soplarlo con aire comprimido, volver a montar el módulo y reconectar el ventilador.",
            optimalProcedure: LAPTOP_PROCEDURE + "desconectar el ventilador → retirar el módulo de refrigeración → brocha y aire comprimido → montar el módulo → reconectar el ventilador" + LAPTOP_CLOSE,
          },
        },
        {
          variantId: "paste",
          overrides: [],
          thermal: { dust: "clean", paste: "old" },
          relevantPartIds: THERMAL_RELEVANT,
          fixCondition: { type: "thermalReady" },
          symptomBroken: THERMAL_BROKEN,
          symptomFixed: THERMAL_FIXED,
          explanation: {
            whatWasHappening: "En este intento, la pasta térmica entre el procesador y el bloque de cobre estaba vieja y reseca.",
            why: "Con los años la pasta se seca y se agrieta: quedan huecos de aire entre el procesador y el disipador, y el calor pasa muy mal aunque el ventilador funcione.",
            howToFix: "Con la batería desconectada: retirar el módulo de refrigeración, quitar el grueso de la pasta vieja con la herramienta plástica, limpiar con alcohol isopropílico, aplicar la cantidad adecuada de pasta nueva, montar el módulo y reconectar el ventilador.",
            optimalProcedure: LAPTOP_PROCEDURE + "desconectar el ventilador → retirar el módulo de refrigeración → retirar la pasta vieja y limpiar con alcohol → aplicar pasta nueva → montar el módulo → reconectar el ventilador" + LAPTOP_CLOSE,
          },
        },
        {
          variantId: "fan-cable",
          overrides: [{ partId: "cable-cpu-fan-laptop", present: true }],
          relevantPartIds: THERMAL_RELEVANT,
          fixCondition: { type: "reseated", partId: "cable-cpu-fan-laptop" },
          symptomBroken: THERMAL_BROKEN,
          symptomFixed: THERMAL_FIXED,
          explanation: {
            whatWasHappening: "En este intento, el conector del ventilador estaba mal asentado en la tarjeta madre: el ventilador no recibía energía y no giraba.",
            why: "El conector del ventilador es pequeño y queda cerca del disipador: si no entra a fondo después de un mantenimiento, el ventilador no gira y el calor se queda dentro, aunque el disipador y la pasta estén bien.",
            howToFix: "Con la batería desconectada: desconectar el conector del ventilador y volver a insertarlo recto y a fondo en su conector de la tarjeta madre.",
            optimalProcedure: LAPTOP_PROCEDURE + "revisar el ventilador y su conexión → reconectar el conector del ventilador" + LAPTOP_CLOSE,
          },
        },
      ],
      hints: [
        "El equipo arranca y funciona, pero no logra deshacerse del calor que produce con el uso. Piensa qué parte del portátil se encarga de sacar ese calor.",
        "Revisa el sistema de refrigeración: el camino que sigue el calor desde el procesador hasta la salida de aire, y lo que mueve ese aire.",
        "Abre el equipo y revisa, con la batería desconectada: que el ventilador esté bien conectado, que las aletas y el ventilador no tengan polvo y el estado de la pasta térmica entre el procesador y el disipador.",
      ],
      explanation: {
        howToDiagnose:
          "Si el equipo arranca pero se calienta y pierde rendimiento con el uso, la energía y los componentes funcionan: falla la disipación del calor. Se revisa, de lo más simple a lo más laborioso: la conexión del ventilador, el polvo en aletas y ventilador, y la pasta térmica.",
        background:
          "El procesador transfiere su calor al bloque de cobre a través de la pasta térmica; los tubos de calor lo llevan a las aletas y el ventilador empuja el aire caliente fuera del equipo. Si falla cualquiera de esos eslabones, el calor se acumula.",
        prevention:
          "Limpia la refrigeración de forma periódica según el entorno de uso, usa el portátil sobre superficies duras que no tapen las rejillas y, cada vez que retires el disipador, revisa la pasta y deja el ventilador bien conectado.",
      },
    },
  ];

  // ── Caso 08 «Falla desconocida» (sep-27, microfase C.1 + C.2) ─────────────
  // NO es una falla nueva: cada intento elige UNA de las condiciones reales
  // de los casos 01-07 (11 en total: 5 fijas + 3 de Wi-Fi + 3 termicas). Las
  // entradas del pool REFERENCIAN los objetos originales (overrides,
  // fixCondition, estado termico, sintomas, textos): una sola fuente de
  // verdad. Solo cambia lo que ve el aprendiz al empezar (sintoma general) y
  // las pistas 1-3, que se toman de la categoria y de las pistas 1-2 del caso
  // de origen (la pista 3 de origen, "revisa X", no se usa: seria la respuesta).
  var UNKNOWN_CATEGORY_HINT = {
    "laptop-case-01": "Empieza por reproducir la falla y fíjate en qué momento del encendido se detiene el equipo: no todo lo que 'no funciona' tiene la misma causa.",
    "laptop-case-02": "Empieza por reproducir la falla y fíjate en qué momento del encendido se detiene el equipo: no todo lo que 'no funciona' tiene la misma causa.",
    "laptop-case-03": "Enciéndelo y prueba cómo responde a lo que haces tú como usuario: compara lo que funciona con lo que no.",
    "laptop-case-04": "Enciéndelo y prueba cómo responde a lo que haces tú como usuario: compara lo que funciona con lo que no.",
    "laptop-case-05": "Enciéndelo y observa con atención todo lo que el equipo muestra y hace mientras arranca, no solo si enciende.",
    "laptop-case-06": "El equipo arranca y se puede usar: piensa en funciones que dependen de comunicarse con otros dispositivos.",
    "laptop-case-07": "El problema no aparece al instante: observa cómo se comporta el equipo después de un rato de uso.",
  };
  function buildUnknownPool() {
    var pool = [];
    LAPTOP_CASES.forEach(function (c) {
      (c.faultPool || [c.fault]).forEach(function (f) {
        pool.push(
          Object.assign({}, f, {
            variantId: c.id + (f.variantId ? ":" + f.variantId : ""),
            sourceCaseId: c.id,
            sourceVariantId: f.variantId || null,
            hints: [UNKNOWN_CATEGORY_HINT[c.id], c.hints[0], c.hints[1]],
            // Repaso: el del caso de origen + la causa concreta de la variante.
            explanation: Object.assign({}, c.explanation, f.explanation || {}),
          })
        );
      });
    });
    return pool;
  }
  LAPTOP_CASES.push({
    id: "laptop-case-08",
    equipmentId: "laptop",
    number: 8,
    name: "Falla desconocida",
    level: "moderado",
    requiresCaseOpenHint: true,
    unknown: true,
    // El sintoma concreto (el del caso de origen) solo se ve al encender y
    // comprobar: reproducir la falla es el primer paso del diagnostico.
    revealSymptomOnCheck: true,
    symptom:
      "El usuario entrega el portátil diciendo que «no funciona bien», sin más detalles. Reproduce la falla, investiga la causa, corrígela y deja el equipo listo para entregar.",
    faultPool: buildUnknownPool(),
    hints: [],
    explanation: {
      howToDiagnose:
        "Método general: reproducir la falla, describir con precisión qué funciona y qué no, formular una hipótesis sobre el subsistema, comprobarla con la menor intervención posible y confirmar encendiendo el equipo armado.",
    },
  });

  var ALL_CASES = CASES.concat(LAPTOP_CASES);

  /** Casos de un equipo (los antiguos, sin equipmentId, son de escritorio). */
  function casesFor(equipmentId) {
    return ALL_CASES.filter(function (c) {
      return (c.equipmentId || "desktop") === equipmentId;
    });
  }

  function getCase(equipmentId, caseId) {
    return (
      casesFor(equipmentId).find(function (c) {
        return c.id === caseId;
      }) || null
    );
  }

  // CASES se mantiene como la lista del ESCRITORIO (compatibilidad con quien ya
  // la usa). La lista completa, por equipo, se obtiene con casesFor/ALL_CASES.
  var api = { CASES: CASES, LAPTOP_CASES: LAPTOP_CASES, ALL_CASES: ALL_CASES, casesFor: casesFor, getCase: getCase };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.DiagnosisCases = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
