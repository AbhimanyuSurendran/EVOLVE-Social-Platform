import React from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/AboutUs.css";

// Replace these paths with your real assets
import evolveLogo from "../../assets/EVOLVE.gif";
import devPhoto from "../../assets/PROFILE-PIC.jpg";

export default function AboutUs() {
  const navigate = useNavigate();

  return (
    <div className="about-page">
      <div className="about-glow about-glow-1" />
      <div className="about-glow about-glow-2" />

      <div className="about-shell">
        {/* TOP BACK BUTTON */}
        <button
          className="about-back-btn"
          onClick={() => navigate("/settings")}
        >
          ← Settings
        </button>

        {/* HERO / LOGO AREA */}
        <section className="about-hero">
          <div className="about-logo-wrap">
            <div className="about-logo-glow">
              <div className="about-logo-badge">
                <img
                  src={evolveLogo}
                  alt="EVOLVE logo"
                  className="about-logo-img"
                />
              </div>
            </div>
          </div>

          <h1 className="about-title">About EVOLVE</h1>
          <p className="about-tagline">Where creativity meets connection</p>
        </section>

        {/* MAIN GRID */}
        <section className="about-main-grid">
          {/* DEVELOPER CARD */}
          <article className="about-card dev-card glass-card">
            <div className="dev-avatar-wrap">
              <div className="dev-avatar-frame">
                <img
                  src={devPhoto}
                  alt="Developer portrait placeholder"
                  className="dev-avatar-img"
                />
              </div>
            </div>

            <div className="dev-info">
              <h2 className="dev-name">Abhimanyu Surendran</h2>
              <p className="dev-role">Creative Software Developer</p>
              <p className="dev-bio">
                A student developer who loves crafting clean interfaces, smooth
                interactions, and meaningful social experiences. EVOLVE is built
                as a space where design, code, and creativity come together.
              </p>
              <p className="dev-bio subtle">
                From sketching UI ideas to writing backend logic, every pixel
                and every line of code is designed to feel thoughtful, modern,
                and user-first.
              </p>
            </div>
          </article>

          {/* RIGHT COLUMN – ABOUT + FEATURES */}
          <div className="about-right-column">
            <article className="about-card glass-card about-app-card">
              <h2>About the App</h2>
              <p>
                EVOLVE is a modern, secure, and interactive social media
                platform designed to help you share your story, connect with
                people who inspire you, and build a digital space that feels
                truly yours.
              </p>

              <div className="about-bullets">
                <div className="about-pill">
                  Clean, distraction-free experience
                </div>
                <div className="about-pill">Real-time, expressive posting</div>
                <div className="about-pill">
                  Built to grow with you over time
                </div>
              </div>
            </article>

            <article className="about-card glass-card features-card">
              <div className="features-header">
                <h2>Features</h2>
                <p>Thoughtfully designed for creators and communities.</p>
              </div>

              <div className="features-grid">
                <div className="feature-chip">
                  <div className="feature-icon">⚡</div>
                  <span className="feature-label">Fast</span>
                </div>
                <div className="feature-chip">
                  <div className="feature-icon">🔒</div>
                  <span className="feature-label">Secure</span>
                </div>
                <div className="feature-chip">
                  <div className="feature-icon">✨</div>
                  <span className="feature-label">Creative</span>
                </div>
                <div className="feature-chip">
                  <div className="feature-icon">👤</div>
                  <span className="feature-label">User First</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* WHY EVOLVE + VALUES */}
        <section className="about-strip">
          <article className="strip-card">
            <h3>🚀 Why EVOLVE?</h3>
            <p>
              Social platforms can feel noisy and overwhelming. EVOLVE focuses
              on clarity, comfort, and connection, so you always feel in control
              of your space.
            </p>
          </article>
          <article className="strip-card">
            <h3>💎 Core Values</h3>
            <div className="values-row">
              <span className="value-pill">Respect</span>
              <span className="value-pill">Creativity</span>
              <span className="value-pill">Clarity</span>
              <span className="value-pill">Trust</span>
            </div>
            <p className="strip-sub">
              Every feature is measured against these four pillars.
            </p>
          </article>
        </section>

        {/* PRIVACY + TECH SECTION */}
        <section className="about-meta-grid">
          <article className="meta-card glass-soft">
            <h3>🔐 Privacy & Safety</h3>
            <p>
              Your content is yours. EVOLVE is built with secure
              authentication, protected APIs, and a privacy-first mindset so you
              feel safe sharing what matters.
            </p>
          </article>
          <article className="meta-card glass-soft">
            <h3>🧠 Built with Modern Tech</h3>
            <p>
              Powered by a modern JavaScript stack, clean APIs, and scalable
              database design — so the app feels fast today and ready for
              tomorrow.
            </p>
            <div className="tech-chips">
              <span>React</span>
              <span>Node.js</span>
              <span>MySQL</span>
              <span>Cloud Media</span>
            </div>
          </article>
          <article className="meta-card glass-soft">
            <h3>📈 Always Evolving</h3>
            <p>
              New ideas, experiments, and improvements are shipped frequently.
              EVOLVE is not a static product — it grows with you and your
              creativity.
            </p>
          </article>
        </section>

        {/* SLOGAN / FOOTER */}
        <section className="about-slogan">
          <p>Where creativity meets connection.</p>
        </section>

        <footer className="about-footer">
          <span>© {new Date().getFullYear()} EVOLVE</span>
          <button
            className="about-btn"
            onClick={() => navigate("/settings")}
          >
            ← Back to Settings
          </button>
        </footer>
      </div>
    </div>
  );
}
