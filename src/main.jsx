import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// -----------------------------
// APPLY SAVED THEME BEFORE RENDER
// -----------------------------
(function applyInitialTheme() {
  let saved = null;

  try {
    saved =
      localStorage.getItem("theme") ||
      localStorage.getItem("evolve-theme"); // supports your old key too
  } catch (e) {
    saved = null;
  }

  let finalTheme = "light";

  if (saved === "dark" || saved === "light") {
    finalTheme = saved;
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    finalTheme = "dark";
  }

  // Apply to DOM
  const isDark = finalTheme === "dark";
  document.body.classList.toggle("theme-dark", isDark);
  document.documentElement.setAttribute("data-theme", finalTheme);

  // Broadcast event so Navbar, LandingPage, etc. can react if needed
  window.dispatchEvent(
    new CustomEvent("evolve:theme-changed", { detail: { theme: finalTheme } })
  );
})();
// -----------------------------
// END OF THEME INIT
// -----------------------------

createRoot(document.getElementById("root")).render(<App />);
