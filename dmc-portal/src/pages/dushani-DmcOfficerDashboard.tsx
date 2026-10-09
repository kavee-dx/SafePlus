import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle,
  ClipboardList,
  Clock,
  Home,
  Inbox,
  KeyRound,
  Loader2,
  LogOut,
  Megaphone,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

import type { AuthUser } from "../types/auth";
import type {
  BroadcastLog,
  DisasterWarning,
  DistrictCoverage,
  WarningStatus,
} from "../types/warning";
import { EXPIRY_EXTENSION_HOURS } from "../types/warning";
import type { HazardReport } from "../types/hazardReport";
import {
  deleteWarning,
  extendWarningExpiry,
  fetchCoverage,
  fetchPendingReports,
  fetchWarnings,
  pinProblem,
  standDownWarning,
  type CoverageResponse,
} from "../services/dushani-alertApi";
import NotificationBell from "../components/dushani-NotificationBell";
import PinChallengeModal from "../components/dushani-PinChallengeModal";
import WarningWizard from "../components/dushani-WarningWizard";
import {
  DASHBOARD_STYLES,
  HISTORY_STYLES,
  OVERVIEW_STYLES,
} from "../styles/dushani-dashboardStyles";
import {
  DATA_STYLES,
  channelLabel,
  deliveryLabel,
  deliveryPill,
  isDeliveryError,
  meterTone,
  severityPill,
  skippedCopy,
} from "../styles/dushani-dataStyles";
import { CONSOLE_THEME } from "../styles/dushani-consoleTheme";
import ReportCenter from "./amasha-ReportCenter";
import ClearancePinCard from "../components/dushani-ClearancePinCard";
import ProfilePage from "./dildhara-ProfilePage";
import { getStoredDmcToken } from "../services/dmc-authApi";
import type { PortalAccount } from "../services/dildhara-portalAuthApi";

interface DmcOfficerDashboardProps {
  officer: AuthUser;
  onLogout: () => void;
}

type DashboardView =
  | "overview"
  | "reports"
  | "issue"
  | "history"
  | "pin"
  | "profile";

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
  profile: {
    title: "My profile",
    subtitle: "Your account details and contact information",
  },
};

export default function DmcOfficerDashboard({
  officer,
  onLogout,
}: DmcOfficerDashboardProps) {
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [wizardReportId, setWizardReportId] = useState<string | undefined>();
  const [wizardWarningId, setWizardWarningId] = useState<string | undefined>();
  const [wizardKey, setWizardKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [displayName, setDisplayName] = useState(officer.fullName);

  // The profile page needs the sign-in token and an account object.
  const token = getStoredDmcToken();

  const account = useMemo<PortalAccount>(() => {
    const o = officer as unknown as Record<string, unknown>;

    return {
      id: String(o.id ?? ""),
      fullName: displayName,
      email: String(o.email ?? ""),
      username: typeof o.username === "string" ? o.username : null,
      role: String(o.role ?? "DMC_OFFICER"),
      status: String(o.status ?? "ACTIVE"),
      interfaces: Array.isArray(o.interfaces)
        ? (o.interfaces as string[])
        : ["DMC_PORTAL"],
    };
  }, [officer, displayName]);

  // Keeps the callback stable so the profile page doesn't reload repeatedly.
  const logoutRef = useRef(onLogout);

  useEffect(() => {
    logoutRef.current = onLogout;
  }, [onLogout]);

  const handleSessionExpired = useCallback(() => logoutRef.current(), []);

  // Only a DMC officer may broadcast; a district officer verifies reports.
  const canIssue = officer.role === "DMC_OFFICER";

  const openWizard = (reportId?: string, warningId?: string) => {
    setWizardReportId(reportId);
    setWizardWarningId(warningId);
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
    { view: "profile", label: "My profile", icon: User },
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
          <div className="dmc-sidebar-label">Operations</div>
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
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="dmc-officer-details">
              <div className="dmc-officer-name">{displayName}</div>
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
            <button
              type="button"
              className={`dmc-profile-button ${
                currentView === "profile" ? "dmc-profile-button-active" : ""
              }`}
              onClick={() => go("profile")}
              aria-label="My profile"
              title="My profile"
            >
              {displayName.charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="dmc-content-body">
          {currentView === "overview" && (
            <OverviewView
              key={refreshKey}
              canIssue={canIssue}
              onVerifyReports={() => go("reports")}
              onIssueWarning={(warningId) => openWizard(undefined, warningId)}
            />
          )}

          {currentView === "reports" && (
            <ReportCenter onIssueWarning={(reportId) => openWizard(reportId)} />
          )}

          {currentView === "issue" && (
            <WarningWizard
              key={wizardKey}
              initialReportId={wizardReportId}
              initialWarningId={wizardWarningId}
              onExit={() => go("overview")}
              onSetupPin={() => go("pin")}
              onViewHistory={() => go("history")}
            />
          )}

          {currentView === "history" && (
            <HistoryView
              key={refreshKey}
              onIssueWarning={(warningId) => openWizard(undefined, warningId)}
            />
          )}

          {currentView === "pin" && <ClearancePinCard />}

          {currentView === "profile" &&
            (token ? (
              <ProfilePage
                token={token}
                account={account}
                onProfileSaved={setDisplayName}
                onSessionExpired={handleSessionExpired}
              />
            ) : (
              <div className="dmc-error-card">
                <AlertTriangle size={18} />
                <div>
                  <h3>Session not found</h3>
                  <p>Please sign out and sign in again to open your profile.</p>
                </div>
              </div>
            ))}
        </div>
      </main>

      <style>{CONSOLE_THEME}</style>
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
  onIssueWarning: (warningId?: string) => void;
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
  const resumableDrafts = drafts.filter((warning) => warning.status === "DRAFT");
  const delivered = warnings.reduce(
    (total, warning) =>
      total + (warning.broadcastLogs ?? []).reduce((sum, log) => sum + log.deliveryCount, 0),
    0
  );

  return (
    <div className="dmc-overview dq-console">
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
                      {resumableDrafts.length} draft warning
                      {resumableDrafts.length === 1 ? "" : "s"} waiting
                    </h3>
                    <p>
                      A draft is already saved. Open it, enter the clearance PIN
                      and it goes out.
                    </p>
                  </div>
                  {canIssue && (
                    <button
                      type="button"
                      className="dmc-action-button"
                      onClick={() => onIssueWarning()}
                    >
                      <Megaphone size={14} /> New warning
                    </button>
                  )}
                </div>
              </div>

              {resumableDrafts.length > 0 && (
                <div className="dmc-alert-list dmc-draft-list">
                  {resumableDrafts.map((draft) => (
                    <article
                      key={draft.id}
                      className={`dmc-alert-item dmc-alert-${tone(draft.status)}`}
                    >
                      <div className="dmc-alert-status">
                        {humanize(draft.status)}
                      </div>
                      <div className="dmc-alert-details">
                        <div className="dmc-alert-title">
                          {humanize(draft.hazardType)} warning
                        </div>
                        <div className="sp-facts">
                          <span className="sp-fact">
                            <span className="sp-label">District</span>
                            <span className="sp-value">{draft.targetDistrict}</span>
                          </span>
                          <span className="sp-fact">
                            <span className="sp-label">Severity</span>
                            <span className={`sp-pill ${severityPill(draft.severityLevel)}`}>
                              {humanize(draft.severityLevel)}
                            </span>
                          </span>
                          <span className="sp-fact">
                            <span className="sp-label">Reference</span>
                            <span className="sp-value sp-mono">{draft.warningId}</span>
                          </span>
                          <span className="sp-fact">
                            <span className="sp-label">Saved</span>
                            <span className="sp-value">
                              {relativeTime(draft.updatedAt)}
                            </span>
                          </span>
                        </div>
                      </div>
                      {canIssue && (
                        <button
                          type="button"
                          className="dmc-action-button dmc-action-button-primary"
                          onClick={() => onIssueWarning(draft.warningId)}
                        >
                          Issue warning
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
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
                  <article
                    key={warning.id}
                    className={`dmc-alert-item dmc-alert-${tone(warning.status)}`}
                  >
                    <div className="dmc-alert-status">{humanize(warning.status)}</div>
                    <div className="dmc-alert-details">
                      <div className="dmc-alert-title">
                        {humanize(warning.hazardType)} warning
                      </div>
                      <div className="sp-facts">
                        <span className="sp-fact">
                          <span className="sp-label">Severity</span>
                          <span className={`sp-pill ${severityPill(warning.severityLevel)}`}>
                            {humanize(warning.severityLevel)}
                          </span>
                        </span>
                        <span className="sp-fact">
                          <span className="sp-label">District</span>
                          <span className="sp-value">{warning.targetDistrict}</span>
                        </span>
                        <span className="sp-fact">
                          <span className="sp-label">Audience</span>
                          <span className="sp-value">
                            {formatCount(warning.audienceCount)} accounts
                          </span>
                        </span>
                        <span className="sp-fact">
                          <span className="sp-label">Reference</span>
                          <span className="sp-value sp-mono">{warning.warningId}</span>
                        </span>
                      </div>
                    </div>
                    <div className="dmc-alert-time">{relativeTime(warning.updatedAt)}</div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <style>{OVERVIEW_STYLES}</style>
      <style>{DATA_STYLES}</style>
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

function ChannelNote({ log }: { log: BroadcastLog }) {
  if (log.status === "SKIPPED") {
    const copy = skippedCopy(log.channelType);

    return (
      <span className="sp-facts">
        <span className="sp-fact">
          <span className="sp-label">Why</span>
          <span className="sp-value sp-muted">{copy.reason}</span>
        </span>
        <span className="sp-fact">
          <span className="sp-label">Next step</span>
          <span className="sp-value sp-muted">{copy.nextStep}</span>
        </span>
      </span>
    );
  }

  if (!log.errorMessage) {
    return null;
  }

  return (
    <span className={isDeliveryError(log.status) ? "dmc-log-error" : "dmc-log-note"}>
      {log.errorMessage}
    </span>
  );
}

function deliverySummary(logs: BroadcastLog[]): { label: string; pill: string } {
  if (logs.length === 0) {
    return { label: "Not broadcast", pill: "sp-pill-slate" };
  }

  if (logs.some((log) => log.status === "FAILED")) {
    return { label: "Delivery failure", pill: "sp-pill-red" };
  }

  if (logs.every((log) => log.status === "SKIPPED")) {
    return { label: "App inbox only", pill: "sp-pill-blue" };
  }

  if (logs.some((log) => log.status === "SKIPPED")) {
    return { label: "Part notified", pill: "sp-pill-blue" };
  }

  if (logs.some((log) => log.status === "PARTIAL")) {
    return { label: "Part delivered", pill: "sp-pill-amber" };
  }

  return { label: "All channels ran", pill: "sp-pill-green" };
}

function HistoryView({
  onIssueWarning,
}: {
  onIssueWarning: (warningId?: string) => void;
}) {
  const [warnings, setWarnings] = useState<DisasterWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [extendHours, setExtendHours] = useState(EXPIRY_EXTENSION_HOURS[1]);
  const [pending, setPending] = useState<{
    action: "extend" | "stand-down";
    warning: DisasterWarning;
  } | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
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

  const openPinModal = (
    warning: DisasterWarning,
    action: "extend" | "stand-down"
  ) => {
    setPending({ action, warning });
    setPendingError(null);
  };

  const runPendingAction = async (securityPin: string) => {
    if (!pending) return;

    const { action, warning } = pending;

    setBusyId(warning.id);
    setPendingError(null);

    try {
      const updated =
        action === "extend"
          ? await extendWarningExpiry(warning.warningId, extendHours, securityPin)
          : await standDownWarning(warning.warningId, securityPin);

      setWarnings((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setPending(null);
    } catch (actionError) {
      setPendingError(pinProblem(actionError));
    } finally {
      setBusyId(null);
    }
  };

  const deleteWarningHandler = async (warning: DisasterWarning) => {
    if (!confirm(`Are you sure you want to delete warning ${warning.warningId}? This action cannot be undone.`)) {
      return;
    }

    setBusyId(warning.id);
    setError(null);

    try {
      await deleteWarning(warning.warningId);

      setWarnings((current) => current.filter((item) => item.id !== warning.id));
    } catch (actionError) {
      setError(messageOf(actionError));
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = warnings.filter((warning) => warning.status === "ACTIVE").length;
  const deliveredCount = warnings.reduce(
    (total, warning) =>
      total +
      (warning.broadcastLogs ?? []).reduce((sum, log) => sum + log.deliveryCount, 0),
    0
  );

  return (
    <div className="dmc-history dq-console">
      <div className="dmc-panel-head">
        <div className="sp-stack">
          <div className="sp-facts">
            <span className="sp-fact">
              <span className="sp-label">On record</span>
              <span className="sp-value">{warnings.length}</span>
            </span>
            <span className="sp-fact">
              <span className="sp-label">Live now</span>
              <span className="sp-value">{activeCount}</span>
            </span>
            <span className="sp-fact">
              <span className="sp-label">Deliveries</span>
              <span className="sp-value sp-mono">{formatCount(deliveredCount)}</span>
            </span>
          </div>
          <p className="dmc-muted">Select a warning to open its target, delivery log and message.</p>
        </div>
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
            onClick={() => onIssueWarning()}
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
          const logs = warning.broadcastLogs ?? [];
          const summary = deliverySummary(logs);
          const pushTargets = logs
            .filter((log) => log.channelType === "push")
            .reduce((total, log) => total + log.targetCount, 0);

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
                    {humanize(warning.hazardType)} warning
                  </span>
                  <span className="sp-badges">
                    <span className={`sp-pill ${severityPill(warning.severityLevel)}`}>
                      {humanize(warning.severityLevel)} severity
                    </span>
                    <span className="sp-pill sp-pill-blue">
                      {warning.targetDistrict} District
                    </span>
                    <span className={`sp-pill ${summary.pill}`}>{summary.label}</span>
                  </span>
                  <span className="sp-facts">
                    <span className="sp-fact">
                      <span className="sp-label">Reference</span>
                      <span className="sp-value sp-mono">{warning.warningId}</span>
                    </span>
                    <span className="sp-fact">
                      <span className="sp-label">Report</span>
                      <span className="sp-value sp-mono">
                        {warning.report?.reportId ?? "Linked"}
                      </span>
                    </span>
                    <span className="sp-fact">
                      <span className="sp-label">Audience</span>
                      <span className="sp-value">
                        {formatCount(warning.audienceCount)} accounts
                      </span>
                    </span>
                  </span>
                </span>
                <span className="dmc-alert-time">{relativeTime(warning.updatedAt)}</span>
              </button>

              {open && (
                <div className="dmc-history-detail">
                  <div className="dmc-detail-block">
                    <h4>Target</h4>
                    <dl className="sp-list">
                      <div className="sp-row">
                        <dt>Boundary</dt>
                        <dd>
                          {warning.gisPolygon
                            ? warning.gisPolygon.source === "CUSTOM"
                              ? "Drawn polygon"
                              : "District polygon"
                            : `Whole ${warning.targetDistrict} district`}
                        </dd>
                      </div>
                      {warning.gisPolygon && (
                        <div className="sp-row">
                          <dt>Area</dt>
                          <dd className="sp-mono">
                            {warning.gisPolygon.areaSqKm.toFixed(1)} km²
                          </dd>
                        </div>
                      )}
                      {warning.gisPolygon?.districtOverlapRatio !== undefined && (
                        <div className="sp-row">
                          <dt>Inside district</dt>
                          <dd className="sp-mono">
                            {(warning.gisPolygon.districtOverlapRatio * 100).toFixed(1)}% of{" "}
                            {warning.targetDistrict}
                          </dd>
                        </div>
                      )}
                      <div className="sp-row">
                        <dt>Accounts targeted</dt>
                        <dd>{formatCount(warning.audienceCount)}</dd>
                      </div>
                      <div className="sp-row">
                        <dt>SMS recipients</dt>
                        <dd>{formatCount(warning.smsRecipientCount)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="dmc-detail-block dmc-detail-wide">
                    <h4>Channels and delivery</h4>

                    {logs.length === 0 ? (
                      <div className="sp-empty">
                        Nothing broadcast yet - this warning is{" "}
                        {humanize(warning.status).toLowerCase()}.
                      </div>
                    ) : (
                      <div className="sp-stack">
                        <div className="sp-table">
                          <div className="sp-table-head">
                            <span>Channel</span>
                            <span>Status</span>
                            <span>Delivered</span>
                          </div>
                          {logs.map((log) => {
                            const share =
                              log.targetCount > 0
                                ? Math.round(
                                    (log.deliveryCount / log.targetCount) * 100
                                  )
                                : 0;

                            return (
                              <div key={log.id} className="sp-table-row">
                                <span className="dmc-log-channel">
                                  {channelLabel(log.channelType)}
                                  <ChannelNote log={log} />
                                </span>
                                <span>
                                  <span
                                    className={`sp-pill ${deliveryPill(log.status)}`}
                                  >
                                    {deliveryLabel(log.status)}
                                  </span>
                                </span>
                                <span className="sp-meter">
                                  {log.targetCount === 0 ? (
                                    <span className="sp-muted">Nothing to send</span>
                                  ) : (
                                    <>
                                      <span className="sp-meter-track">
                                        <span
                                          className={`sp-meter-fill ${meterTone(
                                            log.status
                                          )}`}
                                          style={{
                                            width: `${Math.max(
                                              share,
                                              share > 0 ? 3 : 0
                                            )}%`,
                                          }}
                                        />
                                      </span>
                                      <span className="sp-meter-value">
                                        {formatCount(log.deliveryCount)} /{" "}
                                        {formatCount(log.targetCount)}
                                      </span>
                                    </>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="sp-facts">
                          <span className="sp-fact">
                            <span className="sp-label">In the app</span>
                            <span className="sp-value">
                              {formatCount(warning.audienceCount)} accounts
                            </span>
                          </span>
                          <span className="sp-fact">
                            <span className="sp-label">Push devices</span>
                            <span className="sp-value">
                              {pushTargets === 0 ? "None" : formatCount(pushTargets)}
                            </span>
                          </span>
                          <span className="sp-fact">
                            <span className="sp-label">Text numbers</span>
                            <span className="sp-value">
                              {formatCount(warning.smsRecipientCount)}
                            </span>
                          </span>
                        </div>

                        <p className="dmc-muted">
                          Every targeted account sees this warning in the citizen app
                          inbox, with or without a notification.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="dmc-detail-block dmc-detail-wide">
                    <h4>Alert payload</h4>
                    <div className="sp-stack">
                      {warning.englishMessage && (
                        <div className="dmc-language dmc-language-en">
                          <span className="sp-label">English</span>
                          <p className="dmc-message">{warning.englishMessage}</p>
                        </div>
                      )}
                      {warning.sinhalaMessage && (
                        <div className="dmc-language dmc-language-si">
                          <span className="sp-label">Sinhala</span>
                          <p className="dmc-message">{warning.sinhalaMessage}</p>
                        </div>
                      )}
                      {warning.tamilMessage && (
                        <div className="dmc-language dmc-language-ta">
                          <span className="sp-label">Tamil</span>
                          <p className="dmc-message">{warning.tamilMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="dmc-detail-block">
                    <h4>Timing</h4>
                    <dl className="sp-list">
                      <div className="sp-row">
                        <dt>Broadcast</dt>
                        <dd className="sp-mono">
                          {warning.broadcastAt
                            ? new Date(warning.broadcastAt).toLocaleString()
                            : "Not broadcast yet"}
                        </dd>
                      </div>
                      <div className="sp-row">
                        <dt>{warning.status === "ACTIVE" ? "Active until" : "Expired"}</dt>
                        <dd className="sp-mono">
                          {warning.expiresAt
                            ? new Date(warning.expiresAt).toLocaleString()
                            : "No expiry set"}
                        </dd>
                      </div>
                      <div className="sp-row">
                        <dt>Created</dt>
                        <dd className="sp-mono">
                          {new Date(warning.createdAt).toLocaleString()}
                        </dd>
                      </div>
                      <div className="sp-row">
                        <dt>Last updated</dt>
                        <dd className="sp-mono">
                          {new Date(warning.updatedAt).toLocaleString()}
                        </dd>
                      </div>
                      {warning.safetyInstructions && (
                        <div className="sp-row">
                          <dt>Instruction</dt>
                          <dd className="sp-value-regular">
                            {warning.safetyInstructions}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {warning.status === "DRAFT" && (
                    <div className="dmc-detail-block dmc-detail-actions">
                      <h4>Actions</h4>

                      <p>
                        Saved but never sent. It needs the clearance PIN before
                        it can reach anyone.
                      </p>

                      <button
                        type="button"
                        className="dmc-action-button dmc-action-button-primary"
                        onClick={() => onIssueWarning(warning.warningId)}
                      >
                        <Megaphone size={14} /> Issue warning
                      </button>
                    </div>
                  )}

                  {(warning.status === "ACTIVE" ||
                    warning.status === "EXPIRED" ||
                    warning.status === "STOOD_DOWN") && (
                    <div className="dmc-detail-block dmc-detail-actions">
                      <h4>Actions</h4>

                      {(warning.status === "ACTIVE" || warning.status === "EXPIRED") && (
                        <div className="dmc-extend-row">
                          <label htmlFor={`wz-extend-${warning.id}`}>Extend by</label>
                          <select
                            id={`wz-extend-${warning.id}`}
                            value={extendHours}
                            onChange={(event) =>
                              setExtendHours(Number(event.target.value))
                            }
                          >
                            {EXPIRY_EXTENSION_HOURS.map((hours) => (
                              <option key={hours} value={hours}>
                                {hours === 1 ? "1 hour" : `${hours} hours`}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            className="dmc-action-button"
                            onClick={() => openPinModal(warning, "extend")}
                            disabled={busyId === warning.id}
                          >
                            <Clock size={14} />
                            {warning.status === "EXPIRED"
                              ? "Extend and reactivate"
                              : "Extend expiry"}
                          </button>
                        </div>
                      )}

                      {(warning.status === "ACTIVE" || warning.status === "EXPIRED") && (
                        <button
                          type="button"
                          className="dmc-action-button dmc-action-button-standdown"
                          onClick={() => openPinModal(warning, "stand-down")}
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

                      <button
                        type="button"
                        className="dmc-action-button dmc-action-button-delete"
                        onClick={() => void deleteWarningHandler(warning)}
                        disabled={busyId === warning.id}
                      >
                        {busyId === warning.id ? (
                          <Loader2 className="dmc-spin" size={14} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Delete warning
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}

      {pending && (
        <PinChallengeModal
          title={
            pending.action === "extend"
              ? "Authorize extension"
              : "Authorize stand-down"
          }
          description={
            pending.action === "extend"
              ? `Enter your 6-digit clearance PIN to add ${hoursLabel(
                  extendHours
                )} to warning ${pending.warning.warningId}.`
              : `Enter your 6-digit clearance PIN to stop warning ${pending.warning.warningId}. Citizens will stop seeing it as an active alert.`
          }
          confirmLabel={pending.action === "extend" ? "Extend warning" : "Stand down"}
          busy={busyId === pending.warning.id}
          error={pendingError}
          onCancel={() => {
            setPending(null);
            setPendingError(null);
          }}
          onConfirm={(pin) => void runPendingAction(pin)}
        />
      )}

      <style>{HISTORY_STYLES}</style>
      <style>{DATA_STYLES}</style>
    </div>
  );
}

function hoursLabel(hours: number): string {
  return hours === 1 ? "1 hour" : `${hours} hours`;
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
