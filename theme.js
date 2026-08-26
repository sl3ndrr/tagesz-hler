/* FOUC-Bootstrap: Präferenzen anwenden, bevor CSS und App-Shell gezeichnet werden. */
(() => {
  const root = document.documentElement;
  const readPreference = (key, allowed, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return allowed.includes(value) ? value : fallback;
    } catch (_) {
      return fallback;
    }
  };
  root.dataset.theme = readPreference('theme', ['system', 'light', 'dark'], 'system');
  root.dataset.color = readPreference('color', ['purple', 'blue', 'green', 'orange'], 'purple');
  root.dataset.view = readPreference('view', ['cards', 'compact'], 'cards');
})();
