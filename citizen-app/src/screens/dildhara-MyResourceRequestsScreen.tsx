import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  fetchMyResourceRequests,
  ResourceRequestApiError,
  type ResourceRequest,
} from "../services/dildhara-resourceRequestApi";

interface MyResourceRequestsScreenProps {
  token: string;
  onBack: () => void;
  onSessionExpired: () => void;
  onRequestResource: () => void;
}

function statusLabel(
  status: ResourceRequest["status"]
): string {
  return status;
}

function urgencyLabel(
  urgency: ResourceRequest["urgency"]
): string {
  return urgency;
}

function statusClass(
  status: ResourceRequest["status"]
): string {
  switch (status) {
    case "APPROVED":
      return "bg-green-100 text-green-700";

    case "REJECTED":
      return "bg-red-100 text-red-700";

    case "FULFILLED":
      return "bg-blue-100 text-blue-700";

    case "CANCELLED":
      return "bg-gray-100 text-gray-700";

    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

function urgencyClass(
  urgency: ResourceRequest["urgency"]
): string {
  switch (urgency) {
    case "CRITICAL":
      return "bg-red-100 text-red-700";

    case "HIGH":
      return "bg-orange-100 text-orange-700";

    case "MEDIUM":
      return "bg-yellow-100 text-yellow-700";

    default:
      return "bg-green-100 text-green-700";
  }
}

export default function MyResourceRequestsScreen({
  token,
  onBack,
  onSessionExpired,
  onRequestResource,
}: MyResourceRequestsScreenProps) {
  const [requests, setRequests] =
    useState<ResourceRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadRequests = useCallback(
    async (
      showLoader = true
    ) => {
      if (showLoader) {
        setLoading(true);
      }

      setError("");

      try {
        const result =
          await fetchMyResourceRequests(
            token
          );

        setRequests(result);
      } catch (requestError) {
        if (
          requestError instanceof
          ResourceRequestApiError
        ) {
          if (
            requestError.status === 401
          ) {
            onSessionExpired();
            return;
          }

          setError(
            requestError.message
          );
        } else {
          setError(
            "Could not load your requests."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [token, onSessionExpired]
  );

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleRefresh = async () => {
    setRefreshing(true);

    await loadRequests(false);

    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-safeplus-background">
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        <Pressable
          onPress={onBack}
          className="mb-4"
        >
          <Text className="text-base font-bold text-safeplus-darkGreen">
            ← Back to Profile
          </Text>
        </Pressable>

        <Text className="text-2xl font-extrabold text-safeplus-text">
          My Resource Requests
        </Text>

        <Text className="mt-2 mb-5 text-sm leading-5 text-safeplus-muted">
          View the resources you have
          requested and track their status.
        </Text>

        <Pressable
          onPress={onRequestResource}
          className="items-center justify-center h-12 mb-5 rounded-2xl bg-safeplus-green"
        >
          <Text className="text-base font-extrabold text-white">
            + Request Resource
          </Text>
        </Pressable>

        {error ? (
          <View className="p-3 mb-4 bg-red-50 rounded-2xl">
            <Text className="text-sm font-bold text-red-600">
              {error}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator
              size="large"
              color="#2E7D32"
            />

            <Text className="mt-3 text-sm text-safeplus-muted">
              Loading your requests...
            </Text>
          </View>
        ) : requests.length === 0 ? (
          <View className="p-6 bg-white border rounded-2xl border-safeplus-border">
            <Text className="text-base font-bold text-center text-safeplus-text">
              No resource requests yet
            </Text>

            <Text className="mt-2 text-sm leading-5 text-center text-safeplus-muted">
              When you request emergency
              resources, your requests will
              appear here.
            </Text>
          </View>
        ) : (
          requests.map((request) => (
            <View
              key={request.id}
              className="p-4 mb-4 bg-white border rounded-2xl border-safeplus-border"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-lg font-extrabold text-safeplus-text">
                    {request.resourceName}
                  </Text>

                  <Text className="mt-1 text-sm text-safeplus-muted">
                    {request.resourceType}
                  </Text>
                </View>

                <View
                  className={`px-3 py-1 rounded-full ${statusClass(
                    request.status
                  )
                    .split(" ")
                    .slice(0, 1)
                    .join(" ")}`}
                >
                  <Text
                    className={`text-xs font-extrabold ${
                      statusClass(
                        request.status
                      ).split(" ").slice(1).join(" ")
                    }`}
                  >
                    {statusLabel(
                      request.status
                    )}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-2 mt-4">
                <View
                  className={`px-3 py-2 rounded-xl ${urgencyClass(
                    request.urgency
                  )
                    .split(" ")
                    .slice(0, 1)
                    .join(" ")}`}
                >
                  <Text
                    className={`text-xs font-extrabold ${
                      urgencyClass(
                        request.urgency
                      )
                        .split(" ")
                        .slice(1)
                        .join(" ")
                    }`}
                  >
                    {urgencyLabel(
                      request.urgency
                    )}
                  </Text>
                </View>
              </View>

              <View className="mt-4">
                <Text className="text-sm text-safeplus-text">
                  <Text className="font-bold">
                    Quantity:
                  </Text>{" "}
                  {request.quantity}{" "}
                  {request.unit}
                </Text>

                

                <Text className="mt-1 text-sm text-safeplus-text">
                  <Text className="font-bold">
                    Location:
                  </Text>{" "}
                  {request.location}
                </Text>

                <Text className="mt-1 text-sm text-safeplus-text">
                  <Text className="font-bold">
                    District:
                  </Text>{" "}
                  {request.district}
                </Text>

                {request.requiredDate ? (
                  <Text className="mt-1 text-sm text-safeplus-text">
                    <Text className="font-bold">
                      Required:
                    </Text>{" "}
                    {request.requiredDate}
                  </Text>
                ) : null}

                {request.description ? (
                  <Text className="mt-3 text-sm leading-5 text-safeplus-muted">
                    {request.description}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}