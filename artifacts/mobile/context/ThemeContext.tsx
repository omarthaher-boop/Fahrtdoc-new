import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "pref_theme";

interface ThemeContextType {
  themePreference: ThemePreference;
  resolvedScheme: "light" | "dark";
  setThemePreference: (p: ThemePreference) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextType>({
  themePreference: "system",
  resolvedScheme: "light",
  setThemePreference: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePref] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") setThemePref(v);
    });
  }, []);

  const resolvedScheme: "light" | "dark" =
    themePreference === "system" ? (systemScheme ?? "light") : themePreference;

  const setThemePreference = useCallback(async (p: ThemePreference) => {
    setThemePref(p);
    await AsyncStorage.setItem(THEME_KEY, p);
  }, []);

  return (
    <ThemeContext.Provider value={{ themePreference, resolvedScheme, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
