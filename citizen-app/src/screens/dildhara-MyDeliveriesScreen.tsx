import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  DeliveryApiError,
  fetchMyDeliveries,
  type DeliveryAssignment,
} from "../services/dildhara-deliveriesApi";

interface MyDeliveriesScreenProps {
  token: string;
  onBack: () => void;
  onSessionExpired: () => void;
}

const formatStatus = (status: string) =>
  status.toLowerCase().replaceAll("_", " ");

export default function MyDeliveriesScreen({
  token,
  onBack,
  onSessionExpired,
}: MyDeliveriesScreenProps) {
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      setAssignments(await fetchMyDeliveries(token));
    } catch (error) {
      if (error instanceof DeliveryApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setErrorMessage(
        error instanceof DeliveryApiError
          ? error.message
          : "Could not load your deliveries."
      );
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, token]);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  const renderAssignment = (assignment: DeliveryAssignment) => {
    const expanded = expandedId === assignment.assignmentId;
    const destination =
      assignment.destinationName || assignment.destinationLocation;
    const people = [
      assignment.teamName ? `Team: ${assignment.teamName}` : null,
      assignment.volunteerName
        ? `Volunteer: ${assignment.volunteerName}`
        : null,
      assignment.driverName ? `Driver: ${assignment.driverName}` : null,
    ].filter((entry): entry is string => Boolean(entry));

    return (
      <View
        key={assignment.assignmentId}
        className="p-5 mb-4 bg-white border rounded-3xl border-safeplus-border"
      >
        <Pressable
          onPress={() =>
            setExpandedId(expanded ? null : assignment.assignmentId)
          }
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          className="flex-row items-start"
        >
          <View className="items-center justify-center w-11 h-11 mr-3 rounded-2xl bg-safeplus-blueSoft">
            <Ionicons name="cube-outline" size={22} color="#1570EF" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-safeplus-darkGreen">
              {destination}
            </Text>
            <Text className="mt-1 text-sm text-safeplus-muted">
              {assignment.destinationDistrict} · Trip {assignment.tripNumber}
            </Text>
            <View className="flex-row flex-wrap mt-3">
              <Text className="px-2 py-1 mr-2 mb-1 text-xs font-bold rounded-full bg-safeplus-blueSoft text-safeplus-blue">
                Trip: {formatStatus(assignment.assignmentStatus)}
              </Text>
              <Text className="px-2 py-1 mb-1 text-xs font-bold rounded-full bg-safeplus-amberSoft text-safeplus-amber">
                Dispatch: {formatStatus(assignment.dispatchStatus)}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#667085"
          />
        </Pressable>

        {expanded ? (
          <View className="pt-4 mt-4 border-t border-safeplus-border">
            <Text className="text-sm font-extrabold text-safeplus-darkGreen">
              Delivery details
            </Text>
            <Text className="mt-2 text-sm leading-5 text-safeplus-muted">
              Destination: {assignment.destinationLocation}
            </Text>
            <Text className="mt-1 text-sm leading-5 text-safeplus-muted">
              Agency response: {formatStatus(assignment.agencyResponse)}
            </Text>
            {assignment.plannedDeparture ? (
              <Text className="mt-1 text-sm leading-5 text-safeplus-muted">
                Planned departure:{" "}
                {new Date(assignment.plannedDeparture).toLocaleString()}
              </Text>
            ) : null}
            {people.map((person) => (
              <Text
                key={person}
                className="mt-1 text-sm leading-5 text-safeplus-muted"
              >
                {person}
              </Text>
            ))}
            {assignment.assignmentNotes ? (
              <Text className="mt-1 text-sm leading-5 text-safeplus-muted">
                Notes: {assignment.assignmentNotes}
              </Text>
            ) : null}

            <Text className="mt-4 text-sm font-extrabold text-safeplus-darkGreen">
              Assigned items
            </Text>
            {assignment.items.length === 0 ? (
              <Text className="mt-2 text-sm text-safeplus-muted">
                No item quantities were recorded for this trip.
              </Text>
            ) : (
              assignment.items.map((item) => (
                <View
                  key={item.id}
                  className="p-3 mt-2 rounded-2xl bg-safeplus-background"
                >
                  <Text className="text-sm font-bold text-safeplus-darkGreen">
                    {item.resourceName} · {item.quantityDispatched} {item.unit}
                  </Text>
                  {item.pickupLocation ? (
                    <Text className="mt-1 text-xs text-safeplus-muted">
                      Pickup: {item.pickupLocation} · {item.pickupDistrict}
                    </Text>
                  ) : null}
                  <Text className="mt-1 text-xs text-safeplus-muted">
                    Received: {item.quantityReceived ?? "Not confirmed"} ·
                    Damaged: {item.quantityDamaged} · Missing:{" "}
                    {item.quantityMissing}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        className="self-start px-4 py-2 mb-4 bg-white border rounded-xl border-safeplus-border"
      >
        <Text className="text-sm font-extrabold text-safeplus-darkGreen">
          ← Back to Home
        </Text>
      </Pressable>

      <View className="flex-row items-start mb-5">
        <View className="flex-1">
          <Text className="text-2xl font-extrabold text-safeplus-darkGreen">
            My Deliveries
          </Text>
          <Text className="mt-1 text-sm leading-5 text-safeplus-muted">
            Dispatch trips assigned to your volunteer account or team.
          </Text>
        </View>
        <Pressable
          onPress={() => void loadDeliveries()}
          accessibilityRole="button"
          accessibilityLabel="Refresh deliveries"
          disabled={loading}
          className="items-center justify-center w-11 h-11 ml-3 bg-white border rounded-xl border-safeplus-border disabled:opacity-50"
        >
          <Ionicons name="refresh-outline" size={20} color="#1B7F4B" />
        </Pressable>
      </View>

      {errorMessage ? (
        <View className="p-4 mb-4 border border-red-200 rounded-2xl bg-red-50">
          <Text className="text-sm font-bold text-red-700">{errorMessage}</Text>
          <Pressable
            onPress={() => void loadDeliveries()}
            accessibilityRole="button"
            className="self-start mt-3"
          >
            <Text className="text-sm font-extrabold text-red-700">Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {loading && assignments.length === 0 ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#1B7F4B" />
          <Text className="mt-3 text-sm text-safeplus-muted">
            Loading your deliveries...
          </Text>
        </View>
      ) : !loading && assignments.length === 0 && !errorMessage ? (
        <View className="p-6 bg-white border rounded-3xl border-safeplus-border">
          <Text className="text-base font-extrabold text-safeplus-darkGreen">
            No deliveries assigned yet
          </Text>
          <Text className="mt-2 text-sm leading-5 text-safeplus-muted">
            Deliveries assigned by the coordinator will appear here.
          </Text>
        </View>
      ) : (
        assignments.map(renderAssignment)
      )}
    </View>
  );
}
