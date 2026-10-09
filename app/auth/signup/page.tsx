"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignupAllowed, setIsSignupAllowed] = useState(false);
  const [isFirstAdmin, setIsFirstAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const { signup, user } = useAuth();

  useEffect(() => {
    const checkSetting = async () => {
      try {
        const res = await fetch('/api/public/settings');
        if (res.ok) {
          const data = await res.json();
          setIsSignupAllowed(data.isSignupAllowed);
          setIsFirstAdmin(Boolean(data.isFirstAdmin));
        }
      } catch {
        setIsSignupAllowed(false);
      } finally {
        setChecking(false);
      }
    };
    checkSetting();
  }, []);

  useEffect(() => {
    if (user) {
      router.replace("/audit");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      await signup(email, password, name);
      router.replace("/audit");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
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
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              width: "32px",
              height: "32px",
              border: "3px solid rgba(255, 255, 255, 0.3)",
              borderTopColor: "var(--kpmg-dynamic)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          <p style={{ marginTop: "16px", fontSize: "14px", color: "#6b7280" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!isSignupAllowed) {
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
        <div style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
          <div
            style={{
              backgroundColor: "var(--bg-darkcard)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)",
              padding: "40px",
            }}
          >
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "12px",
              }}
            >
              Sign Up Currently Disabled
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
              New account registration is not available at this time. Please contact your administrator.
            </p>
            <Link
              href="/auth/signin"
              style={{
                color: "var(--kpmg-dynamic)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "8px",
              }}
            >
              Create Account
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              Sign up to access TrustLens
            </p>
          </div>

          {isFirstAdmin && (
            <div
              style={{
                marginBottom: "24px",
                padding: "12px 14px",
                borderRadius: "8px",
                // backgroundColor: "rgba(243, 248, 248, 0.73)",
                border: "1px solid var(--dynamic-border)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                Initial System Setup
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                As the first user, your account will be granted System Administrator access.
              </div>
            </div>
          )}

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

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div>
              <label
                htmlFor="name"
                style={{
                  display: "block",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "6px",
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
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
                Email
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

            <div>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "6px",
                }}
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
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

            <div>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: "block",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "6px",
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={8}
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
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              Already have an account?{" "}
              <Link
                href="/auth/signin"
                style={{
                  color: "var(--kpmg-dynamic)",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
