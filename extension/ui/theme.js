(() => {
  const key = "sample-snip-theme";
  function apply(theme) {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
    const button = document.getElementById("theme");
    if (!button) return;
    const label = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;
    button.title = label;
    button.setAttribute("aria-label", label);
  }
  let theme = "light";
  try {
    theme = localStorage.getItem(key) || theme;
  } catch {}
  apply(theme);
  document.addEventListener("DOMContentLoaded", () => {
    apply(document.documentElement.dataset.theme);
    document.getElementById("theme").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      apply(next);
      try {
        localStorage.setItem(key, next);
      } catch {}
    });
  });
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
})();
