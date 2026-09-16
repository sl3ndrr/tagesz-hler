/* FOUC-Bootstrap: Präferenzen anwenden, bevor CSS und App-Shell gezeichnet werden. */
(() => {
  const root = document.documentElement;
  // Die Skript-URL bezeichnet auch beim Start über ./ oder ./index.html denselben Pfad.
  const namespace = `tageszaehler:${encodeURIComponent(new URL('./', document.currentScript.src).pathname)}:`;
  let journalPreferences = null;
  try {
    const journal = JSON.parse(localStorage.getItem(`${namespace}backup-restore:v1`) || 'null');
    if (journal?.schemaVersion === 1) {
      journalPreferences = journal.state === 'committed'
        ? journal.target?.preferences
        : journal.before?.preferences;
    }
  } catch (_) {
    // Ein unlesbares Journal wird später von app.js sichtbar und schreibgeschützt behandelt.
  }
  const readPreference = (key, allowed, fallback) => {
    try {
      const hasJournalValue = journalPreferences &&
        Object.prototype.hasOwnProperty.call(journalPreferences, key);
      const journalValue = journalPreferences?.[key];
      const value = hasJournalValue
        ? (allowed.includes(journalValue) ? journalValue : fallback)
        : localStorage.getItem(`${namespace}${key}`);
      return allowed.includes(value) ? value : fallback;
    } catch (_) {
      return fallback;
    }
  };
  root.dataset.theme = readPreference('theme', ['system', 'light', 'dark'], 'system');
  root.dataset.color = readPreference('color', ['purple', 'blue', 'green', 'orange'], 'purple');
  root.dataset.view = readPreference('view', ['cards', 'compact'], 'cards');
})();
