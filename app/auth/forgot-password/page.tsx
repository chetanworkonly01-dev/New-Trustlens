"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send reset email");
      } else {
        setSuccess(true);
        if (data.resetToken) {
          // Development mode - auto-open reset page with token
          window.location.href = `/auth/reset-password?token=${data.resetToken}`;
        }
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "63vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--gradient-bg)",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div
          style={{
            backgroundColor: "var(--bg-darkcard)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)",
            padding: "32px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "8px",
              }}
            >
              Forgot Password?
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              Enter your email to reset your password
            </p>
          </div>

          {error && (
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                backgroundColor: "#f0fdf4",
                color: "#166534",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              If an account exists with that email, a reset link has been sent.
            </div>
          )}

          {!success && (
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "28px" }}
            >
              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    fontSize: "16px",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    marginBottom: "6px",
                  }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "1px solid var(--border)",
                    fontSize: "15px",
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--kpmg-dynamic)";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(59, 130, 246, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--border)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "var(--kpmg-dynamic)",
                  color: "var(--kpmg-inverse)",
                  border: "none",
                  fontSize: "15px",
                  fontWeight: 600,
                  opacity: loading ? 0.6 : 1,
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    (e.target as HTMLButtonElement).style.cursor = "pointer";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    (e.target as HTMLButtonElement).style.cursor = "default";
                  }
                }}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              <Link
                href="/auth/signin"
                style={{
                  color: "var(--kpmg-dynamic)",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLAnchorElement).style.color =
                    "var(--kpmg-dynamic)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLAnchorElement).style.color =
                    "var(--kpmg-dynamic)";
                }}
              >
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
