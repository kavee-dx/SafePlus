import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle,
  ClipboardList,
  Home,
  Inbox,
  KeyRound,
  Loader2,
  LogOut,
  Megaphone,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type { AuthUser } from "../types/auth";
import type { DisasterWarning, DistrictCoverage, WarningStatus } from "../types/warning";
import type { HazardReport } from "../types/hazardReport";
import {
  fetchCoverage,
  fetchPendingReports,
  fetchWarnings,
  standDownWarning,
  type CoverageResponse,
} from "../services/dushani-alertApi";
import NotificationBell from "../components/dushani-NotificationBell";
import WarningWizard from "../components/dushani-WarningWizard";
import HazardReportQueue from "./dushani-HazardReportQueue";
import ClearancePinCard from "../components/dushani-ClearancePinCard";

interface DmcOfficerDashboardProps {
  officer: AuthUser;
  onLogout: () => void;
}

type DashboardView = "overview" | "reports" | "issue" | "history" | "pin";

const VIEW_TITLES: Record<DashboardView, { title: string; subtitle: string }> = {
  overview: {
    title: "Dashboard overview",
    subtitle: "Live figures read from the alert tables",
  },
  reports: {
    title: "Hazard report queue",
    subtitle: "Verify citizen reports - a warning can only be raised on a verified one",
  },
  issue: {
    title: "Issue location-based warning",
    subtitle: "Report, target area, payload, PIN authorization, delivery telemetry",
  },
  history: {
    title: "Alert history",
    subtitle: "Every draft and broadcast raised from this account, with per-channel results",
  },
  pin: {
    title: "Clearance PIN",
    subtitle: "The operational authorization that releases a broadcast",
  },
};

export default function DmcOfficerDashboard({
  officer,
  onLogout,
}: DmcOfficerDashboardProps) {
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [wizardReportId, setWizardReportId] = useState<string | undefined>();
  const [wizardKey, setWizardKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Only a DMC officer may broadcast; a district officer verifies reports.
  const canIssue = officer.role === "DMC_OFFICER";

  const openWizard = (reportId?: string) => {
    setWizardReportId(reportId);
    setWizardKey((key) => key + 1);
    setCurrentView("issue");
  };

  const go = (view: DashboardView) => {
    setCurrentView(view);
    setRefreshKey((key) => key + 1);
  };

  const nav: { view: DashboardView; label: string; icon: typeof Home }[] = [
    { view: "overview", label: "Overview", icon: Home },
    { view: "reports", label: "Report queue", icon: Inbox },
    ...(canIssue
      ? [{ view: "issue" as DashboardView, label: "Issue warning", icon: Megaphone }]
      : []),
    { view: "history", label: "Alert history", icon: ClipboardList },
    ...(canIssue
      ? [{ view: "pin" as DashboardView, label: "Clearance PIN", icon: KeyRound }]
      : []),
  ];

  return (
    <div className="dmc-dashboard">
      <aside
        className={`dmc-sidebar ${sidebarOpen ? "dmc-sidebar-open" : "dmc-sidebar-closed"}`}
      >
        <div className="dmc-sidebar-header">
          <div className="dmc-sidebar-brand">
            <div className="dmc-sidebar-brand-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="dmc-sidebar-brand-name">
                Safe<span>Plus</span>
              </div>
              <div className="dmc-sidebar-brand-subtitle">DMC Portal</div>
            </div>
          </div>
          <button
            className="dmc-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={18} /> : <Activity size={18} />}
          </button>
        </div>

        <nav className="dmc-sidebar-nav">
          {nav.map((item) => (
            <button
              key={item.view}
              className={`dmc-nav-item ${currentView === item.view ? "dmc-nav-item-active" : ""}`}
              onClick={() => (item.view === "issue" ? openWizard() : go(item.view))}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="dmc-sidebar-footer">
          <div className="dmc-officer-info">
            <div className="dmc-officer-avatar">
              {officer.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="dmc-officer-details">
              <div className="dmc-officer-name">{officer.fullName}</div>
              <div className="dmc-officer-role">{officer.role.replace("_", " ")}</div>
            </div>
          </div>

          <button className="dmc-logout-button" onClick={onLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="dmc-main-content">
        <header className="dmc-content-header">
          <div className="dmc-header-title">
            <h1>{VIEW_TITLES[currentView].title}</h1>
            <p>{VIEW_TITLES[currentView].subtitle}</p>
          </div>

          <div className="dmc-header-actions">
            <NotificationBell />
          </div>
        </header>

        <div className="dmc-content-body">
          {currentView === "overview" && (
            <OverviewView
              key={refreshKey}
              canIssue={canIssue}
              onVerifyReports={() => go("reports")}
              onIssueWarning={() => openWizard()}
            />
          )}

          {currentView === "reports" && (
            <HazardReportQueue onIssueWarning={(reportId) => openWizard(reportId)} />
          )}

          {currentView === "issue" && (
            <WarningWizard
              key={wizardKey}
              initialReportId={wizardReportId}
              onExit={() => go("overview")}
              onSetupPin={() => go("pin")}
              onViewHistory={() => go("history")}
            />
          )}

          {currentView === "history" && (
            <HistoryView key={refreshKey} onIssueWarning={() => openWizard()} />
          )}

          {currentView === "pin" && <ClearancePinCard />}
        </div>
      </main>

      <style>{DASHBOARD_STYLES}</style>
    </div>
  );
}

function OverviewView({
  canIssue,
  onVerifyReports,
  onIssueWarning,
}: {
  canIssue: boolean;
  onVerifyReports: () => void;
  onIssueWarning: () => void;
}) {
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [pending, setPending] = useState<HazardReport[]>([]);
  const [warnings, setWarnings] = useState<DisasterWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchCoverage(), fetchPendingReports(), fetchWarnings()])
      .then(([coverageResult, pendingResult, warningResult]) => {
        if (cancelled) {
          return;
        }

        setCoverage(coverageResult);
        setPending(pendingResult);
        setWarnings(warningResult);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(messageOf(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const active = warnings.filter((warning) => warning.status === "ACTIVE");
  const drafts = warnings.filter(
    (warning) => warning.status === "DRAFT" || warning.status === "PENDING_DISPATCH"
  );
  const delivered = warnings.reduce(
    (total, warning) =>
      total + (warning.broadcastLogs ?? []).reduce((sum, log) => sum + log.deliveryCount, 0),
    0
  );

  return (
    <div className="dmc-overview">
      {loading && (
        <div className="dmc-loading">
          <Loader2 className="dmc-spin" size={18} /> Reading live alert data…
        </div>
      )}

      {error && (
        <div className="dmc-error-card">
          <AlertTriangle size={18} />
          <div>
            <h3>Overview could not be loaded</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="dmc-stats-grid">
            <StatCard
              tone="active"
              icon={<AlertTriangle size={22} />}
              value={active.length}
              label="Active warnings"
            />
            <StatCard
              tone="warning"
              icon={<Inbox size={22} />}
              value={pending.length}
              label="Reports awaiting verification"
            />
            <StatCard
              tone="info"
              icon={<Users size={22} />}
              value={formatCount(coverage?.totalAlertedAccounts ?? 0)}
              label="Reachable registered accounts"
            />
            <StatCard
              tone="success"
              icon={<CheckCircle size={22} />}
              value={formatCount(delivered)}
              label="Deliveries recorded"
            />
          </div>

          <div className="dmc-columns">
            <section className="dmc-panel">
              <h2>Ready to act on</h2>

              <div className="dmc-action-list">
                <div className="dmc-action-row">
                  <div>
                    <h3>
                      {pending.length} report{pending.length === 1 ? "" : "s"} need a decision
                    </h3>
                    <p>Verifying one unlocks issuing a warning on it.</p>
                  </div>
                  <button type="button" className="dmc-action-button" onClick={onVerifyReports}>
                    Open queue
                  </button>
                </div>

                <div className="dmc-action-row">
                  <div>
                    <h3>
                      {drafts.length} draft warning{drafts.length === 1 ? "" : "s"} waiting
                    </h3>
                    <p>A draft still needs its PIN authorization to go out.</p>
                  </div>
                  {canIssue && (
                    <button
                      type="button"
                      className="dmc-action-button dmc-action-button-primary"
                      onClick={onIssueWarning}
                    >
                      Issue warning
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="dmc-panel">
              <h2>Alert coverage by district</h2>

              {!coverage || coverage.byDistrict.length === 0 ? (
                <p className="dmc-empty">
                  No registered account has a district on file yet. Citizens set theirs in the
                  mobile app.
                </p>
              ) : (
                <ul className="dmc-coverage-list">
                  {coverage.byDistrict.slice(0, 8).map((row) => (
                    <CoverageRow
                      key={row.district ?? "unset"}
                      row={row}
                      total={coverage.totalAlertedAccounts}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="dmc-panel">
            <h2>Recent warnings</h2>

            {warnings.length === 0 ? (
              <p className="dmc-empty">
                Nothing broadcast yet. Verify a report, then issue the first warning.
              </p>
            ) : (
              <div className="dmc-alert-list">
                {warnings.slice(0, 5).map((warning) => (
                  <div
                    key={warning.id}
                    className={`dmc-alert-item dmc-alert-${tone(warning.status)}`}
                  >
                    <div className="dmc-alert-status">{humanize(warning.status)}</div>
                    <div className="dmc-alert-details">
                      <div className="dmc-alert-title">
                        {humanize(warning.hazardType)} · {humanize(warning.severityLevel)}
                      </div>
                      <div className="dmc-alert-location">
                        {warning.targetDistrict} District · {warning.audienceCount} accounts ·{" "}
                        {warning.warningId}
                      </div>
                    </div>
                    <div className="dmc-alert-time">{relativeTime(warning.updatedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <style>{OVERVIEW_STYLES}</style>
    </div>
  );
}

function CoverageRow({ row, total }: { row: DistrictCoverage; total: number }) {
  const share = total > 0 ? Math.round((row.count / total) * 100) : 0;

  return (
    <li className="dmc-coverage-row">
      <span className="dmc-coverage-name">{row.district ?? "District not set"}</span>
      <span className="dmc-coverage-bar">
        <span className="dmc-coverage-fill" style={{ width: `${Math.max(2, share)}%` }} />
      </span>
      <span className="dmc-coverage-count">
        {row.count} ({share}%)
      </span>
    </li>
  );
}

function StatCard({
  tone,
  icon,
  value,
  label,
}: {
  tone: "active" | "warning" | "info" | "success";
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className={`dmc-stat-card dmc-stat-card-${tone}`}>
      <div className="dmc-stat-icon">{icon}</div>
      <div className="dmc-stat-content">
        <div className="dmc-stat-value">{value}</div>
        <div className="dmc-stat-label">{label}</div>
      </div>
    </div>
  );
}

function HistoryView({ onIssueWarning }: { onIssueWarning: () => void }) {
  const [warnings, setWarnings] = useState<DisasterWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    fetchWarnings()
      .then((items) => {
        setWarnings(items);
        setError(null);
      })
      .catch((loadError) => {
        setError(messageOf(loadError));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const standDown = async (warning: DisasterWarning) => {
    setBusyId(warning.id);
    setError(null);

    try {
      const updated = await standDownWarning(warning.id);

      setWarnings((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (actionError) {
      setError(messageOf(actionError));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="dmc-history">
      <div className="dmc-panel-head">
        <p className="dmc-muted">
          {warnings.length} warning{warnings.length === 1 ? "" : "s"} on record. Select a row to
          see its target, delivery log and message.
        </p>
        <div className="dmc-header-actions">
          <button
            type="button"
            className="dmc-action-button"
            onClick={() => {
              setLoading(true);
              setToken((current) => current + 1);
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            className="dmc-action-button dmc-action-button-primary"
            onClick={onIssueWarning}
          >
            <Megaphone size={14} /> New warning
          </button>
        </div>
      </div>

      {error && (
        <div className="dmc-error-card">
          <AlertTriangle size={18} />
          <div>
            <h3>History problem</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="dmc-loading">
          <Loader2 className="dmc-spin" size={18} /> Loading warnings…
        </div>
      )}

      {!loading && warnings.length === 0 && (
        <div className="dmc-panel">
          <p className="dmc-empty">No warnings raised from this account yet.</p>
        </div>
      )}

      {!loading &&
        warnings.map((warning) => {
          const open = openId === warning.id;

          return (
            <article key={warning.id} className="dmc-history-card">
              <button
                type="button"
                className={`dmc-history-row dmc-alert-${tone(warning.status)}`}
                onClick={() => setOpenId(open ? null : warning.id)}
              >
                <span className="dmc-alert-status">{humanize(warning.status)}</span>
                <span className="dmc-history-main">
                  <span className="dmc-alert-title">
                    {humanize(warning.hazardType)} · {humanize(warning.severityLevel)} ·{" "}
                    {warning.targetDistrict}
                  </span>
                  <span className="dmc-alert-location">
                    {warning.warningId} · report {warning.report?.reportId ?? "linked"} ·{" "}
                    {warning.audienceCount} accounts
                  </span>
                </span>
                <span className="dmc-alert-time">{relativeTime(warning.updatedAt)}</span>
              </button>

              {open && (
                <div className="dmc-history-detail">
                  <div className="dmc-detail-block">
                    <h4>Target</h4>
                    <p>
                      {warning.gisPolygon
                        ? `${
                            warning.gisPolygon.source === "CUSTOM"
                              ? "Drawn polygon"
                              : "District polygon"
                          } · ${warning.gisPolygon.areaSqKm} km²${
                            warning.gisPolygon.districtOverlapRatio !== undefined
                              ? ` · ${(warning.gisPolygon.districtOverlapRatio * 100).toFixed(1)}% inside ${warning.targetDistrict}`
                              : ""
                          }`
                        : `${warning.targetDistrict} District (whole district)`}
                    </p>
                  </div>

                  <div className="dmc-detail-block">
                    <h4>Channels and delivery</h4>

                    {(warning.broadcastLogs ?? []).length === 0 ? (
                      <p className="dmc-muted">
                        Not broadcast yet - this warning is {humanize(warning.status).toLowerCase()}.
                      </p>
                    ) : (
                      <ul className="dmc-log-list">
                        {(warning.broadcastLogs ?? []).map((log) => (
                          <li key={log.id} className="dmc-log-item">
                            <strong>{humanize(log.channelType)}</strong> · {humanize(log.status)} ·{" "}
                            {log.deliveryCount}/{log.targetCount} delivered
                            {log.errorMessage ? ` · ${log.errorMessage}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="dmc-detail-block">
                    <h4>Alert payload</h4>
                    <p className="dmc-message">{warning.englishMessage}</p>
                    <p className="dmc-message">{warning.sinhalaMessage}</p>
                    <p className="dmc-message">{warning.tamilMessage}</p>
                  </div>

                  {warning.status === "ACTIVE" && (
                    <button
                      type="button"
                      className="dmc-action-button dmc-action-button-standdown"
                      onClick={() => void standDown(warning)}
                      disabled={busyId === warning.id}
                    >
                      {busyId === warning.id ? (
                        <Loader2 className="dmc-spin" size={14} />
                      ) : (
                        <Ban size={14} />
                      )}
                      Stand down
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}

      <style>{HISTORY_STYLES}</style>
    </div>
  );
}

function tone(status: WarningStatus): string {
  if (status === "ACTIVE") return "critical";
  if (status === "DRAFT" || status === "PENDING_DISPATCH") return "high";

  return "medium";
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const DASHBOARD_STYLES = `
  .dmc-dashboard {
    display: flex;
    min-height: 100vh;
    background: ${Colors.background};
    font-family: Inter, system-ui, -apple-system, sans-serif;
  }

  .dmc-sidebar {
    width: 280px;
    background: ${Colors.navy};
    color: ${Colors.white};
    display: flex;
    flex-direction: column;
    transition: width 240ms ease;
    flex-shrink: 0;
  }

  .dmc-sidebar-closed {
    width: 72px;
  }

  .dmc-sidebar-header {
    padding: 24px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .dmc-sidebar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dmc-sidebar-brand-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: ${Colors.red};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .dmc-sidebar-brand-name {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .dmc-sidebar-brand-name span {
    color: ${Colors.red};
  }

  .dmc-sidebar-brand-subtitle {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #98a2b3;
    margin-top: 2px;
  }

  .dmc-sidebar-toggle {
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: ${Colors.white};
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dmc-sidebar-toggle:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .dmc-sidebar-nav {
    flex: 1;
    padding: 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .dmc-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: none;
    background: transparent;
    color: #98a2b3;
    font-size: 13px;
    font-weight: 600;
    border-radius: 9px;
    cursor: pointer;
    text-align: left;
  }

  .dmc-nav-item:hover {
    background: rgba(255, 255, 255, 0.06);
    color: ${Colors.white};
  }

  .dmc-nav-item-active {
    background: ${Colors.red};
    color: ${Colors.white};
  }

  .dmc-sidebar-closed .dmc-nav-item span,
  .dmc-sidebar-closed .dmc-sidebar-brand-name,
  .dmc-sidebar-closed .dmc-sidebar-brand-subtitle,
  .dmc-sidebar-closed .dmc-officer-details,
  .dmc-sidebar-closed .dmc-logout-button span {
    display: none;
  }

  .dmc-sidebar-footer {
    padding: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .dmc-officer-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .dmc-officer-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .dmc-officer-name {
    font-size: 13px;
    font-weight: 700;
    color: ${Colors.white};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dmc-officer-role {
    font-size: 10px;
    color: #98a2b3;
    margin-top: 2px;
    text-transform: capitalize;
  }

  .dmc-logout-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 14px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: transparent;
    color: #fda29b;
    font-size: 12px;
    font-weight: 700;
    border-radius: 9px;
    cursor: pointer;
  }

  .dmc-logout-button:hover {
    background: rgba(217, 45, 32, 0.15);
    border-color: ${Colors.red};
    color: ${Colors.red};
  }

  .dmc-main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .dmc-content-header {
    padding: 28px 40px;
    background: ${Colors.white};
    border-bottom: 1px solid ${Colors.border};
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .dmc-header-title h1 {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: ${Colors.text};
    margin: 0 0 6px;
  }

  .dmc-header-title p {
    font-size: 14px;
    color: ${Colors.muted};
    margin: 0;
  }

  .dmc-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dmc-content-body {
    flex: 1;
    padding: 36px 40px;
    overflow-y: auto;
  }

  .dmc-loading,
  .dmc-error-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 20px;
    border-radius: 12px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.muted};
    font-size: 13px;
  }

  .dmc-error-card {
    border-color: ${Colors.red};
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }

  .dmc-error-card h3 {
    margin: 0 0 4px;
    font-size: 14px;
  }

  .dmc-error-card p {
    margin: 0;
    font-size: 12px;
  }

  .dmc-spin {
    animation: dmc-spin 900ms linear infinite;
  }

  @keyframes dmc-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1024px) {
    .dmc-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
    }

    .dmc-sidebar-closed {
      left: -280px;
      width: 280px;
    }

    .dmc-content-header,
    .dmc-content-body {
      padding: 22px;
    }
  }
`;

const OVERVIEW_STYLES = `
  .dmc-overview {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .dmc-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 16px;
  }

  .dmc-stat-card {
    padding: 22px;
    border-radius: 14px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .dmc-stat-icon {
    width: 50px;
    height: 50px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .dmc-stat-card-active .dmc-stat-icon {
    background: ${Colors.redLight};
    color: ${Colors.red};
  }

  .dmc-stat-card-success .dmc-stat-icon {
    background: #dcfce7;
    color: #16a34a;
  }

  .dmc-stat-card-info .dmc-stat-icon {
    background: ${Colors.blueLight};
    color: ${Colors.blue};
  }

  .dmc-stat-card-warning .dmc-stat-icon {
    background: ${Colors.amberLight};
    color: ${Colors.amber};
  }

  .dmc-stat-value {
    font-size: 26px;
    font-weight: 800;
    color: ${Colors.text};
    letter-spacing: -0.03em;
  }

  .dmc-stat-label {
    font-size: 12px;
    color: ${Colors.muted};
    font-weight: 600;
    margin-top: 2px;
  }

  .dmc-columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 18px;
  }

  .dmc-panel {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    padding: 22px;
  }

  .dmc-panel h2 {
    margin: 0 0 16px;
    font-size: 17px;
    font-weight: 800;
    color: ${Colors.text};
  }

  .dmc-empty {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
    line-height: 1.6;
  }

  .dmc-action-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .dmc-action-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid ${Colors.border};
    border-radius: 11px;
  }

  .dmc-action-row h3 {
    margin: 0 0 3px;
    font-size: 13px;
    font-weight: 800;
    color: ${Colors.text};
  }

  .dmc-action-row p {
    margin: 0;
    font-size: 12px;
    color: ${Colors.muted};
  }

  .dmc-action-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 38px;
    padding: 0 15px;
    border: 1px solid ${Colors.border};
    border-radius: 9px;
    background: ${Colors.white};
    color: ${Colors.text};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .dmc-action-button:hover:not(:disabled) {
    border-color: ${Colors.navy};
    color: ${Colors.navy};
  }

  .dmc-action-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .dmc-action-button-primary {
    background: ${Colors.red};
    border-color: ${Colors.red};
    color: ${Colors.white};
  }

  .dmc-action-button-primary:hover:not(:disabled) {
    background: ${Colors.redDark};
    border-color: ${Colors.redDark};
    color: ${Colors.white};
  }

  .dmc-action-button-standdown {
    color: ${Colors.redDark};
    border-color: ${Colors.red};
  }

  .dmc-coverage-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .dmc-coverage-row {
    display: grid;
    grid-template-columns: 150px 1fr 92px;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: ${Colors.text};
  }

  .dmc-coverage-bar {
    height: 8px;
    border-radius: 6px;
    background: ${Colors.background};
    overflow: hidden;
  }

  .dmc-coverage-fill {
    display: block;
    height: 100%;
    background: ${Colors.blue};
  }

  .dmc-coverage-count {
    text-align: right;
    color: ${Colors.muted};
    font-weight: 600;
  }

  .dmc-alert-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .dmc-alert-item {
    padding: 16px;
    border-radius: 12px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .dmc-alert-status {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .dmc-alert-item.dmc-alert-critical {
    border-color: ${Colors.red};
  }

  .dmc-alert-item.dmc-alert-critical .dmc-alert-status,
  .dmc-history-row.dmc-alert-critical .dmc-alert-status {
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }

  .dmc-alert-item.dmc-alert-high .dmc-alert-status,
  .dmc-history-row.dmc-alert-high .dmc-alert-status {
    background: ${Colors.amberLight};
    color: ${Colors.amberText};
  }

  .dmc-alert-item.dmc-alert-medium .dmc-alert-status,
  .dmc-history-row.dmc-alert-medium .dmc-alert-status {
    background: #dcfce7;
    color: #166534;
  }

  .dmc-alert-details {
    flex: 1;
    min-width: 0;
  }

  .dmc-alert-title {
    font-size: 14px;
    font-weight: 700;
    color: ${Colors.text};
  }

  .dmc-alert-location {
    font-size: 12px;
    color: ${Colors.muted};
    margin-top: 2px;
  }

  .dmc-alert-time {
    font-size: 12px;
    color: ${Colors.muted};
    white-space: nowrap;
  }

  @media (max-width: 720px) {
    .dmc-coverage-row {
      grid-template-columns: 110px 1fr 80px;
    }

    .dmc-alert-item,
    .dmc-action-row {
      flex-wrap: wrap;
    }
  }
`;

const HISTORY_STYLES = `
  .dmc-history {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .dmc-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .dmc-muted {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
  }

  .dmc-history-card {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    overflow: hidden;
  }

  .dmc-history-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .dmc-history-row:hover {
    background: ${Colors.background};
  }

  .dmc-history-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .dmc-history-detail {
    padding: 18px;
    border-top: 1px solid ${Colors.border};
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .dmc-detail-block h4 {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .dmc-detail-block p {
    margin: 0;
    font-size: 13px;
    color: ${Colors.text};
    line-height: 1.6;
  }

  .dmc-message {
    margin: 0 0 6px !important;
    color: ${Colors.muted} !important;
  }

  .dmc-log-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .dmc-log-item {
    font-size: 12px;
    color: ${Colors.text};
  }

  @media (max-width: 720px) {
    .dmc-history-row {
      flex-wrap: wrap;
    }
  }
`;
