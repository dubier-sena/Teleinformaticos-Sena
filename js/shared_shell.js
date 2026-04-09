// js/shared_shell.js
(function () {
  function markShellReady() {
    document.documentElement.classList.add("shell-ready");
  }

  function attachRevealMotion() {
    document.querySelectorAll("[data-reveal]").forEach((element, index) => {
      element.style.setProperty("--reveal-index", String(index));
      element.classList.add("is-visible");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    markShellReady();
    attachRevealMotion();
  });
})();
