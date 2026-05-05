import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type LightVariant = "goldBeige" | "blueGray" | "greenGray" | "roseGray";
export type DarkMode = "on" | "off" | "auto";

type ThemeContextValue = {
  lightVariant: LightVariant;
  setLightVariant: (variant: LightVariant) => void;
  darkMode: DarkMode;
  setDarkMode: (mode: DarkMode) => void;
  isDarkEffective: boolean;
  lightVariantOptions: { id: LightVariant; label: string }[];
  darkModeOptions: { id: DarkMode; label: string }[];
};

const LIGHT_VARIANT_STORAGE_KEY = "bakergest.theme.lightVariant";
const DARK_MODE_STORAGE_KEY = "bakergest.theme.darkMode";

const lightVariantOptions: { id: LightVariant; label: string }[] = [
  { id: "goldBeige", label: "Mode or et beige" },
  { id: "blueGray", label: "Mode bleu et gris" },
  { id: "greenGray", label: "Mode vert et gris" },
  { id: "roseGray", label: "Mode rose et gris" },
];

const darkModeOptions: { id: DarkMode; label: string }[] = [
  { id: "off", label: "Sombre désactivé" },
  { id: "on", label: "Sombre activé" },
  { id: "auto", label: "Sombre auto (système)" },
];

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
};

function isLightVariant(value: string): value is LightVariant {
  return lightVariantOptions.some((o) => o.id === value);
}

function isDarkMode(value: string): value is DarkMode {
  return darkModeOptions.some((o) => o.id === value);
}

function isSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [lightVariant, setLightVariant] = useState<LightVariant>(() => {
    const stored = localStorage.getItem(LIGHT_VARIANT_STORAGE_KEY);
    if (stored && isLightVariant(stored)) {
      return stored;
    }
    return "greenGray";
  });

  const [darkMode, setDarkMode] = useState<DarkMode>(() => {
    const stored = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (stored && isDarkMode(stored)) {
      return stored;
    }
    return "off";
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => isSystemDark());
  const isDarkEffective = darkMode === "on" || (darkMode === "auto" && systemDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme-variant", lightVariant);
    document.documentElement.setAttribute(
      "data-theme-mode",
      isDarkEffective ? "dark" : "light",
    );
    localStorage.setItem(LIGHT_VARIANT_STORAGE_KEY, lightVariant);
    localStorage.setItem(DARK_MODE_STORAGE_KEY, darkMode);
  }, [lightVariant, darkMode, isDarkEffective]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      lightVariant,
      setLightVariant,
      darkMode,
      setDarkMode,
      isDarkEffective,
      lightVariantOptions,
      darkModeOptions,
    }),
    [lightVariant, darkMode, isDarkEffective],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook pairé au provider
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
