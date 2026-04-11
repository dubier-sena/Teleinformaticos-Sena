(function () {
  window.PROJECT_INTEGRATIONS = Object.assign(
    {
      googleAppsScriptUrl:
        "https://script.google.com/macros/s/AKfycbz8w9o1Fd2KxHc5KINuVzVhuLtvXn7yXNKuzaOyn6goCNqVYYp1nyf2GtJrFkHdN0cVKg/exec",
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
      ],
    },
    window.PROJECT_INTEGRATIONS || {}
  );
})();
