import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Home,
  Inbox,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  ShieldCheck,
  User,
  X,
  XCircle,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type { AuthUser } from "../types/auth";
import type { HazardReport } from "../types/hazardReport";
import {
  fetchPendingReports,
  fetchVerifiedReports,
  verifyReport,
  AlertApiError,
} from "../services/dushani-alertApi";
import { getStoredDmcToken } from "../services/dmc-authApi";
import {
  fetchPortalProfile,
  type PortalProfile,
} from "../services/dildhara-portalAuthApi";

interface DistrictOfficerDashboardProps {
  officer: AuthUser;
  onLogout: () => void;
}

type DashboardView = "overview" | "reports" | "verified" | "profile";

interface OfficerIdentity {
  fullName: string;
  email: string;
  officerId: string;
  district: string;
  clearanceLevel: string;
  dutyPhone: string;
  secretariats: string[];
}

const VIEW_META: Record<DashboardView, { title: string; subtitle: string }> = {
  overview: {
    title: "District overview",
    subtitle: "Live hazard picture for your assigned district",
  },
  reports: {
    title: "Report verification queue",
    subtitle:
      "Ground reports raised by citizens in your district — verify to unlock DMC warnings",
  },
  verified: {
    title: "Verified reports",
    subtitle: "Reports from your district that passed verification",
  },
  profile: {
    title: "My profile",
    subtitle: "Your assignment, clearance and contact details",
  },
};

function readString(
  source: Record<string, unknown> | null | undefined,
  key: string
): string {
  const value = source?.[key];
  return typeof value === "string" ? value : "";
}

function buildIdentity(
  officer: AuthUser,
  profile: PortalProfile | null
): OfficerIdentity {
  const fallback = officer as unknown as Record<string, unknown>;
  const user = profile?.user ?? fallback;
  const details = profile?.details;

  const rawSecretariats =
    readString(details, "divisionalSecretariats") ||
    readString(user, "divisionalSecretariats");

  return {
    fullName:
      readString(user, "fullName") ||
      readString(fallback, "fullName") ||
      "District Officer",
    email: readString(user, "email") || readString(fallback, "email"),
    officerId: readString(details, "officerId"),
    district:
      readString(user, "district") ||
      readString(details, "assignedDistrict") ||
      readString(fallback, "district"),
    clearanceLevel:
      readString(details, "clearanceLevel") ||
      readString(user, "clearanceLevel"),
    dutyPhone:
      readString(details, "dutyPhoneNumber") ||
      readString(user, "dutyPhoneNumber"),
    secretariats: rawSecretariats
      ? rawSecretariats
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  };
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function KaveeshaDistrictOfficerDashboard({
  officer,
  onLogout,
}: DistrictOfficerDashboardProps) {
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 1024
  );
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const token = getStoredDmcToken();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetchPortalProfile(token)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch(() => {
        if (!cancelled) setProfileError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const identity = useMemo(
    () => buildIdentity(officer, profile),
    [officer, profile]
  );

  const go = (view: DashboardView) => {
    setCurrentView(view);
    setNotice(null);
    setRefreshKey((key) => key + 1);
  };

  const nav: { view: DashboardView; label: string; icon: typeof Home }[] = [
    { view: "overview", label: "Overview", icon: Home },
    { view: "reports", label: "Report queue", icon: Inbox },
    { view: "verified", label: "Verified reports", icon: ClipboardCheck },
    { view: "profile", label: "My profile", icon: User },
  ];

  return (
    <div className="kdash-app">
      <aside
        className={`kdash-sidebar ${
          sidebarOpen ? "kdash-sidebar-open" : "kdash-sidebar-closed"
        }`}
      >
        <div className="kdash-sidebar-head">
          <div className="kdash-brand">
            <div className="kdash-brand-mark">
              <ShieldCheck size={22} />
            </div>
            <div className="kdash-brand-text">
              <div className="kdash-brand-name">
                Safe<span>Plus</span>
              </div>
              <div className="kdash-brand-sub">District Operations</div>
            </div>
          </div>
          <button
            type="button"
            className="kdash-icon-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronDown size={16} /> : <MapPin size={16} />}
          </button>
        </div>

        {identity.district && (
          <div className="kdash-district-chip">
            <MapPin size={13} />
            <span>{identity.district} District</span>
          </div>
        )}

        <nav className="kdash-nav">
          {nav.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`kdash-nav-item ${
                currentView === item.view ? "kdash-nav-item-active" : ""
              }`}
              onClick={() => go(item.view)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="kdash-sidebar-foot">
          <div className="kdash-officer">
            <div className="kdash-avatar">
              {identity.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="kdash-officer-meta">
              <div className="kdash-officer-name">{identity.fullName}</div>
              <div className="kdash-officer-role">District Officer</div>
            </div>
          </div>
          <button type="button" className="kdash-logout" onClick={onLogout}>
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="kdash-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        className="kdash-fab-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <main className="kdash-main">
        <header className="kdash-topbar">
          <div className="kdash-topbar-titles">
            <h1>{VIEW_META[currentView].title}</h1>
            <p>{VIEW_META[currentView].subtitle}</p>
          </div>
          <button
            type="button"
            className={`kdash-profile-button ${
              currentView === "profile" ? "kdash-profile-button-active" : ""
            }`}
            onClick={() => go("profile")}
            aria-label="My profile"
            title="My profile"
          >
            {identity.fullName.charAt(0).toUpperCase()}
          </button>
        </header>

        <div className="kdash-body">
          {notice && (
            <div className="kdash-notice">
              <BadgeCheck size={16} />
              <span>{notice}</span>
            </div>
          )}

          {profileError && (
            <div className="kdash-error">
              <AlertTriangle size={17} />
              <div>
                <h3>Profile could not be loaded</h3>
                <p>
                  Your session may have expired. Sign out and sign in again to
                  restore full access.
                </p>
              </div>
            </div>
          )}

          {!token && (
            <div className="kdash-error">
              <AlertTriangle size={17} />
              <div>
                <h3>Session not found</h3>
                <p>Please sign out and sign in again.</p>
              </div>
            </div>
          )}

          {currentView === "overview" && (
            <OverviewView
              key={`overview-${refreshKey}`}
              identity={identity}
              loadingProfile={!profile && !profileError}
              onOpenQueue={() => go("reports")}
              onReportVerified={(reportId) => {
                setNotice(
                  `Report ${reportId} verified. The DMC can now raise a warning on it.`
                );
              }}
            />
          )}

          {currentView === "reports" && (
            <ReportQueueView
              key={`reports-${refreshKey}`}
              identity={identity}
              loadingProfile={!profile && !profileError}
              onReportVerified={(reportId) => {
                setNotice(
                  `Report ${reportId} verified. The DMC can now raise a warning on it.`
                );
              }}
            />
          )}

          {currentView === "verified" && (
            <VerifiedReportsView
              key={`verified-${refreshKey}`}
              identity={identity}
              loadingProfile={!profile && !profileError}
            />
          )}

          {currentView === "profile" && <ProfileView identity={identity} />}
        </div>
      </main>

      <style>{APP_STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewView({
  identity,
  loadingProfile,
  onOpenQueue,
  onReportVerified,
}: {
  identity: OfficerIdentity;
  loadingProfile: boolean;
  onOpenQueue: () => void;
  onReportVerified: (reportId: string) => void;
}) {
  const [pending, setPending] = useState<HazardReport[]>([]);
  const [verified, setVerified] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const district = identity.district;

  useEffect(() => {
    if (!district) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    Promise.all([
      fetchPendingReports(district),
      fetchVerifiedReports(),
    ])
      .then(([pendingResult, verifiedResult]) => {
        if (cancelled) return;
        setPending(pendingResult);
        setVerified(
          verifiedResult.filter(
            (report) => report.locationDistrict === district
          )
        );
      })
      .catch((loadError) => {
        if (!cancelled) setError(messageOf(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [district]);

  const urgent = pending.filter(
    (report) =>
      report.severityLevel === "HIGH" || report.severityLevel === "CRITICAL"
  );
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = [...pending, ...verified].filter(
    (report) => new Date(report.createdAt).getTime() >= weekAgo
  ).length;

  return (
    <div className="kdash-stack">
      <section className="kdash-hero">
        <div className="kdash-hero-text">
          <p className="kdash-hero-kicker">
            {greeting()}, {identity.fullName.split(" ")[0]}
          </p>
          <h2>{district ? `${district} District` : "Your district"}</h2>
          <p className="kdash-hero-sub">
            {loading || loadingProfile
              ? "Reading the latest district data…"
              : `${pending.length} report${
                  pending.length === 1 ? "" : "s"
                } awaiting your verification${
                  urgent.length > 0
                    ? ` — ${urgent.length} marked high priority`
                    : ""
                }.`}
          </p>
        </div>
        <div className="kdash-hero-badge">
          <ShieldCheck size={26} />
          <div>
            <div className="kdash-hero-badge-label">Clearance</div>
            <div className="kdash-hero-badge-value">
              {identity.clearanceLevel || "District Officer"}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="kdash-error">
          <AlertTriangle size={17} />
          <div>
            <h3>Live data could not be loaded</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!district && !loading && !loadingProfile && (
        <div className="kdash-error">
          <AlertTriangle size={17} />
          <div>
            <h3>No district assigned</h3>
            <p>
              Your account has no assigned district on file. Contact the Super
              Admin to complete your assignment.
            </p>
          </div>
        </div>
      )}

      {district && (
        <>
          <div className="kdash-stat-grid">
            <StatCard
              tone="warning"
              icon={<Inbox size={21} />}
              value={loading ? "—" : pending.length}
              label="Awaiting verification"
            />
            <StatCard
              tone="critical"
              icon={<AlertTriangle size={21} />}
              value={loading ? "—" : urgent.length}
              label="High priority pending"
            />
            <StatCard
              tone="success"
              icon={<CheckCircle2 size={21} />}
              value={loading ? "—" : verified.length}
              label="Verified for this district"
            />
            <StatCard
              tone="info"
              icon={<CalendarClock size={21} />}
              value={loading ? "—" : newThisWeek}
              label="New reports this week"
            />
          </div>

          <div className="kdash-two-col">
            <section className="kdash-panel">
              <div className="kdash-panel-head">
                <h2>Needs your decision</h2>
                <button
                  type="button"
                  className="kdash-btn"
                  onClick={onOpenQueue}
                >
                  Open queue
                </button>
              </div>

              {loading ? (
                <div className="kdash-loading">
                  <Loader2 className="kdash-spin" size={17} /> Loading reports…
                </div>
              ) : pending.length === 0 ? (
                <p className="kdash-empty">
                  The queue is clear. New citizen reports for {district} will
                  appear here for your verification.
                </p>
              ) : (
                <div className="kdash-report-list">
                  {pending.slice(0, 3).map((report) => (
                    <CompactReportRow
                      key={report.id}
                      report={report}
                      onVerified={onReportVerified}
                    />
                  ))}
                  {pending.length > 3 && (
                    <button
                      type="button"
                      className="kdash-more"
                      onClick={onOpenQueue}
                    >
                      View all {pending.length} reports
                    </button>
                  )}
                </div>
              )}
            </section>

            <DistrictIdentityPanel identity={identity} />
          </div>
        </>
      )}

      <style>{OVERVIEW_STYLES}</style>
    </div>
  );
}

function DistrictIdentityPanel({ identity }: { identity: OfficerIdentity }) {
  return (
    <section className="kdash-panel kdash-identity">
      <h2>My assignment</h2>

      <div className="kdash-identity-district">
        <MapPin size={18} />
        <div>
          <div className="kdash-identity-label">Assigned district</div>
          <div className="kdash-identity-value">
            {identity.district || "Not assigned"}
          </div>
        </div>
      </div>

      <dl className="kdash-identity-list">
        <div>
          <dt>Officer ID</dt>
          <dd>{identity.officerId || "—"}</dd>
        </div>
        <div>
          <dt>Duty phone</dt>
          <dd>{identity.dutyPhone || "—"}</dd>
        </div>
        <div>
          <dt>Clearance level</dt>
          <dd>{identity.clearanceLevel || "—"}</dd>
        </div>
        <div>
          <dt>Official email</dt>
          <dd>{identity.email || "—"}</dd>
        </div>
      </dl>

      <div className="kdash-identity-label" style={{ marginBottom: 8 }}>
        Divisional secretariats covered
      </div>
      {identity.secretariats.length === 0 ? (
        <p className="kdash-empty">Whole district</p>
      ) : (
        <div className="kdash-chip-row">
          {identity.secretariats.map((name) => (
            <span key={name} className="kdash-chip">
              {name}
            </span>
          ))}
        </div>
      )}

      <p className="kdash-shared-note">
        Reports are scoped to your district — every officer assigned to{" "}
        {identity.district || "this district"} sees the same queue, so the duty
        is covered even when you are off shift.
      </p>
    </section>
  );
}

function CompactReportRow({
  report,
  onVerified,
}: {
  report: HazardReport;
  onVerified: (reportId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const decide = async (decision: "VERIFIED" | "REJECTED") => {
    setBusy(true);
    setFieldError(null);
    try {
      await verifyReport(report.reportId, decision, notes.trim() || undefined);
      onVerified(report.reportId);
    } catch (decisionError) {
      if (decisionError instanceof AlertApiError) {
        setFieldError(
          decisionError.fieldErrors.verificationNotes ?? decisionError.message
        );
      } else {
        setFieldError(messageOf(decisionError));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`kdash-report ${expanded ? "kdash-report-open" : ""}`}>
      <button
        type="button"
        className="kdash-report-row"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`kdash-pill kdash-pill-${report.severityLevel.toLowerCase()}`}>
          {report.severityLevel}
        </span>
        <span className="kdash-report-main">
          <span className="kdash-report-title">
            {humanize(report.hazardType)}
          </span>
          <span className="kdash-report-meta">
            {report.reportId} · {relativeTime(report.createdAt)}
            {report.reporterName ? ` · by ${report.reporterName}` : ""}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`kdash-chevron ${expanded ? "kdash-chevron-up" : ""}`}
        />
      </button>

      {expanded && (
        <div className="kdash-report-detail">
          <p className="kdash-report-desc">{report.description}</p>

          <div className="kdash-report-facts">
            <span>
              <MapPin size={12} /> {report.locationDistrict}
              {report.locationLat !== undefined && report.locationLng !== undefined
                ? ` · ${report.locationLat.toFixed(4)}, ${report.locationLng.toFixed(4)}`
                : ""}
            </span>
            {report.affectedPopulation !== undefined && (
              <span>{report.affectedPopulation} people affected</span>
            )}
          </div>

          <textarea
            className="kdash-notes"
            placeholder="Verification note (optional, required when rejecting)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
          />

          {fieldError && <p className="kdash-field-error">{fieldError}</p>}

          <div className="kdash-decision-row">
            <button
              type="button"
              className="kdash-btn kdash-btn-verify"
              disabled={busy}
              onClick={() => void decide("VERIFIED")}
            >
              {busy ? (
                <Loader2 className="kdash-spin" size={14} />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Verify
            </button>
            <button
              type="button"
              className="kdash-btn kdash-btn-reject"
              disabled={busy}
              onClick={() => void decide("REJECTED")}
            >
              <XCircle size={14} />
              Reject
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Report queue
// ---------------------------------------------------------------------------

function ReportQueueView({
  identity,
  loadingProfile,
  onReportVerified,
}: {
  identity: OfficerIdentity;
  loadingProfile: boolean;
  onReportVerified: (reportId: string) => void;
}) {
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const district = identity.district;

  const load = useCallback(() => {
    if (!district) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPendingReports(district)
      .then((result) => {
        setReports(result);
        setError(null);
      })
      .catch((loadError) => setError(messageOf(loadError)))
      .finally(() => setLoading(false));
  }, [district]);

  useEffect(() => {
    if (!loadingProfile) load();
  }, [load, loadingProfile]);

  const handleVerified = (reportId: string) => {
    setReports((current) =>
      current.filter((report) => report.reportId !== reportId)
    );
    onReportVerified(reportId);
  };

  return (
    <div className="kdash-stack">
      {!district && !loadingProfile ? (
        <div className="kdash-error">
          <AlertTriangle size={17} />
          <div>
            <h3>No district assigned</h3>
            <p>
              Your account has no assigned district on file. Contact the Super
              Admin to complete your assignment.
            </p>
          </div>
        </div>
      ) : (
        <section className="kdash-panel">
          <div className="kdash-panel-head">
            <p className="kdash-muted">
              {loading
                ? "Loading…"
                : `${reports.length} report${
                    reports.length === 1 ? "" : "s"
                  } awaiting verification in ${district}.`}
            </p>
            <button type="button" className="kdash-btn" onClick={load}>
              Refresh
            </button>
          </div>

          {error && (
            <div className="kdash-error">
              <AlertTriangle size={17} />
              <div>
                <h3>Queue could not be loaded</h3>
                <p>{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="kdash-loading">
              <Loader2 className="kdash-spin" size={17} /> Loading the district
              queue…
            </div>
          ) : reports.length === 0 ? (
            <p className="kdash-empty">
              Nothing waiting on you. Verified reports move to the Verified
              tab, and the DMC takes over from there.
            </p>
          ) : (
            <div className="kdash-report-list">
              {reports.map((report) => (
                <CompactReportRow
                  key={report.id}
                  report={report}
                  onVerified={handleVerified}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <style>{QUEUE_STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verified reports
// ---------------------------------------------------------------------------

function VerifiedReportsView({
  identity,
  loadingProfile,
}: {
  identity: OfficerIdentity;
  loadingProfile: boolean;
}) {
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const district = identity.district;

  useEffect(() => {
    if (!district || loadingProfile) {
      if (!loadingProfile) setLoading(false);
      return;
    }
    let cancelled = false;

    fetchVerifiedReports()
      .then((result) => {
        if (cancelled) return;
        setReports(
          result
            .filter((report) => report.locationDistrict === district)
            .sort(
              (a, b) =>
                new Date(b.verifiedAt ?? b.updatedAt).getTime() -
                new Date(a.verifiedAt ?? a.updatedAt).getTime()
            )
        );
      })
      .catch((loadError) => {
        if (!cancelled) setError(messageOf(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [district, loadingProfile]);

  return (
    <div className="kdash-stack">
      <section className="kdash-panel">
        <div className="kdash-panel-head">
          <p className="kdash-muted">
            {loading
              ? "Loading…"
              : `${reports.length} verified report${
                  reports.length === 1 ? "" : "s"
                } for ${district || "your district"}.`}
          </p>
        </div>

        {error && (
          <div className="kdash-error">
            <AlertTriangle size={17} />
            <div>
              <h3>Verified reports could not be loaded</h3>
              <p>{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="kdash-loading">
            <Loader2 className="kdash-spin" size={17} /> Loading verified
            reports…
          </div>
        ) : reports.length === 0 ? (
          <p className="kdash-empty">
            No verified reports for this district yet. Verify a pending report
            and it will be listed here.
          </p>
        ) : (
          <div className="kdash-report-list">
            {reports.map((report) => (
              <article key={report.id} className="kdash-report">
                <div className="kdash-report-row kdash-report-row-static">
                  <span
                    className={`kdash-pill kdash-pill-${report.severityLevel.toLowerCase()}`}
                  >
                    {report.severityLevel}
                  </span>
                  <span className="kdash-report-main">
                    <span className="kdash-report-title">
                      {humanize(report.hazardType)}
                    </span>
                    <span className="kdash-report-meta">
                      {report.reportId} · verified{" "}
                      {report.verifiedAt
                        ? relativeTime(report.verifiedAt)
                        : "recently"}
                      {(report.warningCount ?? 0) > 0
                        ? ` · ${report.warningCount} warning${
                            report.warningCount === 1 ? "" : "s"
                          } raised`
                        : ""}
                    </span>
                    {report.verificationNotes && (
                      <span className="kdash-report-note">
                        “{report.verificationNotes}”
                      </span>
                    )}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{QUEUE_STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function ProfileView({ identity }: { identity: OfficerIdentity }) {
  return (
    <div className="kdash-stack">
      <section className="kdash-panel kdash-profile-card">
        <div className="kdash-profile-top">
          <div className="kdash-avatar kdash-avatar-lg">
            {identity.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2>{identity.fullName}</h2>
            <p className="kdash-muted">District Officer · SafePlus DMC</p>
            <div className="kdash-chip-row" style={{ marginTop: 10 }}>
              <span className="kdash-chip kdash-chip-accent">
                <ShieldCheck size={11} />
                {identity.clearanceLevel || "District Officer"}
              </span>
              {identity.district && (
                <span className="kdash-chip">
                  <MapPin size={11} />
                  {identity.district}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="kdash-identity-list kdash-identity-list-wide">
          <div>
            <dt>Full name</dt>
            <dd>{identity.fullName}</dd>
          </div>
          <div>
            <dt>Official email</dt>
            <dd>{identity.email || "—"}</dd>
          </div>
          <div>
            <dt>Officer ID</dt>
            <dd>{identity.officerId || "—"}</dd>
          </div>
          <div>
            <dt>Duty phone</dt>
            <dd>{identity.dutyPhone || "—"}</dd>
          </div>
          <div>
            <dt>Assigned district</dt>
            <dd>{identity.district || "Not assigned"}</dd>
          </div>
          <div>
            <dt>Clearance level</dt>
            <dd>{identity.clearanceLevel || "—"}</dd>
          </div>
        </dl>

        <div className="kdash-identity-label" style={{ margin: "18px 0 8px" }}>
          Divisional secretariats covered
        </div>
        {identity.secretariats.length === 0 ? (
          <p className="kdash-empty">Whole district</p>
        ) : (
          <div className="kdash-chip-row">
            {identity.secretariats.map((name) => (
              <span key={name} className="kdash-chip">
                {name}
              </span>
            ))}
          </div>
        )}
      </section>

      <style>{PROFILE_STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function StatCard({
  tone,
  icon,
  value,
  label,
}: {
  tone: "critical" | "warning" | "info" | "success";
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className={`kdash-stat kdash-stat-${tone}`}>
      <div className="kdash-stat-icon">{icon}</div>
      <div>
        <div className="kdash-stat-value">{value}</div>
        <div className="kdash-stat-label">{label}</div>
      </div>
    </div>
  );
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function relativeTime(iso: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  );
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const APP_STYLES = `
  .kdash-app {
    display: flex;
    min-height: 100vh;
    background: ${Colors.background};
    font-family: Inter, system-ui, -apple-system, sans-serif;
  }

  .kdash-sidebar {
    width: 272px;
    background: ${Colors.navy};
    color: ${Colors.white};
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    transition: width 240ms ease;
  }

  .kdash-sidebar-closed {
    width: 74px;
  }

  .kdash-sidebar-head {
    padding: 22px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .kdash-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }

  .kdash-brand-mark {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    background: ${Colors.blue};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(21, 112, 239, 0.4);
  }

  .kdash-brand-name {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.03em;
    white-space: nowrap;
  }

  .kdash-brand-name span {
    color: ${Colors.blue};
  }

  .kdash-brand-sub {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: #98a2b3;
    margin-top: 2px;
    white-space: nowrap;
  }

  .kdash-icon-button {
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: ${Colors.white};
    width: 30px;
    height: 30px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kdash-icon-button:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  .kdash-district-chip {
    margin: 0 18px 6px;
    padding: 8px 12px;
    border-radius: 9px;
    background: rgba(21, 112, 239, 0.16);
    border: 1px solid rgba(21, 112, 239, 0.45);
    color: ${Colors.blueLight};
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
    overflow: hidden;
  }

  .kdash-nav {
    flex: 1;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kdash-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 13px;
    border: none;
    background: transparent;
    color: #98a2b3;
    font-size: 13px;
    font-weight: 600;
    border-radius: 9px;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }

  .kdash-nav-item:hover {
    background: rgba(255, 255, 255, 0.06);
    color: ${Colors.white};
  }

  .kdash-nav-item-active {
    background: ${Colors.blue};
    color: ${Colors.white};
    box-shadow: 0 4px 12px rgba(21, 112, 239, 0.35);
  }

  .kdash-sidebar-closed .kdash-nav-item span,
  .kdash-sidebar-closed .kdash-brand-text,
  .kdash-sidebar-closed .kdash-district-chip,
  .kdash-sidebar-closed .kdash-officer-meta,
  .kdash-sidebar-closed .kdash-logout span {
    display: none;
  }

  .kdash-sidebar-foot {
    padding: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .kdash-officer {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 14px;
  }

  .kdash-avatar {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .kdash-officer-name {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }

  .kdash-officer-role {
    font-size: 10px;
    color: #98a2b3;
    margin-top: 2px;
  }

  .kdash-logout {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 11px 13px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: transparent;
    color: #fda29b;
    font-size: 12px;
    font-weight: 700;
    border-radius: 9px;
    cursor: pointer;
  }

  .kdash-logout:hover {
    background: rgba(217, 45, 32, 0.15);
    border-color: ${Colors.red};
    color: ${Colors.red};
  }

  .kdash-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .kdash-topbar {
    padding: 26px 38px;
    background: ${Colors.white};
    border-bottom: 1px solid ${Colors.border};
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .kdash-topbar-titles h1 {
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: ${Colors.text};
    margin: 0 0 5px;
  }

  .kdash-topbar-titles p {
    font-size: 13px;
    color: ${Colors.muted};
    margin: 0;
  }

  .kdash-profile-button {
    width: 42px;
    height: 42px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: ${Colors.navy};
    color: ${Colors.white};
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 160ms ease, border-color 160ms ease;
  }

  .kdash-profile-button:hover,
  .kdash-profile-button-active {
    background: ${Colors.blue};
    border-color: ${Colors.blueDark};
  }

  .kdash-body {
    flex: 1;
    padding: 32px 38px;
    overflow-y: auto;
  }

  .kdash-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 16px;
    margin-bottom: 18px;
    border-radius: 11px;
    background: #ecfdf3;
    border: 1px solid #a6f4c5;
    color: #067647;
    font-size: 13px;
    font-weight: 600;
  }

  .kdash-error,
  .kdash-loading {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
    border-radius: 12px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.muted};
    font-size: 13px;
    line-height: 1.5;
  }

  .kdash-loading {
    align-items: center;
  }

  .kdash-error {
    border-color: ${Colors.red};
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }

  .kdash-error h3 {
    margin: 0 0 3px;
    font-size: 14px;
  }

  .kdash-error p {
    margin: 0;
    font-size: 12px;
  }

  .kdash-spin {
    animation: kdash-spin 900ms linear infinite;
  }

  @keyframes kdash-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .kdash-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 37px;
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

  .kdash-btn:hover:not(:disabled) {
    border-color: ${Colors.blue};
    color: ${Colors.blue};
  }

  .kdash-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .kdash-fab-toggle,
  .kdash-scrim {
    display: none;
  }

  @media (max-width: 1024px) {
    .kdash-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
    }

    .kdash-sidebar-closed {
      left: -272px;
      width: 272px;
    }

    .kdash-scrim {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(11, 31, 51, 0.45);
      z-index: 90;
    }

    .kdash-fab-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 110;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid ${Colors.border};
      background: ${Colors.white};
      color: ${Colors.navy};
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(16, 24, 40, 0.12);
    }

    .kdash-fab-toggle:hover {
      background: ${Colors.background};
    }

    .kdash-topbar,
    .kdash-body {
      padding: 20px;
    }

    .kdash-topbar {
      padding-left: 66px;
    }
  }
`;

const OVERVIEW_STYLES = `
  .kdash-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .kdash-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 28px 30px;
    border-radius: 16px;
    background: linear-gradient(115deg, ${Colors.navy} 0%, ${Colors.navyLight} 100%);
    color: ${Colors.white};
    position: relative;
    overflow: hidden;
  }

  .kdash-hero::after {
    content: "";
    position: absolute;
    right: -70px;
    top: -70px;
    width: 240px;
    height: 240px;
    border-radius: 50%;
    background: rgba(21, 112, 239, 0.22);
    pointer-events: none;
  }

  .kdash-hero-kicker {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${Colors.blueLight};
  }

  .kdash-hero h2 {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .kdash-hero-sub {
    margin: 0;
    font-size: 13px;
    color: #cdd5df;
    max-width: 520px;
    line-height: 1.6;
  }

  .kdash-hero-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .kdash-hero-badge-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: #98a2b3;
  }

  .kdash-hero-badge-value {
    font-size: 13px;
    font-weight: 800;
    margin-top: 2px;
    max-width: 200px;
  }

  .kdash-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(215px, 1fr));
    gap: 15px;
  }

  .kdash-stat {
    padding: 20px;
    border-radius: 14px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    display: flex;
    align-items: center;
    gap: 15px;
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .kdash-stat:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 22px rgba(16, 24, 40, 0.07);
  }

  .kdash-stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kdash-stat-critical .kdash-stat-icon {
    background: ${Colors.redLight};
    color: ${Colors.red};
  }

  .kdash-stat-warning .kdash-stat-icon {
    background: ${Colors.amberLight};
    color: ${Colors.amber};
  }

  .kdash-stat-info .kdash-stat-icon {
    background: ${Colors.blueLight};
    color: ${Colors.blue};
  }

  .kdash-stat-success .kdash-stat-icon {
    background: #dcfae6;
    color: ${Colors.success};
  }

  .kdash-stat-value {
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${Colors.text};
  }

  .kdash-stat-label {
    font-size: 12px;
    font-weight: 600;
    color: ${Colors.muted};
    margin-top: 2px;
  }

  .kdash-two-col {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
    gap: 18px;
    align-items: start;
  }

  .kdash-panel {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    padding: 22px;
  }

  .kdash-panel h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: ${Colors.text};
  }

  .kdash-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .kdash-muted {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
  }

  .kdash-empty {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
    line-height: 1.65;
  }

  .kdash-more {
    border: none;
    background: transparent;
    color: ${Colors.blue};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 10px 4px 2px;
    text-align: left;
  }

  .kdash-more:hover {
    color: ${Colors.blueDark};
  }

  .kdash-identity-district {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 14px 16px;
    margin: 14px 0 16px;
    border-radius: 12px;
    background: ${Colors.blueLight};
    color: ${Colors.blue};
  }

  .kdash-identity-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdash-identity-value {
    font-size: 16px;
    font-weight: 800;
    color: ${Colors.text};
  }

  .kdash-identity-district .kdash-identity-value {
    color: ${Colors.navy};
  }

  .kdash-identity-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    margin: 0 0 6px;
  }

  .kdash-identity-list dt {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${Colors.muted};
    margin-bottom: 3px;
  }

  .kdash-identity-list dd {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${Colors.text};
    word-break: break-word;
  }

  .kdash-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .kdash-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 20px;
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
    color: ${Colors.text};
    font-size: 11px;
    font-weight: 700;
  }

  .kdash-chip-accent {
    background: ${Colors.blueLight};
    border-color: ${Colors.blue};
    color: ${Colors.blue};
  }

  .kdash-shared-note {
    margin: 16px 0 0;
    padding: 12px 14px;
    border-radius: 10px;
    background: ${Colors.background};
    border-left: 3px solid ${Colors.blue};
    font-size: 12px;
    color: ${Colors.muted};
    line-height: 1.6;
  }

  @media (max-width: 720px) {
    .kdash-hero {
      flex-direction: column;
      align-items: flex-start;
      padding: 22px;
    }

    .kdash-identity-list {
      grid-template-columns: 1fr;
    }
  }
`;

const QUEUE_STYLES = `
  .kdash-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .kdash-panel {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    padding: 22px;
  }

  .kdash-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .kdash-muted {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
  }

  .kdash-empty {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
    line-height: 1.65;
  }

  .kdash-loading {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    color: ${Colors.muted};
    font-size: 13px;
  }

  .kdash-error {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
    border-radius: 12px;
    background: ${Colors.redLight};
    border: 1px solid ${Colors.red};
    color: ${Colors.redDark};
    font-size: 13px;
    margin-bottom: 16px;
  }

  .kdash-error h3 {
    margin: 0 0 3px;
    font-size: 14px;
  }

  .kdash-error p {
    margin: 0;
    font-size: 12px;
  }

  .kdash-report-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kdash-report {
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    background: ${Colors.white};
    overflow: hidden;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .kdash-report:hover {
    border-color: #b2c4d8;
  }

  .kdash-report-open {
    border-color: ${Colors.blue};
    box-shadow: 0 6px 18px rgba(21, 112, 239, 0.09);
  }

  .kdash-report-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 15px 17px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .kdash-report-row-static {
    cursor: default;
  }

  .kdash-report-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .kdash-report-title {
    font-size: 14px;
    font-weight: 700;
    color: ${Colors.text};
  }

  .kdash-report-meta {
    font-size: 12px;
    color: ${Colors.muted};
  }

  .kdash-report-note {
    font-size: 12px;
    color: ${Colors.muted};
    font-style: italic;
    margin-top: 3px;
  }

  .kdash-chevron {
    color: ${Colors.muted};
    transition: transform 180ms ease;
    flex-shrink: 0;
  }

  .kdash-chevron-up {
    transform: rotate(180deg);
  }

  .kdash-pill {
    padding: 5px 11px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .kdash-pill-low {
    background: ${Colors.blueLight};
    color: ${Colors.blue};
  }

  .kdash-pill-medium {
    background: ${Colors.amberLight};
    color: ${Colors.amberText};
  }

  .kdash-pill-high {
    background: #fde4c7;
    color: #b54708;
  }

  .kdash-pill-critical {
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }

  .kdash-report-detail {
    padding: 4px 17px 17px;
    border-top: 1px dashed ${Colors.border};
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kdash-report-desc {
    margin: 12px 0 0;
    font-size: 13px;
    color: ${Colors.text};
    line-height: 1.65;
  }

  .kdash-report-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    font-size: 12px;
    color: ${Colors.muted};
  }

  .kdash-report-facts span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .kdash-notes {
    width: 100%;
    resize: vertical;
    border: 1px solid ${Colors.border};
    border-radius: 9px;
    padding: 10px 12px;
    font-family: inherit;
    font-size: 12px;
    color: ${Colors.text};
    line-height: 1.5;
  }

  .kdash-notes:focus {
    outline: none;
    border-color: ${Colors.blue};
    box-shadow: 0 0 0 3px rgba(21, 112, 239, 0.12);
  }

  .kdash-field-error {
    margin: 0;
    font-size: 12px;
    color: ${Colors.red};
    font-weight: 600;
  }

  .kdash-decision-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .kdash-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 37px;
    padding: 0 16px;
    border: 1px solid ${Colors.border};
    border-radius: 9px;
    background: ${Colors.white};
    color: ${Colors.text};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .kdash-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .kdash-btn-verify {
    background: ${Colors.success};
    border-color: ${Colors.success};
    color: ${Colors.white};
  }

  .kdash-btn-verify:hover:not(:disabled) {
    background: #0e9f5d;
    border-color: #0e9f5d;
    color: ${Colors.white};
  }

  .kdash-btn-reject {
    color: ${Colors.redDark};
    border-color: ${Colors.red};
    background: ${Colors.white};
  }

  .kdash-btn-reject:hover:not(:disabled) {
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }
`;

const PROFILE_STYLES = `
  .kdash-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .kdash-profile-card {
    max-width: 720px;
  }

  .kdash-profile-top {
    display: flex;
    align-items: center;
    gap: 18px;
    padding-bottom: 20px;
    margin-bottom: 20px;
    border-bottom: 1px solid ${Colors.border};
  }

  .kdash-avatar-lg {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: ${Colors.navy};
    color: ${Colors.white};
    font-size: 24px;
    flex-shrink: 0;
  }

  .kdash-profile-top h2 {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.text};
  }

  .kdash-muted {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
  }

  .kdash-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .kdash-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 20px;
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
    color: ${Colors.text};
    font-size: 11px;
    font-weight: 700;
  }

  .kdash-chip-accent {
    background: ${Colors.blueLight};
    border-color: ${Colors.blue};
    color: ${Colors.blue};
  }

  .kdash-identity-list-wide {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 14px 20px;
    margin: 0;
  }

  .kdash-identity-list-wide dt {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${Colors.muted};
    margin-bottom: 3px;
  }

  .kdash-identity-list-wide dd {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${Colors.text};
    word-break: break-word;
  }

  .kdash-identity-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdash-empty {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
  }

  @media (max-width: 560px) {
    .kdash-profile-top {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`;
