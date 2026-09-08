import { writable } from "svelte/store";

export type Theme = "light" | "dark";

const STORAGE_KEY = "openwizardai-theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark() ? "dark" : "light";
}

export const theme = writable<Theme>(initialTheme());

theme.subscribe((value) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = value;
  window.localStorage.setItem(STORAGE_KEY, value);
});

export function toggleTheme() {
  theme.update((current) => (current === "light" ? "dark" : "light"));
}
