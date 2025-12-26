// src/features/Post/Post.jsx
import React, { useState } from "react";
import "../../styles/Post.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const MAX_CAPTION_LENGTH = 280;

export default function Post() {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const token = localStorage.getItem("token");

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview("");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview("");
  };

  const handleCaptionChange = (e) => {
    const value = e.target.value;
    // Soft limit for caption length (like Twitter style)
    if (value.length <= MAX_CAPTION_LENGTH) {
      setContent(value);
    }
  };

  const uploadToCloudinary = async (file) => {
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
      console.error("Cloudinary upload error:", await resp.text());
      throw new Error("Image upload failed");
    }

    const data = await resp.json();
    return data.secure_url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!token) {
      setError("You must be logged in to post.");
      return;
    }

    // ✅ Image is required
    if (!imageFile) {
      setError("Please select an image. Image is required to create a post.");
      return;
    }

    try {
      setSubmitting(true);

      // 1) Upload image to Cloudinary
      const uploadedImageURL = await uploadToCloudinary(imageFile);

      // 2) Create post
      const resp = await fetch(`${API_BASE}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: content.trim() || null,
          image_url: uploadedImageURL,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to create post");
      }

      await resp.json();

      setSuccessMsg("Post created successfully 🎉");
      setContent("");
      setImageFile(null);
      setImagePreview("");
    } catch (err) {
      console.error("Create post error:", err);
      setError(err.message || "Error creating post.");
    } finally {
      setSubmitting(false);
    }
  };


  
  return (
    <div className="feed-page post-page">

      <form className="post-form-card" onSubmit={handleSubmit}>
        {/* Header area like social platforms */}        
            <h2 className="feed-title">Create Post</h2>

        <div className="post-card-header">    

          <div className="post-avatar-circle">
            <span className="post-avatar-initial">POST</span>
          </div>
          <div className="post-header-text">
            <p className="post-header-title">Share something new</p>
            <p className="post-header-subtitle">
              Drop a photo and tell your story ✨
            </p>
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="post-alert post-alert-error">{error}</div>}
        {successMsg && (
          <div className="post-alert post-alert-success">{successMsg}</div>
        )}



        {/* Image upload */}
        <div className="post-form-group">
          <label className="post-label">
            Image <span className="post-required-star">*</span>
          </label>

          <label
            htmlFor="post-image-input"
            className={`post-upload-area ${
              imagePreview ? "has-image" : ""
            }`}
          >
            {!imagePreview && (
              <div className="post-upload-placeholder">
                <div className="post-upload-icon">📷</div>
                <div className="post-upload-text">
                  <span className="post-upload-title">
                    Drag & drop an image here
                  </span>
                  <span className="post-upload-subtitle">
                    or <span className="post-upload-browse">browse files</span>
                  </span>
                  <span className="post-upload-hint">
                    Supported: JPG, PNG, GIF
                  </span>
                </div>
              </div>
            )}

            {imagePreview && (
              <div className="post-upload-has-image-text">
                <span>Change image</span>
                <span className="post-upload-change-hint">Click to reselect</span>
              </div>
            )}
          </label>

          <input
            id="post-image-input"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="post-file-input"
            required
          />

          {imagePreview && (
            <div className="post-image-preview">
              <img src={imagePreview} alt="preview" />
              <button
                type="button"
                className="post-remove-image-btn"
                onClick={handleRemoveImage}
              >
                ✕
              </button>
            </div>
          )}

          {imageFile && (
            <p className="post-image-name">Selected: {imageFile.name}</p>
          )}
        </div>
                {/* Caption */}
        <div className="post-form-group">
          <label className="post-label">Caption (optional)</label>
          <div className="post-textarea-wrapper">
            <textarea
              className="post-textarea"
              placeholder="What's on your mind?"
              value={content}
              onChange={handleCaptionChange}
            />
            <div className="post-caption-meta">
              <span className="post-caption-hint">
                Tip: Add a short caption for better engagement.
              </span>
              <span
                className={
                  content.length > MAX_CAPTION_LENGTH - 30
                    ? "post-char-count post-char-count-warning"
                    : "post-char-count"
                }
              >
                {content.length}/{MAX_CAPTION_LENGTH}
              </span>
            </div>
          </div>
        </div>

        {/* Footer row + button */}
        <div className="post-footer-row">
          <span className="post-required-note">
            <span className="post-required-dot" /> Image is required to post.
          </span>

          <button
            type="submit"
            className="post-submit-btn"
            disabled={submitting}
          >
            {submitting && <span className="post-btn-spinner" />}
            {submitting ? "Posting..." : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
}
