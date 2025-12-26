// server.js (put this in social-platform/backend/server.js)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const path = require("path");
const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

/**
 * MySQL pool (single-file backend)
 * Configure via .env or hardcode dev defaults below.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "social_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const JWT_SECRET = process.env.JWT_SECRET || "please_change_me";
const SALT_ROUNDS = 10;














/* =====================================================================
 * AUTHENTICATION ROUTES
 * ===================================================================== */
// register new application user
app.post(
  "/api/auth/register",
  [
    body("username").isLength({ min: 3 }).trim(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res
        .status(400)
        .json({ message: "Invalid input", errors: errors.array() });

    const { username, email, password } = req.body;
    try {
      const [existing] = await pool.query(
        "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
        [username, email]
      );
      if (existing.length)
        return res
          .status(409)
          .json({ message: "Username or email already in use" });

      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      const [result] = await pool.query(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        [username, email, hashed]
      );

      const token = jwt.sign(
        { id: result.insertId, username },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        message: "User created",
        token,
        user: { id: result.insertId, username, email },
      });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// login for application users
app.post(
  "/api/auth/login",
  [body("email").isEmail(), body("password").exists()],
  async (req, res) => {
    const { email, password } = req.body;
    try {
      const [rows] = await pool.query(
        "SELECT id, username, password_hash FROM users WHERE email = ? LIMIT 1",
        [email]
      );
      if (!rows.length)
        return res.status(401).json({ message: "Invalid credentials" });

      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Reset password (called AFTER OTP verification on frontend)
app.post(
  "/api/auth/reset-password",
  [
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const [rows] = await pool.query(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email]
      );
      if (!rows.length) {
        return res.status(404).json({ message: "User not found" });
      }

      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      await pool.query(
        "UPDATE users SET password_hash = ? WHERE email = ?",
        [hashed, email]
      );

      res.json({ message: "Password reset successful" });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);


// Example authenticated route (uses Authorization: Bearer <token>)
 
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "No token" });
  const parts = auth.split(" ");
  if (parts.length !== 2)
    return res.status(401).json({ message: "Invalid token format" });

  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, email, bio, avatar_url, created_at FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});












/* =====================================================================
 * FEED.JSX file routes
 * ===================================================================== */
// fetch feed posts with like/comment counts and isLiked/isFollowing
app.get("/api/feed", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const [rows] = await pool.query(
      `
      SELECT
        p.id,
        p.user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        p.content,
        p.image_url,
        p.created_at,

        -- total likes for this post
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likeCount,

        -- total comments for this post
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount,

        -- has current user liked this post
        EXISTS(
          SELECT 1 FROM likes l2
          WHERE l2.post_id = p.id AND l2.user_id = ?
        ) AS isLiked,

        -- is current user following the author of this post
        EXISTS(
          SELECT 1 FROM followers f
          WHERE f.follower_id = ? AND f.following_id = p.user_id
        ) AS isFollowing
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?;
      `,
      [currentUserId, currentUserId, limit, offset]
    );

    const feed = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      content: row.content,
      image_url: row.image_url,
      created_at: row.created_at,
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      isLiked: !!row.isLiked,       // convert 0/1 -> true/false
      isFollowing: !!row.isFollowing,
    }));

    res.json({ feed });
  } catch (err) {
    console.error("Error fetching feed:", err.message, err);
    res
      .status(500)
      .json({ message: "Error fetching feed", error: err.message });
  }
});

// fetch single post by id with like/comment counts and isLiked/isFollowing
app.post("/api/posts/:postId/like", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const postId = parseInt(req.params.postId, 10);

  if (!postId) {
    return res.status(400).json({ message: "Invalid post id" });
  }

  try {
    // 1) Get post + owner
    const [postRows] = await pool.query(
      "SELECT id, user_id FROM posts WHERE id = ? LIMIT 1",
      [postId]
    );

    if (!postRows.length) {
      return res.status(404).json({ message: "Post not found" });
    }

    const post = postRows[0]; // post.user_id = owner id

    // 2) Check if already liked
    const [rows] = await pool.query(
      "SELECT id FROM likes WHERE user_id = ? AND post_id = ?",
      [currentUserId, postId]
    );

    if (rows.length > 0) {
      // ====== UNLIKE ======
      await pool.query("DELETE FROM likes WHERE id = ?", [rows[0].id]);

      // Try to delete notification for this like
      try {
        await pool.query(
          `
          DELETE FROM notifications
          WHERE type = 'like'
            AND actor_id = ?
            AND post_id = ?;
          `,
          [currentUserId, postId]
        );
      } catch (notifErr) {
        console.error("Error deleting like notification:", notifErr);
      }

      const [[{ count }]] = await pool.query(
        "SELECT COUNT(*) AS count FROM likes WHERE post_id = ?",
        [postId]
      );

      return res.json({
        liked: false,
        likeCount: count,
      });
    } else {
      // ====== LIKE ======
      await pool.query(
        "INSERT INTO likes (user_id, post_id) VALUES (?, ?)",
        [currentUserId, postId]
      );

      // Try to insert notification for post owner (even if self-like, if you want)
      try {
        // If you want to SKIP self-like notifications, uncomment this:
        // if (Number(post.user_id) !== Number(currentUserId)) { ... }

        await pool.query(
          `
          INSERT INTO notifications (user_id, actor_id, type, post_id, is_read)
          VALUES (?, ?, 'like', ?, FALSE);
          `,
          [post.user_id, currentUserId, postId]
        );
      } catch (notifErr) {
        console.error("Error inserting like notification:", notifErr);
        // we don't throw here so like still succeeds
      }

      const [[{ count }]] = await pool.query(
        "SELECT COUNT(*) AS count FROM likes WHERE post_id = ?",
        [postId]
      );

      return res.json({
        liked: true,
        likeCount: count,
      });
    }
  } catch (err) {
    console.error("Error toggling like:", err);
    res.status(500).json({ message: "Error toggling like" });
  }
});



// get follow status for a user
app.get(
  "/api/users/:userId/follow-status",
  authMiddleware,
  async (req, res) => {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (!targetUserId || targetUserId === currentUserId) {
      return res.status(400).json({ message: "Invalid target user" });
    }

    try {
      const [rows] = await pool.query(
        "SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ? LIMIT 1",
        [currentUserId, targetUserId]
      );

      const following = rows.length > 0;

      return res.json({ following });
    } catch (err) {
      console.error("Error checking follow status:", err);
      return res
        .status(500)
        .json({ message: "Error checking follow status" });
    }
  }
);

// check follow / unfollow: POST /api/users/:userId/follow
app.post("/api/users/:userId/follow", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const targetUserId = parseInt(req.params.userId, 10);

  if (!targetUserId || targetUserId === currentUserId) {
    return res.status(400).json({ message: "Invalid target user" });
  }

  try {
    // Check if follow exists
    const [rows] = await pool.query(
      "SELECT id FROM followers WHERE follower_id = ? AND following_id = ?",
      [currentUserId, targetUserId]
    );

    if (rows.length > 0) {
      // ====== UNFOLLOW ======

      await pool.query("DELETE FROM followers WHERE id = ?", [rows[0].id]);

      // Remove follow notification
      await pool.query(
        `
        DELETE FROM notifications
        WHERE type = 'follow'
          AND actor_id = ?
          AND user_id = ?;
        `,
        [currentUserId, targetUserId]
      );

      return res.json({
        following: false,
      });
    } else {
      // ====== FOLLOW ======

      await pool.query(
        "INSERT INTO followers (follower_id, following_id) VALUES (?, ?)",
        [currentUserId, targetUserId]
      );

      // Add notification
      await pool.query(
        `
        INSERT INTO notifications (user_id, actor_id, type, is_read)
        VALUES (?, ?, 'follow', FALSE);
        `,
        [targetUserId, currentUserId]
      );

      return res.json({
        following: true,
      });
    }
  } catch (err) {
    console.error("Error toggling follow:", err);
    res.status(500).json({ message: "Error toggling follow" });
  }
});


// fetch comments for a post
app.get("/api/posts/:postId/comments", authMiddleware, async (req, res) => {
  const postId = parseInt(req.params.postId, 10);

  if (!postId) {
    return res.status(400).json({ message: "Invalid post id" });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        c.id,
        c.user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        c.content,
        c.created_at
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC;
      `,
      [postId]
    );

    const comments = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      content: row.content,
      created_at: row.created_at,
    }));

    res.json({ comments });
  } catch (err) {
    console.error("Error fetching comments:", err);
    res.status(500).json({ message: "Error fetching comments" });
  }
});

// add new comment to a post + create notification for post owner
app.post("/api/posts/:postId/comments", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const postId = parseInt(req.params.postId, 10);
  const { content } = req.body;

  if (!postId) {
    return res.status(400).json({ message: "Invalid post id" });
  }

  const trimmedContent = content?.trim();
  if (!trimmedContent) {
    return res
      .status(400)
      .json({ message: "Comment content is required" });
  }

  try {
    // 1) Get the post + owner (so we know whom to notify)
    const [postRows] = await pool.query(
      `
      SELECT id, user_id
      FROM posts
      WHERE id = ?
      LIMIT 1;
      `,
      [postId]
    );

    if (!postRows.length) {
      return res.status(404).json({ message: "Post not found" });
    }

    const post = postRows[0]; // post.user_id is the owner
    const postOwnerId = Number(post.user_id);
    const actorId = Number(currentUserId);

    // 2) Insert the comment
    const [result] = await pool.query(
      `
      INSERT INTO comments (user_id, post_id, content)
      VALUES (?, ?, ?);
      `,
      [actorId, postId, trimmedContent]
    );

    const commentId = result.insertId;

    // 3) Insert notification for post owner (INCLUDING self-comment for now so you can see it working)
    try {
      await pool.query(
        `
        INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id, is_read)
        VALUES (?, ?, 'comment', ?, ?, FALSE);
        `,
        [postOwnerId, actorId, postId, commentId]
      );
    } catch (notifErr) {
      console.error("Error inserting comment notification:", notifErr);
      // If you want to see the exact SQL error:
      // console.error("SQL message:", notifErr.sqlMessage);
      // don't fail the whole request because of notification
    }

    // 4) Return the inserted comment with user info
    const [rows] = await pool.query(
      `
      SELECT
        c.id,
        c.user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        c.content,
        c.created_at
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
      LIMIT 1;
      `,
      [commentId]
    );

    if (!rows.length) {
      return res
        .status(500)
        .json({ message: "Comment created but could not be fetched" });
    }

    res.status(201).json({ comment: rows[0] });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ message: "Error adding comment" });
  }
});


// delete a comment from a post
app.delete(
  "/api/posts/:postId/comments/:commentId",
  authMiddleware,
  async (req, res) => {
    const currentUserId = req.user.id;
    const postId = parseInt(req.params.postId, 10);
    const commentId = parseInt(req.params.commentId, 10);

    if (!postId || !commentId) {
      return res.status(400).json({ message: "Invalid post or comment id" });
    }

    try {
      // 1) Load comment (post join is optional now)
      const [rows] = await pool.query(
        `
        SELECT
          c.id,
          c.user_id AS comment_user_id,
          c.post_id
        FROM comments c
        WHERE c.id = ? AND c.post_id = ?
        LIMIT 1;
        `,
        [commentId, postId]
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Comment not found" });
      }

      const comment = rows[0];

      // 2) Permission check: ONLY comment owner
      const isCommentOwner =
        Number(comment.comment_user_id) === Number(currentUserId);

      if (!isCommentOwner) {
        return res
          .status(403)
          .json({ message: "You are not allowed to delete this comment" });
      }

      // 3) Delete the comment
      await pool.query("DELETE FROM comments WHERE id = ?", [commentId]);

      return res.json({
        message: "Comment deleted successfully",
        commentId,
      });
    } catch (err) {
      console.error("Error deleting comment:", err);
      res.status(500).json({ message: "Error deleting comment" });
    }
  }
);




















/* =====================================================================
 * POST.JSX file routes
 * ===================================================================== */
// create new post
app.post("/api/posts", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const { content, image_url } = req.body;

  if (!content && !image_url) {
    return res
      .status(400)
      .json({ message: "Post must have text or an image" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)",
      [currentUserId, content || null, image_url || null]
    );

    const insertedId = result.insertId;

    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        content,
        image_url,
        created_at
      FROM posts
      WHERE id = ?
      `,
      [insertedId]
    );

    res.status(201).json({
      message: "Post created",
      post: rows[0],
    });
  } catch (err) {
    console.error("Error creating post:", err);
    res.status(500).json({ message: "Error creating post" });
  }
});


















/* =====================================================================
 * PROFILE.JSX file routes
 * ===================================================================== */
// fetch current user's profile info + stats + their posts
app.get("/api/profile/me", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    // user + counts
    const [userRows] = await pool.query(
      `
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.bio,
        u.avatar_url,
        u.profile_link_type,
        u.profile_link,
        u.created_at,
        -- how many posts
        (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS postsCount,
        -- how many followers (people following me)
        (SELECT COUNT(*) FROM followers f WHERE f.following_id = u.id) AS followersCount,
        -- how many I'm following
        (SELECT COUNT(*) FROM followers f2 WHERE f2.follower_id = u.id) AS followingCount
      FROM users u
      WHERE u.id = ?
      LIMIT 1;
      `,
      [currentUserId]
    );

    if (!userRows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const profileUser = userRows[0];

    // posts grid
    const [postRows] = await pool.query(
      `
      SELECT
        id,
        content,
        image_url,
        created_at
      FROM posts
      WHERE user_id = ?
      ORDER BY created_at DESC;
      `,
      [currentUserId]
    );

    res.json({
      user: {
        id: profileUser.id,
        username: profileUser.username,
        display_name: profileUser.display_name,
        bio: profileUser.bio,
        avatar_url: profileUser.avatar_url,
        profile_link_type: profileUser.profile_link_type,
        profile_link: profileUser.profile_link,
        created_at: profileUser.created_at,
        postsCount: profileUser.postsCount,
        followersCount: profileUser.followersCount,
        followingCount: profileUser.followingCount,
      },
      posts: postRows,
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// update current user's profile info
app.put("/api/profile/me", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;

  let {
    display_name,
    bio,
    avatar_url,
    profile_link_type,
    profile_link,
  } = req.body;

  display_name = display_name?.trim() || null;
  bio = bio?.trim() || null;
  avatar_url = avatar_url?.trim() || null;
  profile_link = profile_link?.trim() || null;
  profile_link_type = profile_link_type?.trim() || null;

  // Optional: validate link type against allowed values
  const allowedTypes = ["instagram", "facebook", "twitter", "linkedin", "github"];
  if (profile_link_type && !allowedTypes.includes(profile_link_type)) {
    profile_link_type = null;
  }

  try {
    await pool.query(
      `
      UPDATE users
      SET
        display_name = ?,
        bio = ?,
        avatar_url = ?,
        profile_link_type = ?,
        profile_link = ?
      WHERE id = ?;
      `,
      [
        display_name,
        bio,
        avatar_url,
        profile_link_type,
        profile_link,
        currentUserId,
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT
        id,
        username,
        display_name,
        bio,
        avatar_url,
        profile_link_type,
        profile_link,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1;
      `,
      [currentUserId]
    );

    res.json({ user: rows[0] });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ message: "Error updating profile" });
  }
});

// update a post (only by owner)
app.put("/api/posts/:postId", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const { postId } = req.params;
  let { content } = req.body;

  content = content?.trim() || "";

  if (!content) {
    // If you want to allow empty description, remove this block
    return res.status(400).json({ message: "Content is required" });
  }

  try {
    // 1) Find the post by id
    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_id
      FROM posts
      WHERE id = ?
      LIMIT 1;
      `,
      [postId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Post not found" });
    }

    const post = rows[0];

    // 2) Check ownership
    if (post.user_id !== currentUserId) {
      return res
        .status(403)
        .json({ message: "You are not allowed to edit this post" });
    }

    // 3) Update content
    await pool.query(
      `
      UPDATE posts
      SET content = ?
      WHERE id = ?;
      `,
      [content, postId]
    );

    // 4) Return updated post
    const [updatedRows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        content,
        image_url,
        created_at
      FROM posts
      WHERE id = ?
      LIMIT 1;
      `,
      [postId]
    );

    res.json({
      message: "Post updated successfully",
      post: updatedRows[0],
    });
  } catch (err) {
    console.error("Error updating post:", err);
    res.status(500).json({ message: "Error updating post" });
  }
});

// delete a post (only by owner)
app.delete("/api/posts/:postId", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const { postId } = req.params;

  try {
    // 1) Fetch post to verify existence + ownership
    const [rows] = await pool.query(
      `
      SELECT id, user_id
      FROM posts
      WHERE id = ?
      LIMIT 1;
      `,
      [postId]
    );

    // Post not found
    if (!rows.length) {
      return res.status(404).json({ message: "Post not found" });
    }

    const post = rows[0];

    // Ownership check
    if (Number(post.user_id) !== Number(currentUserId)) {
      return res.status(403).json({
        message: "You are not allowed to delete this post",
      });
    }

    // 2) Delete post
    await pool.query(
      `
      DELETE FROM posts
      WHERE id = ?;
      `,
      [postId]
    );

    // Success response
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ message: "Error deleting post" });
  }
});


















/* =====================================================================
 * SEARCH.JSX / USERS.JSX file routes
 * ===================================================================== */
// user search
app.get("/api/users/search", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const q = (req.query.q || "").trim();

  if (!q) {
    return res.json({ users: [] });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        EXISTS(
          SELECT 1
          FROM followers f
          WHERE f.follower_id = ? AND f.following_id = u.id
        ) AS isFollowing
      FROM users u
      WHERE u.username LIKE ? OR u.display_name LIKE ?
      ORDER BY u.username ASC
      LIMIT 20
      `,
      [currentUserId, `%${q}%`, `%${q}%`]
    );

    // convert isFollowing from 0/1 to boolean
    const users = rows.map((r) => ({
      ...r,
      isFollowing: !!r.isFollowing,
    }));

    res.json({ users });
  } catch (err) {
    console.error("User search error:", err);
    res.status(500).json({ message: "Error searching users" });
  }
});

// PUBLIC USER PROFILE (for viewing others)
app.get("/api/users/:userId", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const userId = parseInt(req.params.userId, 10);

  if (!userId) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    const [[user]] = await pool.query(
      `
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.email,
        u.bio,
        u.avatar_url,
        u.profile_link_type,
        u.profile_link,
        u.created_at,
        (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS postsCount,
        (SELECT COUNT(*) FROM followers f WHERE f.following_id = u.id) AS followersCount,
        (SELECT COUNT(*) FROM followers f2 WHERE f2.follower_id = u.id) AS followingCount,
        EXISTS(
          SELECT 1
          FROM followers f3
          WHERE f3.follower_id = ? AND f3.following_id = u.id
        ) AS isFollowing
      FROM users u
      WHERE u.id = ?
      LIMIT 1
      `,
      [currentUserId, userId]
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isFollowing = !!user.isFollowing;

    const [posts] = await pool.query(
      `
      SELECT id, user_id, content, image_url, created_at
      FROM posts
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json({ user, posts });
  } catch (err) {
    console.error("Public profile error:", err);
    res.status(500).json({ message: "Error loading profile" });
  }
});


// check follow / unfollow: POST /api/users/:userId/follow
app.post("/api/users/:userId/follow", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const targetUserId = parseInt(req.params.userId, 10);

  if (!targetUserId || targetUserId === currentUserId) {
    return res.status(400).json({ message: "Invalid target user" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id FROM followers WHERE follower_id = ? AND following_id = ?",
      [currentUserId, targetUserId]
    );

    if (rows.length > 0) {
      // Already following -> unfollow
      await pool.query("DELETE FROM followers WHERE id = ?", [rows[0].id]);

      return res.json({
        following: false,
      });
    } else {
      // Not following -> follow
      await pool.query(
        "INSERT INTO followers (follower_id, following_id) VALUES (?, ?)",
        [currentUserId, targetUserId]
      );

      return res.json({
        following: true,
      });
    }
  } catch (err) {
    console.error("Error toggling follow:", err);
    res.status(500).json({ message: "Error toggling follow" });
  }
});


























// ===============================
// NOTIFICATIONS ROUTES
// ===============================

// GET /api/notifications
// Return notifications for the logged-in user
app.get("/api/notifications", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const [rows] = await pool.query(
      `
      SELECT
        n.id,
        n.type,
        n.post_id,
        n.comment_id,
        n.is_read,
        n.created_at,
        a.id AS actor_id,
        a.username AS actor_username,
        a.display_name AS actor_display_name,
        a.avatar_url AS actor_avatar_url,
        p.content AS post_content,
        p.image_url AS post_image_url,
        c.content AS comment_content
      FROM notifications n
      LEFT JOIN users a ON n.actor_id = a.id
      LEFT JOIN posts p ON n.post_id = p.id
      LEFT JOIN comments c ON n.comment_id = c.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 100;
      `,
      [currentUserId]
    );

    res.json({ notifications: rows });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ message: "Error fetching notifications" });
  }
});
// PATCH /api/notifications/:id/read
app.patch("/api/notifications/:id/read", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const notifId = parseInt(req.params.id, 10);

  if (!notifId) {
    return res.status(400).json({ message: "Invalid notification id" });
  }

  try {
    const [result] = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = ? AND user_id = ?;
      `,
      [notifId, currentUserId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Notification not found or not yours" });
    }

    res.json({ message: "Notification marked as read", id: notifId });
  } catch (err) {
    console.error("Error marking notification read:", err);
    res.status(500).json({ message: "Error updating notification" });
  }
});
// PATCH /api/notifications/mark-all-read
app.patch(
  "/api/notifications/mark-all-read",
  authMiddleware,
  async (req, res) => {
    const currentUserId = req.user.id;

    try {
      const [result] = await pool.query(
        `
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = ? AND is_read = FALSE;
        `,
        [currentUserId]
      );

      res.json({
        message: "All notifications marked as read",
        updated: result.affectedRows,
      });
    } catch (err) {
      console.error("Error marking all notifications read:", err);
      res.status(500).json({ message: "Error updating notifications" });
    }
  }
);




















/*
MESSAGES ROUTES
*/




// load conversations for the current user
app.get("/api/messages/conversations", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const [rows] = await pool.query(
      `
      SELECT
        u.id AS user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        last_msg.message AS last_message,
        last_msg.created_at AS last_message_time,
        (
          SELECT COUNT(*)
          FROM messages m2
          WHERE m2.sender_id = u.id
            AND m2.reciever_id = ?
            AND m2.is_read = FALSE
        ) AS unread_count
      FROM (
        SELECT
          CASE
            WHEN sender_id = ? THEN reciever_id
            ELSE sender_id
          END AS partner_id,
          MAX(created_at) AS last_time
        FROM messages
        WHERE sender_id = ? OR reciever_id = ?
        GROUP BY partner_id
      ) conv
      JOIN users u ON u.id = conv.partner_id
      JOIN messages last_msg
        ON (
          (last_msg.sender_id = ? AND last_msg.reciever_id = u.id)
          OR
          (last_msg.sender_id = u.id AND last_msg.reciever_id = ?)
        )
        AND last_msg.created_at = conv.last_time
      ORDER BY last_message_time DESC;
      `,
      [
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
      ]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ message: "Error fetching conversations" });
  }
});

// load messages between current user and another user
app.get("/api/messages/:userId", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const otherUserId = parseInt(req.params.userId, 10);

  if (Number.isNaN(otherUserId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT id, sender_id, reciever_id, message, is_read, created_at
      FROM messages
      WHERE
        (sender_id = ? AND reciever_id = ?)
        OR
        (sender_id = ? AND reciever_id = ?)
      ORDER BY created_at ASC;
      `,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );

    // Mark received messages as read
    await pool.query(
      `
      UPDATE messages
      SET is_read = TRUE
      WHERE sender_id = ?
        AND reciever_id = ?
        AND is_read = FALSE;
      `,
      [otherUserId, currentUserId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// send a message to another user
app.post("/api/messages", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const { reciever_id, message } = req.body;

  if (!reciever_id || !message || !message.trim()) {
    return res
      .status(400)
      .json({ message: "reciever_id and message required" });
  }

  // optional: block sending to self
  if (Number(reciever_id) === currentUserId) {
    return res
      .status(400)
      .json({ message: "Cannot send a message to yourself" });
  }

  try {
    // Check receiver exists
    const [users] = await pool.query(
      "SELECT id FROM users WHERE id = ?",
      [reciever_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    // Insert message
    const [result] = await pool.query(
      `
      INSERT INTO messages (sender_id, reciever_id, message)
      VALUES (?, ?, ?);
      `,
      [currentUserId, reciever_id, message.trim()]
    );

    // Send back the inserted message
    const [rows] = await pool.query(
      `
      SELECT id, sender_id, reciever_id, message, is_read, created_at
      FROM messages
      WHERE id = ?;
      `,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ message: "Error sending message" });
  }
});

// mark messages from a specific user as read
app.patch("/api/messages/:userId/read", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const otherUserId = parseInt(req.params.userId, 10);

  if (Number.isNaN(otherUserId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    await pool.query(
      `
      UPDATE messages
      SET is_read = TRUE
      WHERE sender_id = ?
        AND reciever_id = ?;
      `,
      [otherUserId, currentUserId]
    );

    res.json({ message: "Messages marked as read" });
  } catch (err) {
    console.error("Error marking messages read:", err);
    res.status(500).json({ message: "Error marking messages read" });
  }
});
// update a message (only by sender)
app.put("/api/messages/:id", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const messageId = parseInt(req.params.id, 10);
  const { message } = req.body;

  if (Number.isNaN(messageId)) {
    return res.status(400).json({ message: "Invalid message id" });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ message: "Message text required" });
  }

  try {
    
    // Check that message exists and belongs to current user
    const [rows] = await pool.query(
      "SELECT id, sender_id, reciever_id, message, is_read, created_at FROM messages WHERE id = ?",
      [messageId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    const msg = rows[0];

    if (msg.sender_id !== currentUserId) {
      return res.status(403).json({ message: "Not allowed to edit this message" });
    }

    await pool.query(
      `
      UPDATE messages
      SET message = ?
      WHERE id = ?;
      `,
      [message.trim(), messageId]
    );

    const [updatedRows] = await pool.query(
      `
      SELECT id, sender_id, reciever_id, message, is_read, created_at
      FROM messages
      WHERE id = ?;
      `,
      [messageId]
    );

    res.json(updatedRows[0]);
  } catch (err) {
    console.error("Error updating message:", err);
    res.status(500).json({ message: "Error updating message" });
  }
});

// delete a single message (only by sender)
app.delete("/api/messages/:id", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const messageId = parseInt(req.params.id, 10);

  if (Number.isNaN(messageId)) {
    return res.status(400).json({ message: "Invalid message id" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, sender_id FROM messages WHERE id = ?",
      [messageId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    const msg = rows[0];

    if (msg.sender_id !== currentUserId) {
      return res.status(403).json({ message: "Not allowed to delete this message" });
    }

    await pool.query("DELETE FROM messages WHERE id = ?", [messageId]);

    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ message: "Error deleting message" });
  }
});

// delete entire chat with a specific user
app.delete("/api/messages/chat/:userId", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const otherUserId = parseInt(req.params.userId, 10);

  if (Number.isNaN(otherUserId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    await pool.query(
      `
      DELETE FROM messages
      WHERE
        (sender_id = ? AND reciever_id = ?)
        OR
        (sender_id = ? AND reciever_id = ?);
      `,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );

    res.json({ message: "Chat deleted" });
  } catch (err) {
    console.error("Error deleting chat:", err);
    res.status(500).json({ message: "Error deleting chat" });
  }
});















/*
Analytics.jsx
*/
// Returns total followers and total following count for the logged-in user
app.get("/api/analytics/overview", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM followers WHERE following_id = ?) AS followerCount,
        (SELECT COUNT(*) FROM followers WHERE follower_id = ?) AS followingCount
      `,
      [userId, userId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Overview error:", err);
    res.status(500).json({ message: "Failed to load overview" });
  }
});

// Fetches all posts by the logged-in user with like count and comment count
app.get("/api/analytics/posts", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.created_at,
        COUNT(DISTINCT l.id) AS likeCount,
        COUNT(DISTINCT c.id) AS commentCount
      FROM posts p
      LEFT JOIN likes l ON l.post_id = p.id
      LEFT JOIN comments c ON c.post_id = p.id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Posts analytics error:", err);
    res.status(500).json({ message: "Failed to load posts analytics" });
  }
});

// Provides monthly and yearly statistics of likes on the user's posts
app.get("/api/analytics/likes-stats", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const [monthly] = await pool.query(
      `
      SELECT 
        YEAR(l.created_at) AS year,
        MONTH(l.created_at) AS month,
        COUNT(*) AS likeCount
      FROM likes l
      JOIN posts p ON p.id = l.post_id
      WHERE p.user_id = ?
      GROUP BY YEAR(l.created_at), MONTH(l.created_at)
      ORDER BY year, month
      `,
      [userId]
    );

    const [yearly] = await pool.query(
      `
      SELECT 
        YEAR(l.created_at) AS year,
        COUNT(*) AS likeCount
      FROM likes l
      JOIN posts p ON p.id = l.post_id
      WHERE p.user_id = ?
      GROUP BY YEAR(l.created_at)
      ORDER BY year
      `,
      [userId]
    );

    res.json({ monthly, yearly });
  } catch (err) {
    console.error("Likes chart error:", err);
    res.status(500).json({ message: "Failed to load likes stats" });
  }
});

// Provides monthly and yearly growth statistics of the user's followers
app.get("/api/analytics/followers-stats", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const [monthly] = await pool.query(
      `
      SELECT 
        YEAR(created_at) AS year,
        MONTH(created_at) AS month,
        COUNT(*) AS followerCount
      FROM followers
      WHERE following_id = ?
      GROUP BY YEAR(created_at), MONTH(created_at)
      ORDER BY year, month
      `,
      [userId]
    );

    const [yearly] = await pool.query(
      `
      SELECT 
        YEAR(created_at) AS year,
        COUNT(*) AS followerCount
      FROM followers
      WHERE following_id = ?
      GROUP BY YEAR(created_at)
      ORDER BY year
      `,
      [userId]
    );

    res.json({ monthly, yearly });
  } catch (err) {
    console.error("Followers chart error:", err);
    res.status(500).json({ message: "Failed to load follower stats" });
  }
});

// Returns a list of users who follow the logged-in user
app.get("/api/analytics/list/followers", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.query(
      `
      SELECT u.id, u.username, u.display_name, u.avatar_url, f.created_at
      FROM followers f
      JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Followers list error:", err);
    res.status(500).json({ message: "Failed to load followers" });
  }
});

// Returns a list of users that the logged-in user is following
app.get("/api/analytics/list/following", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.query(
      `
      SELECT u.id, u.username, u.display_name, u.avatar_url, f.created_at
      FROM followers f
      JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Following list error:", err);
    res.status(500).json({ message: "Failed to load following" });
  }
});

// Returns a list of users who liked a specific post owned by the user
app.get("/api/analytics/list/post/:postId/likes", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const postId = parseInt(req.params.postId, 10);

  if (isNaN(postId)) {
    return res.status(400).json({ message: "Invalid post id" });
  }

  try {
    const [[owner]] = await pool.query(
      "SELECT user_id FROM posts WHERE id = ?",
      [postId]
    );

    if (!owner || owner.user_id !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        u.id, u.username, u.display_name, u.avatar_url, l.created_at
      FROM likes l
      JOIN users u ON u.id = l.user_id
      WHERE l.post_id = ?
      ORDER BY l.created_at DESC
      `,
      [postId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Likes list error:", err);
    res.status(500).json({ message: "Failed to load likes list" });
  }
});

// Returns a list of comments and commenters for a specific post owned by the user
app.get("/api/analytics/list/post/:postId/comments", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const postId = parseInt(req.params.postId, 10);

  if (isNaN(postId)) {
    return res.status(400).json({ message: "Invalid post id" });
  }

  try {
    const [[owner]] = await pool.query(
      "SELECT user_id FROM posts WHERE id = ?",
      [postId]
    );

    if (!owner || owner.user_id !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        u.id, u.username, u.display_name, u.avatar_url,
        c.content, c.created_at
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at DESC
      `,
      [postId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Comments list error:", err);
    res.status(500).json({ message: "Failed to load comments list" });
  }
});













/*
Settings.jsx
*/ 
// delete current user's account permanently
app.delete("/api/me", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    // Check if user exists
    const [[user]] = await pool.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user (ON DELETE CASCADE should clean related rows)
    await pool.query("DELETE FROM users WHERE id = ?", [userId]);

    res.json({
      message: "Account deleted successfully",
    });

  } catch (err) {
    console.error("Account delete error:", err);
    res.status(500).json({ message: "Failed to delete account" });
  }
});






// Start server (simple start)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);

app.use(express.static(path.join(__dirname, "../dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});