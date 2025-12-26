import React, { useEffect, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import VerticalSidebar from "./VerticalSidebar.jsx";
import "../../styles/LandingPage.css";

const STAR_COUNT = 45;

function createStars() {
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() < 0.3 ? 3 : 2, // a few slightly bigger stars
    delay: `${Math.random() * 3}s`,
    duration: `${2.5 + Math.random() * 2}s`,
  }));
}

export default function LandingPage() {
  const navigate = useNavigate();

  // Redirect if no token (extra safety)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/auth", { replace: true });
  }, [navigate]);

  // If you need user later, it's here
  // const user = JSON.parse(localStorage.getItem("user") || "null");

  // Pre-generate starfield once per mount
  const stars = useMemo(createStars, []);

  return (
    <div className="dashboard-layout">
      {/* Starry background (mainly visible in dark theme) */}
      <div className="dashboard-starfield">
        {stars.map((star) => (
          <span
            key={star.id}
            className="dashboard-star"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
          />
        ))}

        {/* Soft central glow / explosion */}
        <div className="dashboard-explosion" />
      </div>

      {/* Top: Navbar */}
      <Navbar />

      {/* Below navbar: sidebar on left + main content on right */}
      <div className="dashboard-body">
        {/* Left: sidebar */}
        <VerticalSidebar />

        {/* Right: main content area */}
        <main className="content">
          {/* Nested pages (Feed, Messages, etc.) */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
