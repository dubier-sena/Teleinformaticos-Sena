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
        howToDiagnose: "Una advertencia especifica de ventilador/temperatura apunta directo al sistema de refrigeracion, no a la alimentacion general.",
        howToFix: "Reconectar el cable del ventilador en el header CPU_FAN.",
        optimalProcedure: "Abrir gabinete -> localizar el header CPU_FAN -> reconectar -> comprobar que la advertencia desaparece.",
      },
    },

    {
      id: "caso-06",
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
        howToDiagnose: "Un sobrecalentamiento progresivo (no un apagado instantaneo) apunta al sistema de refrigeracion: flujo de aire, instalacion del disipador o pasta termica.",
        howToFix: "Retirar el disipador y reinstalarlo verificando que quede bien asentado y a nivel.",
        optimalProcedure: "Abrir gabinete -> desconectar cable del ventilador -> retirar disipador -> reinstalar firme -> reconectar cable -> comprobar temperatura.",
      },
    },

    {
      id: "caso-09",
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

  var api = { CASES: CASES };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.DiagnosisCases = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
