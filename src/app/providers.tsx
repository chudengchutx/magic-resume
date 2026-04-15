
import { useEffect } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { HeroUIProvider } from "@heroui/react";
import { useLocale } from "@/i18n/compat/client";
import { isTauri } from "@/utils/tauriFileSystem";

/** Syncs Tauri's native OS theme detection with next-themes */
function TauriThemeSync() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();

      // If user selected "system", sync Tauri's native theme on change
      unlisten = await win.onThemeChanged(({ payload: osTheme }) => {
        if (theme === "system") {
          // Force the correct class on <html> immediately
          document.documentElement.classList.toggle("dark", osTheme === "dark");
        }
      });
    })();

    return () => {
      unlisten?.();
    };
  }, [theme, setTheme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const locale = useLocale();

  return (
    <HeroUIProvider locale={locale}>
        <ThemeProvider
          attribute="class"
          defaultTheme={isTauri ? "system" : "light"}
          enableSystem
          disableTransitionOnChange
          storageKey="magic-resume-theme"
        >
          {isTauri && <TauriThemeSync />}
          {children}
        </ThemeProvider>
    </HeroUIProvider>
  );
}
