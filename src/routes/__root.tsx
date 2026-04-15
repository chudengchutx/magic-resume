import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useLocation
} from "@tanstack/react-router";
import appCss from "../app/globals.css?url";
import appFontCss from "../app/font.css?url";
import { NextIntlClientProvider } from "@/i18n/compat/client";
import { useEffect } from "react";
import zhMessages from "@/i18n/locales/zh.json";
import enMessages from "@/i18n/locales/en.json";
import { Providers } from "@/app/providers";
import { Toaster } from "@/components/ui/sonner";
import { getPreferredLocale } from "@/i18n/runtime";

const isTauriApp =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      },
      { title: "Magic Resume" }
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss
      },
      {
        rel: "stylesheet",
        href: appFontCss
      }
    ]
  }),
  component: RootComponent,
  notFoundComponent: RootNotFound
});

function AppShell() {
  const pathname = useLocation({
    select: (location) => location.pathname
  });
  const locale = getPreferredLocale(pathname);
  const messages = locale === "en" ? enMessages : zhMessages;

  useEffect(() => {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
  }, [locale]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Shanghai"
    >
      <Providers>
        <Outlet />
        <Toaster position="top-center" richColors />
      </Providers>
    </NextIntlClientProvider>
  );
}

function RootComponent() {
  // In Tauri desktop app, render without HTML/body wrappers
  // since the HTML shell is provided by index-tauri.html
  if (isTauriApp) {
    return <AppShell />;
  }

  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <HeadContent />
        <link rel="icon" href="/favicon.ico?v=2" />
        <link rel="icon" href="/icon.png" />
      </head>
      <body suppressHydrationWarning>
        <AppShell />
        <Scripts />
      </body>
    </html>
  );
}

function RootNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">页面不存在</p>
    </main>
  );
}
