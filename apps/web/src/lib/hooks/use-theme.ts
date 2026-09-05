import { useState } from "react";
import { getStoredTheme, setTheme as persistTheme, type ThemePreference } from "../theme";

export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());

  const setTheme = (next: ThemePreference) => {
    persistTheme(next);
    setThemeState(next);
  };

  return { theme, setTheme };
}
