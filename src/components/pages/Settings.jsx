// src/features/Settings/Settings.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/Settings.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const STORAGE_KEY = "theme"; // use a single canonical key across the app

// Small helper to safely read/write localStorage
const safeLocal = {
  get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  set(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { }
  }
};

// Utility to apply theme to document and emit a custom event for other parts of the app
export function applyThemeGlobal(mode) {
  const isDark = mode === "dark";
  document.body.classList.toggle("theme-dark", isDark);
  document.documentElement.setAttribute("data-theme", mode);
  // emit event so other components (if they want) can listen
  window.dispatchEvent(new CustomEvent("evolve:theme-changed", { detail: { theme: mode } }));
}

export default function Settings() {
  const navigate = useNavigate();

  // Theme state
  const [theme, setTheme] = useState(() => {
    const stored = safeLocal.get(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  });

  // Slider drag
  const [dragX, setDragX] = useState(6);
  const [isDragging, setIsDragging] = useState(false);

  const sliderRef = useRef(null);
  const knobRef = useRef(null);

  // FX
  const [explode, setExplode] = useState(false);
  const [flash, setFlash] = useState(false);
  const [stars, setStars] = useState([]);

  // Account/Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Spawn stars (memoized generator for reproducible length)
  const STAR_COUNT = 24;
  const spawnStars = useCallback(() => {
    const arr = Array.from({ length: STAR_COUNT }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 2
    }));
    setStars(arr);
  }, []);

  // apply theme on mount (ensures body has correct class immediately when Settings loads)
  useEffect(() => {
    applyThemeGlobal(theme);
    if (theme === "dark") spawnStars();
  }, [spawnStars, theme]);

  // Keep theme persisted & broadcast to other tabs
  const applySwitch = useCallback((newTheme) => {
    if (newTheme === theme) return;
    setTheme(newTheme);
    safeLocal.set(STORAGE_KEY, newTheme);
    applyThemeGlobal(newTheme);

    // FX
    triggerExplosion();
    haptic();
    if (newTheme === "dark") spawnStars();
    else {
      setStars([]);
      flashLight();
    }
  }, [theme, spawnStars]);

  // Listen for storage events (cross-tab) and custom theme events (if other code dispatches)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const val = e.newValue;
        if (val === "dark" || val === "light") {
          setTheme(val);
          applyThemeGlobal(val);
          if (val === "dark") spawnStars();
          else setStars([]);
        }
      }
    };
    const onCustom = (ev) => {
      const val = ev.detail?.theme;
      if (val === "dark" || val === "light") {
        setTheme(val);
        if (val === "dark") spawnStars();
        else setStars([]);
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("evolve:theme-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("evolve:theme-changed", onCustom);
    };
  }, [spawnStars]);

  /* ---------- FX helpers ---------- */
  const triggerExplosion = () => {
    if (explode) return; // prevent overlapping
    setExplode(true);
    setTimeout(() => setExplode(false), 450);
  };

  const flashLight = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 250);
  };

  const haptic = () => {
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) { }
  };

  /* ---------- Drag / Pointer handling ---------- */
  const startDrag = (e) => {
    e.preventDefault();
    setIsDragging(true);
    // For touch, pointer events might be better; we rely on pointermove below
  };

  const onPointerMove = useCallback((ev) => {
    if (!isDragging || !sliderRef.current || !knobRef.current) return;
    const slider = sliderRef.current.getBoundingClientRect();
    const knob = knobRef.current.offsetWidth;
    // pointer event supports touches & mouse
    const clientX = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
    if (clientX == null) return;
    let x = clientX - slider.left - knob / 2;
    const min = 6;
    const max = slider.width - knob - 6;
    setDragX(Math.max(min, Math.min(x, max)));
  }, [isDragging]);

  const stopDrag = useCallback(() => {
    if (!sliderRef.current || !knobRef.current) {
      setIsDragging(false);
      return;
    }
    const width = sliderRef.current.offsetWidth;
    const knob = knobRef.current.offsetWidth;
    const center = dragX + knob / 2;
    const threshold = width * 0.55;
    if (center > threshold) {
      setDragX(width - knob - 6);
      applySwitch("dark");
    } else {
      setDragX(6);
      applySwitch("light");
    }
    setIsDragging(false);
  }, [dragX, applySwitch]);

  // global pointer listeners while dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDrag);
      window.addEventListener("pointercancel", stopDrag);
    } else {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    }
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [isDragging, onPointerMove, stopDrag]);

  // sync knob position when theme changes or layout resizes
  useEffect(() => {
    if (!sliderRef.current || !knobRef.current) return;
    const knob = knobRef.current.offsetWidth;
    const width = sliderRef.current.offsetWidth;
    setDragX(theme === "dark" ? width - knob - 6 : 6);

    const onResize = () => {
      const knobW = knobRef.current?.offsetWidth ?? 0;
      const w = sliderRef.current?.offsetWidth ?? 0;
      setDragX(theme === "dark" ? w - knobW - 6 : 6);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [theme]);

  /* ---------- Account actions (logout / delete) ---------- */
  const handleLogout = () => {
    // Do not clear entire localStorage — preserve theme
    try {
      const savedTheme = safeLocal.get(STORAGE_KEY);
      localStorage.clear();
      if (savedTheme) safeLocal.set(STORAGE_KEY, savedTheme);
    } catch (e) { }
    navigate("/auth", { replace: true });
  };

  const openDeleteModal = () => {
    setDeleteConfirmText("");
    setDeleteError("");
    setShowDeleteModal(true);
  };
  const closeDeleteModal = () => { if (!isDeleting) setShowDeleteModal(false); };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== "delete") {
      setDeleteError('Type "DELETE" to confirm');
      return;
    }
    try {
      setIsDeleting(true);
      const token = safeLocal.get("token");
      const res = await fetch(`${API_BASE}/api/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Delete failed");
      // preserve theme as with logout
      const savedTheme = safeLocal.get(STORAGE_KEY);
      localStorage.clear();
      if (savedTheme) safeLocal.set(STORAGE_KEY, savedTheme);
      navigate("/auth", { replace: true });
    } catch {
      setDeleteError("Account deletion failed.");
    } finally {
      setIsDeleting(false);
    }
  };

  /* ---------- Keyboard accessibility for knob (left/right/enter) ---------- */
  const onKnobKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const prefer = e.key === "ArrowRight" ? "dark" : "light";
      applySwitch(prefer);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      applySwitch(theme === "dark" ? "light" : "dark");
    }
  };


  /* ----------------------------- BLOCK DEV TOOLS ----------------------------- */
  
    useEffect(() => {
    function onKeyDown(e) {
      const key = (e.key || "").toLowerCase();
  
      if (
        e.key === "F12" ||                 // 🔒 Block F12
        (e.ctrlKey &&
          e.shiftKey &&
          (key === "i" || key === "j" || key === "c")) ||
        (e.ctrlKey && key === "u")
      ) {
        e.preventDefault();
      }
    }
  
    function onContext(e) {
      e.preventDefault();                  // 🔒 Block right-click
    }
  
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("contextmenu", onContext);
  
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("contextmenu", onContext);
    };
  }, []);

  /* ---------- JSX ---------- */
  return (
    <div className={`settings-page ${flash ? "settings-flash" : ""}`} style={{ userSelect: isDragging ? "none" : "auto" }}>
      <div className="settings-shell">
        {/* FX */}
        <div className={`settings-explosion ${explode ? "settings-explosion-active" : ""}`} />
        {stars.map((s) => (
          <span
            key={s.id}
            className="settings-star"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
          />
        ))}

        {/* HEADER */}
        <header className="settings-header">
          <div>
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">Tune your EVOLVE experience ✨</p>
          </div>
          <div className="settings-badge">
            <span className="badge-dot" />
            <span className="badge-text">Account active</span>
          </div>
        </header>

        <div className="settings-grid">
          {/* SLIDER */}
          <section className="settings-card appearance-card">
            <div className="card-header">
              <h2>Appearance</h2>
              <span className="card-chip">theme</span>
            </div>

            <p className="card-description">Drag the knob fully to switch theme.</p>

            <div
              ref={sliderRef}
              className={`theme-slider ${theme === "dark" ? "theme-slider-dark" : ""}`}
              // pointer handlers handled globally; prevent default interactions on the slider
              onPointerDown={(e) => {
                // if user clicks the track, move knob to that point
                const slider = sliderRef.current?.getBoundingClientRect();
                const knobW = knobRef.current?.offsetWidth ?? 0;
                if (!slider) return;
                const x = e.clientX - slider.left - knobW / 2;
                const min = 6;
                const max = slider.width - knobW - 6;
                setDragX(Math.max(min, Math.min(x, max)));
                // start dragging immediately
                startDrag(e);
              }}
            >
              <div className="theme-slider-track">
                <span className="theme-slider-text">Slide to switch mode</span>
              </div>

              <div
                ref={knobRef}
                role="switch"
                aria-checked={theme === "dark"}
                tabIndex={0}
                className={`theme-slider-knob ${isDragging ? "dragging" : ""}`}
                onPointerDown={(e) => { e.stopPropagation(); startDrag(e); }}
                onKeyDown={onKnobKeyDown}
                style={{ left: dragX }}
              >
                {theme === "dark" ? "🌙" : "☀️"}
              </div>
            </div>

            <p className="theme-hint">Current: <b>{theme.toUpperCase()}</b></p>
          </section>

          {/* ABOUT */}
          <section className="settings-card about-card">
            <div className="card-header">
              <h2>About EVOLVE</h2>
              <span className="card-chip">info</span>
            </div>
            <p className="card-description">Learn the story behind EVOLVE.</p>
            <button className="settings-btn ghost-btn about-page-btn" onClick={() => navigate("/about")}>📖 Open About Page</button>
          </section>

          {/* ACCOUNT */}
          <section className="settings-card danger-card">
            <div className="card-header">
              <h2>Account</h2>
              <span className="card-chip danger-chip">critical</span>
            </div>
            <p className="card-description">Logout or permanently delete your account.</p>

            <div className="account-actions">
              <button className="settings-btn outline-btn" onClick={handleLogout}>🚪 Logout</button>
              <button className="settings-btn danger-btn" onClick={openDeleteModal}>🗑 Delete account</button>
            </div>
          </section>
        </div>
      </div>

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="settings-modal-backdrop" onClick={closeDeleteModal}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete account?</h2>
            <p>This cannot be undone.</p>
            <p className="modal-warning">Type <b>DELETE</b> to confirm.</p>

            <input className="modal-input" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} />
            {deleteError && <p className="modal-error">{deleteError}</p>}

            <div className="modal-actions">
              <button className="settings-btn ghost-btn" onClick={closeDeleteModal}>Cancel</button>
              <button className="settings-btn danger-btn" onClick={handleDeleteAccount} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
