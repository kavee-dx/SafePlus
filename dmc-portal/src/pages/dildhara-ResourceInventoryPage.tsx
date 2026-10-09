
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Package,
  RefreshCw,
  Search,
  Users,
  Building2,
  MapPin,
  X,
} from "lucide-react";

import {
  fetchResourceInventory,
  type InventoryResource,
  type ContributorType,
  type AvailabilityCondition,
  type ExpiryCondition,
} from "../services/dildhara-resourceInventoryApi";

interface Props {
  token: string;
  onSessionExpired: () => void;
}

type Filter = "ALL" | "AVAILABLE" | "UNAVAILABLE" | "EXPIRED";
type ContributorFilter = "ALL" | ContributorType;

function dateLabel(value: string | null): string {
  if (!value) return "Not specified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function availabilityLabel(value: AvailabilityCondition): string {
  const labels: Record<AvailabilityCondition, string> = {
    AVAILABLE: "Available",
    UNAVAILABLE: "Unavailable",
    EXPIRED: "Expired",
    CANCELLED: "Cancelled",
    NOT_YET_AVAILABLE: "Not yet available",
    AVAILABILITY_ENDED: "Availability ended",
  };

  return labels[value];
}

function expiryLabel(value: ExpiryCondition): string {
  const labels: Record<ExpiryCondition, string> = {
    NO_EXPIRY: "No expiry date",
    EXPIRED: "Expired",
    EXPIRING_SOON: "Expires within 3 days",
    NEAR_EXPIRY: "Expires within 7 days",
    VALID: "Within expiry date",
  };

  return labels[value];
}

function isCurrentlyAvailable(resource: InventoryResource): boolean {
  return resource.availability_condition === "AVAILABLE";
}

function statusClass(value: string): string {
  return value.toLowerCase().replaceAll("_", "-");
}

export default function ResourceInventoryPage({
  token,
  onSessionExpired,
}: Props) {
  const [resources, setResources] = useState<InventoryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [contributorFilter, setContributorFilter] =
    useState<ContributorFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [districtFilter, setDistrictFilter] = useState("ALL");
  const [expiryFilter, setExpiryFilter] = useState("ALL");
  const [selected, setSelected] = useState<InventoryResource | null>(null);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchResourceInventory(token);
      setResources(data);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Could not load the inventory.";

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
    void loadResources();
  }, [loadResources]);

  const types = useMemo(
    () => [...new Set(resources.map((r) => r.resource_type).filter(Boolean))].sort(),
    [resources]
  );

  const districts = useMemo(
    () => [...new Set(resources.map((r) => r.district).filter(Boolean))].sort(),
    [resources]
  );

  const counts = useMemo(() => {
    const available = resources.filter(isCurrentlyAvailable);

    return {
      total: resources.length,
      available: available.length,
      individuals: resources.filter(
        (r) => r.contributor_type === "INDIVIDUAL"
      ).length,
      organizations: resources.filter(
        (r) => r.contributor_type === "ORGANIZATION"
      ).length,
      expired: resources.filter(
        (r) => r.expiry_condition === "EXPIRED" ||
          r.availability_condition === "EXPIRED"
      ).length,
      expiring: resources.filter(
        (r) => r.expiry_condition === "EXPIRING_SOON"
      ).length,
    };
  }, [resources]);

  const visibleResources = useMemo(() => {
    const term = search.trim().toLowerCase();

    return resources.filter((r) => {
      if (filter === "AVAILABLE" && !isCurrentlyAvailable(r)) return false;

      if (
        filter === "UNAVAILABLE" &&
        (isCurrentlyAvailable(r) ||
          r.availability_condition === "EXPIRED")
      ) return false;

      if (
        filter === "EXPIRED" &&
        r.expiry_condition !== "EXPIRED" &&
        r.availability_condition !== "EXPIRED"
      ) return false;

      if (
        contributorFilter !== "ALL" &&
        r.contributor_type !== contributorFilter
      ) return false;

      if (typeFilter !== "ALL" && r.resource_type !== typeFilter) return false;
      if (districtFilter !== "ALL" && r.district !== districtFilter) return false;

      if (
        expiryFilter !== "ALL" &&
        r.expiry_condition !== expiryFilter
      ) return false;

      if (!term) return true;

      return [
        r.resource_name,
        r.resource_type,
        r.provider_name,
        r.provider_role,
        r.district,
        r.location,
        r.unit,
      ].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [
    resources,
    search,
    filter,
    contributorFilter,
    typeFilter,
    districtFilter,
    expiryFilter,
  ]);

  return (
    <main className="ri-page">
      <style>{`
        .ri-page{max-width:1500px;margin:auto;color:#172b3a;font-family:inherit}
        .ri-page *{box-sizing:border-box}
        .ri-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px}
        .ri-heading h1{font-size:29px;color:#0b1f33;margin:0 0 8px}
        .ri-heading p{font-size:14px;color:#667786;line-height:1.6;margin:0;max-width:750px}
        .ri-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 13px;border:1px solid #d6dee5;border-radius:8px;background:white;color:#163a59;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
        .ri-btn:disabled{opacity:.55;cursor:wait}
        .ri-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:22px}
        .ri-stat{background:#fff;border:1px solid #e0e6eb;border-radius:12px;padding:17px;min-width:0}
        .ri-stat-label{display:flex;align-items:center;gap:8px;color:#667786;font-size:12px;margin-bottom:12px}
        .ri-stat strong{font-size:27px;color:#0b1f33}
        .ri-stat small{display:block;color:#71808d;font-size:11px;margin-top:5px}
        .ri-panel{background:#fff;border:1px solid #e0e6eb;border-radius:14px;padding:20px;min-width:0}
        .ri-panel h2{font-size:18px;color:#0b1f33;margin:0}
        .ri-panel-head{display:flex;justify-content:space-between;align-items:center;gap:14px}
        .ri-muted{font-size:12px;color:#71808d}
        .ri-toolbar{display:flex;flex-direction:column;gap:13px;margin:19px 0}
        .ri-search{display:flex;align-items:center;gap:9px;border:1px solid #d6dee5;border-radius:8px;padding:10px 12px;color:#71808d;max-width:480px}
        .ri-search input{border:0;outline:0;background:transparent;color:#172b3a;font:inherit;width:100%;min-width:0}
        .ri-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        .ri-select{width:100%;padding:10px;border:1px solid #d6dee5;border-radius:8px;background:white;color:#34495a;font:inherit;font-size:12px;min-width:0}
        .ri-tabs{display:flex;flex-wrap:wrap;gap:6px}
        .ri-tab{padding:8px 11px;border:1px solid #dfe5ea;border-radius:8px;background:white;color:#566a7b;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
        .ri-tab.active{background:#0b1f33;border-color:#0b1f33;color:white}
        .ri-table-wrap{overflow-x:auto;border:1px solid #e5eaee;border-radius:10px}
        .ri-table{width:100%;border-collapse:collapse;min-width:970px}
        .ri-table th{background:#f7f9fb;color:#667786;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;padding:13px;border-bottom:1px solid #e5eaee}
        .ri-table td{padding:14px 13px;border-bottom:1px solid #edf0f3;font-size:12px;color:#34495a;vertical-align:top}
        .ri-table tbody tr:last-child td{border-bottom:0}
        .ri-resource-name{font-size:13px;font-weight:700;color:#163a59;margin-bottom:4px}
        .ri-sub{font-size:11px;color:#71808d;line-height:1.5;overflow-wrap:anywhere}
        .ri-quantity{font-size:14px;font-weight:700;color:#0b1f33;white-space:nowrap}
        .ri-pill{display:inline-flex;align-items:center;border-radius:30px;padding:5px 8px;font-size:10px;font-weight:700;white-space:nowrap;background:#edf1f5;color:#516273}
        .ri-available,.ri-valid,.ri-no-expiry{background:#e4f7eb;color:#187443}
        .ri-expiring-soon,.ri-near-expiry,.ri-not-yet-available{background:#fff3d8;color:#895900}
        .ri-expired,.ri-cancelled,.ri-availability-ended{background:#ffebe9;color:#b42318}
        .ri-unavailable{background:#edf0f3;color:#566575}
        .ri-icon-btn{border:1px solid #d6dee5;border-radius:7px;background:white;color:#245d88;padding:7px 9px;cursor:pointer;font-size:12px;font-weight:600}
        .ri-empty,.ri-error{padding:32px 16px;text-align:center;color:#71808d;font-size:13px}
        .ri-error{background:#fff0ee;color:#a52820;border:1px solid #f5c2bd;border-radius:9px;margin:14px 0;padding:13px}
        .ri-modal-bg{position:fixed;inset:0;z-index:1000;background:#081827a8;display:flex;align-items:center;justify-content:center;padding:18px}
        .ri-modal{background:white;border-radius:14px;width:min(680px,100%);max-height:90vh;overflow:auto;box-shadow:0 20px 60px #0003}
        .ri-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-bottom:1px solid #e5eaee}
        .ri-modal-head h2{font-size:20px;color:#0b1f33;margin:0 0 6px}
        .ri-modal-body{padding:20px}
        .ri-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}
        .ri-detail label{display:block;font-size:11px;color:#71808d;margin-bottom:6px}
        .ri-detail strong{display:block;font-size:13px;color:#263d50;overflow-wrap:anywhere;line-height:1.5}
        .ri-note{margin-top:18px;padding:13px;background:#f5f8fa;border:1px solid #e6ebef;border-radius:9px;color:#566a7b;font-size:12px;line-height:1.6}
        @media(max-width:1000px){.ri-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ri-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:600px){.ri-heading{flex-direction:column}.ri-panel{padding:12px}.ri-stats{gap:8px}.ri-stat{padding:12px}.ri-stat strong{font-size:23px}.ri-filters{grid-template-columns:1fr}.ri-detail-grid{grid-template-columns:1fr}.ri-page{padding-bottom:20px}}
      `}</style>

      <header className="ri-heading">
        <div>
          <h1>Resource Inventory</h1>
          <p>
            View resources contributed by individuals and organizations in one
            place. Review quantities, locations, availability, and expiry
            information before future allocation planning.
          </p>
        </div>

        <button
          type="button"
          className="ri-btn"
          disabled={loading}
          onClick={() => void loadResources()}
        >
          <RefreshCw size={15} />
          Refresh inventory
        </button>
      </header>

      <section className="ri-stats">
        <div className="ri-stat">
          <div className="ri-stat-label"><Package size={15} /> Total resource records</div>
          <strong>{loading ? "—" : counts.total}</strong>
          <small>All recorded contributions</small>
        </div>
        <div className="ri-stat">
          <div className="ri-stat-label"><Package size={15} /> Currently available</div>
          <strong>{loading ? "—" : counts.available}</strong>
          <small>Availability and expiry rules applied</small>
        </div>
        <div className="ri-stat">
          <div className="ri-stat-label"><Users size={15} /> Individual contributions</div>
          <strong>{loading ? "—" : counts.individuals}</strong>
          <small>Records provided by individuals</small>
        </div>
        <div className="ri-stat">
          <div className="ri-stat-label"><Building2 size={15} /> Organization contributions</div>
          <strong>{loading ? "—" : counts.organizations}</strong>
          <small>Records provided by organizations</small>
        </div>
      </section>

      {(counts.expired > 0 || counts.expiring > 0) && (
        <div className="ri-note" style={{ marginTop: 0, marginBottom: 18 }}>
          <AlertTriangle size={15} style={{ verticalAlign: "middle" }} />{" "}
          <strong>Expiry attention:</strong> {counts.expired} expired record(s)
          and {counts.expiring} record(s) expiring within 3 days. Check the
          expiry indicator before using any resource.
        </div>
      )}

      <section className="ri-panel">
        <div className="ri-panel-head">
          <div>
            <h2>Central inventory</h2>
            <p className="ri-muted" style={{ marginBottom: 0, marginTop: 6 }}>
              {loading ? "Loading resources…" : `${visibleResources.length} record(s) shown`}
            </p>
          </div>
        </div>

        <div className="ri-toolbar">
          <label className="ri-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search resource, contributor, or location"
              aria-label="Search inventory"
            />
          </label>

          <div className="ri-tabs" aria-label="Availability filter">
            {(["ALL", "AVAILABLE", "UNAVAILABLE", "EXPIRED"] as Filter[]).map((value) => (
              <button
                type="button"
                key={value}
                className={`ri-tab ${filter === value ? "active" : ""}`}
                onClick={() => setFilter(value)}
              >
                {value === "ALL"
                  ? "All resources"
                  : value === "UNAVAILABLE"
                    ? "Other unavailable"
                    : value.charAt(0) + value.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="ri-filters">
            <select
              className="ri-select"
              value={contributorFilter}
              onChange={(event) => setContributorFilter(event.target.value as ContributorFilter)}
              aria-label="Filter by contributor type"
            >
              <option value="ALL">All contributors</option>
              <option value="INDIVIDUAL">Individuals</option>
              <option value="ORGANIZATION">Organizations</option>
            </select>

            <select
              className="ri-select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter by resource type"
            >
              <option value="ALL">All resource types</option>
              {types.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>

            <select
              className="ri-select"
              value={districtFilter}
              onChange={(event) => setDistrictFilter(event.target.value)}
              aria-label="Filter by district"
            >
              <option value="ALL">All districts</option>
              {districts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>

            <select
              className="ri-select"
              value={expiryFilter}
              onChange={(event) => setExpiryFilter(event.target.value)}
              aria-label="Filter by expiry condition"
            >
              <option value="ALL">All expiry conditions</option>
              <option value="NO_EXPIRY">No expiry date</option>
              <option value="VALID">Within expiry date</option>
              <option value="EXPIRING_SOON">Expires within 3 days</option>
              <option value="NEAR_EXPIRY">Expires within 7 days</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="ri-error" role="alert">
            {error}{" "}
            <button className="ri-btn" type="button" onClick={() => void loadResources()}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="ri-empty">Loading inventory…</div>
        ) : visibleResources.length === 0 ? (
          <div className="ri-empty">
            No resources match the selected filters.
          </div>
        ) : (
          <div className="ri-table-wrap">
            <table className="ri-table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Contributor</th>
                  <th>Quantity</th>
                  <th>Location</th>
                  <th>Availability</th>
                  <th>Expiry</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {visibleResources.map((resource) => (
                  <tr key={resource.id}>
                    <td>
                      <div className="ri-resource-name">{resource.resource_name}</div>
                      <div className="ri-sub">{resource.resource_type}</div>
                    </td>
                    <td>
                      <div className="ri-resource-name">{resource.provider_name}</div>
                      <div className="ri-sub">
                        {resource.contributor_type === "ORGANIZATION"
                          ? "Organization"
                          : "Individual"}
                      </div>
                    </td>
                    <td>
                      <div className="ri-quantity">
                        {Number(resource.quantity).toLocaleString()} {resource.unit}
                      </div>
                    </td>
                    <td>
                      <div>{resource.district || "Not specified"}</div>
                      <div className="ri-sub">
                        <MapPin size={11} style={{ verticalAlign: "middle" }} />{" "}
                        {resource.location || "Location not specified"}
                      </div>
                    </td>
                    <td>
                      <span className={`ri-pill ri-${statusClass(resource.availability_condition)}`}>
                        {availabilityLabel(resource.availability_condition)}
                      </span>
                    </td>
                    <td>
                      <span className={`ri-pill ri-${statusClass(resource.expiry_condition)}`}>
                        {expiryLabel(resource.expiry_condition)}
                      </span>
                      <div className="ri-sub" style={{ marginTop: 5 }}>
                        {resource.expiry_date ? dateLabel(resource.expiry_date) : "—"}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ri-icon-btn"
                        onClick={() => setSelected(resource)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div
          className="ri-modal-bg"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section className="ri-modal" role="dialog" aria-modal="true" aria-labelledby="ri-detail-title">
            <header className="ri-modal-head">
              <div>
                <h2 id="ri-detail-title">{selected.resource_name}</h2>
                <div className="ri-muted">{selected.resource_type} · {selected.id}</div>
              </div>
              <button className="ri-btn" type="button" onClick={() => setSelected(null)} aria-label="Close details">
                <X size={16} />
              </button>
            </header>

            <div className="ri-modal-body">
              <div className="ri-detail-grid">
                <div className="ri-detail">
                  <label>Contributor</label>
                  <strong>{selected.provider_name}</strong>
                </div>
                <div className="ri-detail">
                  <label>Contributor type</label>
                  <strong>{selected.contributor_type === "ORGANIZATION" ? "Organization" : "Individual"}</strong>
                </div>
                <div className="ri-detail">
                  <label>Quantity</label>
                  <strong>{Number(selected.quantity).toLocaleString()} {selected.unit}</strong>
                </div>
                <div className="ri-detail">
                  <label>District and location</label>
                  <strong>{selected.district}{selected.location ? ` · ${selected.location}` : ""}</strong>
                </div>
                <div className="ri-detail">
                  <label>Available from</label>
                  <strong>{dateLabel(selected.available_from)}</strong>
                </div>
                <div className="ri-detail">
                  <label>Available until</label>
                  <strong>{dateLabel(selected.available_until)}</strong>
                </div>
                <div className="ri-detail">
                  <label>Expiry date</label>
                  <strong>{dateLabel(selected.expiry_date)}</strong>
                </div>
                <div className="ri-detail">
                  <label>Availability status</label>
                  <strong>{availabilityLabel(selected.availability_condition)}</strong>
                </div>
              </div>

              {selected.description && (
                <div className="ri-note">
                  <strong>Description</strong>
                  <p style={{ marginBottom: 0 }}>{selected.description}</p>
                </div>
              )}

              <div className="ri-note">
                <CalendarClock size={14} style={{ verticalAlign: "middle" }} />{" "}
                {expiryLabel(selected.expiry_condition)}. This page is currently
                read-only; it does not reserve stock or dispatch resources.
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}