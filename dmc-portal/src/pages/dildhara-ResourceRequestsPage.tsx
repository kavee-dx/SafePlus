import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import {
  fetchResourceRequests,
  reviewResourceRequest,
  type ResourceRequest,
  type ResourceRequestStatus,
} from "../services/dildhara-resourceRequestApi";

interface Props {
  token: string;
  onBack: () => void;
  onSessionExpired: () => void;
}

type FilterStatus = "ALL" | ResourceRequestStatus;

const FILTERS: FilterStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "FULFILLED",
  "CANCELLED",
  "ALL",
];

function formatDate(value: string | null) {
  if (!value) return "Not specified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function ResourceRequestsPage({
  token,
  onBack,
  onSessionExpired,
}: Props) {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("PENDING");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ResourceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setRequests(await fetchResourceRequests(token));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not load resource requests.";

      if (/401|session expired|token/i.test(message)) {
        onSessionExpired();
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const counts = useMemo(() => {
    const result: Record<FilterStatus, number> = {
      ALL: requests.length,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      FULFILLED: 0,
      CANCELLED: 0,
    };

    for (const request of requests) {
      result[request.status] += 1;
    }

    return result;
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests
      .filter((request) => filter === "ALL" || request.status === filter)
      .filter((request) => {
        if (!term) return true;

        return [
          request.id,
          request.requesterUserId,
          request.resourceName,
          request.resourceType,
          request.district,
          request.location,
          request.urgency,
          request.status,
        ].some((value) => String(value ?? "").toLowerCase().includes(term));
      })
      .sort((a, b) => {
        if (a.status === "PENDING" && b.status !== "PENDING") return -1;
        if (a.status !== "PENDING" && b.status === "PENDING") return 1;

        return (
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        );
      });
  }, [requests, filter, search]);

  function openDetails(request: ResourceRequest) {
    setSelected(request);
    setReviewError("");
  }

  async function handleReview(action: "APPROVED" | "REJECTED") {
    if (!selected) return;

    const confirmation =
      action === "APPROVED"
        ? "Approve this resource request?"
        : "Reject this resource request?";

    if (!window.confirm(confirmation)) return;

    setSaving(true);
    setReviewError("");
    setError("");

    try {
      const updated = await reviewResourceRequest(
        token,
        selected.id,
        action
      );

      setRequests((current) =>
        current.map((request) =>
          request.id === updated.id ? updated : request
        )
      );

      setSelected(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not review request.";

      if (/401|session expired|token/i.test(message)) {
        onSessionExpired();
        return;
      }

      setReviewError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="cr-page">
      <style>{`
        .cr-page{color:#172b3a;width:100%;max-width:1400px;margin:0 auto;padding:28px;box-sizing:border-box;font-family:inherit}
        .cr-page *{box-sizing:border-box}
        .cr-back-button{display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:#245d88;padding:8px 0;margin-bottom:16px;cursor:pointer;font:inherit;font-weight:600}
        .cr-page-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:24px}
        .cr-page-title-row h1{font-size:30px;color:#0b1f33;margin:0 0 8px}
        .cr-page-title-row p{color:#667786;line-height:1.6;margin:0;max-width:700px}
        .cr-refresh-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;padding:10px 13px;border:1px solid #d6dee5;border-radius:8px;background:white;color:#163a59;cursor:pointer;font:inherit;font-weight:600}
        .cr-refresh-button:disabled{opacity:.55;cursor:wait}
        .cr-request-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:24px}
        .cr-summary-card{padding:17px;background:white;border:1px solid #e0e6eb;border-radius:12px}
        .cr-summary-card span{display:block;color:#667786;font-size:13px;margin-bottom:10px}
        .cr-summary-card strong{font-size:27px;color:#0b1f33}
        .cr-panel{background:white;border:1px solid #e0e6eb;border-radius:14px;padding:22px;min-width:0}
        .cr-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}
        .cr-panel-heading h2{font-size:19px;color:#0b1f33;margin:0}
        .cr-panel-heading p{font-size:13px;color:#667786;margin:6px 0 0}
        .cr-request-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:20px 0;flex-wrap:wrap}
        .cr-filter-tabs{display:flex;gap:6px;flex-wrap:wrap}
        .cr-filter-tab{padding:8px 11px;border:1px solid #dfe5ea;border-radius:8px;background:white;color:#566a7b;cursor:pointer;font:inherit;font-size:12px;font-weight:600}
        .cr-filter-tab.active{background:#0b1f33;border-color:#0b1f33;color:white}
        .cr-search-box{display:flex;align-items:center;gap:8px;min-width:220px;max-width:100%;padding:9px 11px;border:1px solid #d6dee5;border-radius:8px;color:#71808d}
        .cr-search-box input{border:0;outline:0;width:100%;min-width:0;font:inherit;color:#172b3a;background:transparent}
        .cr-request-list{display:flex;flex-direction:column;gap:12px}
        .cr-request-card{border:1px solid #e0e6eb;border-radius:12px;padding:17px}
        .cr-request-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
        .cr-request-ref{font-size:11px;font-weight:700;letter-spacing:.8px;color:#71808d;margin-bottom:7px;overflow-wrap:anywhere}
        .cr-request-card h3{font-size:18px;color:#0b1f33;margin:0 0 6px;overflow-wrap:anywhere}
        .cr-request-card p{font-size:13px;color:#667786;margin:0;overflow-wrap:anywhere}
        .cr-status{font-size:11px;font-weight:700;padding:6px 9px;border-radius:20px;white-space:nowrap;background:#edf1f5;color:#516273}
        .cr-status-pending{background:#fff3d8;color:#895900}
        .cr-status-approved{background:#e4f7eb;color:#187443}
        .cr-status-rejected{background:#ffebe9;color:#b42318}
        .cr-status-cancelled{background:#edf0f3;color:#566575}
        .cr-request-meta{display:flex;align-items:center;gap:9px 18px;flex-wrap:wrap;margin:18px 0;color:#566a7b;font-size:12px}
        .cr-request-meta>span{display:inline-flex;align-items:center;gap:6px}
        .cr-urgency{font-weight:700}
        .cr-urgency-critical,.cr-urgency-high{color:#c52b20}
        .cr-urgency-medium{color:#946200}
        .cr-urgency-low{color:#187443}
        .cr-request-card-bottom{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid #edf0f3;padding-top:13px}
        .cr-requester-type{display:inline-flex;align-items:center;color:#71808d;font-size:12px}
        .cr-outline-button,.cr-approve-button,.cr-danger-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:8px;padding:9px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
        .cr-outline-button{border:1px solid #d6dee5;background:white;color:#245d88}
        .cr-approve-button{border:1px solid #16804a;background:#16804a;color:white}
        .cr-approve-button:hover{background:#12663b}
        .cr-danger-button{border:1px solid #d92d20;background:#d92d20;color:white}
        .cr-danger-button:hover{background:#b42318}
        .cr-outline-button:disabled,.cr-approve-button:disabled,.cr-danger-button:disabled{opacity:.6;cursor:wait}
        .cr-empty-state{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;text-align:center;color:#71808d;padding:38px 16px}
        .cr-empty-state strong{color:#263d50}
        .cr-error,.cr-review-error{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 15px;margin:16px 0;background:#fff0ee;color:#a52820;border:1px solid #f5c2bd;border-radius:9px}
        .cr-error button{background:white;border:1px solid #efc3bf;padding:7px 10px;border-radius:7px;cursor:pointer;color:#a52820}
        .cr-modal-backdrop{position:fixed;inset:0;z-index:1000;background:#081827a8;display:flex;align-items:center;justify-content:center;padding:20px}
        .cr-modal{display:flex;flex-direction:column;background:white;width:min(760px,100%);max-height:90vh;border-radius:15px;overflow:hidden;box-shadow:0 20px 60px #0003}
        .cr-modal-header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:20px 23px;border-bottom:1px solid #e8edf1}
        .cr-modal-header h2{font-size:21px;color:#0b1f33;margin:0 0 7px}
        .cr-modal-header p{font-size:12px;color:#71808d;margin:0;overflow-wrap:anywhere}
        .cr-modal-close{display:flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:#f1f4f6;padding:8px;cursor:pointer;color:#405669}
        .cr-modal-body{padding:22px;overflow-y:auto}
        .cr-detail-section{margin-bottom:24px}
        .cr-detail-section:last-child{margin-bottom:0}
        .cr-detail-section h3{font-size:14px;color:#163a59;margin:0 0 13px}
        .cr-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .cr-detail-field{display:flex;flex-direction:column;gap:6px;min-width:0}
        .cr-detail-field>span{font-size:12px;color:#71808d}
        .cr-detail-field>strong{font-size:13px;font-weight:600;color:#263d50;overflow-wrap:anywhere}
        .cr-description{background:#f5f8fa;border:1px solid #e6ebef;border-radius:9px;padding:13px;font-size:13px;line-height:1.6;color:#435a6d;white-space:pre-wrap;overflow-wrap:anywhere}
        .cr-modal-footer{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;padding:16px 22px;border-top:1px solid #e8edf1}
        @media(max-width:800px){.cr-request-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.cr-page-title-row{flex-direction:column}.cr-request-toolbar{align-items:stretch}.cr-search-box{width:100%;max-width:none}}
        @media(max-width:520px){.cr-page{padding:14px}.cr-panel{padding:14px}.cr-request-summary{gap:9px}.cr-summary-card{padding:13px}.cr-request-card{padding:13px}.cr-request-card-top{flex-direction:column}.cr-detail-grid{grid-template-columns:1fr}.cr-modal-backdrop{padding:8px}.cr-modal-body{padding:16px}.cr-modal-footer>*{flex:1}}
      `}</style>

      <button type="button" className="cr-back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to dashboard
      </button>

      <div className="cr-page-title-row">
        <div>
          <h1>Resource Requests</h1>
          <p>
            Review resource needs submitted by citizens and shelters. Approve
            valid requests or reject requests that cannot be verified.
          </p>
        </div>

        <button
          type="button"
          className="cr-refresh-button"
          disabled={loading}
          onClick={() => void loadRequests()}
        >
          <RefreshCw size={15} />
          Refresh requests
        </button>
      </div>

      <section className="cr-request-summary">
        {(
          [
            ["PENDING", "Awaiting review"],
            ["APPROVED", "Approved"],
            ["REJECTED", "Rejected"],
            ["FULFILLED", "Fulfilled"],
            ["CANCELLED", "Cancelled"],
          ] as const
        ).map(([status, label]) => (
          <div className="cr-summary-card" key={status}>
            <span>{label}</span>
            <strong>{loading ? "—" : counts[status]}</strong>
          </div>
        ))}
      </section>

      <section className="cr-panel">
        <div className="cr-panel-heading">
          <div>
            <h2>Request queue</h2>
            <p>
              {loading
                ? "Loading requests…"
                : `${visibleRequests.length} request${
                    visibleRequests.length === 1 ? "" : "s"
                  } shown`}
            </p>
          </div>
        </div>

        <div className="cr-request-toolbar">
          <div className="cr-filter-tabs" aria-label="Filter requests">
            {FILTERS.map((status) => (
              <button
                type="button"
                key={status}
                className={`cr-filter-tab ${filter === status ? "active" : ""}`}
                onClick={() => setFilter(status)}
              >
                {status === "ALL" ? "All" : formatStatus(status)}
                {status !== "ALL" ? ` (${counts[status]})` : ""}
              </button>
            ))}
          </div>

          <label className="cr-search-box">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests..."
              aria-label="Search resource requests"
            />
          </label>
        </div>

        {error && (
          <div className="cr-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadRequests()}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="cr-empty-state">Loading resource requests…</div>
        ) : visibleRequests.length === 0 ? (
          <div className="cr-empty-state">
            <Package size={32} />
            <strong>No requests found</strong>
            <span>
              {search
                ? "Try another search term."
                : "Requests matching this status will appear here."}
            </span>
          </div>
        ) : (
          <div className="cr-request-list">
            {visibleRequests.map((request) => (
              <article className="cr-request-card" key={request.id}>
                <div className="cr-request-card-top">
                  <div>
                    <div className="cr-request-ref">
                      REQUEST · {request.id.slice(0, 8).toUpperCase()}
                    </div>
                    <h3>{request.resourceName || request.resourceType}</h3>
                    <p>
                      Requester:{" "}
                      {request.requesterUserId || "Unknown requester"}
                    </p>
                  </div>

                  <span
                    className={`cr-status cr-status-${request.status.toLowerCase()}`}
                  >
                    {formatStatus(request.status)}
                  </span>
                </div>

                <div className="cr-request-meta">
                  <span>
                    <Package size={14} />
                    {request.quantity} {request.unit}
                  </span>
                  <span>
                    <UserRound size={14} />
                    ID: {request.requesterUserId || "Unavailable"}
                  </span>
                  <span>
                    <MapPin size={14} />
                    {request.district || request.location || "Location not specified"}
                  </span>
                  <span
                    className={`cr-urgency cr-urgency-${request.urgency.toLowerCase()}`}
                  >
                    {request.urgency} urgency
                  </span>
                </div>

                <div className="cr-request-card-bottom">
                  <span className="cr-requester-type">
                    <CalendarDays size={12} />
                    &nbsp;{formatDate(request.createdAt)}
                  </span>

                  <button
                    type="button"
                    className="cr-outline-button"
                    onClick={() => openDetails(request)}
                  >
                    View details <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div
          className="cr-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setSelected(null);
            }
          }}
        >
          <section
            className="cr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cr-detail-title"
          >
            <header className="cr-modal-header">
              <div>
                <h2 id="cr-detail-title">Request details</h2>
                <p>Request ID: {selected.id}</p>
              </div>

              <button
                type="button"
                className="cr-modal-close"
                aria-label="Close details"
                disabled={saving}
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="cr-modal-body">
              <section className="cr-detail-section">
                <h3>Requester information</h3>
                <div className="cr-detail-grid">
                  <DetailField
                    label="Requester ID"
                    value={selected.requesterUserId}
                  />
                  <DetailField
                    label="Submitted"
                    value={formatDate(selected.createdAt)}
                  />
                  <DetailField
                    label="Updated"
                    value={formatDate(selected.updatedAt)}
                  />
                  <DetailField
                    label="District"
                    value={selected.district || "Not specified"}
                  />
                </div>
              </section>

              <section className="cr-detail-section">
                <h3>Resource requirements</h3>
                <div className="cr-detail-grid">
                  <DetailField
                    label="Resource name"
                    value={selected.resourceName}
                  />
                  <DetailField
                    label="Resource type"
                    value={selected.resourceType}
                  />
                  <DetailField
                    label="Quantity"
                    value={`${selected.quantity} ${selected.unit}`}
                  />
                  <DetailField
                    label="Urgency"
                    value={selected.urgency}
                  />
                  <DetailField
                    label="Required by"
                    value={formatDate(selected.requiredDate)}
                  />
                  <DetailField
                    label="Location"
                    value={selected.location || "Not specified"}
                  />
                </div>
              </section>

              <section className="cr-detail-section">
                <h3>Request description</h3>
                <div className="cr-description">
                  {selected.description || "No description was provided."}
                </div>
              </section>

              <section className="cr-detail-section">
                <h3>Current review status</h3>
                <div className="cr-detail-grid">
                  <DetailField
                    label="Status"
                    value={formatStatus(selected.status)}
                  />
                </div>
              </section>

              {selected.status === "PENDING" && (
                <section className="cr-detail-section">
                  <h3>Coordinator review</h3>
                  <p className="cr-description">
                    Approving verifies the request. It does not allocate
                    supplies or initiate dispatch.
                  </p>
                  {reviewError && (
                    <div className="cr-review-error" role="alert">
                      {reviewError}
                    </div>
                  )}
                </section>
              )}
            </div>

            <footer className="cr-modal-footer">
              <button
                type="button"
                className="cr-outline-button"
                disabled={saving}
                onClick={() => setSelected(null)}
              >
                Close
              </button>

              {selected.status === "PENDING" && (
                <>
                  <button
                    type="button"
                    className="cr-danger-button"
                    disabled={saving}
                    onClick={() => void handleReview("REJECTED")}
                  >
                    <XCircle size={16} />
                    {saving ? "Saving…" : "Reject request"}
                  </button>

                  <button
                    type="button"
                    className="cr-approve-button"
                    disabled={saving}
                    onClick={() => void handleReview("APPROVED")}
                  >
                    <CheckCircle2 size={16} />
                    {saving ? "Saving…" : "Approve request"}
                  </button>
                </>
              )}
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="cr-detail-field">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}