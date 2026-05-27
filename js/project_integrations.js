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
      ],
    },
    window.PROJECT_INTEGRATIONS || {}
  );
})();
