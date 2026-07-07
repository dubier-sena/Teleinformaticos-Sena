(function () {
  window.PROJECT_INTEGRATIONS = Object.assign(
    {
      googleAppsScriptUrl:
        "https://script.google.com/macros/s/AKfycbz8w9o1Fd2KxHc5KINuVzVhuLtvXn7yXNKuzaOyn6goCNqVYYp1nyf2GtJrFkHdN0cVKg/exec",
      // URL del Web App de respaldo (apps-script/respaldo_firestore.gs).
      // Dejar vacio para deshabilitar el respaldo a Drive sin romper nada.
      respaldoFirestoreUrl:
        "https://script.google.com/macros/s/AKfycbwlz1goa60gNjHMpUFJxtJHbzgsnj4BBos82c2t9Pk3ryryDD1To7kduRzJ7Eq5NnI8nQ/exec",
      googleAppsScriptAllowedHosts: [
        "script.google.com",
        "script.googleusercontent.com",
      ],
      maxUploadBytes: 10 * 1024 * 1024,
      allowedUploadExtensions: [
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".jpg",
        ".jpeg",
        ".png",
        ".zip",
        ".pkt",
        ".py",
      ],
      // Carpeta raiz de Drive por ficha (espejo de FICHA_ROOT_FOLDERS del Apps
      // Script). Se usa para el respaldo manual: si la entrega automatica falla,
      // el aprendiz abre su carpeta y sube el archivo a mano.
      fichaDriveFolders: {
        "3441939": "https://drive.google.com/drive/folders/1SLkk986REOKGEFaCyWV7rSeudj7lnUMs",
        "3441942": "https://drive.google.com/drive/folders/1cv0DkFXhkMw22AddqIgC354DhUUHcQck",
        "3441944": "https://drive.google.com/drive/folders/1fZ7atqeSym9ayQylRG47HqKm2xdBbFOf",
        "3441950": "https://drive.google.com/drive/folders/1N49ulJRgbF7ySD3JDRJzFE5czCKFO1KM",
        "3168850": "https://drive.google.com/drive/folders/1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp",
        "3168852": "https://drive.google.com/drive/folders/1p9HdGinK1me8PsbaLHYio_OC-idAmorR",
      },
      // Link de DESCARGA DIRECTA (formato uc?export=download, no /view -- ese
      // abre el visor de Drive en el navegador en vez de descargar) al archivo
      // del acuerdo de Etapa Productiva de cada ficha (contiene cedula y datos
      // de TODO el grupo, por eso NO vive en este repo publico). Compartido como
      // "cualquiera con el enlace" (mismo nivel que fichaDriveFolders arriba).
      fichaAcuerdoExcelUrls: {
        "3441939": "https://drive.google.com/uc?export=download&id=1Gs67a5LUc0Alv1kqe3Yla3ryosCeBH0k",
        "3441942": "https://drive.google.com/uc?export=download&id=17Ou96W5e5uWnvVvqAzPq2J1oc8qOYxyd",
        "3441944": "https://drive.google.com/uc?export=download&id=1carTO0eulPdNLmoyUWpoBdzktDPRccTX",
        "3441950": "https://drive.google.com/uc?export=download&id=1S1PKiIPDUwCmbZTuDtWzaWe78NXIXJr3",
        "3168850": "https://drive.google.com/uc?export=download&id=11nEbEacehK3DmAbnQT2moAdsTR3I6t7P",
        "3168852": "https://drive.google.com/uc?export=download&id=1AFGFI-buGhMeL41oSaYVDgaFFr1QTjLT",
      },
    },
    window.PROJECT_INTEGRATIONS || {}
  );
})();
