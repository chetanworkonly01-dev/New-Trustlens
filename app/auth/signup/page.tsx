"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const { signup, user, loading: authLoading } = useAuth();

  // Check if the current user is an admin (for creating additional users)
  useEffect(() => {
    if (!authLoading && user) {
      setIsAdmin(user.role === 'admin');
    }
  }, [user, authLoading]);

  // If not admin and not loading, redirect to signin
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/signin?callbackUrl=/auth/signup");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signup(email, password, name);
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
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

  // If we have a user but they're not an admin, show the "first user" setup
  // If we don't have a user, the redirect useEffect will handle it
  if (!user) {
    return null;
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
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "8px",
              }}
            >
              {isAdmin ? "Create New User" : "Create First Account"}
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              {isAdmin
                ? "Add a new user to the system"
                : "Set up your admin account to get started"}
            </p>
          </div>

          {!isAdmin && (
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderRadius: "8px",
                fontSize: "14px",
                color: "var(--kpmg-dynamic)",
              }}
            >
              Note: You are creating the first account which will have administrator privileges.
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
            style={{ display: "flex", flexDirection: "column", gap: "28px" }}
          >
            {!isAdmin && (
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
            )}

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
              <p
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  color: "#9ca3af",
                }}
              >
                Must contain at least one uppercase letter, one lowercase
                letter, and one number
              </p>
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
              {loading ? "Creating account..." : isAdmin ? "Create User" : "Create Admin Account"}
            </button>
          </form>

          {isAdmin && (
            <div style={{ marginTop: "32px", textAlign: "center" }}>
              <p style={{ fontSize: "14px", color: "#6b7280" }}>
                <Link
                  href="/"
                  style={{
                    color: "var(--kpmg-dynamic)",
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                >
                  Back to Dashboard
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
