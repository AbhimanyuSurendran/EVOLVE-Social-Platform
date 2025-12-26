import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // ⬅️ added
import "../../styles/Users.css";
import Comments from "./Comments.jsx"; // ⬅️ reuse your Comments component

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function Users() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null); // { user, posts }
  const [profileError, setProfileError] = useState("");

  const [currentUserId, setCurrentUserId] = useState(null);

  const token = localStorage.getItem("token");

  /* ===============================
     Fetch current user id (for self check)
     =============================== */
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.user && data.user.id) {
          setCurrentUserId(data.user.id);
        }
      } catch (err) {
        console.error("Users: /api/me error", err);
      }
    })();
  }, [token]);

  /* ===============================
     LIVE SEARCH (search-as-you-type)
     =============================== */
  useEffect(() => {
    if (!token) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setUsers([]);
      setSearchError("");
      return;
    }

    const delay = setTimeout(async () => {
      try {
        setSearching(true);
        setSearchError("");

        const resp = await fetch(
          `${API_BASE}/api/users/search?q=${encodeURIComponent(trimmed)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.message || "Search failed");
        }

        const data = await resp.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error("User search error:", err);
        setSearchError(err.message || "Error searching users.");
      } finally {
        setSearching(false);
      }
    }, 300); // debounce

    return () => clearTimeout(delay);
  }, [query, token]);

  /* ===============================
     Load selected user profile
     =============================== */
  const handleSelectUser = async (userId) => {
    if (!token) return;

    setSelectedProfile(null);
    setProfileError("");

    try {
      const resp = await fetch(`${API_BASE}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load user profile");
      }

      const data = await resp.json(); // { user, posts }
      setSelectedProfile(data);
    } catch (err) {
      console.error("Load user profile error:", err);
      setProfileError(err.message || "Error loading user profile.");
    }
  };

  /* ===============================
     Follow / Unfollow
     =============================== */
  const handleToggleFollow = async (userId, source = "list") => {
    if (!token) return;
    if (currentUserId && Number(currentUserId) === Number(userId)) return;

    try {
      const resp = await fetch(`${API_BASE}/api/users/${userId}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to toggle follow");
      }

      const data = await resp.json(); // { following: true/false }

      // update in search list
      if (source === "list") {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, isFollowing: data.following } : u
          )
        );
      }

      // update in profile view
      if (source === "profile" && selectedProfile && selectedProfile.user) {
        if (selectedProfile.user.id === userId) {
          setSelectedProfile((prev) => {
            if (!prev) return prev;
            const diff =
              data.following === true
                ? 1
                : prev.user.isFollowing
                ? -1
                : 0;

            return {
              ...prev,
              user: {
                ...prev.user,
                isFollowing: data.following,
                followersCount: (prev.user.followersCount || 0) + diff,
              },
            };
          });
        }
      }

      // also reflect in list no matter what
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isFollowing: data.following } : u
        )
      );
    } catch (err) {
      console.error("Follow toggle error:", err);
      alert(err.message || "Error toggling follow");
    }
  };

  const handleBackToSearch = () => {
    setSelectedProfile(null);
    setProfileError("");
  };

  /* ===============================
     If profile selected → show UserProfile
     =============================== */
  if (selectedProfile && selectedProfile.user) {
    return (
      <UserProfileView
        data={selectedProfile}
        onBack={handleBackToSearch}
        currentUserId={currentUserId}
        onToggleFollow={handleToggleFollow}
        error={profileError}
      />
    );
  }

  /* ===============================
     SEARCH VIEW
     =============================== */
  return (
    <div className="feed-page users-page">
      <div className="users-shell">
        <h2 className="feed-title users-title">Search Users</h2>

        <div className="users-search-wrapper">
          <input
            type="text"
            placeholder="Search by username or display name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="users-search-input"
          />
          {searching && (
            <p className="users-search-meta users-search-meta--info">
              Searching...
            </p>
          )}
          {searchError && (
            <p className="users-search-meta users-search-meta--error">
              {searchError}
            </p>
          )}
        </div>

        {!searching && query && users.length === 0 && !searchError && (
          <p className="users-empty-text">No users found.</p>
        )}

        <div className="users-list">
          {users.map((u) => {
            const initials =
              (u.display_name || u.username || "?")
                .split(" ")
                .filter(Boolean)
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "?";

            const isOwn =
              currentUserId && Number(currentUserId) === Number(u.id);

            return (
              <div key={u.id} className="users-item">
                {/* Left: avatar + name */}
                <div
                  className="users-item-left"
                  onClick={() => handleSelectUser(u.id)}
                >
                  <div className="users-avatar">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.username}
                        className="users-avatar-img"
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  <div className="users-item-main">
                    <span className="users-item-username">
                      {u.display_name || u.username}
                    </span>
                    <span className="users-item-handle">@{u.username}</span>
                  </div>
                </div>

                {/* Right: Follow / Unfollow, if not me */}
                {!isOwn && (
                  <div className="users-item-actions">
                    <button
                      className={`users-follow-btn ${
                        u.isFollowing ? "following" : ""
                      }`}
                      onClick={() => handleToggleFollow(u.id, "list")}
                    >
                      {u.isFollowing ? "Unfollow" : "Follow"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ==================================================
   USER PROFILE VIEW (READ-ONLY, WITH FOLLOW + MESSAGE)
   ================================================== */
function UserProfileView({
  data,
  onBack,
  currentUserId,
  onToggleFollow,
  error,
}) {
  const navigate = useNavigate(); // ⬅️ added
  const u = data.user;
  const posts = data.posts || [];

  const [selectedPost, setSelectedPost] = useState(null);
  const [isPostOverlayOpen, setIsPostOverlayOpen] = useState(false);

  // NEW: right-click context menu + comments modal
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    post: null,
  });
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentPost, setCommentPost] = useState(null);

  const initials =
    (u.display_name || u.username || "?")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const isOwn = currentUserId && Number(currentUserId) === Number(u.id);

  const handlePostClick = (post) => {
    setSelectedPost(post);
    setIsPostOverlayOpen(true);
  };

  const closePostOverlay = () => {
    setIsPostOverlayOpen(false);
    setSelectedPost(null);
  };

  // Right-click → show context menu with "Comment"
  const handlePostContextMenu = (e, post) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      post,
    });
  };

  const handleOpenComments = () => {
    if (!contextMenu.post) return;
    setCommentPost(contextMenu.post);
    setIsCommentsOpen(true);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // Close context menu on any global click
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu((prev) =>
        prev.visible ? { ...prev, visible: false } : prev
      );
    };

    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const closeCommentsModal = () => {
    setIsCommentsOpen(false);
    setCommentPost(null);
  };

  // ✅ Message button handler
  const handleMessageClick = () => {
    navigate(`/messages?userId=${u.id}`);
  };

  return (
    <div className="feed-page users-page profile-page">
      <div className="users-shell">
        {error && <p className="users-error-text">{error}</p>}

        <button className="users-back-btn" onClick={onBack}>
          ← Back to search
        </button>

        <div className="profile-header">
          <div className="profile-avatar-wrap">
            {u.avatar_url ? (
              <img
                src={u.avatar_url}
                alt="avatar"
                className="profile-avatar-img"
              />
            ) : (
              <div className="profile-avatar-circle">{initials}</div>
            )}
          </div>

          <div className="profile-main-info">
            <div className="profile-name-row">
              <div className="profile-name-block">
                <h2 className="profile-display-name">
                  {u.display_name || u.username}
                </h2>
                <p className="profile-username">@{u.username}</p>
              </div>
            </div>

            <div className="profile-counts">
              <div className="profile-count-box">
                <span className="profile-count-number">
                  {u.postsCount || 0}
                </span>
                <span className="profile-count-label">Posts</span>
              </div>
              <div className="profile-count-box">
                <span className="profile-count-number">
                  {u.followersCount || 0}
                </span>
                <span className="profile-count-label">Followers</span>
              </div>
              <div className="profile-count-box">
                <span className="profile-count-number">
                  {u.followingCount || 0}
                </span>
                <span className="profile-count-label">Following</span>
              </div>
            </div>

            <div className="profile-bio">
              {u.bio ? (
                <p>{u.bio}</p>
              ) : (
                <p className="profile-bio-placeholder">
                  This user hasn&apos;t added a bio yet.
                </p>
              )}
            </div>

            {/* Profile link */}
            {u.profile_link && (
              <div className="profile-link-display">
                <a
                  href={u.profile_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {u.profile_link_type
                    ? `${u.profile_link_type.toUpperCase()} Profile`
                    : "Profile Link"}
                </a>
              </div>
            )}

            {/* Follow + Message (if not own profile) */}
            {!isOwn && (
              <div className="profile-actions-row">
                <button
                  className={`profile-edit-btn ${
                    u.isFollowing ? "following" : ""
                  }`}
                  onClick={() => onToggleFollow(u.id, "profile")}
                >
                  {u.isFollowing ? "Unfollow" : "Follow"}
                </button>

                <button
                  type="button"
                  className="profile-message-btn"
                  onClick={handleMessageClick}
                >
                  Message
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="profile-posts-section">
          <h3 className="profile-posts-title">Posts</h3>

          {posts.length === 0 ? (
            <p className="users-no-posts-text">
              This user hasn&apos;t posted anything yet.
            </p>
          ) : (
            <div className="profile-posts-grid">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="profile-post-tile"
                  onClick={() => handlePostClick(post)} // LEFT CLICK → overlay
                  onContextMenu={(e) => handlePostContextMenu(e, post)} // RIGHT CLICK → "Comment"
                >
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt="post"
                      className="profile-post-img"
                    />
                  ) : (
                    <div className="profile-post-text-tile">
                      <p>{post.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* POST OVERLAY (view image + description) */}
      {isPostOverlayOpen && selectedPost && (
        <div className="profile-post-overlay" onClick={closePostOverlay}>
          <div
            className="profile-post-overlay-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="profile-overlay-close-btn"
              type="button"
              onClick={closePostOverlay}
            >
              ✕
            </button>

            {selectedPost.image_url && (
              <img
                src={selectedPost.image_url}
                alt="post"
                className="profile-post-overlay-image"
              />
            )}

            <div className="profile-post-overlay-text">
              <h4>Post Description</h4>
              <p>{selectedPost.content || "No description provided."}</p>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT-CLICK CONTEXT MENU (Comment) */}
      {contextMenu.visible && (
        <ul
          className="profile-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <li onClick={handleOpenComments}>Comment</li>
        </ul>
      )}

      {/* COMMENTS MODAL */}
      {isCommentsOpen && commentPost && (
        <div className="profile-post-overlay" onClick={closeCommentsModal}>
          <div
            className="profile-post-overlay-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="profile-overlay-close-btn"
              type="button"
              onClick={closeCommentsModal}
            >
              ✕
            </button>

            <h4 style={{ marginBottom: "8px" }}>Comments</h4>
            <Comments postId={commentPost.id} />
          </div>
        </div>
      )}
    </div>
  );
}
