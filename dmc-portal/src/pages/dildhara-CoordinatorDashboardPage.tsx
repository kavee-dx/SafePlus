import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Clock3,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";

import type { PortalAccount } from "../services/dildhara-portalAuthApi";
import {
  fetchResourceRequests,
  type ResourceRequest,
} from "../services/dildhara-resourceRequestApi";

interface Props {
  account: PortalAccount;
  token: string;
  onOpenRequests: () => void;
  onSessionExpired?: () => void;
}

function formatDate(value: string) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
  }).format(date);
}

export default function CoordinatorDashboardPage({
  account,
  token,
  onOpenRequests,
  onSessionExpired,
}: Props) {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setRequests(await fetchResourceRequests(token));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load requests.";

      if (/401|session expired|token/i.test(message)) {
        onSessionExpired?.();
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const pending = requests.filter((r) => r.status === "PENDING").length;
  const approved = requests.filter((r) => r.status === "APPROVED").length;
  const rejected = requests.filter((r) => r.status === "REJECTED").length;

  const recentRequests = [...requests]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  const firstName =
    account.fullName?.trim().split(/\s+/)[0] || "Coordinator";

  return (
    <main className="cr-page">
      <style>{`
        .cr-page{color:#172b3a;width:100%;max-width:1400px;margin:0 auto;padding:28px;box-sizing:border-box;font-family:inherit}
        .cr-page *{box-sizing:border-box}
        .cr-welcome{display:flex;justify-content:space-between;align-items:center;gap:24px;background:linear-gradient(120deg,#0b1f33,#163a59);color:white;border-radius:18px;padding:32px;margin-bottom:28px}
        .cr-eyebrow{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:1.4px;color:#c8d8e7}
        .cr-welcome h1{font-size:clamp(25px,3vw,34px);margin:16px 0 10px}
        .cr-welcome p{line-height:1.6;color:#dce6ef;max-width:620px;margin:0 0 22px}
        .cr-welcome-icon{color:#b8cede;opacity:.85;padding:12px}
        .cr-primary-button,.cr-refresh-button,.cr-text-button,.cr-bottom-link{display:inline-flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;font:inherit;font-weight:600;border:0}
        .cr-primary-button{background:#d92d20;color:white;padding:12px 17px;border-radius:9px}
        .cr-primary-button:hover,.cr-danger-button:hover{background:#b42318}
        .cr-section-heading,.cr-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}
        .cr-section-heading{margin:26px 0 16px}
        .cr-section-heading h2,.cr-panel-heading h2{margin:0;font-size:19px;color:#0b1f33}
        .cr-section-heading p,.cr-panel-heading p{margin:6px 0 0;color:#667786;font-size:13px}
        .cr-refresh-button{padding:9px 12px;border:1px solid #d6dee5;border-radius:8px;background:white;color:#163a59}
        .cr-refresh-button:disabled{opacity:.55;cursor:wait}
        .cr-stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px}
        .cr-stat-card{background:white;border:1px solid #e0e6eb;border-radius:13px;padding:19px;text-align:left;color:#172b3a;cursor:pointer;min-width:0;box-shadow:0 2px 8px #0b1f3308}
        .cr-stat-card:hover,.cr-recent-item:hover{border-color:#9bb2c5;transform:translateY(-1px)}
        .cr-stat-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .cr-stat-icon,.cr-recent-icon,.cr-quick-icon{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;padding:10px;background:#fff0ee;color:#d92d20}
        .cr-icon-blue{background:#eaf3fb;color:#245d88}
        .cr-icon-green{background:#e9f7ef;color:#16804a}
        .cr-icon-red{background:#fff0ee;color:#d92d20}
        .cr-stat-label{font-size:13px;color:#566a7b;font-weight:600}
        .cr-stat-card>strong{display:block;font-size:32px;margin:18px 0 12px;color:#0b1f33}
        .cr-stat-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#667786}
        .cr-content-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,1fr);gap:20px}
        .cr-panel{background:white;border:1px solid #e0e6eb;border-radius:14px;padding:22px;min-width:0}
        .cr-recent-list{display:flex;flex-direction:column;margin-top:16px}
        .cr-recent-item{width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:14px 0;border:0;border-bottom:1px solid #edf0f3;background:white;cursor:pointer;color:inherit;min-width:0}
        .cr-recent-info{display:flex;flex-direction:column;gap:5px;flex:1;min-width:0}
        .cr-recent-info strong{overflow-wrap:anywhere;color:#173047}
        .cr-recent-info>span{font-size:12px;color:#697b89}
        .cr-status{font-size:11px;font-weight:700;padding:6px 9px;border-radius:20px;white-space:nowrap;background:#edf1f5;color:#516273}
        .cr-status-pending{background:#fff3d8;color:#895900}
        .cr-status-approved{background:#e4f7eb;color:#187443}
        .cr-status-rejected{background:#ffebe9;color:#b42318}
        .cr-status-cancelled{background:#edf0f3;color:#566575}
        .cr-text-button,.cr-bottom-link{background:transparent;color:#245d88;padding:7px}
        .cr-bottom-link{margin-top:14px;width:100%;justify-content:space-between;border-top:1px solid #edf0f3;padding-top:16px}
        .cr-empty-state{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;text-align:center;color:#71808d;padding:36px 16px}
        .cr-empty-state strong{color:#263d50}
        .cr-quick-panel{display:flex;flex-direction:column;gap:12px}
        .cr-quick-action{display:flex;align-items:center;gap:12px;padding:14px 0;border:0;border-bottom:1px solid #edf0f3;background:white;color:inherit;text-align:left;width:100%}
        button.cr-quick-action{cursor:pointer}
        .cr-quick-action>span:nth-child(2){display:flex;flex-direction:column;gap:5px;flex:1}
        .cr-quick-action small{font-size:12px;color:#71808d}
        .cr-quick-disabled{opacity:.65}
        .cr-note{display:flex;align-items:flex-start;gap:10px;background:#f1f6fa;border-radius:10px;padding:13px;color:#435a6d;font-size:12px;line-height:1.6;margin-top:8px}
        .cr-error{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 15px;margin:16px 0;background:#fff0ee;color:#a52820;border:1px solid #f5c2bd;border-radius:9px}
        .cr-error button{background:white;border:1px solid #efc3bf;padding:7px 10px;border-radius:7px;cursor:pointer;color:#a52820}
        @media(max-width:1000px){.cr-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cr-content-grid{grid-template-columns:1fr}}
        @media(max-width:600px){.cr-page{padding:14px}.cr-welcome{padding:22px}.cr-welcome-icon{display:none}.cr-stats-grid{gap:10px}.cr-stat-card{padding:13px}.cr-panel{padding:15px}.cr-section-heading{align-items:flex-start}.cr-recent-item{flex-wrap:wrap}}
      `}</style>

      <section className="cr-welcome">
        <div>
          <span className="cr-eyebrow">
            <ShieldCheck size={15} /> RELIEF OPERATIONS
          </span>
          <h1>Welcome back, {firstName}</h1>
          <p>
            Coordinate resources, review community needs, and keep relief
            operations moving.
          </p>
          <button
            type="button"
            className="cr-primary-button"
            onClick={onOpenRequests}
          >
            <ClipboardList size={18} />
            Review supply requests
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="cr-welcome-icon" aria-hidden="true">
          <Activity size={72} strokeWidth={1.2} />
        </div>
      </section>

      <section className="cr-section-heading">
        <div>
          <h2>Operations overview</h2>
          <p>Resource-request figures from SafePlus.</p>
        </div>
        <button
          type="button"
          className="cr-refresh-button"
          onClick={() => void loadRequests()}
          disabled={loading}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </section>

      {error && (
        <div className="cr-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadRequests()}>
            Try again
          </button>
        </div>
      )}

      <section className="cr-stats-grid">
        {[
          {
            label: "Awaiting review",
            value: pending,
            description: "Pending resource requests",
            icon: <Clock3 size={21} />,
            iconClass: "",
          },
          {
            label: "Total requests",
            value: requests.length,
            description: "All submitted requests",
            icon: <Package size={21} />,
            iconClass: "cr-icon-blue",
          },
          {
            label: "Approved",
            value: approved,
            description: "Approved requests",
            icon: <ShieldCheck size={21} />,
            iconClass: "cr-icon-green",
          },
          {
            label: "Rejected",
            value: rejected,
            description: "Rejected requests",
            icon: <ClipboardList size={21} />,
            iconClass: "cr-icon-red",
          },
        ].map((stat) => (
          <button
            type="button"
            className="cr-stat-card"
            key={stat.label}
            onClick={onOpenRequests}
          >
            <span className="cr-stat-top">
              <span className={`cr-stat-icon ${stat.iconClass}`}>
                {stat.icon}
              </span>
              <span className="cr-stat-label">{stat.label}</span>
            </span>
            <strong>{loading ? "—" : stat.value}</strong>
            <span className="cr-stat-footer">
              {stat.description} <ArrowRight size={14} />
            </span>
          </button>
        ))}
      </section>

      <section className="cr-content-grid">
        <div className="cr-panel">
          <div className="cr-panel-heading">
            <div>
              <h2>Recent resource requests</h2>
              <p>Latest requests submitted for relief support.</p>
            </div>
            <button
              type="button"
              className="cr-text-button"
              onClick={onOpenRequests}
            >
              View all <ArrowRight size={15} />
            </button>
          </div>

          {loading ? (
            <div className="cr-empty-state">Loading requests…</div>
          ) : recentRequests.length === 0 ? (
            <div className="cr-empty-state">
              <Package size={30} />
              <strong>No resource requests yet</strong>
              <span>New requests will appear here.</span>
            </div>
          ) : (
            <div className="cr-recent-list">
              {recentRequests.map((request) => (
                <button
                  type="button"
                  className="cr-recent-item"
                  key={request.id}
                  onClick={onOpenRequests}
                >
                  <span className="cr-recent-icon">
                    <Package size={19} />
                  </span>
                  <span className="cr-recent-info">
                    <strong>
                      {request.resourceName || request.resourceType}
                    </strong>
                    <span>
                      Requester {request.requesterUserId} ·{" "}
                      {request.district || "District not specified"} ·{" "}
                      {formatDate(request.createdAt)}
                    </span>
                  </span>
                  <span
                    className={`cr-status cr-status-${request.status.toLowerCase()}`}
                  >
                    {request.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="cr-bottom-link"
            onClick={onOpenRequests}
          >
            Open request management <ArrowRight size={16} />
          </button>
        </div>

        <aside className="cr-panel cr-quick-panel">
          <div className="cr-panel-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Manage your next steps.</p>
            </div>
          </div>

          <button
            type="button"
            className="cr-quick-action"
            onClick={onOpenRequests}
          >
            <span className="cr-quick-icon cr-icon-red">
              <ClipboardList size={20} />
            </span>
            <span>
              <strong>Review supply requests</strong>
              <small>
                {loading ? "Checking requests…" : `${pending} waiting for review`}
              </small>
            </span>
            <ArrowRight size={17} />
          </button>

          <div className="cr-quick-action cr-quick-disabled">
            <span className="cr-quick-icon cr-icon-blue">
              <Users size={20} />
            </span>
            <span>
              <strong>Assign volunteers</strong>
              <small>Operations module · Coming soon</small>
            </span>
          </div>

          <div className="cr-quick-action cr-quick-disabled">
            <span className="cr-quick-icon cr-icon-green">
              <Truck size={20} />
            </span>
            <span>
              <strong>Plan delivery routes</strong>
              <small>Delivery module · Coming soon</small>
            </span>
          </div>

          <div className="cr-note">
            <ShieldCheck size={18} />
            <span>
              Request approval verifies a submitted need. It does not allocate
              or dispatch resources.
            </span>
          </div>
        </aside>
      </section>
    </main>
  );
}