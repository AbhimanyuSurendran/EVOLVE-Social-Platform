import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import evolveGif from "../../assets/EVOLVE.gif";
import "../../styles/splash.css";

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to Feed after 3 seconds
    const timer = setTimeout(() => {
      navigate("/feed", { replace: true });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash-container">
      <img src={evolveGif} alt="EVOLVE Logo" className="splash-logo" />
      <h1 className="splash-text">EVOLVE</h1>
      <p className="splash-sub">Connecting people...</p>
      <div className="loader-bar"></div>
    </div>
  );
}
