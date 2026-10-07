import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  LayoutDashboard,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type { AdminUser } from "../types/auth";
import {
  AdminApiError,
  approveRegistration,
  clearSession,
  fetchRegistrations,
  fetchStats,
  rejectRegistration,
  type AccountStatus,
  type AdminStats,
  type RegistrationRecord,
  type ReviewableRole,
} from "../services/amasha-adminApi";
import AdminSidebar, {
  ROLE_ICONS,
  type SidebarItem,
  type SidebarKey,
} from "./amasha-AdminSidebar";

interface AdminDashboardProps {
  admin: AdminUser;
  onLogout: () => void;
}

const ROLE_ORDER: ReviewableRole[] = [
  "DISTRICT_OFFICER",
  "DMC_OFFICER",
  "COORDINATOR",
  "RELIEF_AGENCY",
  "ORGANIZATION_ADMIN",
  "INDEPENDENT_TEAM_LEADER",
];

const ROLE_LABELS: Record<ReviewableRole, string> = {
  DISTRICT_OFFICER: "District Officers",
  DMC_OFFICER: "DMC Officers",
  COORDINATOR: "Coordinators",
  RELIEF_AGENCY: "Relief Agencies",
  ORGANIZATION_ADMIN: "Organization Admins",
  INDEPENDENT_TEAM_LEADER: "Independent Team Leaders",
};

type StatusFilter = AccountStatus | "ALL";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "PENDING_VERIFICATION", label: "Pending" },
  { key: "ACTIVE", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

const STATUS_META: Record<
  AccountStatus,
  { label: string; bg: string; color: string }
> = {
  PENDING_VERIFICATION: {
    label: "Pending",
    bg: Colors.amberLight,
    color: Colors.amberText,
  },
  ACTIVE: { label: "Approved", bg: "#D1FADF", color: "#087443" },
  REJECTED: { label: "Rejected", bg: Colors.redLight, color: Colors.redDark },
  SUSPENDED: { label: "Suspended", bg: "#E4E7EC", color: "#344054" },
};

export default function AdminDashboard({
  admin,
  onLogout,
}: AdminDashboardProps) {
  const [allRegistrations, setAllRegistrations] = useState<RegistrationRecord[]>(
    []
  );
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [selectedRole, setSelectedRole] = useState<SidebarKey>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] =
    useState<RegistrationRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [regs, counts] = await Promise.all([
        fetchRegistrations({ status: "ALL" }),
        fetchStats(),
      ]);
      setAllRegistrations(regs);
      setStats(counts);
    } catch (err) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : "Failed to load registrations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const countFor = (key: SidebarKey) =>
      key === "ALL"
        ? allRegistrations.length
        : allRegistrations.filter((r) => r.role === key).length;

    const allItem: SidebarItem = {
      key: "ALL",
      label: "All Users",
      count: countFor("ALL"),
      icon: LayoutDashboard,
    };

    const roleItems: SidebarItem[] = ROLE_ORDER.map((role) => ({
      key: role,
      label: ROLE_LABELS[role],
      count: countFor(role),
      icon: ROLE_ICONS[role],
    }));

    return [allItem, ...roleItems];
  }, [allRegistrations]);

  const visible = useMemo(
    () =>
      allRegistrations.filter(
        (r) =>
          (selectedRole === "ALL" || r.role === selectedRole) &&
          (statusFilter === "ALL" || r.status === statusFilter)
      ),
    [allRegistrations, selectedRole, statusFilter]
  );

  const grouped = useMemo(() => {
    const map = new Map<ReviewableRole, RegistrationRecord[]>();
    for (const role of ROLE_ORDER) map.set(role, []);
    for (const record of visible) {
      map.get(record.role)?.push(record);
    }
    return map;
  }, [visible]);

  const handleApprove = async (record: RegistrationRecord) => {
    setBusyId(record.id);
    setNotice("");
    setError("");
    try {
      await approveRegistration(record.id);
      setNotice(`Approved ${record.fullName}. An approval email has been sent.`);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Approval failed.");
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (record: RegistrationRecord) => {
    setRejectTarget(record);
    setRejectReason("");
    setRejectError("");
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 5) {
      setRejectError("Please provide a reason (at least 5 characters).");
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      await rejectRegistration(rejectTarget.id, rejectReason.trim());
      setNotice(
        `Rejected ${rejectTarget.fullName}. A rejection email has been sent with the reason.`
      );
      setRejectTarget(null);
      await load();
    } catch (err) {
      setRejectError(
        err instanceof AdminApiError ? err.message : "Rejection failed."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleLogout = () => {
    clearSession();
    onLogout();
  };

  const heading =
    selectedRole === "ALL" ? "All Users" : ROLE_LABELS[selectedRole];

  const renderCard = (record: RegistrationRecord) => (
    <article key={record.id} className="admin-card">
      <div className="admin-card-head">
        <div>
          <h4>{record.fullName}</h4>
          <p className="admin-email">{record.email}</p>
        </div>
        <span
          className="admin-status"
          style={{
            background: STATUS_META[record.status].bg,
            color: STATUS_META[record.status].color,
          }}
        >
          {STATUS_META[record.status].label}
        </span>
      </div>

      <dl className="admin-details">
        {record.phone && <Detail label="Phone" value={record.phone} />}
        {record.district && <Detail label="District" value={record.district} />}
        <Detail
          label="Registered"
          value={new Date(record.createdAt).toLocaleString()}
        />
        {record.profile.map((field) => (
          <Detail key={field.label} label={field.label} value={field.value} />
        ))}
      </dl>

      {record.rejectionReason && (
        <div className="admin-reason">
          <strong>Rejection reason:</strong> {record.rejectionReason}
        </div>
      )}

      <div className="admin-actions">
        <button
          type="button"
          className="admin-btn-approve"
          onClick={() => void handleApprove(record)}
          disabled={busyId === record.id || record.status === "ACTIVE"}
        >
          <CheckCircle2 size={15} />
          Approve
        </button>
        <button
          type="button"
          className="admin-btn-reject"
          onClick={() => openReject(record)}
          disabled={busyId === record.id || record.status === "REJECTED"}
        >
          <XCircle size={15} />
          Reject
        </button>
      </div>
    </article>
  );

  return (
    <div className="admin-shell">
      <AdminSidebar
        items={sidebarItems}
        selected={selectedRole}
        onSelect={setSelectedRole}
        admin={admin}
        onLogout={handleLogout}
      />

      <div className="admin-content">
        <header className="admin-topbar">
          <div>
            <h2>{heading}</h2>
            <p>
              {visible.length} user{visible.length === 1 ? "" : "s"} shown
              {statusFilter !== "ALL"
                ? ` · ${STATUS_FILTERS.find((f) => f.key === statusFilter)?.label}`
                : ""}
            </p>
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-filters">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={
                    statusFilter === filter.key
                      ? "admin-chip admin-chip-active"
                      : "admin-chip"
                  }
                  onClick={() => setStatusFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="admin-refresh"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        <main className="admin-main">
          <section className="admin-stats">
            <StatCard
              icon={<Clock size={18} />}
              label="Pending"
              value={stats?.pending ?? 0}
              accent={Colors.amber}
            />
            <StatCard
              icon={<CheckCircle2 size={18} />}
              label="Approved"
              value={stats?.active ?? 0}
              accent={Colors.success}
            />
            <StatCard
              icon={<XCircle size={18} />}
              label="Rejected"
              value={stats?.rejected ?? 0}
              accent={Colors.red}
            />
            <StatCard
              icon={<Users size={18} />}
              label="Total"
              value={stats?.total ?? 0}
              accent={Colors.blue}
            />
          </section>

          {notice && <div className="admin-notice">{notice}</div>}
          {error && <div className="admin-banner-error">{error}</div>}

          {loading ? (
            <div className="admin-empty">Loading registrations...</div>
          ) : visible.length === 0 ? (
            <div className="admin-empty">
              No registrations found for this selection.
            </div>
          ) : selectedRole === "ALL" ? (
            <div className="admin-groups">
              {ROLE_ORDER.map((role) => {
                const items = grouped.get(role) ?? [];
                if (items.length === 0) return null;
                return (
                  <section key={role} className="admin-group">
                    <div className="admin-group-head">
                      <h3>{ROLE_LABELS[role]}</h3>
                      <span className="admin-count">{items.length}</span>
                    </div>
                    <div className="admin-cards">{items.map(renderCard)}</div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="admin-cards">{visible.map(renderCard)}</div>
          )}
        </main>
      </div>

      {rejectTarget && (
        <div
          className="admin-modal-overlay"
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="admin-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Reject registration</h3>
            <p>
              {rejectTarget.fullName} — {rejectTarget.email}
            </p>
            <label>Reason for rejection</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="e.g. NIC document could not be verified. Please re-upload."
            />
            {rejectError && (
              <div className="admin-banner-error">{rejectError}</div>
            )}
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn-cancel"
                onClick={() => setRejectTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn-reject"
                onClick={() => void handleReject()}
                disabled={busyId === rejectTarget.id}
              >
                Reject & notify
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        .admin-shell {
          display: flex;
          min-height: 100vh;
          background: ${Colors.background};
          font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
          color: ${Colors.text};
        }
        .admin-content { flex: 1; min-width: 0; display: flex; flex-direction: column; }

        .admin-topbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
          padding: 18px 28px; background: #fff;
          border-bottom: 1px solid ${Colors.border};
        }
        .admin-topbar h2 { margin: 0; font-size: 20px; letter-spacing: -0.02em; }
        .admin-topbar p { margin: 4px 0 0; color: ${Colors.muted}; font-size: 12px; }
        .admin-topbar-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .admin-filters { display: flex; gap: 8px; flex-wrap: wrap; }
        .admin-chip {
          border: 1px solid ${Colors.border}; background: #fff;
          color: ${Colors.muted}; padding: 8px 15px; border-radius: 999px;
          font-size: 12px; font-weight: 700; cursor: pointer;
        }
        .admin-chip-active { background: ${Colors.navy}; color: #fff; border-color: ${Colors.navy}; }
        .admin-refresh {
          display: inline-flex; align-items: center; gap: 7px;
          border: 1px solid ${Colors.border}; background: #fff;
          color: ${Colors.text}; padding: 8px 15px; border-radius: 9px;
          font-size: 12px; font-weight: 700; cursor: pointer;
        }
        .admin-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
        .spin { animation: admin-spin 1s linear infinite; }
        @keyframes admin-spin { to { transform: rotate(360deg); } }

        .admin-main { max-width: 1180px; width: 100%; margin: 0 auto; padding: 28px; }

        .admin-stats {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 14px; margin-bottom: 24px;
        }
        .admin-stat {
          background: #fff; border: 1px solid ${Colors.border};
          border-radius: 13px; padding: 16px;
          display: flex; align-items: center; gap: 13px;
        }
        .admin-stat-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .admin-stat strong { display: block; font-size: 22px; line-height: 1; }
        .admin-stat small { color: ${Colors.muted}; font-size: 11px; font-weight: 700; }

        .admin-notice {
          background: #D1FADF; color: #087443; border-radius: 10px;
          padding: 12px 14px; font-size: 13px; margin-bottom: 16px;
        }
        .admin-banner-error {
          background: ${Colors.redLight}; color: ${Colors.redDark};
          border-radius: 10px; padding: 12px 14px; font-size: 13px; margin-bottom: 16px;
        }
        .admin-empty {
          background: #fff; border: 1px dashed ${Colors.border};
          border-radius: 13px; padding: 48px; text-align: center;
          color: ${Colors.muted}; font-size: 14px;
        }

        .admin-groups { display: flex; flex-direction: column; gap: 26px; }
        .admin-group-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .admin-group-head h3 { font-size: 17px; margin: 0; letter-spacing: -0.02em; }
        .admin-count {
          background: ${Colors.navy}; color: #fff; font-size: 11px;
          font-weight: 800; padding: 2px 9px; border-radius: 999px;
        }
        .admin-cards {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px;
        }
        .admin-card {
          background: #fff; border: 1px solid ${Colors.border};
          border-radius: 14px; padding: 18px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .admin-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .admin-card-head h4 { margin: 0; font-size: 15px; }
        .admin-email { margin: 3px 0 0; color: ${Colors.muted}; font-size: 12px; word-break: break-all; }
        .admin-status {
          font-size: 10px; font-weight: 800; padding: 4px 10px;
          border-radius: 999px; white-space: nowrap; letter-spacing: 0.03em;
        }
        .admin-details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin: 0; }
        .admin-detail { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .admin-detail dt { color: ${Colors.muted}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
        .admin-detail dd { margin: 0; font-size: 13px; word-break: break-word; }
        .admin-reason {
          background: ${Colors.redLight}; color: ${Colors.redDark};
          border-radius: 9px; padding: 10px 12px; font-size: 12px; line-height: 1.5;
        }
        .admin-actions { display: flex; gap: 10px; margin-top: auto; }
        .admin-btn-approve, .admin-btn-reject {
          flex: 1; display: inline-flex; align-items: center; justify-content: center;
          gap: 7px; height: 42px; border: none; border-radius: 10px;
          font-size: 13px; font-weight: 800; cursor: pointer;
        }
        .admin-btn-approve { background: ${Colors.success}; color: #fff; }
        .admin-btn-approve:hover:not(:disabled) { background: #0e9f5e; }
        .admin-btn-reject { background: ${Colors.redLight}; color: ${Colors.redDark}; }
        .admin-btn-reject:hover:not(:disabled) { background: #fbd5d3; }
        .admin-btn-approve:disabled, .admin-btn-reject:disabled { opacity: 0.45; cursor: not-allowed; }

        .admin-modal-overlay {
          position: fixed; inset: 0; background: rgba(11,31,51,0.55);
          display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50;
        }
        .admin-modal { background: #fff; border-radius: 16px; padding: 26px; width: 100%; max-width: 460px; }
        .admin-modal h3 { margin: 0 0 6px; font-size: 19px; }
        .admin-modal p { margin: 0 0 18px; color: ${Colors.muted}; font-size: 13px; word-break: break-all; }
        .admin-modal label { display: block; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
        .admin-modal textarea {
          width: 100%; border: 1px solid ${Colors.border}; border-radius: 10px;
          padding: 12px; font-size: 13px; font-family: inherit; resize: vertical;
        }
        .admin-modal textarea:focus { outline: none; border-color: ${Colors.red}; }
        .admin-modal-actions { display: flex; gap: 10px; margin-top: 20px; }
        .admin-btn-cancel {
          flex: 1; height: 44px; border: 1px solid ${Colors.border};
          background: #fff; color: ${Colors.muted}; border-radius: 10px;
          font-size: 13px; font-weight: 800; cursor: pointer;
        }
        .admin-modal-actions .admin-btn-reject { flex: 1; height: 44px; background: ${Colors.red}; color: #fff; }
        .admin-modal-actions .admin-btn-reject:hover:not(:disabled) { background: ${Colors.redDark}; }

        @media (max-width: 860px) {
          .admin-shell { flex-direction: column; }
          .admin-stats { grid-template-columns: repeat(2, 1fr); }
          .admin-main { padding: 18px; }
          .admin-topbar { padding: 16px 18px; }
          .admin-details { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="admin-stat">
      <div
        className="admin-stat-icon"
        style={{ background: `${accent}1a`, color: accent }}
      >
        {icon}
      </div>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-detail">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
