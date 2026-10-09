import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";

import { AuthApiError } from "../services/dildhara-authApi";

import {
  fetchMyResources,
  type Resource,
  updateResource,
} from "../services/dildhara-resourceApi";

interface Props {
  token: string;
  backLabel?: string;
  onProvideResource: () => void;
  onBack: () => void;
  onSessionExpired: () => void;
}

export default function MyResourcesScreen({
  token,
  backLabel = "← Back to Profile",
  onProvideResource,
  onBack,
  onSessionExpired,
}: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadResources = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await fetchMyResources(token);
      setResources(result);
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.status === 401) {
          onSessionExpired();
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage("Could not load your resources.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const markUnavailable = async (resource: Resource) => {
    try {
      const updated = await updateResource(token, resource.id, {
        status: "UNAVAILABLE",
      });

      setResources((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.status === 401) {
          onSessionExpired();
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage("Could not update the resource.");
      }
    }
  };

  if (loading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator size="large" color="#1B7F4B" />
      </View>
    );
  }

  return (
    <View>
      <View className="mb-5">
        <Pressable
          onPress={onBack}
          className="self-start px-4 py-2 mb-4 bg-white border rounded-xl border-safeplus-border"
        >
          <Text className="text-sm font-extrabold text-safeplus-darkGreen">
            {backLabel}
          </Text>
        </Pressable>

        <Text className="text-2xl font-extrabold text-safeplus-darkGreen">
          My Resources
        </Text>

        <Text className="mt-1 text-sm text-safeplus-muted">
          Resources you have offered for relief operations.
        </Text>
      </View>

      <Pressable
        onPress={onProvideResource}
        className="items-center justify-center h-12 mb-5 rounded-2xl bg-safeplus-green"
      >
        <Text className="text-base font-extrabold text-white">
          + Provide Resource
        </Text>
      </Pressable>

      {errorMessage ? (
        <Text className="mb-4 text-sm font-bold text-red-600">
          {errorMessage}
        </Text>
      ) : null}

      {resources.length === 0 ? (
        <View className="p-6 bg-white border rounded-3xl border-safeplus-border">
          <Text className="text-base font-bold text-safeplus-darkGreen">
            No resources yet
          </Text>

          <Text className="mt-2 text-sm leading-5 text-safeplus-muted">
            Add a resource so the relief coordination team can know what you
            are able to provide.
          </Text>
        </View>
      ) : (
        resources.map((resource) => (
          <View
            key={resource.id}
            className="p-5 mb-4 bg-white border rounded-3xl border-safeplus-border"
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-lg font-extrabold text-safeplus-darkGreen">
                  {resource.resource_name}
                </Text>

                <Text className="mt-1 text-sm font-bold text-safeplus-muted">
                  {resource.resource_type}
                </Text>
              </View>

              <View className="px-3 py-1 rounded-full bg-safeplus-paleGreen">
                <Text className="text-xs font-bold text-safeplus-darkGreen">
                  {resource.status}
                </Text>
              </View>
            </View>

            <View className="mt-4">
              <ResourceField
                label="Quantity"
                value={`${resource.quantity} ${resource.unit}`}
              />

              <ResourceField label="District" value={resource.district} />

              <ResourceField
                label="Location"
                value={resource.location || "Not specified"}
              />

              {resource.expiry_date ? (
                <ResourceField
                  label="Expiry"
                  value={formatDate(resource.expiry_date)}
                />
              ) : null}
            </View>

            {resource.status === "AVAILABLE" ? (
              <Pressable
                onPress={() => markUnavailable(resource)}
                className="items-center justify-center h-11 mt-4 bg-white border rounded-2xl border-safeplus-border"
              >
                <Text className="text-sm font-extrabold text-safeplus-text">
                  Mark Unavailable
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

function ResourceField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View className="py-2 border-b border-safeplus-border">
      <Text className="text-xs font-bold uppercase text-safeplus-muted">
        {label}
      </Text>

      <Text className="mt-1 text-sm text-safeplus-text">{value}</Text>
    </View>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}