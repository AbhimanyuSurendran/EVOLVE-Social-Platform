import React, { useEffect, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import {
  FaHome,
  FaPen,
  FaComments,
  FaBell,
  FaUser,
  FaCog,
  FaChartBar,
} from "react-icons/fa";
import "../../styles/VerticalSidebar.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/** safe JSON parse helper (stable reference) */
function safeParse(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function VerticalSidebar() {
  // persist collapsed state (read once)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("vs_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // user info
  const [username, setUsername] = useState(() => {
    try {
      const u = safeParse("user");
      return (u && u.username) || localStorage.getItem("username") || "Guest";
    } catch {
      return localStorage.getItem("username") || "Guest";
    }
  });

  const [avatarUrl, setAvatarUrl] = useState(() => {
    try {
      const u = safeParse("user_profile");
      return (u && u.avatar_url) || "";
    } catch {
      return "";
    }
  });

  // dynamic badges / counts
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const [postCount, setPostCount] = useState(0);

  // routes with ICON components
  const routes = [
    { key: "home", label: "Home", path: "/", icon: <FaHome /> },
    { key: "post", label: "Post", path: "/post", icon: <FaPen /> },
    { key: "user", label: "Search", path: "/users", icon: <FaUser /> },
    {
      key: "messages",
      label: "Messages",
      path: "/messages",
      icon: <FaComments />,
    },
    {
      key: "notifications",
      label: "Notifications",
      path: "/notifications",
      icon: <FaBell />,
    },
    {key: "analytics", label: "Analytics", path: "/analytics", icon: <FaChartBar />},
    { key: "profile", label: "Profile", path: "/profile", icon: <FaUser /> },
    { key: "settings", label: "Settings", path: "/settings", icon: <FaCog /> },
  ];

  const computeCounts = useCallback(() => {
    // notifications: count unread
    const notifs = safeParse("notifications");
    const notifsArr = Array.isArray(notifs) ? notifs : [];
    const unreadNotifs = notifsArr.filter((n) => !n.read).length;
    setNotifCount(unreadNotifs);

    // conversations: count unread messages (not fromMe and not read)
    const convos = safeParse("conversations");
    const convosArr = Array.isArray(convos) ? convos : [];
    const unreadMsgs = convosArr.reduce((acc, c) => {
      const messages = Array.isArray(c.messages) ? c.messages : [];
      const unread = messages.filter((m) => !m.read && !m.fromMe).length;
      return acc + unread;
    }, 0);
    setMsgCount(unreadMsgs);

    // posts count
    const posts = safeParse("posts");
    const postsArr = Array.isArray(posts) ? posts : [];
    setPostCount(postsArr.length);

    // username refresh (from localStorage)
    const u = safeParse("user");
    const name =
      (u && u.username) || localStorage.getItem("username") || "Guest";
    setUsername(name);
  }, []);

  // run initially
  useEffect(() => {
    computeCounts();
  }, [computeCounts]);

  // storage event listener (other tabs) + polling fallback
  useEffect(() => {
    function onStorage() {
      computeCounts();
    }
    window.addEventListener("storage", onStorage);

    const interval = setInterval(() => computeCounts(), 2500);

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, [computeCounts]);

  // fetch profile once to get avatar + (better) display name
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;

        const data = await resp.json();
        const u = data.user;
        if (!u) return;

        setUsername(u.display_name || u.username || "Guest");
        setAvatarUrl(u.avatar_url || "");

        // cache for future (optional)
        localStorage.setItem("user_profile", JSON.stringify(u));
      } catch (err) {
        console.error("Sidebar profile fetch error:", err);
      }
    })();
  }, []);

  // persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem("vs_collapsed", collapsed ? "true" : "false");
    } catch {}
  }, [collapsed]);

  const initials = (username || "GU").slice(0, 2).toUpperCase();

  return (
    <div className={`sidebar-wrapper ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="sidebar-logo">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                className="sidebar-logo-avatar-img"
              />
            ) : (
              initials
            )}
          </div>
          <span className="username">{username}</span>

          <button
            className="toggle-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            ☰
          </button>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {routes.map((item) => {
            let badge = 0;
            if (item.key === "notifications") badge = notifCount;
            if (item.key === "messages") badge = msgCount;
            if (item.key === "post") badge = postCount;

            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <span className="icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="label">{item.label}</span>
                {!collapsed && badge > 0 && (
                  <span className="badge" aria-hidden>
                    {badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
