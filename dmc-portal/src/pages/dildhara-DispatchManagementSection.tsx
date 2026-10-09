
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assignDispatchTrip,
  confirmDispatchDelivery,
  createDispatchForAllocation,
  fetchDispatchAssignmentOptions,
  fetchDispatches,
  fetchDispatchDetails,
  fetchReliefAllocationDetails,
  fetchReliefAllocations,
  markDispatchDeparted,
  recordAgencyResponse,
  type DispatchAssignmentOptions,
  recordDispatchTracking,
  type DeliveryCondition,
  type ReliefAllocation,
  type ReliefDispatch,
  type ReliefDispatchFocus,
} from "../services/dildhara-reliefOperationsApi";

interface Props {
  token: string;
  onSessionExpired: () => void;
  focus?: ReliefDispatchFocus;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  marginBottom: 18,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
  marginTop: 6,
};

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "10px 14px",
  background: "#b91c1c",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#374151",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 12,
};

function quantity(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function statusColor(status: string): string {
  if (["DELIVERED", "ACCEPTED", "READY", "COMPLETED"].includes(status)) {
    return "#166534";
  }

  if (["CANCELLED", "REJECTED"].includes(status)) {
    return "#b91c1c";
  }

  return "#92400e";
}

export default function DildharaDispatchManagementSection({
  token,
  onSessionExpired,
  focus,
}: Props) {
  const [allocations, setAllocations] = useState<ReliefAllocation[]>([]);
  const [dispatches, setDispatches] = useState<ReliefDispatch[]>([]);
  const [assignmentOptions, setAssignmentOptions] =
    useState<DispatchAssignmentOptions>({
      vehicles: [],
      volunteers: [],
      drivers: [],
      teams: [],
    });
  const [assignmentOptionsError, setAssignmentOptionsError] = useState("");
  const [selectedAllocationDetails, setSelectedAllocationDetails] =
    useState<ReliefAllocation | null>(null);
  const [allocationDetailsLoading, setAllocationDetailsLoading] =
    useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState("");
  const [selectedDispatchId, setSelectedDispatchId] = useState("");
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState("ALL");
  const [focusNotice, setFocusNotice] = useState("");
  const focusHandled = useRef(false);

  const [plannedDeparture, setPlannedDeparture] = useState("");
  const [createNotes, setCreateNotes] = useState("");

  const [response, setResponse] = useState<"ACCEPTED" | "REJECTED">("ACCEPTED");
  const [responseNotes, setResponseNotes] = useState("");

  const [tripNumber, setTripNumber] = useState("1");
  const [vehicleId, setVehicleId] = useState("");
  const [driverUserId, setDriverUserId] = useState("");
  const [volunteerProfileId, setVolunteerProfileId] = useState("");
  const [teamProfileId, setTeamProfileId] = useState("");
  const [tripNotes, setTripNotes] = useState("");
  const [dispatchQuantities, setDispatchQuantities] = useState<
    Record<string, string>
  >({});

  const [locationLabel, setLocationLabel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [trackingNotes, setTrackingNotes] = useState("");

  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [deliveryCondition, setDeliveryCondition] =
    useState<DeliveryCondition>("ACCEPTED");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryQuantities, setDeliveryQuantities] = useState<
    Record<string, { received: string; damaged: string; missing: string }>
  >({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedAllocation = useMemo(
    () =>
      selectedAllocationDetails?.id === selectedAllocationId
        ? selectedAllocationDetails
        : undefined,
    [selectedAllocationDetails, selectedAllocationId]
  );

  const selectedDispatch = useMemo(
    () => dispatches.find((item) => item.id === selectedDispatchId),
    [dispatches, selectedDispatchId]
  );

  function getRemainingQuantity(
    allocationItemId: string,
    allocatedQuantity: number | string
  ): number {
    const dispatched = dispatches.reduce(
      (total, dispatch) =>
        total +
        (dispatch.items ?? [])
          .filter((item) => item.allocation_item_id === allocationItemId)
          .reduce(
            (itemTotal, item) =>
              itemTotal + quantity(item.quantity_dispatched),
            0
          ),
      0
    );

    return Math.max(0, quantity(allocatedQuantity) - dispatched);
  }

  const refreshDispatch = useCallback(
    async (dispatchId: string) => {
      const latest = await fetchDispatchDetails(token, dispatchId);

      setDispatches((current) => {
        const exists = current.some((item) => item.id === latest.id);

        return exists
          ? current.map((item) => (item.id === latest.id ? latest : item))
          : [latest, ...current];
      });

      return latest;
    },
    [token]
  );

  const refreshDispatchRegister = useCallback(async () => {
    const result = await fetchDispatches(token);
    setDispatches(result);
  }, [token]);

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [result, existingDispatches] = await Promise.all([
        fetchReliefAllocations(token),
        fetchDispatches(token),
      ]);
      setAllocations(result);
      setDispatches(existingDispatches);

      if (focus === "assignment" && !focusHandled.current) {
        focusHandled.current = true;
        const eligible = existingDispatches.find(
          (dispatch) =>
            ["PLANNED", "READY"].includes(dispatch.status) &&
            dispatch.agency_response !== "REJECTED"
        );

        if (eligible) {
          setSelectedDispatchId(eligible.id);
          setFocusNotice(
            "Selected an active dispatch. Agency acceptance and backend eligibility are checked before departure."
          );
        } else {
          setFocusNotice(
            "No active dispatch is available for assignment. Create a dispatch from a reserved allocation first."
          );
        }
      }

      try {
        const options = await fetchDispatchAssignmentOptions(token);
        setAssignmentOptions(options);
        setAssignmentOptionsError("");
      } catch (optionsError) {
        const message =
          optionsError instanceof Error
            ? optionsError.message
            : "Could not load assignment options.";
        setAssignmentOptionsError(message);

        if (/401|403|token|session expired/i.test(message)) {
          onSessionExpired();
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load allocations.";

      setError(message);

      if (/401|403|token|session expired/i.test(message)) {
        onSessionExpired();
      }
    } finally {
      setLoading(false);
    }
  }, [focus, token, onSessionExpired]);

  useEffect(() => {
    void loadAllocations();
  }, [loadAllocations]);

  useEffect(() => {
    if (!focus || loading) return;

    const target =
      focus === "planning"
        ? "dispatch-create-section"
        : selectedDispatch
          ? "dispatch-assignment-section"
          : "dispatch-register-section";
    document
      .getElementById(target)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, loading, selectedDispatch]);

  useEffect(() => {
    if (!selectedAllocationId) return;

    let current = true;

    void fetchReliefAllocationDetails(token, selectedAllocationId)
      .then((allocation) => {
        if (current) {
          setSelectedAllocationDetails(allocation);
          const initial: Record<string, string> = {};
          for (const item of allocation.items ?? []) {
            if (item.id) initial[item.id] = "";
          }
          setDispatchQuantities(initial);
        }
      })
      .catch((err: unknown) => {
        if (!current) return;
        const message =
          err instanceof Error
            ? err.message
            : "Could not load allocation items.";
        setError(message);
        if (/401|403|token|session expired/i.test(message)) {
          onSessionExpired();
        }
      })
      .finally(() => {
        if (current) setAllocationDetailsLoading(false);
      });

    return () => {
      current = false;
    };
  }, [onSessionExpired, selectedAllocationId, token]);

  useEffect(() => {
    if (!selectedDispatch) {
      setDeliveryQuantities({});
      return;
    }

    const initial: Record<
      string,
      { received: string; damaged: string; missing: string }
    > = {};

    for (const item of selectedDispatch.items ?? []) {
      initial[item.id] = {
        received:
          item.quantity_received == null ? "" : String(item.quantity_received),
        damaged:
          item.quantity_damaged == null ? "" : String(item.quantity_damaged),
        missing:
          item.quantity_missing == null ? "" : String(item.quantity_missing),
      };
    }

    setDeliveryQuantities(initial);
  }, [selectedDispatchId, selectedDispatch]);

  async function runAction(action: () => Promise<void>) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await action();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The operation failed.";

      setError(message);

      if (/401|403|token|session expired/i.test(message)) {
        onSessionExpired();
      }
    } finally {
      setSaving(false);
    }
  }

  function updateDispatch(updated: ReliefDispatch) {
    setDispatches((current) => {
      const exists = current.some((item) => item.id === updated.id);

      return exists
        ? current.map((item) => (item.id === updated.id ? updated : item))
        : [updated, ...current];
    });

    setSelectedDispatchId(updated.id);
  }

  async function createDispatch() {
    if (!selectedAllocation) {
      setError("Select an allocation first.");
      return;
    }

    if (selectedAllocation.status !== "RESERVED") {
      setError("Only reserved allocations can be dispatched.");
      return;
    }

    await runAction(async () => {
      const created = await createDispatchForAllocation(
        token,
        selectedAllocation.id,
        {
          plannedDeparture: plannedDeparture
            ? new Date(plannedDeparture).toISOString()
            : undefined,
          notes: createNotes.trim() || undefined,
        }
      );

      const details = await fetchDispatchDetails(token, created.id);
      updateDispatch(details);
      await refreshDispatchRegister();
      setSuccess("Dispatch created successfully.");
    });
  }

  async function submitAgencyResponse() {
    if (!selectedDispatch) return;

    await runAction(async () => {
      const updated = await recordAgencyResponse(
        token,
        selectedDispatch.id,
        {
          response,
          notes: responseNotes.trim() || undefined,
        }
      );

      updateDispatch(updated);
      await refreshDispatchRegister();
      setSuccess(`Agency response recorded: ${response}.`);
    });
  }

  async function submitTrip() {
    if (!selectedDispatch || !selectedAllocation) return;

    const tripItems = (selectedAllocation.items ?? [])
      .filter((item) => item.id)
      .map((item) => ({
        allocationItemId: item.id!,
        quantityDispatched: Number(dispatchQuantities[item.id!] || 0),
      }))
      .filter((item) => item.quantityDispatched > 0);

    if (tripItems.length === 0) {
      setError("Enter a positive dispatch quantity for at least one item.");
      return;
    }

    const exceededItem = tripItems.find((item) => {
      const allocationItem = selectedAllocation.items?.find(
        (entry) => entry.id === item.allocationItemId
      );
      return (
        !allocationItem ||
        item.quantityDispatched >
          getRemainingQuantity(item.allocationItemId, allocationItem.quantity)
      );
    });

    if (exceededItem) {
      setError("A dispatch quantity exceeds the remaining allocatable quantity.");
      return;
    }

    if (
      !vehicleId.trim() &&
      !driverUserId.trim() &&
      !volunteerProfileId.trim() &&
      !teamProfileId.trim()
    ) {
      setError("Select at least one available vehicle, driver, volunteer, or team.");
      return;
    }

    await runAction(async () => {
      await assignDispatchTrip(token, selectedDispatch.id, {
        tripNumber: Number(tripNumber),
        vehicleId: vehicleId.trim() || undefined,
        driverUserId: driverUserId.trim() || undefined,
        volunteerProfileId: volunteerProfileId.trim() || undefined,
        teamProfileId: teamProfileId.trim() || undefined,
        notes: tripNotes.trim() || undefined,
        items: tripItems,
      });

      await refreshDispatch(selectedDispatch.id);
      setDispatchQuantities({});
      setSuccess("Trip assignment saved.");
    });
  }

  async function departDispatch() {
    if (!selectedDispatch) return;

    await runAction(async () => {
      const updated = await markDispatchDeparted(token, selectedDispatch.id);
      updateDispatch(updated);
      await refreshDispatchRegister();
      setSuccess("Dispatch marked as in transit.");
    });
  }

  async function submitTracking() {
    if (!selectedDispatch) return;

    const lat = latitude.trim() ? Number(latitude) : undefined;
    const lng = longitude.trim() ? Number(longitude) : undefined;

    if (lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      setError("Latitude must be between -90 and 90.");
      return;
    }

    if (
      lng !== undefined &&
      (!Number.isFinite(lng) || lng < -180 || lng > 180)
    ) {
      setError("Longitude must be between -180 and 180.");
      return;
    }

    await runAction(async () => {
      await recordDispatchTracking(token, selectedDispatch.id, {
        locationLabel: locationLabel.trim() || undefined,
        latitude: lat,
        longitude: lng,
        notes: trackingNotes.trim() || undefined,
      });

      await refreshDispatch(selectedDispatch.id);
      setSuccess("Tracking update recorded.");
    });
  }

  async function submitDelivery() {
    if (!selectedDispatch) return;

    if (!receiverName.trim()) {
      setError("Enter the receiver's name.");
      return;
    }

    const items = (selectedDispatch.items ?? []).map((item) => {
      const values = deliveryQuantities[item.id];

      return {
        dispatchItemId: item.id,
        quantityReceived: Number(values?.received || 0),
        quantityDamaged: Number(values?.damaged || 0),
        quantityMissing: Number(values?.missing || 0),
      };
    });

    if (items.length === 0) {
      setError("This dispatch has no assigned items to confirm.");
      return;
    }

    for (const item of items) {
      const original = selectedDispatch.items.find(
        (dispatchItem) => dispatchItem.id === item.dispatchItemId
      );

      if (
        item.quantityReceived +
          item.quantityDamaged +
          item.quantityMissing >
        quantity(original?.quantity_dispatched) + 1e-8
      ) {
        setError(
          `The delivery quantities exceed the dispatched quantity for ${
            original?.resource_name ?? "an item"
          }.`
        );
        return;
      }

      if (
        Math.abs(
          item.quantityReceived +
            item.quantityDamaged +
            item.quantityMissing -
            quantity(original?.quantity_dispatched)
        ) > 1e-8
      ) {
        setError(
          `Received, damaged, and missing quantities must account for the full dispatched quantity for ${
            original?.resource_name ?? "an item"
          }.`
        );
        return;
      }
    }

    await runAction(async () => {
      const updated = await confirmDispatchDelivery(
        token,
        selectedDispatch.id,
        {
          receiverName: receiverName.trim(),
          receiverPhone: receiverPhone.trim() || undefined,
          condition: deliveryCondition,
          notes: deliveryNotes.trim() || undefined,
          items,
        }
      );

      updateDispatch(updated);
      await refreshDispatchRegister();
      setSuccess("Delivery confirmation recorded.");
    });
  }

  const reservedAllocations = allocations.filter(
    (allocation) => allocation.status === "RESERVED"
  );
  const visibleDispatches = dispatches.filter((dispatch) => {
    const query = dispatchSearch.trim().toLowerCase();
    const matchesStatus =
      dispatchStatusFilter === "ALL" ||
      dispatch.status === dispatchStatusFilter;
    const matchesSearch =
      !query ||
      [dispatch.id, dispatch.allocation_id, dispatch.destination_name ?? ""]
        .some((value) => value.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  return (
    <section style={{ marginTop: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Dispatch Management</h2>
          <p style={{ color: "#6b7280", marginBottom: 0 }}>
            Create dispatches, assign trips, record tracking and confirm delivery.
          </p>
        </div>

        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={() => void loadAllocations()}
          disabled={loading || saving}
        >
          {loading ? "Refreshing..." : "Refresh allocations and dispatches"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            ...cardStyle,
            background: "#fef2f2",
            color: "#991b1b",
            borderColor: "#fecaca",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            ...cardStyle,
            background: "#f0fdf4",
            color: "#166534",
            borderColor: "#bbf7d0",
          }}
        >
          {success}
        </div>
      )}

      {assignmentOptionsError && (
        <div
          role="status"
          style={{
            ...cardStyle,
            marginBottom: 0,
            background: "#fffaeb",
            color: "#93370d",
            borderColor: "#fedf89",
          }}
        >
          Vehicle, volunteer, and team selectors could not be loaded. Existing
          saved assignments remain visible. {assignmentOptionsError}
        </div>
      )}

      {focusNotice && (
        <div
          role="status"
          style={{ ...cardStyle, background: "#eff8ff", color: "#175cd3" }}
        >
          {focusNotice}
        </div>
      )}

      <div id="dispatch-create-section" style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>1. Create a dispatch</h3>

        <label style={labelStyle}>
          Reserved allocation
          <select
            style={fieldStyle}
            value={selectedAllocationId}
            onChange={(event) => {
              const allocationId = event.target.value;
              setSelectedAllocationId(allocationId);
              setSelectedAllocationDetails(null);
              setDispatchQuantities({});
              setAllocationDetailsLoading(Boolean(allocationId));
              setError("");
            }}
          >
            <option value="">Select a reserved allocation</option>
            {reservedAllocations.map((allocation) => (
              <option key={allocation.id} value={allocation.id}>
                {allocation.destination_name} — {allocation.destination_district}
              </option>
            ))}
          </select>
        </label>

        {allocationDetailsLoading && (
          <p role="status">Loading allocation items…</p>
        )}

        {selectedAllocation && (
          <div
            style={{
              background: "#f9fafb",
              borderRadius: 8,
              padding: 12,
              marginBottom: 14,
              fontSize: 14,
            }}
          >
            <strong>Destination:</strong> {selectedAllocation.destination_name}
            <br />
            <strong>Location:</strong> {selectedAllocation.destination_location}
            <br />
            <strong>District:</strong> {selectedAllocation.destination_district}
          </div>
        )}
        {selectedAllocation &&
          (selectedAllocation.items ?? []).length === 0 &&
          !allocationDetailsLoading && (
            <p role="alert">
              This allocation has no item details, so trip quantities cannot be
              assigned.
            </p>
          )}

        <label style={labelStyle}>
          Planned departure (optional)
          <input
            type="datetime-local"
            style={fieldStyle}
            value={plannedDeparture}
            onChange={(event) => setPlannedDeparture(event.target.value)}
          />
        </label>

        <label style={labelStyle}>
          Dispatch notes (optional)
          <textarea
            style={fieldStyle}
            rows={2}
            value={createNotes}
            onChange={(event) => setCreateNotes(event.target.value)}
          />
        </label>

        <button
          type="button"
          style={buttonStyle}
          disabled={
            saving ||
            allocationDetailsLoading ||
            !selectedAllocation ||
            (selectedAllocation.items ?? []).length === 0
          }
          onClick={() => void createDispatch()}
        >
          {saving ? "Saving..." : "Create dispatch"}
        </button>
      </div>

      <div id="dispatch-register-section" style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>2. Dispatch register</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <label style={labelStyle}>
            Search destination or ID
            <input
              style={fieldStyle}
              type="search"
              value={dispatchSearch}
              onChange={(event) => setDispatchSearch(event.target.value)}
              placeholder="Destination, dispatch ID, or allocation ID"
            />
          </label>
          <label style={labelStyle}>
            Filter by status
            <select
              style={fieldStyle}
              value={dispatchStatusFilter}
              onChange={(event) => setDispatchStatusFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              {["PLANNED", "READY", "IN_TRANSIT", "DELIVERED", "CANCELLED"].map(
                (status) => (
                  <option key={status} value={status}>{status}</option>
                )
              )}
            </select>
          </label>
        </div>

        {dispatches.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            No dispatches have been created yet.
          </p>
        ) : visibleDispatches.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No dispatches match these filters.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibleDispatches.map((dispatch) => (
              <button
                key={dispatch.id}
                type="button"
                onClick={() =>
                  void runAction(async () => {
                    const latest = await fetchDispatchDetails(token, dispatch.id);
                    updateDispatch(latest);
                    setError("");
                    setSuccess("");
                  })
                }
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 8,
                  border:
                    selectedDispatchId === dispatch.id
                      ? "2px solid #b91c1c"
                      : "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <strong>
                  {dispatch.destination_name ??
                    allocations.find((a) => a.id === dispatch.allocation_id)
                      ?.destination_name ??
                    "Dispatch"}
                </strong>
                <span
                  style={{
                    float: "right",
                    color: statusColor(dispatch.status),
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {dispatch.status}
                </span>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginTop: 5,
                    overflowWrap: "anywhere",
                  }}
                >
                  ID: {dispatch.id}
                </div>
                <div style={{ fontSize: 12, color: "#475467", marginTop: 5 }}>
                  Allocation: {dispatch.allocation_id}
                  {" · "}Agency: {dispatch.agency_response}
                  {" · "}Trips: {dispatch.assignments?.length ?? 0}
                </div>
                {dispatch.agency_response_notes && (
                  <div style={{ fontSize: 12, color: "#475467", marginTop: 4 }}>
                    Agency notes: {dispatch.agency_response_notes}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedDispatch && (
        <>
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Selected dispatch</h3>
            <p>
              <strong>Status:</strong>{" "}
              <span style={{ color: statusColor(selectedDispatch.status) }}>
                {selectedDispatch.status}
              </span>
            </p>
            <p>
              <strong>Agency response:</strong>{" "}
              {selectedDispatch.agency_response}
            </p>
            {selectedDispatch.agency_response_notes && (
              <p>
                <strong>Agency response notes:</strong>{" "}
                {selectedDispatch.agency_response_notes}
              </p>
            )}
            <p>
              <strong>Allocation status:</strong>{" "}
              {selectedDispatch.allocation_status ?? "Unavailable"}
            </p>
            <p style={{ overflowWrap: "anywhere" }}>
              <strong>Dispatch ID:</strong> {selectedDispatch.id}
            </p>
            <p style={{ overflowWrap: "anywhere" }}>
              <strong>Allocation:</strong> {selectedDispatch.allocation_id}
              {selectedDispatch.destination_name
                ? ` · ${selectedDispatch.destination_name}`
                : ""}
              {selectedDispatch.destination_district
                ? ` · ${selectedDispatch.destination_district}`
                : ""}
            </p>
            {selectedDispatch.destination_location && (
              <p>
                <strong>Destination location:</strong>{" "}
                {selectedDispatch.destination_location}
              </p>
            )}
            {selectedDispatch.status === "DELIVERED" &&
              selectedDispatch.allocation_status !== "COMPLETED" && (
                <p role="status" style={{ color: "#92400e" }}>
                  Delivery was recorded, but the allocation remains open because
                  some allocated quantity was damaged, missing, or not received.
                </p>
              )}
            <h4>Dispatched resources</h4>
            {(selectedDispatch.items ?? []).length === 0 ? (
              <p>No trip quantities have been assigned.</p>
            ) : (
              <ul>
                {selectedDispatch.items.map((item) => (
                  <li key={item.id}>
                    {item.resource_name ?? item.resource_id ?? item.id}:{" "}
                    {quantity(item.quantity_dispatched)} {item.unit ?? ""}
                    {item.quantity_received != null &&
                      ` · Received ${quantity(item.quantity_received)}`}
                    {item.quantity_damaged != null &&
                      ` · Damaged ${quantity(item.quantity_damaged)}`}
                    {item.quantity_missing != null &&
                      ` · Missing ${quantity(item.quantity_missing)}`}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              style={secondaryButtonStyle}
              disabled={saving}
              onClick={() =>
                void runAction(async () => {
                  const latest = await fetchDispatchDetails(
                    token,
                    selectedDispatch.id
                  );
                  updateDispatch(latest);
                  setSuccess("Dispatch details refreshed.");
                })
              }
            >
              Refresh dispatch details
            </button>
          </div>

          {selectedDispatch.status === "PLANNED" &&
            selectedDispatch.agency_response === "PENDING" && (
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>3. Record agency response</h3>

                <label style={labelStyle}>
                  Response
                  <select
                    style={fieldStyle}
                    value={response}
                    onChange={(event) =>
                      setResponse(event.target.value as "ACCEPTED" | "REJECTED")
                    }
                  >
                    <option value="ACCEPTED">Accept dispatch</option>
                    <option value="REJECTED">Reject dispatch</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Response notes (optional)
                  <textarea
                    style={fieldStyle}
                    rows={2}
                    value={responseNotes}
                    onChange={(event) => setResponseNotes(event.target.value)}
                  />
                </label>

                <button
                  type="button"
                  style={buttonStyle}
                  disabled={saving}
                  onClick={() => void submitAgencyResponse()}
                >
                  Save agency response
                </button>
              </div>
            )}

          {(selectedDispatch.status === "PLANNED" ||
            selectedDispatch.status === "READY") &&
            selectedDispatch.agency_response !== "REJECTED" && (
              <div id="dispatch-assignment-section" style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>4. Assign a trip</h3>
                <p style={{ color: "#6b7280", fontSize: 13 }}>
                  Choose real records from the available selectors. Vehicles
                  are listed only when an AVAILABLE vehicle record exists;
                  volunteer and team choices come from registered profiles.
                  Leave unused selectors empty.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={labelStyle}>
                    Trip number
                    <input
                      style={fieldStyle}
                      type="number"
                      min="1"
                      step="1"
                      value={tripNumber}
                      onChange={(event) => setTripNumber(event.target.value)}
                    />
                  </label>

                  <label style={labelStyle}>
                    Vehicle (optional)
                    <select
                      style={fieldStyle}
                      value={vehicleId}
                      onChange={(event) => setVehicleId(event.target.value)}
                    >
                      <option value="">
                        {assignmentOptions.vehicles.length
                          ? "Select available vehicle"
                          : "No available vehicle records"}
                      </option>
                      {assignmentOptions.vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.vehicle_registration_number} · {vehicle.vehicle_type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Driver (active volunteer with registered license)
                    <select
                      style={fieldStyle}
                      value={driverUserId}
                      onChange={(event) => setDriverUserId(event.target.value)}
                    >
                      <option value="">
                        {assignmentOptions.drivers.length
                          ? "Select a registered driver"
                          : "No eligible registered drivers"}
                      </option>
                      {assignmentOptions.drivers.map((driver) => (
                        <option key={driver.user_id} value={driver.user_id}>
                          {driver.full_name}
                          {driver.district ? ` · ${driver.district}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Volunteer
                    <select
                      style={fieldStyle}
                      value={volunteerProfileId}
                      onChange={(event) =>
                        setVolunteerProfileId(event.target.value)
                      }
                    >
                      <option value="">Select a volunteer</option>
                      {assignmentOptions.volunteers.map((volunteer) => (
                        <option key={volunteer.id} value={volunteer.id}>
                          {volunteer.full_name}
                          {volunteer.district ? ` · ${volunteer.district}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Team
                    <select
                      style={fieldStyle}
                      value={teamProfileId}
                      onChange={(event) => setTeamProfileId(event.target.value)}
                    >
                      <option value="">Select a team</option>
                      {assignmentOptions.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.team_name} · {team.operating_district}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label style={labelStyle}>
                  Trip notes (optional)
                  <textarea
                    style={fieldStyle}
                    rows={2}
                    value={tripNotes}
                    onChange={(event) => setTripNotes(event.target.value)}
                  />
                </label>

                <h4>Quantities to dispatch</h4>

                {(selectedAllocation?.items ?? []).length === 0 ? (
                  <p>
                    No allocation items were returned for this allocation.
                    Check that the allocation API includes its items.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: 8 }}>Item</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Allocated</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Remaining</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Dispatch quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedAllocation?.items ?? []).map((item) => {
                          const remaining = item.id
                            ? getRemainingQuantity(item.id, item.quantity)
                            : 0;

                          return (
                            <tr key={item.id ?? item.resource_id}>
                              <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>
                                {item.resource_name ?? item.resource_id}
                              </td>
                              <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>
                                {item.quantity} {item.unit ?? ""}
                              </td>
                              <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>
                                {remaining} {item.unit ?? ""}
                              </td>
                              <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>
                                <input
                                  style={{ ...fieldStyle, marginTop: 0, minWidth: 100 }}
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  step="any"
                                  value={item.id ? dispatchQuantities[item.id] ?? "" : ""}
                                  disabled={!item.id || remaining <= 0}
                                  onChange={(event) => {
                                    if (!item.id) return;
                                    setDispatchQuantities((current) => ({
                                      ...current,
                                      [item.id!]: event.target.value,
                                    }));
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <button
                  type="button"
                  style={buttonStyle}
                  disabled={
                    saving ||
                    allocationDetailsLoading ||
                    !selectedAllocation ||
                    (selectedAllocation.items ?? []).length === 0 ||
                    Number(tripNumber) < 1
                  }
                  onClick={() => void submitTrip()}
                >
                  Save trip assignment
                </button>
              </div>
            )}

          {selectedDispatch.status === "READY" &&
            selectedDispatch.agency_response === "ACCEPTED" && (
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>5. Depart</h3>
                <p>
                  Once a trip has been assigned, mark this dispatch as in
                  transit.
                </p>
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={
                    saving || selectedDispatch.assignments.length === 0
                  }
                  onClick={() => void departDispatch()}
                >
                  Mark as departed
                </button>
                {selectedDispatch.assignments.length === 0 && (
                  <p style={{ color: "#92400e", fontSize: 13 }}>
                    Assign at least one trip before departure.
                  </p>
                )}
              </div>
            )}

          {selectedDispatch.status === "IN_TRANSIT" && (
            <>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>6. Record tracking update</h3>
                <p style={{ color: "#6b7280", fontSize: 13 }}>
                  This records a manual update. It does not automatically track
                  a vehicle's live GPS location.
                </p>

                <label style={labelStyle}>
                  Current location / checkpoint
                  <input
                    style={fieldStyle}
                    value={locationLabel}
                    onChange={(event) => setLocationLabel(event.target.value)}
                    placeholder="e.g. Kurunegala distribution point"
                  />
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={labelStyle}>
                    Latitude (optional)
                    <input
                      style={fieldStyle}
                      type="number"
                      value={latitude}
                      onChange={(event) => setLatitude(event.target.value)}
                    />
                  </label>

                  <label style={labelStyle}>
                    Longitude (optional)
                    <input
                      style={fieldStyle}
                      type="number"
                      value={longitude}
                      onChange={(event) => setLongitude(event.target.value)}
                    />
                  </label>
                </div>

                <label style={labelStyle}>
                  Tracking notes
                  <textarea
                    style={fieldStyle}
                    rows={2}
                    value={trackingNotes}
                    onChange={(event) => setTrackingNotes(event.target.value)}
                  />
                </label>

                <button
                  type="button"
                  style={buttonStyle}
                  disabled={saving}
                  onClick={() => void submitTracking()}
                >
                  Save tracking update
                </button>
              </div>

              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>7. Confirm delivery</h3>

                <label style={labelStyle}>
                  Receiver name
                  <input
                    style={fieldStyle}
                    value={receiverName}
                    onChange={(event) => setReceiverName(event.target.value)}
                    required
                  />
                </label>

                <label style={labelStyle}>
                  Receiver phone (optional)
                  <input
                    style={fieldStyle}
                    value={receiverPhone}
                    onChange={(event) => setReceiverPhone(event.target.value)}
                  />
                </label>

                <label style={labelStyle}>
                  Overall delivery condition
                  <select
                    style={fieldStyle}
                    value={deliveryCondition}
                    onChange={(event) =>
                      setDeliveryCondition(
                        event.target.value as DeliveryCondition
                      )
                    }
                  >
                    <option value="ACCEPTED">Accepted</option>
                    <option value="PARTIAL">Partial delivery</option>
                    <option value="DAMAGED">Damaged goods</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </label>

                <h4>Confirm every dispatched item</h4>

                {(selectedDispatch.items ?? []).length === 0 ? (
                  <p>No dispatched items were found for this dispatch.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: 8 }}>Item</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Sent</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Received</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Damaged</th>
                          <th style={{ textAlign: "left", padding: 8 }}>Missing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDispatch.items.map((item) => {
                          const values = deliveryQuantities[item.id] ?? {
                            received: "",
                            damaged: "",
                            missing: "",
                          };

                          return (
                            <tr key={item.id}>
                              <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>
                                {item.resource_name ?? item.id}
                              </td>
                              <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>
                                {item.quantity_dispatched} {item.unit ?? ""}
                              </td>
                              {(
                                ["received", "damaged", "missing"] as const
                              ).map((field) => (
                                <td
                                  key={field}
                                  style={{
                                    padding: 8,
                                    borderTop: "1px solid #e5e7eb",
                                  }}
                                >
                                  <input
                                    style={{
                                      ...fieldStyle,
                                      marginTop: 0,
                                      minWidth: 75,
                                    }}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={values[field]}
                                    onChange={(event) =>
                                      setDeliveryQuantities((current) => ({
                                        ...current,
                                        [item.id]: {
                                          ...(current[item.id] ?? {
                                            received: "",
                                            damaged: "",
                                            missing: "",
                                          }),
                                          [field]: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <label style={labelStyle}>
                  Delivery notes (optional)
                  <textarea
                    style={fieldStyle}
                    rows={2}
                    value={deliveryNotes}
                    onChange={(event) => setDeliveryNotes(event.target.value)}
                  />
                </label>

                <button
                  type="button"
                  style={buttonStyle}
                  disabled={saving || selectedDispatch.items.length === 0}
                  onClick={() => void submitDelivery()}
                >
                  Confirm delivery
                </button>
              </div>
            </>
          )}

          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Dispatch history</h3>
            <p>
              Dispatch: <strong>{selectedDispatch.status}</strong>
              {" · "}Allocation:{" "}
              <strong>{selectedDispatch.allocation_status ?? "Unavailable"}</strong>
            </p>

            <h4>Tracking updates</h4>
            {(selectedDispatch.tracking ?? []).length === 0 ? (
              <p>No tracking updates yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {selectedDispatch.tracking.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: 12,
                      background: "#f9fafb",
                      borderRadius: 8,
                    }}
                  >
                    <strong>{entry.status}</strong>
                    {entry.location_label && ` — ${entry.location_label}`}
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {entry.reported_at
                        ? new Date(entry.reported_at).toLocaleString()
                        : ""}
                    </div>
                    {entry.notes && <p style={{ marginBottom: 0 }}>{entry.notes}</p>}
                    {(entry.latitude != null || entry.longitude != null) && (
                      <p style={{ marginBottom: 0 }}>
                        Coordinates: {entry.latitude ?? "—"}, {entry.longitude ?? "—"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h4>Trip assignments</h4>
            {(selectedDispatch.assignments ?? []).length === 0 ? (
              <p>No trips assigned yet.</p>
            ) : (
              <ul>
                {selectedDispatch.assignments.map((assignment) => (
                  <li key={assignment.id}>
                    Trip {assignment.trip_number} — {assignment.status}
                    {assignment.vehicle_registration_number
                      ? ` — Vehicle ${assignment.vehicle_registration_number}`
                      : assignment.vehicle_id
                        ? ` — Vehicle ID ${assignment.vehicle_id}`
                        : ""}
                    {assignment.driver_name
                      ? ` — Driver ${assignment.driver_name}`
                      : assignment.driver_user_id
                        ? ` — Driver ID ${assignment.driver_user_id}`
                        : ""}
                    {assignment.volunteer_name
                      ? ` — Volunteer ${assignment.volunteer_name}`
                      : assignment.volunteer_profile_id
                        ? ` — Volunteer profile ${assignment.volunteer_profile_id}`
                        : ""}
                    {assignment.team_name
                      ? ` — Team ${assignment.team_name}`
                      : assignment.team_profile_id
                        ? ` — Team profile ${assignment.team_profile_id}`
                        : ""}
                  </li>
                ))}
              </ul>
            )}

            {selectedDispatch.deliveryConfirmations.length > 0 && (
              <>
                <h4>Saved delivery confirmations</h4>
                <div style={{ display: "grid", gap: 10 }}>
                  {selectedDispatch.deliveryConfirmations.map((confirmation) => (
                    <article
                      key={confirmation.id}
                      style={{
                        padding: 12,
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: 8,
                      }}
                    >
                      <strong>{confirmation.receiver_name ?? "Receiver not recorded"}</strong>
                      {confirmation.receiver_phone && (
                        <div>Contact: {confirmation.receiver_phone}</div>
                      )}
                      <div>
                        Condition: {confirmation.delivery_condition}
                        {" · "}
                        {confirmation.delivered_at
                          ? new Date(confirmation.delivered_at).toLocaleString()
                          : "Time unavailable"}
                      </div>
                      {confirmation.notes && <p>{confirmation.notes}</p>}
                      <div style={{ overflowX: "auto", marginTop: 8 }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 12,
                          }}
                        >
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: 6 }}>Item</th>
                              <th style={{ textAlign: "right", padding: 6 }}>Dispatched</th>
                              <th style={{ textAlign: "right", padding: 6 }}>Received</th>
                              <th style={{ textAlign: "right", padding: 6 }}>Damaged</th>
                              <th style={{ textAlign: "right", padding: 6 }}>Missing</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedDispatch.items ?? []).map((item) => (
                              <tr key={item.id}>
                                <td style={{ borderTop: "1px solid #d1fadf", padding: 6 }}>
                                  {item.resource_name ?? item.id}
                                </td>
                                <td style={{ borderTop: "1px solid #d1fadf", padding: 6, textAlign: "right" }}>
                                  {quantity(item.quantity_dispatched)} {item.unit ?? ""}
                                </td>
                                <td style={{ borderTop: "1px solid #d1fadf", padding: 6, textAlign: "right" }}>
                                  {item.quantity_received ?? "—"} {item.unit ?? ""}
                                </td>
                                <td style={{ borderTop: "1px solid #d1fadf", padding: 6, textAlign: "right" }}>
                                  {item.quantity_damaged ?? "—"} {item.unit ?? ""}
                                </td>
                                <td style={{ borderTop: "1px solid #d1fadf", padding: 6, textAlign: "right" }}>
                                  {item.quantity_missing ?? "—"} {item.unit ?? ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  ))}
                </div>
                <p>
                  Final dispatch status: <strong>{selectedDispatch.status}</strong>
                </p>
              </>
            )}
          </div>
        </>
      )}

      <p style={{ color: "#6b7280", fontSize: 12 }}>
        Checkpoint updates are entered manually; live vehicle GPS tracking is
        not enabled.
      </p>
    </section>
  );
}