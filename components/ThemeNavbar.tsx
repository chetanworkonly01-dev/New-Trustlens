"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useTheme } from "./ThemeProvider";
import { Audit } from "../lib/types";

export default function ThemeNavbar() {
  const { isDark, toggleTheme } = useTheme();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        const res = await fetch("/api/audit/list");
        if (res.ok) setAudits(await res.json());
      } catch {
        /* ignore */
      }
      setLoading(false);
    };
    fetchAudits();
  }, []);

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-inner">
        <a href="/" className="navbar-brand" aria-label="KPMG TrustLens — Home">
          <div className="kpmg-logo-wrap">
            <Image
              src={isDark ? "/kpmg-logo-dark.svg" : "/kpmg-logo-light-user.svg"}
              alt="KPMG"
              width={120}
              height={30}
              style={{
                width: 94,
                height: "auto",
                transition: "all 0.3s ease",
              }}
              className="kpmg-logo-svg"
              priority
            />
            <div className="kpmg-divider" aria-hidden="true" />
            <div className="kpmg-product-name">
              <span className="Powered by AI">TrustLens</span>
              <span className="kpmg-product-title">Powered by AI</span>
            </div>
          </div>
        </a>

        <div className="navbar-links">
          <a href="/" className="navbar-link">
            Dashboard
          </a>
          <a href="/audit" className="navbar-link">
            New Audit
          </a>
          {audits.length > 0 && (
            <a href="/audit-history" className="navbar-link">
              View Audit History
            </a>
          )}

          {/* Theme Toggle */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
            id="theme-toggle-btn"
          >
            <span className="theme-toggle-icon">{isDark ? "☀️" : "🌙"}</span>
            <div
              className={`theme-toggle-track ${!isDark ? "light-active" : ""}`}
            >
              <div
                className={`theme-toggle-thumb ${!isDark ? "light-active" : ""}`}
              />
            </div>
          </button>

          {/* <div className="kpmg-ai-badge" aria-label="AI-powered tool">
            <span className="kpmg-ai-dot" aria-hidden="true" />
            AI Active
          </div> */}
        </div>
      </div>
    </nav>
  );
}
