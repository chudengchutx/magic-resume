/**
 * Hook to handle native macOS menu bar actions in the Tauri desktop app.
 * Listens for "menu-action" events emitted from Rust and triggers
 * corresponding frontend actions (navigation, save, export, etc.)
 */

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { isTauri } from "@/utils/tauriFileSystem";

export function useTauriMenuHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");

      unlisten = await listen<string>("menu-action", (event) => {
        const action = event.payload;

        switch (action) {
          case "new_resume":
            // Dispatch a custom DOM event for the dashboard to pick up
            window.dispatchEvent(new CustomEvent("tauri:new-resume"));
            // Also navigate to dashboard if not already there
            navigate({ to: "/app/dashboard/resumes" });
            break;

          case "save":
            // Trigger save via custom DOM event (the editor can listen for this)
            window.dispatchEvent(new CustomEvent("tauri:save"));
            break;

          case "export_pdf":
            window.dispatchEvent(new CustomEvent("tauri:export-pdf"));
            break;

          case "goto_dashboard":
            navigate({ to: "/app/dashboard/resumes" });
            break;

          case "goto_templates":
            navigate({ to: "/app/dashboard/templates" });
            break;

          case "goto_ai_settings":
            navigate({ to: "/app/dashboard/ai" });
            break;

          case "goto_settings":
            navigate({ to: "/app/dashboard/settings" });
            break;
        }
      });
    })();

    return () => {
      unlisten?.();
    };
  }, [navigate]);
}
