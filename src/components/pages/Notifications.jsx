import React, { useEffect, useState } from "react";
import "../../styles/Notifications.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const token = localStorage.getItem("token");

  // Load notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!token) {
        setError("You are not logged in.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const resp = await fetch(`${API_BASE}/api/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to load notifications (${resp.status})`);
        }

        const data = await resp.json();
        setNotifications(data.notifications || []);
      } catch (err) {
        console.error("Notifications fetch error:", err);
        setError(err.message || "Failed to load notifications");
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [token]);

  const formatActorName = (n) => {
    if (!n) return "Someone";
    return n.display_name || n.username || "Someone";
  };

  const buildMessage = (notif) => {
    const actorName = formatActorName({
      display_name: notif.actor_display_name,
      username: notif.actor_username,
    });

    if (notif.type === "like") {
      return `${actorName} liked your post`;
    } else if (notif.type === "comment") {
      if (notif.comment_content) {
        return `${actorName} commented: "${notif.comment_content.slice(
          0,
          60
        )}${notif.comment_content.length > 60 ? "..." : ""}"`;
      }
      return `${actorName} commented on your post`;
    } else if (notif.type === "follow") {
      return `${actorName} started following you`;
    }

    return `${actorName} did something`;
  };

  const handleMarkRead = async (id) => {
    if (!token) return;

    try {
      const resp = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        const msg = data?.message || "Failed to mark as read";
        throw new Error(msg);
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (err) {
      console.error("Mark read error:", err);
      setError(err.message || "Failed to update notification");
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    setMarkingAll(true);
    setError("");

    try {
      const resp = await fetch(
        `${API_BASE}/api/notifications/mark-all-read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        const msg = data?.message || "Failed to mark all as read";
        throw new Error(msg);
      }

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: 1 }))
      );
    } catch (err) {
      console.error("Mark all read error:", err);
      setError(err.message || "Failed to update notifications");
    } finally {
      setMarkingAll(false);
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

  return (
    <div className="feed-page">
      <div className="notifications-card">
        <div className="notifications-header">
          <h2 className="notifications-title">Notifications</h2>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="notifications-mark-all-btn"
            >
              {markingAll ? "Updating..." : "Mark all as read"}
            </button>
          )}
        </div>

        {loading && (
          <p className="notifications-status-text">
            Loading notifications...
          </p>
        )}

        {error && (
          <p className="notifications-error">{error}</p>
        )}

        {!loading && notifications.length === 0 && !error && (
          <p className="notifications-empty">
            You have no notifications yet.
          </p>
        )}

        <ul className="notifications-list">
          {notifications.map((n) => {
            const actorInitials = (
              n.actor_display_name ||
              n.actor_username ||
              "?"
            )
              .split(" ")
              .filter(Boolean)
              .map((x) => x[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            const isRead = !!n.is_read;

            return (
              <li
                key={n.id}
                className={`notifications-item ${
                  isRead ? "notifications-item-read" : "notifications-item-unread"
                }`}
              >
                <div className="notifications-avatar">
                  {n.actor_avatar_url ? (
                    <img
                      src={n.actor_avatar_url}
                      alt="actor avatar"
                      className="notifications-avatar-img"
                    />
                  ) : (
                    actorInitials
                  )}
                </div>

                <div className="notifications-content">
                  <div className="notifications-main-row">
                    <span className="notifications-message">
                      {buildMessage(n)}
                    </span>

                    {!isRead && (
                      <span className="notifications-badge">
                        New
                      </span>
                    )}
                  </div>

                  <div className="notifications-meta-row">
                    <span className="notifications-timestamp">
                      {new Date(n.created_at).toLocaleString()}
                    </span>

                    {!isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        className="notifications-mark-btn"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
