// data/material_apoyo_drive.js  -- generado el 2026-09-21
//
// Catalogo central de material de apoyo alojado en Google Drive.
// Migracion de almacenamiento (auditoria 2026-09-21): los archivos pesados de
// assets/materiales/ se subieron a la carpeta "Portal_SENA_Material_Apoyo" de
// la cuenta dubierportatil@gmail.com (id 1kXH2HQYJPAVULopdkHzz9RiRLIii65aH).
//
// Clave  = ruta del archivo tal como vive HOY en el repositorio.
// Valor  = id del archivo en Drive.
// Varias rutas comparten id a proposito: un recurso que estaba duplicado en
// varias guias tiene UNA sola copia en Drive (95 rutas -> 78 archivos).
//
// ┌─ enabled ───────────────────────────────────────────────────────────────┐
// │ ACTIVO desde el 21/09/2026. La carpeta raiz tiene permiso "cualquier     │
// │ persona con el enlace: lector" y los 112 archivos lo heredan; se         │
// │ comprobo uno por uno con peticiones anonimas (sin sesion de Google) que  │
// │ los 78 recursos abren y descargan, y que 16 descargas coinciden byte a   │
// │ byte con la copia del repositorio.                                       │
// │                                                                          │
// │ Volver a false devuelve el portal a servir el material desde GitHub,     │
// │ siempre que esas copias sigan versionadas.                               │
// └──────────────────────────────────────────────────────────────────────────┘
window.__MATERIAL_APOYO_DRIVE__ = {
  enabled: true,
  folderId: "1kXH2HQYJPAVULopdkHzz9RiRLIii65aH",
  folderUrl: "https://drive.google.com/drive/folders/1kXH2HQYJPAVULopdkHzz9RiRLIii65aH",
  files: {
  "assets/materiales/comun/Teams_Quick_Start_Guide.pdf": "1_EkFvOu7iFtfdj5ctac6Ih2UGRLNue07",
  "assets/materiales/comun/VirtualBox_UserManual_7.2.6.pdf": "1xUmt6F-bcfWcOKWL0WhepvBw19eLrreg",
  "assets/materiales/etapa-productiva/1. Ficha de inscripcion.docx": "1_Mu89SxT0QORhi9lm-DghRiFpCCvrgvu",
  "assets/materiales/etapa-productiva/2. Formato Proyecto Productivo.docx": "1qPLmwbYXD59u1PdcfuxQ55iTP1FNzu-N",
  "assets/materiales/etapa-productiva/2.1. Anexo financiero.xlsx": "1YN5eJNU3ewQ8EHEQbfKKT-C9WWMngT2c",
  "assets/materiales/etapa-productiva/Diseno Curricular Sistemas Teleinformaticos.pdf": "1x4JcMFc1OyXeW1xBLPW5KWHxCelGLPTJ",
  "assets/materiales/etapa-productiva/GFPI-F-147 Formato Bitacora Seguimiento Etapa Productiva.xlsx": "1KZ9f9gxlNh8OuPfCZQBME9Qf1fyxcg-3",
  "assets/materiales/guia2/Bitacora_Para_Caso.docx": "1eUUi4jaKwfhL14auSHG5Hg771WuS4lyG",
  "assets/materiales/guia2/CISA_Phishing_Guidance.pdf": "1pivn6yp42wKJoU_83gbthFNSFGlAqQpf",
  "assets/materiales/guia2/Cybersecurity_Awareness_Slides.pdf": "13cJgXNXGoFTtkyX7BsFKvk3HYtxjE0sV",
  "assets/materiales/guia2/FHS_3.0_Filesystem_Hierarchy_Standard.pdf": "1kleDPOucM6plAdVJ17hlGSteFvGhIRwF",
  "assets/materiales/guia2/GFPI-F-165FormatoSeleccionModificacionAlternativaEtapaProductiva.xlsx": "1fXFvb4l3kkyB9q2lO4hQuQRlTeO6hA1L",
  "assets/materiales/guia2/Guia_2_OperarHerramientas.docx": "1dm6wBLDwqnvCYDzWx4eSc8QFsEOJFqLV",
  "assets/materiales/guia2/Guia_rapida_normas_IEEE.pdf": "1A8ufITQCRI_mVAns2ApkqD1aNUq3qOCX",
  "assets/materiales/guia2/IEEE_Editorial_Style_Manual.pdf": "1eb1j5MlztHZoyHYFM9KzdfPdzyd-YmZo",
  "assets/materiales/guia2/Linux_Boot_Process_Presentation_Notes.pdf": "1RRnudwcoWIUhh-x_77IdVEz3e4FY7qpH",
  "assets/materiales/guia2/MatrizDiagnosticoDigital.docx": "1UhWyolEHl7alhBCssVs4XUToy17viKN5",
  "assets/materiales/guia2/NIST_SP800-83r1_Malware_Incident.pdf": "1QM9WGhdqLp62vsBBaQtE7HQzqkd-BZBx",
  "assets/materiales/guia2/SharePoint_Quick_Start_Guide.pdf": "1mEwWD3O8ZX67hKnXIrOKft4rMlhM810y",
  "assets/materiales/guia2/Taller_1_Guia2.docx": "1Z8AZCHIM-xDR2Be8QPHfj-bLfrNTsw6x",
  "assets/materiales/guia2/Virtualization_Lecture_Slides.ppt": "1bvmDORcx7PsoOgxu5_hhwqqObmz_ES3e",
  "assets/materiales/guia2/taller 1_guia5.docx": "1Z8AZCHIM-xDR2Be8QPHfj-bLfrNTsw6x",
  "assets/materiales/guia4ciber/12_consejos_copias_borrado_seguro.pdf": "1fzGDoRA3g2SR1wWCzsAs3AI3hECyFACT",
  "assets/materiales/guia4ciber/CONPES_3995_2020.pdf": "1-5GvYQ8ro1QQS0H8w0tJ_GO4Z-PHeTBM",
  "assets/materiales/guia4ciber/Estrategia_Nacional_Seguridad_Digital_Colombia_2025_2027.pdf": "1UTPame2rSg4PuYK8x_pfXMuhGs8Q17FS",
  "assets/materiales/guia4ciber/INCIBE_Proteccion_de_la_informacion_mirror.pdf": "1ftlVj47NBMjAyN0zfO678AXqhW6TnFQR",
  "assets/materiales/guia4ciber/MinTIC_Guia_Gestion_Clasificacion_Activos_2016.pdf": "1GaS3YDytBgVk5uOcDWqxfkjXI4TP9tOM",
  "assets/materiales/guia4ciber/MinTIC_Guia_Gestion_Clasificacion_Incidentes_G21.pdf": "1pEs7mZVv7XXap-27CY2lKJ_u_WlVG35X",
  "assets/materiales/guia4ciber/MinTIC_Guia_Gestion_Riesgos_G7.pdf": "1-nezny90goBksEK7hzvfojGXr3mCY3gB",
  "assets/materiales/guia4ciber/MinTIC_Guia_Indicadores_Gestion_Seguridad_G9.pdf": "1ZHWZasx_DpUriqApm-dgwWRmdAv_Yom_",
  "assets/materiales/guia4ciber/MinTIC_Guia_Seguridad_en_la_Nube_G12.pdf": "19CU1dbWkncFNky-2vS5Sw3hAVpvyJKt9",
  "assets/materiales/guia4ciber/MinTIC_Lineamientos_Inventario_Clasificacion_Activos_2025.pdf": "1maZOcog-uNE6yBhdD0ccNwN9p0v3EiPb",
  "assets/materiales/guia4ciber/MinTIC_Lineamientos_Modelo_Gestion_Riesgo_SI_2025.pdf": "1z_z6Q7QuXvLKxLc2Yg_C_5DIBOBMvwrW",
  "assets/materiales/guia4ciber/MinTIC_Modelo_Seguridad_Privacidad_Informacion_MSPI.pdf": "1l-rQPK-S8p6vGinxB4VM_o0FSDnfmvsL",
  "assets/materiales/guia4ciber/NIST_CSF_2_0_es.pdf": "16HMZtx-ib35oAGk6KfLFLWKq0ZXgfo_P",
  "assets/materiales/guia5/Bitacora_Para_Caso.docx": "1WlNeXoOqrNgNJOE85qLJmCM82eN_MCeP",
  "assets/materiales/guia5/CISA_Phishing_Guidance.pdf": "1pivn6yp42wKJoU_83gbthFNSFGlAqQpf",
  "assets/materiales/guia5/Cybersecurity_Awareness_Slides.pdf": "13cJgXNXGoFTtkyX7BsFKvk3HYtxjE0sV",
  "assets/materiales/guia5/FHS_3.0_Filesystem_Hierarchy_Standard.pdf": "1kleDPOucM6plAdVJ17hlGSteFvGhIRwF",
  "assets/materiales/guia5/GFPI-F-165FormatoSeleccionModificacionAlternativaEtapaProductiva.xlsx": "1fXFvb4l3kkyB9q2lO4hQuQRlTeO6hA1L",
  "assets/materiales/guia5/Guia_rapida_normas_IEEE.pdf": "1A8ufITQCRI_mVAns2ApkqD1aNUq3qOCX",
  "assets/materiales/guia5/IEEE_Editorial_Style_Manual.pdf": "1eb1j5MlztHZoyHYFM9KzdfPdzyd-YmZo",
  "assets/materiales/guia5/Linux_Boot_Process_Presentation_Notes.pdf": "1RRnudwcoWIUhh-x_77IdVEz3e4FY7qpH",
  "assets/materiales/guia5/NIST_SP800-83r1_Malware_Incident.pdf": "1QM9WGhdqLp62vsBBaQtE7HQzqkd-BZBx",
  "assets/materiales/guia5/SharePoint_Quick_Start_Guide.pdf": "1mEwWD3O8ZX67hKnXIrOKft4rMlhM810y",
  "assets/materiales/guia5/Virtualization_Lecture_Slides.ppt": "1bvmDORcx7PsoOgxu5_hhwqqObmz_ES3e",
  "assets/materiales/guia5/taller 1_guia5.docx": "1Z8AZCHIM-xDR2Be8QPHfj-bLfrNTsw6x",
  "assets/materiales/guia6/Conceptos Seguridad.pdf": "1YFAa-y9gfN51qkCU4lb-DUg95RNJ5EIE",
  "assets/materiales/guia6/CrystalDiskInfo9_8_0.zip": "1PVupEmRyK0rBUM7OClAnHTczqsAPjouI",
  "assets/materiales/guia6/GFPI-F-165FormatoSeleccionModificacionAlternativaEtapaProductiva.xlsx": "1fXFvb4l3kkyB9q2lO4hQuQRlTeO6hA1L",
  "assets/materiales/guia6/Guia-Accountability - Habeas Data.pdf": "10ImtoEIs-_CJp61fgbxto1lutfHDh06w",
  "assets/materiales/guia6/INCIBE_Copias_borrado_seguro_12_consejos.pdf": "1fzGDoRA3g2SR1wWCzsAs3AI3hECyFACT",
  "assets/materiales/guia6/INCIBE_Proteccion_de_la_informacion_mirror_uv.pdf": "1ftlVj47NBMjAyN0zfO678AXqhW6TnFQR",
  "assets/materiales/guia6/INCIBE_guia_ciberseguridad_para_todos.pdf": "1bFAPvuXTcmhApVjXWbBZSWTVmWW0vvmE",
  "assets/materiales/guia6/ITE7_Chp13 - Seguridad.pdf": "1YIHAxlTUt0MxM32Ye9C_hvDaJG9_FY4j",
  "assets/materiales/guia6/Ley_1581_de_2012.pdf": "1_Pj7ePC8xxho5332knfu-a_ixbMmy9Wv",
  "assets/materiales/guia6/MinEducacion_Guia_Implementacion_Politica_Seguridad_Digital.pdf": "1HE_h2iwaBAA4Cfv2STy8cjRiO7Hu-oAo",
  "assets/materiales/guia6/MinTIC_Guia_Gestion_Clasificacion_Incidentes.pdf": "1pEs7mZVv7XXap-27CY2lKJ_u_WlVG35X",
  "assets/materiales/guia6/NTC-ISO-IEC 27001_2013.pdf": "1o8a8oczFwWyu4VKx7-o4YQ4C0X0K4meh",
  "assets/materiales/guia6/PRESENTACION LEY 1581 de 2012.pptx": "1CCF2Jp0DCb7-_QX63uGRyp9jE5iezqMz",
  "assets/materiales/guia6/guia-copias-de-seguridad.pdf": "1zKx7OAtpPoBxvbaICA-0clmS3dYLs5kv",
  "assets/materiales/guia6/materiales_apoyo_guia6_PDFs_y_enlaces.zip": "1kbWCKAy3hhK9W2s7zAKtE6ZJizl8MZCP",
  "assets/materiales/guia6mant/1_Actividad_El_Detective.docx": "1GoTJB80rTqauaZ0T9qD-ugd-cxauBul5",
  "assets/materiales/guia6mant/Anexo_Reporte_Ejemplo_HWMonitor.pdf": "1f0_5AcvZFduivSbuYl9qpq-3SQC82xJ8",
  "assets/materiales/guia6mant/Arquitectura_Laptops.pdf": "11RQ1CJssqjYPU2p1mgHHTCydRVqQoHNG",
  "assets/materiales/guia6mant/Arquitectura_PC.pdf": "1cLluaxO1aNeeKNAoRx7TM-mnsUJD7dpf",
  "assets/materiales/guia6mant/Comunidad_Emagister_Mantenimiento_Preventivo.pdf": "1md1D1VQGL-Muwa8P7pl7XvrQYy4PWnxv",
  "assets/materiales/guia6mant/Conexion_M2_y_SATA.docx": "1GQNhxVwbkM4rE_P--OGeMhL5WMg-f2qd",
  "assets/materiales/guia6mant/Decreto_284_de_2018.pdf": "1UaD2t_95VqiOnG7iES7yZUoRieUcyTYR",
  "assets/materiales/guia6mant/Formato_Inspeccion_Externa_Equipos.pdf": "1OUhbXb9m_BApy28GFzokRTJesUOazd2x",
  "assets/materiales/guia6mant/GA-F-05-HV-de-Equipos-de-Computo.pdf": "1W8Ob3_n-c3xdXFPlC0H2EUQVMb_G-xU6",
  "assets/materiales/guia6mant/GT-FO-01-FORMATO-HOJAS-DE-VIDA-EQUIPOS-V03.xlsx": "1G4uFoJB3w6MhkPYoxxxaXQI8W64vatgg",
  "assets/materiales/guia6mant/HWMonitor_Manual_Usuario.pdf": "1QCMarvLS9xULewvB5T1duSviOMckEwCF",
  "assets/materiales/guia6mant/Manual_Mantenimiento_del_Computador.pdf": "1cbxeAmh1SaGqJeJfXFAjjKGwtJwdVae7",
  "assets/materiales/guia6mant/Modulo_2_Referencia_Adicional.pdf": "1H-Dohco3HdpLXcLDNBZwogKWiKMEMj55",
  "assets/materiales/guia6mant/Plan_de_Mantenimiento_Ejemplo.pdf": "13zh14499OX0yLg0pI33zLKf1_Y9HDoTX",
  "assets/materiales/guia6mant/Programa_Mantenimiento_Ejemplo.pdf": "19vXYiSU0b1Y4aVq30WCdKvbHuUoRfsR3",
  "assets/materiales/guia6mant/f-ga-146-ficha-tecnica-equipos-de-computo.xlsx": "1cTgMO1uBR1emeYEFGt-8kMzdPtsgYnTz",
  "assets/materiales/guia6mant/f-gr-02-hoja-de-vida-equipos-tecnologicos.pdf": "1Y1S73dUPAr3wAGaENUb23RnhkvGUyAf0",
  "assets/materiales/guia6mant/resolucion-1297-de-2010.pdf": "19bJJ1vwfZZIns5cCyAPbzBChkolPqW4d",
  "assets/materiales/induccion/3. Formato EstiloAprendizaje.xls": "1zVlt3ARjeo3ZHXzpQi-Tsz4JSnSuE9_u",
  "assets/materiales/induccion/3.1PROGRAMA - PROYECTO (1).pptx": "1_vn9piBY7WdsEoLVL4DDQkQTUlraGzDY",
  "assets/materiales/induccion/Acuerdo_009_2024_Reglamento_Aprendiz_SENA.pdf": "1CT7Kk8ay9n-detH0zoVRMWaTiaI0ie-9",
  "assets/materiales/induccion/Dia3_PEI_y_Formacion_por_Proyectos.pptx": "1LSNCTaEOUzZGnxWshIzVSKmE5qkb7oN9",
  "assets/materiales/induccion/Diseno_Curricular_Sistemas_Teleinformaticos.pdf": "1x4JcMFc1OyXeW1xBLPW5KWHxCelGLPTJ",
  "assets/materiales/induccion/Instructivo_APA_Biblioteca_SENA.pdf": "1wRuDTKTs6bybQSjKveGmLYvR7af5HA4e",
  "assets/materiales/induccion/Instructivo_OPAC_Biblioteca_SENA.pdf": "1lK5heOgBSnTzN--VsIJKvE5QO8v3pytM",
  "assets/materiales/induccion/Manual_Formacion_Virtual_SOFIA.pdf": "1-HNcdMnY7jpfFiVmFMN51kCSl9XCBaAu",
  "assets/materiales/induccion/PROYECTO EDUCATIVO INSTITUCIONAL SENA.pdf": "1wGdfWA66TVIb2-XB3nqcuN652qcisAYK",
  "assets/materiales/induccion/Proyecto_Acuerdo_Reglamento_Aprendiz_Anexos.pdf": "1u9w0erYn2UF9xlnDLTBerLqF5AtKSAK9",
  "assets/materiales/induccion/T1_Analisis_Logo_Simbolos_SENA.docx": "1nY6-AA5eJm47XJ3D6pQ_zUQNvZwna57Y",
  "assets/materiales/induccion/T2_Uso_Plataformas_Portafolio.docx": "1WiHyfb0NdmepYzLB9FQwkol3osxN7P_X",
  "assets/materiales/induccion/arbol-vida.jpeg": "1SJ1Xtsd0Tsdn2o6rabSN-U0SunVSN8rO",
  "assets/materiales/induccion/infografia EJEMPLO.pdf": "1AbiVNYj97xbi8MUX1-TlF8FvTp3zNZOx",
  "assets/materiales/talleres_refuerzo/induccion/TALLER_REFUERZO_Guia_Induccion.pdf": "1Ydk5CoR4H9WWPp5_dgOEBGKuveY3R5KZ"
},
};
