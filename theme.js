/* FOUC-Bootstrap: Präferenzen anwenden, bevor CSS und App-Shell gezeichnet werden. */
(() => {
  const root = document.documentElement;
  // Die Skript-URL bezeichnet auch beim Start über ./ oder ./index.html denselben Pfad.
  const namespace = `tageszaehler:${encodeURIComponent(new URL('./', document.currentScript.src).pathname)}:`;
  const readPreference = (key, allowed, fallback) => {
    try {
      const value = localStorage.getItem(`${namespace}${key}`);
      return allowed.includes(value) ? value : fallback;
    } catch (_) {
      return fallback;
    }
  };
  root.dataset.theme = readPreference('theme', ['system', 'light', 'dark'], 'system');
  root.dataset.color = readPreference('color', ['purple', 'blue', 'green', 'orange'], 'purple');
  root.dataset.view = readPreference('view', ['cards', 'compact'], 'cards');
})();
