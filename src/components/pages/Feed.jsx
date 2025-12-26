import React, { useEffect, useState, useCallback } from "react";
import "../../styles/Feed.css";
import Comments from "./Comments"; // <- same folder

// Change base URL if your backend is hosted elsewhere
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const token = localStorage.getItem("token");

  const fetchCurrentUser = useCallback(async () => {
    if (!token) return;

    try {
      const resp = await fetch(`${API_BASE}/api/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        return;
      }

      const data = await resp.json();
      if (data.user && data.user.id) {
        setCurrentUserId(data.user.id);
      }
    } catch (err) {
      console.error("Error fetching current user:", err);
    }
  }, [token]);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${API_BASE}/api/feed`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        throw new Error(`Failed to load feed (${resp.status})`);
      }

      const data = await resp.json();
      setPosts(data.feed || []);
    } catch (err) {
      console.error("Error fetching feed:", err);
      setError(err.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setError("You are not logged in.");
      setLoading(false);
      return;
    }
    fetchCurrentUser();
    fetchFeed();
  }, [fetchFeed, fetchCurrentUser, token]);

  const handleToggleLike = async (postId) => {
    if (!token) return;

    try {
      const resp = await fetch(`${API_BASE}/api/posts/${postId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        throw new Error("Failed to toggle like");
      }

      const data = await resp.json(); // { liked, likeCount }

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: data.liked, likeCount: data.likeCount }
            : p
        )
      );
    } catch (err) {
      console.error("Like error:", err);
    }
  };

  const handleToggleFollow = async (userId) => {
    if (!token) return;
    if (currentUserId && Number(currentUserId) === Number(userId)) return;

    try {
      const resp = await fetch(`${API_BASE}/api/users/${userId}/follow`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        throw new Error("Failed to toggle follow");
      }

      const data = await resp.json(); // { following }

      setPosts((prev) =>
        prev.map((p) =>
          p.user_id === userId ? { ...p, isFollowing: data.following } : p
        )
      );
    } catch (err) {
      console.error("Follow error:", err);
    }
  };

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

  
  if (loading) {
    return (
      <div className="feed-page">
        <p>Loading feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feed-page">
        <p style={{ color: "crimson" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="feed-page feed-layout">
      {/* LEFT: Feed */}
      <div className="feed-main">
        <div className="feed-list">
          {posts.length === 0 && (
            <p style={{ color: "#6b7280" }}>
              No posts yet. Follow people or create a post.
            </p>
          )}

          {posts.map((post) => {
            const initials =
              (post.username || "?")
                .split(" ")
                .filter(Boolean)
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "?";

            const isOwnPost =
              currentUserId && Number(post.user_id) === Number(currentUserId);

            return (
              <article key={post.id} className="feed-card">
                {/* Top: username + follow/unfollow */}
                <header className="feed-card-header">
                  <div className="feed-user">
                    <div className="feed-avatar">
                      {post.avatar_url ? (
                        <img
                          src={post.avatar_url}
                          alt={post.username}
                          className="feed-avatar-img"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="feed-user-info">
                      <div className="feed-username">
                        {post.display_name || post.username}
                      </div>
                    </div>
                  </div>

                  {!isOwnPost && (
                    <button
                      className={`follow-btn ${post.isFollowing ? "following" : ""
                        }`}
                      onClick={() => handleToggleFollow(post.user_id)}
                    >
                      {post.isFollowing ? "Unfollow" : "Follow"}
                    </button>
                  )}
                </header>

                {/* Image */}
                {post.image_url && (
                  <div className="feed-image-wrapper">
                    <img
                      src={post.image_url}
                      alt="post"
                      className="feed-image"
                    />
                  </div>
                )}

                {/* Like / comment row */}
                <div className="feed-actions">
                  <button
                    className={`like-btn ${post.isLiked ? "liked" : ""}`}
                    onClick={() => handleToggleLike(post.id)}
                  >
                    {post.isLiked ? "❤️" : "🤍"}
                    {post.likeCount || 0}
                  </button>

                  <button
                    className="comment-btn"
                    onClick={() =>
                      setSelectedPost((prev) =>
                        prev && prev.id === post.id ? null : post
                      )
                    }
                  >
                    💬 {post.commentCount || 0}
                  </button>
                </div>

                {/* Description */}
                {post.content && (
                  <p className="feed-description">{post.content}</p>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Comments panel — only rendered when a post is selected */}
      {selectedPost && <Comments postId={selectedPost.id} post={selectedPost} />}
    </div>
  );
}
