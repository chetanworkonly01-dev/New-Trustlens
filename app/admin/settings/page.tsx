"use client";

import { useState, useEffect } from "react";
import AdminGuard from "@/components/Auth/AdminGuard";

export default function AdminSettingsPage() {
  const [isSignupAllowed, setIsSignupAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchSetting();
  }, []);

  const fetchSetting = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setIsSignupAllowed(data.isSignupAllowed);
      }
    } catch {
      setMessage('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isSignupAllowed: !isSignupAllowed }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsSignupAllowed(data.isSignupAllowed);
        setMessage(data.isSignupAllowed ? 'Sign up enabled successfully' : 'Sign up disabled successfully');
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to update setting');
      }
    } catch {
      setMessage('Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminGuard>
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
        <div style={{ width: "100%", maxWidth: "480px" }}>
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
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                Sign Up Settings
              </h1>
              <p style={{ fontSize: "14px", color: "#6b7280" }}>
                Control whether new users can create accounts
              </p>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
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
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    backgroundColor: isSignupAllowed
                      ? "rgba(0, 178, 169, 0.1)"
                      : "rgba(255, 51, 86, 0.1)",
                    border: `1px solid ${isSignupAllowed ? "rgba(0, 178, 169, 0.3)" : "rgba(255, 51, 86, 0.3)"}`,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: isSignupAllowed ? "#00B2A9" : "#FF3356",
                      marginBottom: "4px",
                    }}
                  >
                    {isSignupAllowed ? "OPEN" : "CLOSED"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>
                    {isSignupAllowed
                      ? "New users can sign up"
                      : "New users cannot sign up"}
                  </div>
                </div>

                <button
                  onClick={handleToggle}
                  disabled={saving}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: isSignupAllowed ? "#FF3356" : "#00B2A9",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    opacity: saving ? 0.6 : 1,
                    cursor: saving ? "default" : "pointer",
                    transition: "background-color 0.2s",
                  }}
                >
                  {saving ? "Saving..." : isSignupAllowed ? "Disable Sign Up" : "Enable Sign Up"}
                </button>

                {message && (
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor: message.includes('Failed') || message.includes('Failed')
                        ? "#fef2f2"
                        : "rgba(0, 178, 169, 0.1)",
                      color: message.includes('Failed') || message.includes('Failed')
                        ? "#991b1b"
                        : "#00B2A9",
                      fontSize: "14px",
                      textAlign: "center",
                    }}
                  >
                    {message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
