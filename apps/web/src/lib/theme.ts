// Préférence d'apparence (clair / sombre / système), appliquée via l'attribut
// data-theme sur <html> — voir index.css pour les jeux de variables associés
// (:root, :root:not([data-theme="light"]) sous prefers-color-scheme, et
// :root[data-theme="dark"]). "system" correspond à l'absence d'attribut :
// c'est prefers-color-scheme qui tranche, comme avant l'ajout de ce réglage.
export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "cookgrim-theme";

export function getStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage indisponible (navigation privée, cookies bloqués…) — on
    // retombe sur "system" plutôt que de faire planter l'appli.
  }
  return "system";
}

function applyTheme(theme: ThemePreference) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function setTheme(theme: ThemePreference) {
  applyTheme(theme);
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Le choix reste actif pour la session en cours même si la
    // persistance échoue.
  }
}
