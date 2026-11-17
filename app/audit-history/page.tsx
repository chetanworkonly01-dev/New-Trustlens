"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Audit } from "../../lib/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  PILLAR_META,
  TRUST_COLORS,
  TRUST_LABELS,
  COMPLIANCE_COLORS,
  COMPLIANCE_LABELS,
  getPerfGrade,
  getAuditTitle,
} from "../../lib/constants";

// Client-safe domain normalizer
function extractDomain(url?: string): string {
  if (!url || url === "PDF Document") return "PDF Document";
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

export default function AuditHistoryPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Multi-audit selection for consolidation
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);
  const [consolidating, setConsolidating] = useState<boolean>(false);
  const [consolidateError, setConsolidateError] = useState<string | null>(null);

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/signin?callbackUrl=/audit-history");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchInitialAudits = async () => {
      try {
        const res = await fetch("/api/audit/list?limit=3", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.audits)) {
            setAudits(data.audits);
            setTotalCount(data.totalCount || data.audits.length);
            setHasMore(data.hasMore ?? false);
          } else if (Array.isArray(data)) {
            setAudits(data.slice(0, 3));
            setTotalCount(data.length);
            setHasMore(data.length > 3);
          }
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    };
    fetchInitialAudits();
  }, [user]);

  const handleFetchAllAudits = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch("/api/audit/list?limit=all", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const allList = Array.isArray(data.audits)
          ? data.audits
          : Array.isArray(data)
            ? data
            : [];
        setAudits(allList);
        setTotalCount(allList.length);
        setHasMore(false);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const running = audits.filter(
    (a) => a.status !== "complete" && a.status !== "error",
  );
  const completed = audits
    .filter((a) => a.status === "complete")
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

  // Consolidation domain matching & selection logic
  const firstSelected = completed.find((a) => selectedAuditIds.includes(a.id));
  const activeDomain = firstSelected ? extractDomain(firstSelected.config?.url) : null;
  const matchingAudits = activeDomain
    ? completed.filter((a) => extractDomain(a.config?.url) === activeDomain)
    : [];
  const isAllDomainSelected =
    matchingAudits.length > 0 &&
    matchingAudits.every((a) => selectedAuditIds.includes(a.id));

  const handleToggleSelect = (auditId: string) => {
    setSelectedAuditIds((prev) => {
      if (prev.includes(auditId)) {
        return prev.filter((id) => id !== auditId);
      } else {
        return [...prev, auditId];
      }
    });
  };

  const handleConsolidateReport = async () => {
    if (selectedAuditIds.length < 2) return;
    setConsolidating(true);
    setConsolidateError(null);
    try {
      const res = await fetch("/api/export-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auditIds: selectedAuditIds,
          format: "pdf",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.details || data.error || "Failed to consolidate reports");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `TrustLens_Consolidated_Audit_${activeDomain || "Report"}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Consolidation error:", err);
      setConsolidateError(
        err instanceof Error ? err.message : "Failed to consolidate reports",
      );
    } finally {
      setConsolidating(false);
    }
  };

  // Pillar-aware aggregate stats
  const avgScore = completed.length
    ? Math.round(
      completed.reduce((s, a) => s + (a.displayScore ?? a.score.overall), 0) /
      completed.length,
    )
    : 0;
  const totalIssues = completed.reduce(
    (s, a) => s + (a.totalIssues ?? a.score.totalIssues),
    0,
  );
  const testsRun = completed.reduce((s, a) => s + (a.score.testsRun || 0), 0);
  const pillarsRun = [
    ...new Set(
      completed.flatMap((a) => a.config.enabledPillars || ["accessibility"]),
    ),
  ];

  return (
    <div className="container">
      <div style={{ marginTop: 44, marginBottom: 110 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            Audit History
          </h2>
          {/* <p style={{ fontSize: 14, color: "var(--offshade-text)" }}>
              Every finding is automatically mapped to the applicable regulation
              or standard
            </p> */}
          {completed.length > 0 && (
            <p
              style={{
                fontSize: 14,
                paddingTop: "2px",
                color: "var(--offshade-text)",
                margin: 0,
              }}
            >
              {completed.length} completed audit
              {completed.length !== 1 ? "s" : ""} — select audits to consolidate, or view any report
            </p>
          )}
        </div>
      </div>
      {/* ------------------- */}
      {completed.length > 0 && (
        <div className="grid-4 animate-slide-up" style={{ marginBottom: 28 }}>
          {[
            {
              val: totalCount,
              label: "Audits Completed",
              color: "var(--accent-blue)",
            },
            {
              val: `${avgScore}/100`,
              label: "Average Score",
              color:
                avgScore >= 75
                  ? "var(--kpmg-dynamic)"
                  : avgScore >= 50
                    ? "var(--kpmg-dynamic)"
                    : "var(--kpmg-dynamic)",
            },
            {
              val: totalIssues,
              label: "Total Issues Found",
              color: "var(--kpmg-dynamic)",
            },
            {
              val: pillarsRun.length,
              label: "Pillars Exercised",
              color: "var(--kpmg-teal)",
            },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div
                className="stat-value"
                style={{ color: "var(--kpmg-dynamic)" }}
              >
                {s.val}
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------------------- */}
      <div id="audits" style={{ marginBottom: 44 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            {/* <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 2 }}>
                📋 Audit History
              </h2> */}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {hasMore && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleFetchAllAudits}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : `Show All (${totalCount})`}
              </button>
            )}
            {selectedAuditIds.length >= 2 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConsolidateReport}
                disabled={consolidating}
                style={{
                  background: "linear-gradient(135deg, #0091DA 0%, #00338D 100%)",
                  borderColor: "#0091DA",
                  boxShadow: "0 2px 10px rgba(0, 145, 218, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 600,
                  cursor: consolidating ? "not-allowed" : "pointer",
                }}
                title="Merge selected audits into a single consolidated PDF report"
              >
                {consolidating ? (
                  <>
                    <div
                      style={{
                        width: 13,
                        height: 13,
                        border: "2px solid rgba(255, 255, 255, 0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <span>Consolidating ({selectedAuditIds.length})...</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 13 }}></span>
                    <span>Consolidate Report ({selectedAuditIds.length})</span>
                  </>
                )}
              </button>
            )}
            <Link href="/audit" className="btn btn-primary btn-sm">
              + New Audit
            </Link>
          </div>
        </div>

        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: 44,
            }}
          >
            <div
              className="spinner"
              style={{ margin: "0 auto", marginBottom: 12 }}
            />
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Loading audits...
            </p>
          </div>
        )}

        {!loading && completed.length === 0 && (
          <div
            className="glass-card"
            style={{ textAlign: "center", padding: 56 }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}></div>
            <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 22 }}>
              No Audits Yet
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: 10,
                fontSize: 14,
              }}
            >
              Start your first TrustLens audit to get enterprise-grade digital
              trust insights.
            </p>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                marginBottom: 24,
              }}
            >
              Choose any combination of Accessibility · Dark Patterns ·
              Performance ·
            </p>
            <Link href="/audit" className="btn btn-primary btn-lg">
              Start First Audit
            </Link>
          </div>
        )}

        {/* Domain Consolidation Control Bar */}
        {activeDomain && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 18px",
              borderRadius: 10,
              background: "rgba(0, 145, 218, 0.08)",
              border: "1px solid rgba(0, 145, 218, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#0091DA",
                  boxShadow: "0 0 8px #0091DA",
                }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--kpmg-dynamic)" }}>
                  Domain Locked:{" "}
                  <span style={{ color: "var(--accent-blue, #0091DA)" }}>{activeDomain}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--offshade-text)" }}>
                  {selectedAuditIds.length} of {matchingAudits.length} audit{matchingAudits.length !== 1 ? "s" : ""} selected
                  {completed.length - matchingAudits.length > 0 &&
                    ` (${completed.length - matchingAudits.length} different domain audit${completed.length - matchingAudits.length !== 1 ? "s" : ""} disabled)`}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (isAllDomainSelected) {
                    setSelectedAuditIds([]);
                  } else {
                    setSelectedAuditIds(matchingAudits.map((a) => a.id));
                  }
                }}
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  fontWeight: 600,
                  borderColor: "rgba(0, 145, 218, 0.35)",
                }}
              >
                {isAllDomainSelected
                  ? "Deselect All"
                  : `Select All for ${activeDomain} (${matchingAudits.length})`}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedAuditIds([])}
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  color: "var(--offshade-text)",
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {consolidateError && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 16px",
              borderRadius: 8,
              background: "rgba(255, 51, 86, 0.1)",
              border: "1px solid rgba(255, 51, 86, 0.3)",
              color: "#FF3356",
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{consolidateError}</span>
            <button
              onClick={() => setConsolidateError(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#FF3356",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {completed.map((a) => {
            let pillars =
              a.config?.enabledPillars ?? Object.keys(a.pillarScores ?? {});
            if (pillars.length === 0) pillars = ["accessibility"];
            const isPerfOnly =
              pillars.length === 1 && pillars[0] === "performance";
            const isA11yOnly =
              pillars.length === 0 ||
              (pillars.length === 1 && pillars[0] === "accessibility");
            const displayScore = a.displayScore ?? a.score.overall;
            const issueCount = a.totalIssues ?? a.score.totalIssues;
            const pillarScores = a.pillarScores ?? {};
            const trustColor = a.trustScore
              ? TRUST_COLORS[a.trustScore.trustLevel] || "#0091DA"
              : displayScore >= 75
                ? "#00BA8C"
                : displayScore >= 50
                  ? "#F0AB00"
                  : "#FF3356";
            const level = a.config?.wcagLevels?.includes("AAA")
              ? "AAA"
              : a.config?.wcagLevels?.includes("AA")
                ? "AA"
                : "A";
            const auditTitle = getAuditTitle(pillars);
            const perfGrade = isPerfOnly ? getPerfGrade(displayScore) : null;

            const auditDomain = extractDomain(a.config?.url);
            const isSelected = selectedAuditIds.includes(a.id);
            const isDomainMatch = !activeDomain || auditDomain === activeDomain;
            const isDisabled = activeDomain !== null && !isDomainMatch;

            return (
              <div
                key={a.id}
                className="glass-card"
                onClick={() => {
                  if (!isDisabled) {
                    handleToggleSelect(a.id);
                  }
                }}
                style={{
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  transition: "all 0.18s ease",
                  border: isSelected
                    ? "2px solid #0091DA"
                    : isDisabled
                      ? "1px dashed rgba(255, 255, 255, 0.12)"
                      : "1px solid var(--border)",
                  background: isSelected
                    ? "rgba(0, 145, 218, 0.08)"
                    : "var(--card-bg, rgba(255, 255, 255, 0.03))",
                  boxShadow: isSelected
                    ? "0 4px 20px rgba(0, 145, 218, 0.18)"
                    : undefined,
                  opacity: isDisabled ? 0.38 : 1,
                  filter: isDisabled ? "grayscale(40%)" : "none",
                  position: "relative",
                  borderRadius: "12px",
                  padding: "16px",
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) {
                    (e.currentTarget as HTMLDivElement).style.transform =
                      "translateY(-2px)";
                    if (!isSelected) {
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        "0 8px 32px rgba(0,0,0,0.18)";
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled) {
                    (e.currentTarget as HTMLDivElement).style.transform = "";
                    if (!isSelected) {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                    }
                  }
                }}
              >
                {/* Top row: score circle + info + badge */}
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                  }}
                >
                  {/* Score circle */}
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      border: `2.5px solid ${trustColor}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background: `${trustColor}08`,
                    }}
                  >
                    {isPerfOnly && perfGrade ? (
                      <>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: perfGrade.color,
                            lineHeight: 1,
                          }}
                        >
                          {perfGrade.label}
                        </div>
                        <div
                          style={{
                            fontSize: 7.5,
                            color: "var(--text-scondary)",
                            letterSpacing: "0.03em",
                          }}
                        >
                          {perfGrade.sub}
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: trustColor,
                            lineHeight: 1,
                          }}
                        >
                          {displayScore}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: "var(--offshade-text)",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {a.trustScore ? "Trust" : "Score"}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* URL + audit type */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 18,
                        marginBottom: 5,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 300,
                        }}
                      >
                        {a.config?.url || "PDF Document"}
                      </span>
                      {/* <span
                            style={{
                              fontSize: 13,
                              padding: "2px 7px",
                              borderRadius: 99,
                              background: "rgba(0,145,218,0.1)",
                              color: "var(--accent-blue)",
                              border: "1px solid rgba(0,145,218,0.25)",
                              fontWeight: 700,
                            }}
                          >
                            {auditTitle}
                          </span> */}
                      {isA11yOnly && (
                        <span
                          className={`audit-level-chip ${level.toLowerCase()}`}
                          style={{ fontSize: 12, padding: "2px 7px" }}
                        >
                          {a.config?.standard || "WCAG 2.2"} {level}
                        </span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div
                      style={{
                        display: "flex",
                        gap: 18,
                        fontSize: 13,
                        color: "var(--offshade-text)",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      {/* Pillar badges */}
                      {pillars.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {pillars.map((p) => {
                            const m = PILLAR_META[p];
                            if (!m) return null;
                            return (
                              <span
                                key={p}
                                style={{
                                  fontSize: 12,
                                  padding: "2px 10px",
                                  borderRadius: 99,
                                  background: `${m.color}18`,
                                  color: m.color,
                                  border: `1px solid var(--kpmg-dynamic)`,
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  lineHeight: "1.4",
                                }}
                              >
                                {m.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Meta row */}
                    <div
                      style={{
                        display: "flex",
                        gap: 18,
                        fontSize: 13,
                        color: "var(--offshade-text)",
                        flexWrap: "wrap",
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      <span
                        style={{
                          padding: "2px 7px",
                          borderRadius: 99,
                          border: "1px solid var(--kpmg-dynamic)",
                          // background: "var(--kpmg-dynamic)",
                          color: "var(--offshade-text)",
                          fontWeight: 200,
                          fontSize: 12,
                        }}
                      >
                        {a.crawlCoverage?.pagesAudited ?? "—"} pages
                      </span>
                      <span
                        style={{
                          padding: "2px 7px",
                          borderRadius: 99,
                          border: "1px solid var(--kpmg-dynamic)",
                          // background: "var(--kpmg-dynamic)",
                          color: "var(--offshade-text)",
                          fontWeight: 200,
                          fontSize: 12,
                        }}
                      >
                        {issueCount} issue{issueCount !== 1 ? "s" : ""}
                      </span>
                      {a.crawlCoverage && (
                        <span
                          style={{
                            padding: "2px 7px",
                            borderRadius: 99,
                            border: "1px solid var(--kpmg-dynamic)",
                            // background: "var(--kpmg-dynamic)",
                            color: "var(--offshade-text)",
                            fontWeight: 200,
                            fontSize: 12,
                          }}
                        >
                          {a.crawlCoverage.coveragePercent}% coverage
                        </span>
                      )}
                      <span
                        style={{
                          padding: "2px 7px",
                          borderRadius: 99,
                          border: "1px solid var(--kpmg-dynamic)",
                          // background: "var(--kpmg-dynamic)",
                          color: "var(--offshade-text)",
                          fontWeight: 200,
                          fontSize: 12,
                        }}
                      >
                        {" "}
                        {new Date(a.startedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Right badge — trust level for multi-pillar, compliance for a11y, grade for perf */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    {/* Selection status badge */}
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 9px",
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: isSelected
                          ? "#0091DA"
                          : isDisabled
                            ? "rgba(128, 128, 128, 0.15)"
                            : "rgba(0, 145, 218, 0.08)",
                        color: isSelected
                          ? "#ffffff"
                          : isDisabled
                            ? "rgba(180, 180, 180, 0.7)"
                            : "#0091DA",
                        border: isSelected
                          ? "1px solid #0091DA"
                          : isDisabled
                            ? "1px solid rgba(128, 128, 128, 0.3)"
                            : "1px solid rgba(0, 145, 218, 0.25)",
                        userSelect: "none",
                      }}
                    >
                      {isSelected ? (
                        <>
                          <span>✓</span>
                          <span>Selected</span>
                        </>
                      ) : isDisabled ? (
                        <>
                          <span>🔒</span>
                          <span>Different Domain</span>
                        </>
                      ) : (
                        <>
                          <span>○</span>
                          <span>Select</span>
                        </>
                      )}
                    </div>

                    {a.trustScore ? (
                      <span
                        style={{
                          fontSize: 13,
                          padding: "4px 10px",
                          borderRadius: 99,
                          fontWeight: 700,
                          background: `${TRUST_COLORS[a.trustScore.trustLevel] || trustColor}18`,
                          color:
                            TRUST_COLORS[a.trustScore.trustLevel] ||
                            trustColor,
                          border: `1px solid ${TRUST_COLORS[a.trustScore.trustLevel] || trustColor}40`,
                        }}
                      >
                        {TRUST_LABELS[a.trustScore.trustLevel] ||
                          a.trustScore.trustLevel}
                      </span>
                    ) : isPerfOnly ? (
                      <span
                        style={{
                          fontSize: 13,
                          padding: "4px 10px",
                          borderRadius: 99,
                          fontWeight: 700,
                          background: `${trustColor}18`,
                          color: trustColor,
                          border: `1px solid ${trustColor}40`,
                        }}
                      >
                        {getPerfGrade(displayScore).sub}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 13,
                          padding: "4px 10px",
                          borderRadius: 99,
                          fontWeight: 700,
                          background: `${COMPLIANCE_COLORS[a.score.complianceLevel] || "#0091DA"}18`,
                          color:
                            COMPLIANCE_COLORS[a.score.complianceLevel] ||
                            "#0091DA",
                          border: `1px solid ${COMPLIANCE_COLORS[a.score.complianceLevel] || "#0091DA"}40`,
                        }}
                      >
                        {COMPLIANCE_LABELS[a.score.complianceLevel] ||
                          a.score.complianceLevel}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/audit/${a.id}/report`);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: "4px 8px",
                        color: "var(--accent-blue, #0091DA)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        borderRadius: 6,
                        transition: "background 0.15s",
                        marginTop: 4,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "rgba(0, 145, 218, 0.12)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "transparent";
                      }}
                    >
                      View Report →
                    </button>
                  </div>
                </div>

                {/* Per-pillar score bar (multi-pillar only) */}
                {Object.keys(pillarScores).length > 1 && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {Object.entries(pillarScores).map(([p, ps]) => {
                      const m = PILLAR_META[p];
                      if (!m) return null;
                      const barColor =
                        ps >= 75
                          ? "var(--kpmg-dynamic)"
                          : ps >= 50
                            ? "var(--kpmg-dynamic)"
                            : "var(--kpmg-dynamic)";
                      return (
                        <div key={p} style={{ flex: 1, minWidth: 80 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 14,
                              marginBottom: 3,
                              color: "var(--text-secondary)",
                            }}
                          >
                            <span style={{ color: m.color, fontWeight: 700 }}>
                              {/* {m.icon} */}
                              {m.label}
                            </span>
                            <span
                              style={{ color: barColor, fontWeight: 700 }}
                            >
                              {ps}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 4,
                              borderRadius: 99,
                              background: "var(--border)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${ps}%`,
                                background: barColor,
                                borderRadius: 99,
                                transition: "width 0.6s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasMore && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button
              className="btn btn-secondary"
              onClick={handleFetchAllAudits}
              disabled={loadingMore}
              style={{
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                cursor: loadingMore ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {loadingMore ? (
                <>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                      borderTopColor: "var(--kpmg-dynamic)",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <span>Fetching remaining audits...</span>
                </>
              ) : (
                <span>Show More Audits ({totalCount - completed.length} remaining) →</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
