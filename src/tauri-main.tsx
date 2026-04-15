import "./app/globals.css";
import "./app/font.css";

import React from "react";
import ReactDOM from "react-dom/client";
import {
  createRouter,
  RouterProvider
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.tauri.gen";
import { loadResumesFromDisk } from "./utils/tauriFileSystem";
import { useResumeStore } from "./store/useResumeStore";

// For desktop app, auto-navigate to dashboard when on root or landing page
const { pathname } = window.location;
if (
  pathname === "/" ||
  pathname === "/index.html" ||
  /^\/[a-z]{2}\/?$/.test(pathname)
) {
  window.history.replaceState(null, "", "/app/dashboard/resumes");
}

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: "intent"
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Load resumes from ~/Documents/MagicResume/ on startup
loadResumesFromDisk().then((diskResumes) => {
  if (diskResumes.length > 0) {
    const store = useResumeStore.getState();
    const currentResumes = store.resumes;
    let merged = { ...currentResumes };
    for (const resume of diskResumes) {
      const existing = merged[resume.id];
      // Disk file wins if it's newer or doesn't exist in memory
      if (!existing || resume.updatedAt > (existing.updatedAt ?? "")) {
        merged[resume.id] = resume;
      }
    }
    useResumeStore.setState({ resumes: merged });
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
