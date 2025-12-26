// src/components/auth/LoginRegister.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/login_register.css";
import { login, signup, resetPassword } from "../../api/auth";
import evolveGif from "../../assets/EVOLVE.gif";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export default function LoginRegister() {
  const [rightPanelActive, setRightPanelActive] = useState(false);
  const navigate = useNavigate();

  /* ----------------------------- LOGIN ----------------------------- */

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const resp = await login(form);
      const token = resp?.data?.token || resp?.token;
      const user = resp?.data?.user || resp?.user;

      if (!token) throw new Error("Login response missing token");

      localStorage.setItem("token", token);
      if (user?.username) localStorage.setItem("username", user.username);
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/splash", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------- SIGNUP ----------------------------- */

  const [signupForm, setSignupForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });

  const [signupError, setSignupError] = useState(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [pendingSignup, setPendingSignup] = useState(null);

  // LIVE username normalization & field updates
  const onSignupChange = (e) => {
    const { name, value } = e.target;

    if (name === "username") {
      const normalized = value.toLowerCase().replace(/\s+/g, "");
      setSignupForm((f) => ({ ...f, username: normalized }));
      return;
    }

    setSignupForm((f) => ({ ...f, [name]: value }));
  };

  // NEW USERNAME RULES HERE
  const validateSignup = () => {
    if (!signupForm.username.trim()) return "Username required";

    // username: 3–30 chars, lowercase, digits, _, $, @
    const usernameRe = /^[a-z0-9_$@]{3,30}$/;
    if (!usernameRe.test(signupForm.username)) {
      return 'Username must be 3–30 characters, lowercase only, digits allowed, and may include _ $ @ (no spaces).';
    }

    if (!/\S+@\S+\.\S+/.test(signupForm.email)) return "Valid email required";
    if (signupForm.password.length < 6)
      return "Password must be at least 6 characters";
    if (signupForm.password !== signupForm.confirmPassword)
      return "Passwords do not match";

    return null;
  };

  const generateOtp = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

  /* ----------------------------- FORGOT PASSWORD ----------------------------- */

  const [showForgot, setShowForgot] = useState(false);
  const [resetForm, setResetForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [resetError, setResetError] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  const onResetChange = (e) =>
    setResetForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validateReset = () => {
    if (!/\S+@\S+\.\S+/.test(resetForm.email)) return "Valid email required";
    if (resetForm.password.length < 6)
      return "Password must be at least 6 characters";
    if (resetForm.password !== resetForm.confirmPassword)
      return "Passwords do not match";
    return null;
  };

  /* ----------------------------- OTP OVERLAY ----------------------------- */

  const [otpOverlayOpen, setOtpOverlayOpen] = useState(false);
  const [otpMode, setOtpMode] = useState(null);
  const [otpEmail, setOtpEmail] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);

  const sendOtpEmail = async ({ email, username }) => {
    const code = generateOtp();
    setGeneratedOtp(code);
    setOtpCode("");
    setOtpError(null);
    setOtpEmail(email);
    setOtpOverlayOpen(true);

    const params = {
      user_email: email,
      user_name: username || "User",
      otp: code,
    };

    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      params,
      EMAILJS_PUBLIC_KEY
    );
  };

  const onSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupError(null);

    const msg = validateSignup();
    if (msg) return setSignupError(msg);

    setSignupLoading(true);
    setOtpMode("register");
    setPendingSignup({
      username: signupForm.username,
      email: signupForm.email,
      password: signupForm.password,
    });

    try {
      await sendOtpEmail({
        email: signupForm.email,
        username: signupForm.username,
      });
      alert("OTP sent to your email for verification.");
    } catch (err) {
      setSignupError("Failed to send OTP. Please try again.");
      setOtpOverlayOpen(false);
    } finally {
      setSignupLoading(false);
    }
  };

  const onForgotSubmit = async (e) => {
    e.preventDefault();
    setResetError(null);

    const msg = validateReset();
    if (msg) return setResetError(msg);

    setResetLoading(true);
    setOtpMode("reset");

    try {
      await sendOtpEmail({
        email: resetForm.email,
        username: resetForm.email,
      });
      alert("OTP sent to your email.");
    } catch (err) {
      setResetError("Failed to send OTP. Try again.");
      setOtpOverlayOpen(false);
    } finally {
      setResetLoading(false);
    }
  };

  const closeOtpOverlay = () => {
    setOtpOverlayOpen(false);
    setOtpMode(null);
    setOtpCode("");
    setOtpError(null);
  };

  const onOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpError(null);

    if (!otpCode.trim()) return setOtpError("Please enter the OTP");
    if (otpCode.trim() !== generatedOtp)
      return setOtpError("Invalid OTP. Check again.");

    setOtpLoading(true);
    try {
      if (otpMode === "register" && pendingSignup) {
        const resp = await signup(pendingSignup);
        const token = resp?.data?.token || resp?.token;
        const user = resp?.data?.user || resp?.user;

        if (!token) throw new Error("Signup missing token");

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        alert("Signup successful!");

        navigate("/splash", { replace: true });
      } else if (otpMode === "reset") {
        await resetPassword({
          email: resetForm.email,
          password: resetForm.password,
        });
        alert("Password reset successful.");
        setShowForgot(false);
      }

      closeOtpOverlay();
    } catch (err) {
      setOtpError(err?.message || "Something went wrong");
    } finally {
      setOtpLoading(false);
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


  /* ----------------------------- JSX ----------------------------- */

  return (
    <>
      <div
        className={`container ${
          rightPanelActive ? "right-panel-active" : ""
        }`}
      >
        {/* SIGNUP */}
        <div className="form-container sign-up-container">
          <form onSubmit={onSignupSubmit}>
            <h1>Register</h1>

            <input
              type="text"
              name="username"
              placeholder="Enter your Username for your account"
              required
              value={signupForm.username}
              onChange={onSignupChange}
            />

            <input
              type="email"
              name="email"
              placeholder="Enter your Email"
              required
              value={signupForm.email}
              onChange={onSignupChange}
            />

            <input
              type="text"
              name="phone"
              placeholder="Enter your Phone Number"
              value={signupForm.phone}
              onChange={onSignupChange}
            />

            <input
              type="password"
              name="password"
              placeholder="Enter your Password"
              required
              value={signupForm.password}
              onChange={onSignupChange}
            />

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm your Password"
              required
              value={signupForm.confirmPassword}
              onChange={onSignupChange}
            />

            {signupError && <div className="error-text">{signupError}</div>}

            <button type="submit" disabled={signupLoading}>
              {signupLoading ? "Sending OTP..." : "Register"}
            </button>
          </form>
        </div>

        {/* LOGIN */}
        <div className="form-container sign-in-container">
          <form onSubmit={onSubmit}>
            <h1>Login</h1>

            {error && <div className="error-text">{error}</div>}

            <input
              type="email"
              name="email"
              placeholder="Enter your Email"
              required
              value={form.email}
              onChange={onChange}
            />

            <input
              type="password"
              name="password"
              placeholder="Enter your Password"
              required
              value={form.password}
              onChange={onChange}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Logging..." : "Login"}
            </button>

            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setShowForgot(true);
                setResetError(null);
              }}
            >
              Forgot password?
            </button>
          </form>
        </div>

        {/* OVERLAY */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1>EVOLVE</h1>
              <img className="app-logo" src={evolveGif} alt="logo" />
              <h1>Welcome Back!</h1>
              <p>Login to continue.</p>
              <button
                className="ghost"
                onClick={() => setRightPanelActive(false)}
              >
                Login
              </button>
            </div>

            <div className="overlay-panel overlay-right">
              <h1>EVOLVE</h1>
              <img className="app-logo" src={evolveGif} alt="logo" />
              <h1>Social Platform</h1>
              <h3>Create your account now.</h3>

              <button
                className="ghost"
                onClick={() => setRightPanelActive(true)}
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FORGOT MODAL */}
      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Reset Password</h2>
            <p>Enter your email + new password</p>

            {resetError && <div className="error-text">{resetError}</div>}

            <form onSubmit={onForgotSubmit}>
              <input
                type="email"
                name="email"
                placeholder="Enter your Email"
                required
                value={resetForm.email}
                onChange={onResetChange}
              />

              <input
                type="password"
                name="password"
                placeholder="Enter your New Password"
                required
                value={resetForm.password}
                onChange={onResetChange}
              />

              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm your New Password"
                required
                value={resetForm.confirmPassword}
                onChange={onResetChange}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowForgot(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={resetLoading}>
                  {resetLoading ? "Sending OTP..." : "Send OTP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OTP MODAL */}
      {otpOverlayOpen && (
        <div className="modal-overlay" onClick={closeOtpOverlay}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              {otpMode === "register"
                ? "Verify your email"
                : "Enter OTP to reset password"}
            </h2>
            <p>OTP sent to {otpEmail}</p>

            {otpError && <div className="error-text">{otpError}</div>}

            <form onSubmit={onOtpSubmit}>
              <input
                type="text"
                maxLength={6}
                placeholder="Enter OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeOtpOverlay}
                >
                  Cancel
                </button>

                <button type="submit" disabled={otpLoading}>
                  {otpLoading ? "Verifying..." : "Verify"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
