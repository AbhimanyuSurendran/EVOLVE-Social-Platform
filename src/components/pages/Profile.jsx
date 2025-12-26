import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import "../../styles/Profile.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// same Cloudinary config as Post.jsx
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");

  // NEW: profile link state
  const [editProfileLinkType, setEditProfileLinkType] = useState("");
  const [editProfileLink, setEditProfileLink] = useState("");

  // avatar upload state
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isAvatarDragActive, setIsAvatarDragActive] = useState(false);
  const avatarInputRef = useRef(null);

  // post overlay + context menu state
  const [selectedPost, setSelectedPost] = useState(null); // for overlay
  const [isPostOverlayOpen, setIsPostOverlayOpen] = useState(false);

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    post: null,
  });

  const [editingPost, setEditingPost] = useState(null);
  const [editPostContent, setEditPostContent] = useState("");

  const token = localStorage.getItem("token");

  const fetchProfile = useCallback(async () => {
    if (!token) {
      setError("You are not logged in.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/api/profile/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        const msg = data?.message || "Failed to load profile";
        throw new Error(msg);
      }

      setProfile(data.user);
      setPosts(data.posts || []);

      setEditDisplayName(data.user.display_name || "");
      setEditBio(data.user.bio || "");
      setEditAvatarUrl(data.user.avatar_url || "");
      setAvatarPreview(data.user.avatar_url || "");

      // NEW: populate profile link fields
      setEditProfileLinkType(data.user.profile_link_type || "");
      setEditProfileLink(data.user.profile_link || "");
    } catch (err) {
      console.error("Profile load error:", err);
      setError(err.message || "Error loading profile");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Close custom context menu when clicking anywhere
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu((prev) =>
        prev.visible ? { ...prev, visible: false } : prev
      );
    };

    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const uploadAvatarToCloudinary = async (file) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      throw new Error(
        "Cloudinary config missing. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET."
      );
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const resp = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!resp.ok) {
      console.error("Avatar upload error:", await resp.text());
      throw new Error("Failed to upload avatar image");
    }

    const data = await resp.json();
    return data.secure_url; // stored in users.avatar_url
  };

  // Helper to process a selected/dropped avatar file
  const processAvatarFile = (file) => {
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file)); // live preview
    // when using file, ignore manual URL field
    setEditAvatarUrl("");
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAvatarFile(null);
      setAvatarPreview(editAvatarUrl || profile?.avatar_url || "");
      return;
    }
    processAvatarFile(file);
  };

  // Drag & drop handlers for avatar
  const handleAvatarDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAvatarDragActive(true);
  };

  const handleAvatarDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAvatarDragActive(false);
  };

  const handleAvatarDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAvatarDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAvatarFile(file);
    }
  };

  const handleAvatarDropClick = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!token) {
      setError("You are not logged in.");
      return;
    }

    try {
      setError("");

      // If a new file is selected, upload to Cloudinary first
      let finalAvatarUrl = editAvatarUrl;

      if (avatarFile) {
        finalAvatarUrl = await uploadAvatarToCloudinary(avatarFile);
      }

      const resp = await fetch(`${API_BASE}/api/profile/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: editDisplayName,
          bio: editBio,
          avatar_url: finalAvatarUrl || null,
          profile_link_type: editProfileLinkType || null,
          profile_link: editProfileLink || null,
        }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        const msg = data?.message || "Failed to update profile";
        throw new Error(msg);
      }

      // update profile with latest values from backend
      setProfile((prev) => ({
        ...prev,
        ...data.user,
      }));

      // sync local edit state with saved values
      setEditAvatarUrl(data.user.avatar_url || "");
      setAvatarPreview(data.user.avatar_url || "");
      setAvatarFile(null);

      setEditProfileLinkType(data.user.profile_link_type || "");
      setEditProfileLink(data.user.profile_link || "");

      setIsEditing(false);
    } catch (err) {
      console.error("Profile update error:", err);
      setError(err.message || "Error updating profile");
    }
  };

  // ====== post overlay + context menu handlers ======

  // Left click → open overlay
  const handlePostClick = (post) => {
    setSelectedPost(post);
    setIsPostOverlayOpen(true);
    // also hide context menu if open
    setContextMenu((prev) =>
      prev.visible ? { ...prev, visible: false } : prev
    );
  };

  const closePostOverlay = () => {
    setIsPostOverlayOpen(false);
    setSelectedPost(null);
  };

  // Right click → show context menu
  const handlePostContextMenu = (e, post) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      post,
    });
  };

  // Edit description option
  const startEditPostDescription = () => {
    if (!contextMenu.post) return;
    setEditingPost(contextMenu.post);
    setEditPostContent(contextMenu.post.content || "");
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleSavePostDescription = async (e) => {
    e.preventDefault();
    if (!token) {
      setError("You are not logged in.");
      return;
    }
    if (!editingPost) return;

    try {
      setError("");

      const resp = await fetch(`${API_BASE}/api/posts/${editingPost.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editPostContent }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        const msg = data?.message || "Failed to update post";
        throw new Error(msg);
      }

      const updated = data?.post || { ...editingPost, content: editPostContent };

      setPosts((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );

      // if overlay is open and this is the selected post, update it too
      setSelectedPost((prev) =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev
      );

      setEditingPost(null);
      setEditPostContent("");
    } catch (err) {
      console.error("Post update error:", err);
      setError(err.message || "Error updating post description");
    }
  };

  // Delete post option
  const handleDeletePost = async () => {
    if (!token) {
      setError("You are not logged in.");
      return;
    }
    if (!contextMenu.post) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this post?"
    );
    if (!confirmDelete) {
      setContextMenu((prev) => ({ ...prev, visible: false }));
      return;
    }

    try {
      setError("");

      const resp = await fetch(
        `${API_BASE}/api/posts/${contextMenu.post.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        const msg = data?.message || "Failed to delete post";
        throw new Error(msg);
      }

      // Remove from local state
      setPosts((prev) =>
        prev.filter((p) => p.id !== contextMenu.post.id)
      );

      // If that post was open in overlay, close it
      if (selectedPost && selectedPost.id === contextMenu.post.id) {
        setSelectedPost(null);
        setIsPostOverlayOpen(false);
      }

      setContextMenu((prev) => ({ ...prev, visible: false }));
    } catch (err) {
      console.error("Post delete error:", err);
      setError(err.message || "Error deleting post");
    }
  };

  if (loading) {
    return (
      <div className="feed-page">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="feed-page">
        <p style={{ color: "crimson" }}>{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="feed-page">
        <p>No profile data.</p>
      </div>
    );
  }

  const initials =
    (profile.display_name || profile.username || "?")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <div className="feed-page profile-page">
      {error && (
        <p style={{ color: "crimson", marginBottom: "8px" }}>{error}</p>
      )}

      {/* HEADER */}
      <div className="profile-header">
        <div className="profile-avatar-wrap">
          {avatarPreview || profile.avatar_url ? (
            <img
              src={avatarPreview || profile.avatar_url}
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
                {profile.display_name || profile.username}
              </h2>
              <p className="profile-username">@{profile.username}</p>
            </div>
          </div>

          <div className="profile-counts">
            <div className="profile-count-box">
              <span className="profile-count-number">
                {profile.postsCount || 0}
              </span>
              <span className="profile-count-label">Posts</span>
            </div>
            <div className="profile-count-box">
              <span className="profile-count-number">
                {profile.followersCount || 0}
              </span>
              <span className="profile-count-label">Followers</span>
            </div>
            <div className="profile-count-box">
              <span className="profile-count-number">
                {profile.followingCount || 0}
              </span>
              <span className="profile-count-label">Following</span>
            </div>
          </div>

          <div className="profile-bio">
            {profile.bio ? (
              <p>{profile.bio}</p>
            ) : (
              <p className="profile-bio-placeholder">
                Add a short bio about yourself…
              </p>
            )}
          </div>

          {/* Display profile link if available */}
          {profile.profile_link && (
            <div className="profile-link-display">
              <a
                href={profile.profile_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {profile.profile_link_type
                  ? `${profile.profile_link_type.toUpperCase()} Profile`
                  : "Profile Link"}
              </a>
            </div>
          )}

          {/* Edit button below bio */}
          <button
            className="profile-edit-btn"
            onClick={() => setIsEditing((prev) => !prev)}
          >
            {isEditing ? "Cancel" : "Edit Profile"}
          </button>
        </div>
      </div>

      {/* EDIT FORM */}
      {isEditing && (
        <form className="profile-edit-form" onSubmit={handleSaveProfile}>
          <div className="profile-edit-grid">
            {/* LEFT COLUMN */}
            <div className="profile-edit-left">
              <div className="profile-edit-row">
                <label className="profile-edit-label">Display Name</label>
                <input
                  className="profile-edit-input"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>

              <div className="profile-edit-row">
                <label className="profile-edit-label">Bio</label>
                <textarea
                  className="profile-edit-textarea"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell something about yourself"
                />
              </div>

              {/* Avatar upload with drop zone */}
              <div className="profile-edit-row">
                <label className="profile-edit-label">Profile Picture</label>

                <div
                  className={`profile-avatar-dropzone ${
                    isAvatarDragActive ? "drag-active" : ""
                  }`}
                  onDragOver={handleAvatarDragOver}
                  onDragLeave={handleAvatarDragLeave}
                  onDrop={handleAvatarDrop}
                  onClick={handleAvatarDropClick}
                >
                  {avatarPreview || profile.avatar_url ? (
                    <div className="profile-avatar-dropzone-preview">
                      <img
                        src={avatarPreview || profile.avatar_url}
                        alt="preview"
                      />
                    </div>
                  ) : (
                    <div className="profile-avatar-dropzone-placeholder">
                      <span className="profile-avatar-dropzone-icon">📁</span>
                      <p>Drag &amp; drop your picture here</p>
                      <span>or click to browse</span>
                    </div>
                  )}
                </div>

                {/* hidden file input */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="profile-avatar-file-input"
                />

                <small style={{ fontSize: "12px", color: "#6b7280" }}>
                  Drop an image or choose a file. If you don&apos;t pick a new
                  file, the existing picture will stay.
                </small>
              </div>

              {/* Optional: raw avatar URL */}
              <div className="profile-edit-row">
                <label className="profile-edit-label">
                  Avatar URL (optional)
                </label>
                <input
                  className="profile-edit-input"
                  value={editAvatarUrl}
                  onChange={(e) => {
                    setEditAvatarUrl(e.target.value);
                    if (!avatarFile) setAvatarPreview(e.target.value);
                  }}
                  placeholder="Paste image URL or leave blank"
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="profile-edit-right">
              <div className="profile-edit-row profile-link-row">
                <label className="profile-edit-label">Profile Link</label>

                <select
                  className="profile-edit-select"
                  value={editProfileLinkType}
                  onChange={(e) => setEditProfileLinkType(e.target.value)}
                >
                  <option value="">Select platform</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="twitter">Twitter</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="github">GitHub</option>
                </select>

                <textarea
                  className="profile-edit-textarea profile-link-textarea"
                  value={editProfileLink}
                  onChange={(e) => setEditProfileLink(e.target.value)}
                  placeholder="Paste your profile link here"
                />
              </div>
            </div>
          </div>

          <button type="submit" className="profile-save-btn">
            Save
          </button>
        </form>
      )}

      {/* POSTS GRID */}
      <div className="profile-posts-section">
        <h3 className="profile-posts-title">Posts</h3>

        {posts.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            You haven&apos;t posted anything yet.
          </p>
        ) : (
          <div className="profile-posts-grid">
            {posts.map((post) => (
              <div
                key={post.id}
                className="profile-post-tile"
                onClick={() => handlePostClick(post)} // LEFT CLICK
                onContextMenu={(e) => handlePostContextMenu(e, post)} // RIGHT CLICK
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

      {/* POST OVERLAY */}
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

      {/* CONTEXT MENU (RIGHT CLICK) */}
      {contextMenu.visible && (
        <ul
          className="profile-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <li onClick={startEditPostDescription}>Edit description</li>
          <li onClick={handleDeletePost}>Delete post</li>
        </ul>
      )}

      {/* EDIT POST DESCRIPTION MODAL */}
      {editingPost && (
        <div
          className="profile-post-overlay"
          onClick={() => {
            setEditingPost(null);
            setEditPostContent("");
          }}
        >
          <form
            className="profile-post-edit-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSavePostDescription}
          >
            <h4>Edit Post Description</h4>
            <textarea
              className="profile-edit-textarea"
              value={editPostContent}
              onChange={(e) => setEditPostContent(e.target.value)}
              placeholder="Update your post description"
            />
            <div className="profile-post-edit-actions">
              <button
                type="button"
                className="profile-edit-cancel-btn"
                onClick={() => {
                  setEditingPost(null);
                  setEditPostContent("");
                }}
              >
                Cancel
              </button>
              <button type="submit" className="profile-save-btn">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
