import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";

import {
  cancelReliefAllocation,
  createReliefAllocation,
  fetchAvailableReliefResources,
  fetchReliefAllocations,
  reserveReliefAllocation,
  type ReliefDispatchFocus,
  type AvailableReliefResource,
  type ReliefAllocation,
} from "../services/dildhara-reliefOperationsApi";
import {
  fetchResourceRequests,
  type ResourceRequest,
} from "../services/dildhara-resourceRequestApi";
import DildharaDispatchManagementSection from "./dildhara-DispatchManagementSection";

interface ReliefOperationsPageProps {
  token: string;
  onSessionExpired: () => void;
  dispatchFocus?: ReliefDispatchFocus;
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e7ebf0",
  borderRadius: 16,
  padding: 22,
  boxShadow: "0 8px 24px rgba(16, 24, 40, 0.045)",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: 10,
  fontSize: 14,
  background: "#ffffff",
  color: "#101828",
  colorScheme: "light",
  fontFamily: "inherit",
};

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background: "#b42318",
  color: "#ffffff",
  padding: "10px 14px",
  fontWeight: 600,
  cursor: "pointer",
};

function displayQuantity(value: number | string | undefined): string {
  const quantity = Number(value ?? 0);
  return Number.isFinite(quantity) ? quantity.toLocaleString() : "0";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "No expiry date";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString();
}

function statusStyle(status: string): React.CSSProperties {
  const colors: Record<string, { background: string; color: string }> = {
    DRAFT: { background: "#f2f4f7", color: "#344054" },
    RESERVED: { background: "#ecfdf3", color: "#027a48" },
    DISPATCHED: { background: "#eff8ff", color: "#175cd3" },
    COMPLETED: { background: "#ecfdf3", color: "#027a48" },
    CANCELLED: { background: "#fef3f2", color: "#b42318" },
  };

  const selected = colors[status] ?? colors.DRAFT;

  return {
    display: "inline-block",
    padding: "4px 9px",
    borderRadius: 999,
    background: selected.background,
    color: selected.color,
    fontSize: 11,
    fontWeight: 700,
  };
}

export default function ReliefOperationsPage({
  token,
  onSessionExpired,
  dispatchFocus,
}: ReliefOperationsPageProps) {
  const [resources, setResources] = useState<AvailableReliefResource[]>([]);
  const [allocations, setAllocations] = useState<ReliefAllocation[]>([]);
  const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [allocationType, setAllocationType] =
    useState<"REQUEST" | "AREA">("AREA");
  const [requestId, setRequestId] = useState("");
  const [destinationName, setDestinationName] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [destinationDistrict, setDestinationDistrict] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [availableResources, currentAllocations, requests] = await Promise.all([
        fetchAvailableReliefResources(token),
        fetchReliefAllocations(token),
        fetchResourceRequests(token),
      ]);

      setResources(availableResources);
      setAllocations(currentAllocations);
      setResourceRequests(requests);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load relief operations.";

      if (/401|unauthori[sz]ed|token expired|authentication required/i.test(message)) {
        onSessionExpired();
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const selectedItems = resources
      .map((resource) => ({
        resourceId: resource.id,
        quantity: Number(quantities[resource.id] ?? 0),
      }))
      .filter((item) => item.quantity > 0);

    if (selectedItems.length === 0) {
      setError("Enter a quantity for at least one resource.");
      return;
    }

    for (const item of selectedItems) {
      const resource = resources.find((entry) => entry.id === item.resourceId);
      if (!resource || item.quantity > Number(resource.available_quantity)) {
        setError(
          `The requested quantity exceeds the available stock for ${
            resource?.resource_name ?? "a selected resource"
          }.`
        );
        return;
      }
    }

    if (allocationType === "REQUEST" && !requestId.trim()) {
      setError("Select an approved resource request.");
      return;
    }

    setSaving(true);

    try {
      await createReliefAllocation(token, {
        allocationType,
        ...(allocationType === "REQUEST"
          ? { requestId: requestId.trim() }
          : {}),
        destinationName: destinationName.trim(),
        destinationLocation: destinationLocation.trim(),
        destinationDistrict: destinationDistrict.trim(),
        notes: notes.trim(),
        items: selectedItems,
      });

      setSuccess(
        "Allocation draft created. Stock has not been reserved yet."
      );
      setQuantities({});
      setRequestId("");
      setDestinationName("");
      setDestinationLocation("");
      setDestinationDistrict("");
      setNotes("");

      await loadData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create the allocation.";

      if (/401|unauthori[sz]ed|token expired|authentication required/i.test(message)) {
        onSessionExpired();
        return;
      }

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReserve = async (allocation: ReliefAllocation) => {
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await reserveReliefAllocation(token, allocation.id);
      setSuccess(`Allocation ${allocation.id} reserved successfully.`);
      await loadData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not reserve this allocation.";

      if (/401|unauthori[sz]ed|token expired|authentication required/i.test(message)) {
        onSessionExpired();
        return;
      }

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (allocation: ReliefAllocation) => {
    const confirmed = window.confirm(
      "Cancel this allocation? A dispatched allocation cannot be cancelled through this action."
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await cancelReliefAllocation(token, allocation.id);
      setSuccess("Allocation cancelled.");
      await loadData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not cancel this allocation.";

      if (/401|unauthori[sz]ed|token expired|authentication required/i.test(message)) {
        onSessionExpired();
        return;
      }

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const reservedCount = allocations.filter(
    (allocation) => allocation.status === "RESERVED"
  ).length;

  const draftCount = allocations.filter(
    (allocation) => allocation.status === "DRAFT"
  ).length;

  const approvedRequests = resourceRequests.filter(
    (request) => request.status === "APPROVED"
  );

  const activeStockCount = resources.length;

  return (
    <div className="ro-page" style={{ display: "grid", gap: 22, color: "#101828" }}>
      <header
        className="ro-hero"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          padding: "26px 28px",
          borderRadius: 18,
          background: "linear-gradient(125deg, #102a43 0%, #174e5b 100%)",
          boxShadow: "0 14px 30px rgba(16, 42, 67, 0.16)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              color: "#ffb4a9",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.06em",
            }}
          >
            <Truck size={17} />
            RELIEF OPERATIONS
          </div>
          <h1 style={{ margin: "8px 0", fontSize: 27, color: "#ffffff", letterSpacing: "-0.5px" }}>
            Dispatch & Resource Allocation
          </h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.76)", lineHeight: 1.6, maxWidth: 650 }}>
            Allocate available relief resources to approved requests or
            designated relief areas.
            <button
        type="button"
        onClick={() => void loadData()}
        disabled={loading || saving}
        style={{
          ...primaryButtonStyle,
          background: "rgba(255,255,255,0.12)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.28)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 3,
        }}
      >
        <RefreshCw size={16} />
        Refresh
      </button>
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading || saving}
          style={{
            ...primaryButtonStyle,
            background: "rgba(255,255,255,0.12)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.28)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 3,
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            padding: 13,
            border: "1px solid #fecdca",
            background: "#fef3f2",
            color: "#b42318",
            borderRadius: 9,
            display: "flex",
            alignItems: "flex-start",
            gap: 9,
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            padding: 13,
            border: "1px solid #abefc6",
            background: "#ecfdf3",
            color: "#027a48",
            borderRadius: 9,
            display: "flex",
            alignItems: "flex-start",
            gap: 9,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
        }}
      >
        <div style={cardStyle}>
          <span className="ro-stat-icon ro-stat-red"><Package size={19} /></span>
          <p style={{ color: "#667085", margin: "12px 0 4px", fontSize: 13 }}>
            Resources available
          </p>
          <strong style={{ fontSize: 27 }}>{activeStockCount}</strong>
        </div>
        <div style={cardStyle}>
          <span className="ro-stat-icon ro-stat-blue"><ClipboardList size={19} /></span>
          <p style={{ color: "#667085", margin: "12px 0 4px", fontSize: 13 }}>
            Draft allocations
          </p>
          <strong style={{ fontSize: 27 }}>{draftCount}</strong>
        </div>
        <div style={cardStyle}>
          <span className="ro-stat-icon ro-stat-green"><ShieldCheck size={19} /></span>
          <p style={{ color: "#667085", margin: "12px 0 4px", fontSize: 13 }}>
            Reserved allocations
          </p>
          <strong style={{ fontSize: 27 }}>{reservedCount}</strong>
        </div>
      </section>

      <section style={cardStyle}>
        <div className="ro-section-title">
          <div className="ro-section-title-icon"><ClipboardList size={18} /></div>
          <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 19, color: "#101828" }}>
          Create allocation draft
        </h2>
        <p style={{ margin: "0 0 18px", color: "#667085", fontSize: 13 }}>
          Drafting does not reserve stock. The backend rechecks stock when you
          reserve the allocation.
        </p>
          </div>
        </div>

        <form onSubmit={handleCreateDraft} style={{ display: "grid", gap: 18 }}>
          <div className="ro-type-field">
            <label htmlFor="allocationType" style={labelStyle}>
              Allocation type
            </label>
            <select
              id="allocationType"
              value={allocationType}
              onChange={(event) =>
                setAllocationType(event.target.value as "REQUEST" | "AREA")
              }
              style={fieldStyle}
            >
              <option value="AREA">Relief area / destination</option>
              <option value="REQUEST">Approved resource request</option>
            </select>
          </div>

          {allocationType === "REQUEST" && (
            <div>
              <label htmlFor="requestId" style={labelStyle}>
                Approved resource request
              </label>
              <select
                id="requestId"
                value={requestId}
                onChange={(event) => {
                  const selectedId = event.target.value;
                  setRequestId(selectedId);
                  const request = resourceRequests.find(
                    (entry) => entry.id === selectedId
                  );
                  if (request) {
                    setDestinationName(request.location || request.resourceName);
                    setDestinationLocation(request.location ?? "");
                    setDestinationDistrict(request.district ?? "");
                  }
                }}
                style={fieldStyle}
                required
              >
                <option value="">Select an approved request</option>
                {approvedRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.resourceName} · {request.quantity} {request.unit}
                    {request.urgency ? ` · ${request.urgency}` : ""}
                    {request.district ? ` · ${request.district}` : ""}
                  </option>
                ))}
              </select>
              <p style={{ color: "#667085", fontSize: 12, margin: "5px 0 0" }}>
                {approvedRequests.length > 0
                  ? "Only approved requests are selectable; the backend revalidates the request when saving."
                  : "No approved requests are available. Approve a request before creating a request-based allocation."}
              </p>
            </div>
          )}

          <div
            className="ro-form-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <label htmlFor="destinationName" style={labelStyle}>
                Destination name
              </label>
              <input
                id="destinationName"
                value={destinationName}
                onChange={(event) => setDestinationName(event.target.value)}
                placeholder="e.g. Relief Centre A"
                style={fieldStyle}
                required
              />
            </div>
            <div>
              <label htmlFor="destinationLocation" style={labelStyle}>
                Destination location
              </label>
              <input
                id="destinationLocation"
                value={destinationLocation}
                onChange={(event) => setDestinationLocation(event.target.value)}
                placeholder="Town, address or area"
                style={fieldStyle}
                required
              />
            </div>
            <div>
              <label htmlFor="destinationDistrict" style={labelStyle}>
                District
              </label>
              <input
                id="destinationDistrict"
                value={destinationDistrict}
                onChange={(event) => setDestinationDistrict(event.target.value)}
                placeholder="e.g. Colombo"
                style={fieldStyle}
                required
              />
            </div>
          </div>

          <div className="ro-notes">
            <label htmlFor="allocationNotes" style={labelStyle}>
              Notes (optional)
            </label>
            <textarea
              id="allocationNotes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Special handling or allocation instructions"
              style={{ ...fieldStyle, resize: "vertical" }}
            />
          </div>

          <div>
            <h3 style={{ margin: "4px 0 10px", fontSize: 15 }}>
              Select resources and quantities
            </h3>

            {loading ? (
              <p style={{ color: "#667085" }}>Loading available resources…</p>
            ) : resources.length === 0 ? (
              <p style={{ color: "#667085" }}>
                No eligible resources are currently available.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 9 }}>
                {resources.map((resource) => {
                  const available = Number(resource.available_quantity);

                  return (
                    <div
                      className="ro-resource-row"
                      key={resource.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) 110px",
                        gap: 12,
                        alignItems: "center",
                        padding: 12,
                        border: "1px solid #eaecf0",
                        borderRadius: 9,
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 14 }}>
                          {resource.resource_name}
                        </strong>
                        <div
                          style={{
                            color: "#667085",
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {resource.resource_type} ·{" "}
                          {displayQuantity(resource.available_quantity)}{" "}
                          {resource.unit} available
                        </div>
                        <div
                          style={{
                            color: "#667085",
                            fontSize: 12,
                            marginTop: 3,
                          }}
                        >
                          <MapPin
                            size={12}
                            style={{ verticalAlign: "middle" }}
                          />{" "}
                          {resource.district}
                          {" · "}Expiry: {formatDate(resource.expiry_date)}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`quantity-${resource.id}`}
                          style={{ ...labelStyle, fontSize: 11 }}
                        >
                          Quantity ({resource.unit})
                        </label>
                        <input
                          id={`quantity-${resource.id}`}
                          type="number"
                          min="0"
                          max={Math.max(0, available)}
                          step="any"
                          value={quantities[resource.id] ?? ""}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [resource.id]: event.target.value,
                            }))
                          }
                          placeholder="0"
                          style={fieldStyle}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={saving || loading}
              style={{
                ...primaryButtonStyle,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                opacity: saving || loading ? 0.65 : 1,
              }}
            >
              {saving ? (
                <LoaderCircle size={16} />
              ) : (
                <ClipboardList size={16} />
              )}
              Create draft
            </button>
          </div>
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>
          Allocation register
        </h2>
        <p style={{ margin: "0 0 16px", color: "#667085", fontSize: 13 }}>
          Review drafts and reservations. Dispatch planning and delivery
          confirmation will be connected in the next stage.
        </p>

        {loading ? (
          <p style={{ color: "#667085" }}>Loading allocations…</p>
        ) : allocations.length === 0 ? (
          <div
            style={{
              padding: 25,
              textAlign: "center",
              color: "#667085",
              background: "#f9fafb",
              borderRadius: 9,
            }}
          >
            <Package size={24} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>No allocations have been created yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 11 }}>
            {allocations.map((allocation) => (
              <article
                key={allocation.id}
                style={{
                  border: "1px solid #eaecf0",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>
                      {allocation.destination_name || "Unnamed destination"}
                    </strong>
                    <div
                      style={{
                        color: "#667085",
                        fontSize: 12,
                        marginTop: 5,
                        overflowWrap: "anywhere",
                      }}
                    >
                      ID: {allocation.id}
                    </div>
                    <div
                      style={{
                        color: "#667085",
                        fontSize: 12,
                        marginTop: 5,
                      }}
                    >
                      {allocation.allocation_type === "REQUEST"
                        ? `Request: ${allocation.request_id ?? "Not specified"}`
                        : "Area allocation"}
                      {" · "}
                      {allocation.destination_district}
                    </div>
                    <div
                      style={{
                        color: "#667085",
                        fontSize: 12,
                        marginTop: 5,
                      }}
                    >
                      Created: {formatDate(allocation.created_at)}
                    </div>
                  </div>

                  <span style={statusStyle(allocation.status)}>
                    {allocation.status}
                  </span>
                </div>

                {allocation.items && allocation.items.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 8,
                      background: "#f9fafb",
                      fontSize: 12,
                    }}
                  >
                    {allocation.items.map((item, index) => (
                      <div key={item.id ?? `${item.resource_id}-${index}`}>
                        {item.resource_name ?? item.resource_type ?? item.resource_id}
                        {" — "}
                        {displayQuantity(item.quantity)} {item.unit ?? ""}
                      </div>
                    ))}
                  </div>
                )}

                {allocation.notes && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#667085",
                      margin: "10px 0 0",
                    }}
                  >
                    {allocation.notes}
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 13,
                  }}
                >
                  {allocation.status === "DRAFT" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleReserve(allocation)}
                      style={{
                        ...primaryButtonStyle,
                        background: "#027a48",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <ShieldCheck size={15} />
                      Reserve stock
                    </button>
                  )}

                  {(allocation.status === "DRAFT" ||
                    allocation.status === "RESERVED") && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleCancel(allocation)}
                      style={{
                        ...primaryButtonStyle,
                        background: "#ffffff",
                        color: "#b42318",
                        border: "1px solid #fecdca",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <XCircle size={15} />
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      
      </section>

      <DildharaDispatchManagementSection
        token={token}
        onSessionExpired={onSessionExpired}
        focus={dispatchFocus}
      />

    
      <style>{`
        .ro-page {
          text-align: left;
          font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
        }

        .ro-page h2,
        .ro-page h3 {
          color: #101828;
          letter-spacing: -0.02em;
        }

        .ro-page input,
        .ro-page select,
        .ro-page textarea {
          width: 100%;
          min-height: 44px;
          color: #101828 !important;
          background-color: #ffffff !important;
          color-scheme: light;
          text-align: left;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }

        .ro-page textarea {
          min-height: 76px;
        }

        .ro-page input::placeholder,
        .ro-page textarea::placeholder {
          color: #98a2b3;
          opacity: 1;
        }

        .ro-page input:focus,
        .ro-page select:focus,
        .ro-page textarea:focus {
          outline: none;
          border-color: #1570ef;
          box-shadow: 0 0 0 3px rgba(21, 112, 239, 0.13);
        }

        .ro-hero {
          color: #ffffff;
        }

        .ro-section-title {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .ro-section-title-icon,
        .ro-stat-icon {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
        }

        .ro-section-title-icon {
          background: #fff1f0;
          color: #b42318;
        }

        .ro-stat-icon {
          width: 42px;
          height: 42px;
        }

        .ro-stat-red {
          background: #fff1f0;
          color: #b42318;
        }

        .ro-stat-blue {
          background: #eff8ff;
          color: #175cd3;
        }

        .ro-stat-green {
          background: #ecfdf3;
          color: #027a48;
        }

        .ro-type-field {
          max-width: 440px;
        }

        .ro-form-grid {
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 14px;
        }

        .ro-resource-row {
          background: #ffffff;
          transition: border-color 150ms ease, background-color 150ms ease,
            transform 150ms ease;
        }

        .ro-resource-row:hover {
          border-color: #b2ccff !important;
          background: #f8fbff;
          transform: translateY(-1px);
        }

        .ro-page button {
          transition: background-color 150ms ease, box-shadow 150ms ease,
            transform 150ms ease;
        }

        .ro-page button:hover:not(:disabled) {
          box-shadow: 0 5px 12px rgba(16, 24, 40, 0.12);
          transform: translateY(-1px);
        }

        .ro-page button:focus-visible {
          outline: 3px solid rgba(21, 112, 239, 0.35);
          outline-offset: 2px;
        }

        @media (max-width: 560px) {
          .ro-hero {
            padding: 20px !important;
          }

          .ro-page > section {
            padding: 18px !important;
          }

          .ro-resource-row {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 6,
  color: "#344054",
};