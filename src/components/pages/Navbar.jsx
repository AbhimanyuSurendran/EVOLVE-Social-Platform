import React from "react";
import { useNavigate } from "react-router-dom";
import evolveGif from "../../assets/EVOLVE.gif";

import "../../styles/Navbar.css";  // we will create this next

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const username = user?.username || "Guest";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("user");
    navigate("/auth", { replace: true });
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <img
          src={evolveGif}   // replace with your actual app logo
          alt="App Logo"
          className="navbar-logo"
        />
        <h2 className="navbar-title">EVOLVE</h2>
      </div>

      <div className="navbar-right">
        <span className="navbar-username">{username}</span>
        <button className="navbar-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
