// src/components/pages/RequireAuth.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  const location = useLocation();

  if (!token) {
    // Redirect to auth page and remember where we came from
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
}
