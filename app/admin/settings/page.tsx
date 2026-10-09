"use client";

import { useState, useEffect } from "react";
import AdminGuard from "@/components/Auth/AdminGuard";
import { useAuth } from "@/contexts/AuthContext";

interface UserItem {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
}

interface StorageData {
  formattedUsed: string;
  formattedTotal: string;
  usagePercent: number;
}

export default function AdminSettingsPage() {
  const { user: currentUser } = useAuth();
  const [isSignupAllowed, setIsSignupAllowed] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [storageData, setStorageData] = useState<StorageData | null>(null);
  const [loadingSetting, setLoadingSetting] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [savingSetting, setSavingSetting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<UserItem | null>(null);
  const [settingMessage, setSettingMessage] = useState("");
  const [userMessage, setUserMessage] = useState("");

  useEffect(() => {
    fetchSetting();
    fetchUsers();
    fetchStorage();
  }, []);

  const fetchSetting = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setIsSignupAllowed(data.isSignupAllowed);
      }
    } catch {
      setSettingMessage('Failed to load signup settings');
    } finally {
      setLoadingSetting(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        setUserMessage('Failed to load user accounts');
      }
    } catch {
      setUserMessage('Failed to load user accounts');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchStorage = async () => {
    setLoadingStorage(true);
    try {
      const res = await fetch('/api/admin/storage');
      if (res.ok) {
        const data = await res.json();
        setStorageData({
          formattedUsed: data.formattedUsed,
          formattedTotal: data.formattedTotal,
          usagePercent: data.usagePercent,
        });
      }
    } catch {
      // Ignore storage fetch error
    } finally {
      setLoadingStorage(false);
    }
  };

  const handleToggleSignup = async () => {
    setSavingSetting(true);
    setSettingMessage('');
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
        setSettingMessage(data.isSignupAllowed ? 'Sign up enabled successfully' : 'Sign up disabled successfully');
      } else {
        const error = await res.json();
        setSettingMessage(error.error || 'Failed to update setting');
      }
    } catch {
      setSettingMessage('Failed to update setting');
    } finally {
      setSavingSetting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingRoleId(userId);
    setUserMessage('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        setUserMessage(`Role updated to ${newRole.toUpperCase()} successfully.`);
      } else {
        const errData = await res.json();
        setUserMessage(errData.error || 'Failed to update user role.');
      }
    } catch {
      setUserMessage('Error updating user role in database.');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmUser) return;
    const userId = confirmUser.id;
    setDeletingId(userId);
    setUserMessage('');
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setUserMessage(`User ${confirmUser.email} deleted successfully.`);
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        const errData = await res.json();
        setUserMessage(errData.error || 'Failed to delete user.');
      }
    } catch {
      setUserMessage('Error deleting user account.');
    } finally {
      setDeletingId(null);
      setConfirmUser(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminGuard>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "75vh",
          alignItems: "center",
          background: "var(--gradient-bg)",
          padding: "32px 24px",
          gap: "32px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "960px" }}>

          {/* Header Banner */}
          <div style={{ marginBottom: "24px", textAlign: "left" }}>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "6px",
              }}
            >
              Admin Control Center
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              System settings and user account management for KPMG TrustLens
            </p>
          </div>

          {/* Grid Container for Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* 1. Minimal Database Storage Circular Gauge Card */}
            <div
              style={{
                backgroundColor: "var(--bg-darkcard)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)",
                padding: "24px 32px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                  Database Storage Usage
                </h2>
                <p style={{ fontSize: "13px", color: "#6b7280" }}>
                  Neon PostgreSQL database capacity
                </p>
              </div>

              {loadingStorage ? (
                <div style={{ padding: "30px 0", textAlign: "center" }}>
                  <div
                    style={{
                      display: "inline-block",
                      width: "28px",
                      height: "28px",
                      border: "3px solid rgba(255, 255, 255, 0.2)",
                      borderTopColor: "var(--kpmg-dynamic)",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                </div>
              ) : storageData ? (
                <div style={{ display: "flex", alignItems: "center", gap: "32px", padding: "8px 0" }}>
                  {/* Circular Storage Progress Ring */}
                  {(() => {
                    const usage = storageData.usagePercent;
                    const storageColor =
                      usage > 85
                        ? "#FF3356"
                        : usage > 60
                          ? "#F0AB00"
                          : "#00B2A9";

                    const radius = 26;
                    const circumference = 2 * Math.PI * radius; // ~163.36
                    const offset = circumference - (circumference * Math.max(0.5, Math.min(100, usage))) / 100;

                    return (
                      <div
                        style={{
                          position: "relative",
                          width: 64,
                          height: 64,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <svg width="64" height="64" viewBox="0 0 64 64">
                          {/* Unfilled track (Grey) */}
                          <circle
                            cx="32"
                            cy="32"
                            r={radius}
                            stroke="rgba(155, 152, 152, 0.21)"
                            strokeWidth="3.5"
                            fill="none"
                          />
                          {/* Consumed track (Green / Orange / Red) */}
                          <circle
                            cx="32"
                            cy="32"
                            r={radius}
                            stroke={storageColor}
                            strokeWidth="3.5"
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            transform="rotate(-90 32 32)"
                            style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
                          />
                        </svg>

                        {/* Centered Percentage Text */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: storageColor,
                              lineHeight: 1,
                            }}
                          >
                            {usage}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Minimal Storage Metrics */}
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                      Current Used Storage
                    </div>
                    <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "4px" }}>
                      {storageData.formattedUsed}
                    </div>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>
                      Total Capacity: <strong style={{ color: "var(--text-primary)" }}>{storageData.formattedTotal}</strong>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 2. Sign Up Settings Card */}
            <div
              style={{
                backgroundColor: "var(--bg-darkcard)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)",
                padding: "28px 32px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                    Sign Up Registration
                  </h2>
                  <p style={{ fontSize: "13px", color: "#6b7280" }}>
                    Control whether new external users can create accounts
                  </p>
                </div>

                {!loadingSetting && (
                  <button
                    onClick={handleToggleSignup}
                    disabled={savingSetting}
                    // style={{
                    //   padding: "10px 20px",
                    //   backgroundColor: isSignupAllowed ? "#FF3356" : "#00B2A9",
                    //   color: "white",
                    //   border: "none",
                    //   borderRadius: "8px",
                    //   fontSize: "14px",
                    //   fontWeight: 600,
                    //   opacity: savingSetting ? 0.6 : 1,
                    //   cursor: savingSetting ? "default" : "pointer",
                    //   transition: "all 0.2s",
                    // }}
                    className="btn btn-primary btn-md"
                  >
                    {savingSetting ? "Saving..." : isSignupAllowed ? "Disable Sign Up" : "Enable Sign Up"}
                  </button>
                )}
              </div>

              {loadingSetting ? (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <div className="spin-loader" />
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "14px 18px",
                    borderRadius: "8px",
                    backgroundColor: isSignupAllowed ? "rgba(0, 178, 169, 0.1)" : "rgba(255, 51, 86, 0.1)",
                    border: `1px solid ${isSignupAllowed ? "rgba(0, 178, 169, 0.3)" : "rgba(255, 51, 86, 0.3)"}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      backgroundColor: isSignupAllowed ? "#00B2A9" : "#FF3356",
                      color: "#ffffff",
                    }}
                  >
                    {isSignupAllowed ? "OPEN" : "CLOSED"}
                  </span>
                  <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                    {isSignupAllowed
                      ? "New user account registration is currently enabled."
                      : "Public user account creation is restricted."}
                  </span>
                </div>
              )}

              {settingMessage && (
                <div style={{ marginTop: "12px", fontSize: "13px", color: settingMessage.includes('Failed') ? '#FF3356' : '#00B2A9' }}>
                  {settingMessage}
                </div>
              )}
            </div>

            {/* 3. User Management Card */}
            <div
              style={{
                backgroundColor: "var(--bg-darkcard)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)",
                padding: "28px 32px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                    Registered Users & Roles
                  </h2>
                  <p style={{ fontSize: "13px", color: "#6b7280" }}>
                    Switch user roles dynamically or manage account access
                  </p>
                </div>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: "20px",
                    backgroundColor: "rgba(0, 178, 169, 0.15)",
                    color: "#00B2A9",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  {users.length} {users.length === 1 ? "User" : "Users"}
                </span>
              </div>

              {userMessage && (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    backgroundColor: userMessage.includes("Failed") || userMessage.includes("Error")
                      ? "rgba(255, 51, 86, 0.1)"
                      : "rgba(0, 178, 169, 0.1)",
                    border: `1px solid ${userMessage.includes("Failed") || userMessage.includes("Error")
                      ? "rgba(255, 51, 86, 0.3)"
                      : "rgba(0, 178, 169, 0.3)"
                      }`,
                    color: userMessage.includes("Failed") || userMessage.includes("Error") ? "#FF3356" : "#00B2A9",
                    fontSize: "13px",
                  }}
                >
                  {userMessage}
                </div>
              )}

              {loadingUsers ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div
                    style={{
                      display: "inline-block",
                      width: "28px",
                      height: "28px",
                      border: "3px solid rgba(255, 255, 255, 0.2)",
                      borderTopColor: "var(--kpmg-dynamic)",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                </div>
              ) : users.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#6b7280", fontSize: "14px" }}>
                  No user accounts found in database.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                      fontSize: "14px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                          color: "#9ca3af",
                          fontSize: "12px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        <th style={{ padding: "12px 16px" }}>User</th>
                        <th style={{ padding: "12px 16px" }}>Role Selector</th>
                        <th style={{ padding: "12px 16px" }}>Joined</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((userItem) => {
                        const isAdmin = userItem.role === "admin";
                        const isSelf = currentUser?.id === userItem.id;
                        const isUpdating = updatingRoleId === userItem.id;

                        return (
                          <tr
                            key={userItem.id}
                            style={{
                              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                              transition: "background-color 0.15s",
                            }}
                          >
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                {userItem.name || "Unnamed User"}
                                {isSelf && (
                                  <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(0, 178, 169, 0.2)", color: "#00B2A9" }}>
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                                {userItem.email}
                              </div>
                            </td>

                            <td style={{ padding: "14px 16px" }}>
                              {isSelf ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    // backgroundColor: "rgba(0, 51, 141, 0.35)",
                                    color: "#9ca3af",
                                    // border: "1px solid rgba(74, 144, 226, 0.4)",
                                  }}
                                >
                                  ADMIN (Active Session)
                                </span>
                              ) : (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                  <select
                                    value={userItem.role}
                                    onChange={(e) => handleRoleChange(userItem.id, e.target.value)}
                                    disabled={isUpdating}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: "6px",
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      backgroundColor: isAdmin
                                        ? "rgba(0, 51, 141, 0.35)"
                                        : "rgba(156, 163, 175, 0.15)",
                                      color: isAdmin ? "#4A90E2" : "#9ca3af",
                                      border: `1px solid ${isAdmin ? "rgba(74, 144, 226, 0.4)" : "rgba(156, 163, 175, 0.3)"
                                        }`,
                                      outline: "none",
                                      cursor: isUpdating ? "default" : "pointer",
                                      transition: "all 0.2s",
                                    }}
                                  >
                                    <option value="user" style={{ backgroundColor: "#1e293b", color: "#e5e7eb" }}>
                                      USER
                                    </option>
                                    <option value="admin" style={{ backgroundColor: "#1e293b", color: "#4A90E2" }}>
                                      ADMIN
                                    </option>
                                  </select>

                                  {isUpdating && (
                                    <span style={{ fontSize: "11px", color: "#00B2A9" }}>Updating...</span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: "13px" }}>
                              {formatDate(userItem.createdAt)}
                            </td>

                            <td style={{ padding: "14px 16px", textAlign: "right" }}>
                              {isAdmin ? (
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "#6b7280",
                                    fontStyle: "normal",
                                    // padding: "12px 12px",
                                  }}
                                >
                                  Protected
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmUser(userItem)}
                                  disabled={deletingId === userItem.id}
                                  style={{
                                    padding: "6px 14px",
                                    backgroundColor: "rgba(255, 51, 86, 0.15)",
                                    color: "#FF3356",
                                    border: "1px solid rgba(255, 51, 86, 0.3)",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    cursor: deletingId === userItem.id ? "default" : "pointer",
                                    transition: "all 0.2s",
                                  }}
                                >
                                  {deletingId === userItem.id ? "Deleting..." : "Delete User"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Confirmation Modal for Deleting User */}
      {confirmUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-darkcard)",
              borderRadius: "12px",
              padding: "28px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 251, 251, 0.1)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
              Delete User Account?
            </h3>
            <p style={{ fontSize: "14px", color: "#9ca3af", marginBottom: "20px", lineHeight: "1.5" }}>
              Are you sure you want to delete <strong style={{ color: "#ffffff" }}>{confirmUser.email}</strong>?
              This will permanently remove their access from PostgreSQL.
            </p>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setConfirmUser(null)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deletingId !== null}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#FF3356",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: deletingId !== null ? "default" : "pointer",
                  opacity: deletingId !== null ? 0.7 : 1,
                }}
              >
                {deletingId ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminGuard>
  );
}
