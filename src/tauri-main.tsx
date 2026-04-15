import "./app/globals.css";
import "./app/font.css";

import React from "react";
import ReactDOM from "react-dom/client";
import {
  createRouter,
  RouterProvider
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.tauri.gen";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
