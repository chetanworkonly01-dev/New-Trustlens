"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Audit } from "../lib/types";

export default function ThemeNavbar() {
  const { isDark, toggleTheme } = useTheme();
  const { user, loading, signout } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        const res = await fetch("/api/audit/list", { credentials: "include" });
        if (res.ok) setAudits(await res.json());
      } catch {
        /* ignore */
      }
    };
    fetchAudits();
  }, []);

  const handleSignOut = async () => {
    await signout();
    window.location.href = "/";
  };

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-inner">
        <Link
          href="/"
          className="navbar-brand"
          aria-label="KPMG TrustLens — Home"
        >
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
        </Link>

        <div className="navbar-links">
          <Link href="/" className="navbar-link">
            Dashboard
          </Link>
          <Link href="/audit" className="navbar-link">
            New Audit
          </Link>
          {!loading && user && audits.length > 0 && (
            <Link href="/audit-history" className="navbar-link">
              View Audit History
            </Link>
          )}

          {!loading && user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* <span
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {user.name || user.email.split("@")[0]}
              </span> */}
              <button
                onClick={handleSignOut}
                className="navbar-link"
                style={{
                  cursor: "pointer",
                  // padding: "6px 12px",
                  // borderRadius: "6px",
                  border: "none",
                  // fontSize: "14px",
                  // fontWeight: 500,
                  background: "transparent",
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            !loading && (
              <Link href="/auth/signin" className="navbar-link">
                Sign In
              </Link>
            )
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
        </div>
      </div>
    </nav>
  );
}
