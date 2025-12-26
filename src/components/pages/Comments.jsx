import React, { useEffect, useState, useCallback } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function Comments({ postId, post }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // 👈 for permissions

  const token = localStorage.getItem("token");

  // Fetch current user (for delete permissions)
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!resp.ok) {
          console.error("Failed to fetch current user", resp.status);
          return;
        }

        const data = await resp.json();
        setCurrentUser(data.user || null);
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    })();
  }, [token]);

  const fetchComments = useCallback(async () => {
    if (!postId || !token) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        throw new Error(`Failed to load comments (${resp.status})`);
      }

      const data = await resp.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error("Error fetching comments:", err);
      setError(err.message || "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId, token]);

  useEffect(() => {
    setComments([]);
    setNewComment("");
    if (postId) {
      fetchComments();
    }
  }, [postId, fetchComments]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!token || !postId) return;
    if (!newComment.trim()) return;

    try {
      const resp = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (!resp.ok) {
        throw new Error("Failed to add comment");
      }

      const data = await resp.json(); // { comment }

      // Append new comment
      setComments((prev) => [...prev, data.comment]);
      setNewComment("");
    } catch (err) {
      console.error("Add comment error:", err);
      setError(err.message || "Failed to add comment");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!token || !postId) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this comment?"
    );
    if (!confirmDelete) return;

    try {
      const resp = await fetch(
        `${API_BASE}/api/posts/${postId}/comments/${commentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        const msg = data?.message || "Failed to delete comment";
        throw new Error(msg);
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error("Delete comment error:", err);
      setError(err.message || "Failed to delete comment");
    }
  };

  // Helper: can current user delete this comment?
  const canDeleteComment = (comment) => {
    if (!currentUser) return false;
    // ONLY comment owner can delete
    return Number(comment.user_id) === Number(currentUser.id);
  };

  if (!postId) {
    return (
      <aside className="comments-panel">
        <p style={{ color: "#6b7280" }}>Select a post to view comments.</p>
      </aside>
    );
  }

  return (
    <aside className="comments-panel">
      <div className="comments-header">
        <h3>Comments</h3>
        {post && (
          <p className="comments-post-snippet">
            On: <strong>{post.display_name || post.username}</strong>'s post
          </p>
        )}
      </div>

      <form className="comment-form" onSubmit={handleAddComment}>
        <textarea
          className="comment-input"
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button className="comment-submit-btn" type="submit">
          Post Comment
        </button>
      </form>

      {loading && <p>Loading comments...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div className="comments-list">
        {comments.length === 0 && !loading && (
          <p style={{ color: "#6b7280" }}>No comments yet. Be the first!</p>
        )}

        {comments.map((c) => {
          const initials =
            (c.username || "?")
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2) || "?";

          return (
            <div key={c.id} className="comment-item">
              <div className="comment-avatar">{initials}</div>
              <div className="comment-body">
                <div className="comment-meta">
                  <span className="comment-username">
                    {c.display_name || c.username}
                  </span>
                  <span className="comment-time">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                  {canDeleteComment(c) && (
                    <button
                      type="button"
                      className="comment-delete-btn"
                      onClick={() => handleDeleteComment(c.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="comment-text">{c.content}</div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
