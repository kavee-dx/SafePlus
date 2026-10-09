import { createElement, useState } from "react";
import type { ChangeEvent } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import {
  createResourceRequest,
  ResourceRequestApiError,
  type ResourceRequestUrgency,
} from "../services/dildhara-resourceRequestApi";

interface RequestResourceScreenProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
  onSessionExpired: () => void;
}


const RESOURCE_TYPES = [
  "Drinking Water",
  "Food",
  "Medicine",
  "Blankets",
  "Clothing",
  "Hygiene Kits",
  "Baby Supplies",
  "Emergency Equipment",
  "Other",
];

const UNITS = [
  "Bottles",
  "Packets",
  "Boxes",
  "Kits",
  "Pieces",
  "Litres",
  "Kilograms",
  "Other",
];

const URGENCIES: ResourceRequestUrgency[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

function formatDate(date: Date): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getToday(): Date {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

export default function RequestResourceScreen({
  token,
  onSuccess,
  onCancel,
  onSessionExpired,
}: RequestResourceScreenProps) {
  const [resourceType, setResourceType] =
    useState("Drinking Water");

  const [resourceName, setResourceName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [quantity, setQuantity] =
    useState("");
    

  const [unit, setUnit] =
    useState("Bottles");

  const [urgency, setUrgency] =
    useState<ResourceRequestUrgency>("MEDIUM");

  const [requiredDate, setRequiredDate] =
    useState<Date | null>(null);

  const [location, setLocation] =
    useState("");

  const [district, setDistrict] =
    useState("");

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleQuantityChange = (
    value: string
  ) => {
    // Allow whole numbers only.
    const cleaned = value.replace(
      /[^0-9]/g,
      ""
    );

    setQuantity(cleaned);
  };

  const handleDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowDatePicker(false);

    if (!selectedDate) {
      return;
    }

    const today = getToday();

    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setError(
        "Required date cannot be a past date."
      );
      return;
    }

    setRequiredDate(selectedDate);
  };

  const handleWebDateChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.value;
    setError("");

    if (!value) {
      setRequiredDate(null);
      return;
    }

    const [year, month, day] = value.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < getToday()) {
      setError("Required date cannot be a past date.");
      return;
    }

    setRequiredDate(selectedDate);
  };

  const validate = (): boolean => {
    setError("");

    if (!resourceName.trim()) {
      setError(
        "Please enter the resource name."
      );
      return false;
    }

    if (!quantity.trim()) {
      setError(
        "Please enter the quantity."
      );
      return false;
    }

    const numericQuantity =
      Number(quantity);

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity <= 0
    ) {
      setError(
        "Quantity must be a positive whole number."
      );
      return false;
    }

    if (!location.trim()) {
      setError(
        "Please enter where the resource is needed."
      );
      return false;
    }

    if (!district.trim()) {
      setError(
        "Please enter the district."
      );
      return false;
    }

    if (requiredDate) {
      const today = getToday();

      const selected = new Date(
        requiredDate
      );

      selected.setHours(0, 0, 0, 0);

      if (selected < today) {
        setError(
          "Required date cannot be a past date."
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (saving) {
      return;
    }

    if (!validate()) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createResourceRequest(
        token,
        {
          resourceType:
            resourceType.trim(),

          resourceName:
            resourceName.trim(),

          description:
            description.trim(),

          quantity:
            Number(quantity),

          unit:
            unit.trim(),

          urgency,

          requiredDate:
            requiredDate
              ? formatDate(requiredDate)
              : undefined,

          location:
            location.trim(),

          district:
            district.trim(),
        }
      );

      onSuccess();
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
          "Something went wrong. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-safeplus-background"
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 40,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}

      <View className="mb-5">
        <Pressable
          onPress={onCancel}
          className="mb-4"
          hitSlop={10}
        >
          <Text className="text-base font-bold text-safeplus-darkGreen">
            ← Back to Profile
          </Text>
        </Pressable>

        <Text className="text-2xl font-extrabold text-safeplus-text">
          Request Resource
        </Text>

        <Text className="mt-2 text-sm leading-5 text-safeplus-muted">
          Request resources that are needed
          during an emergency. Your request
          will be sent to the relevant relief
          or shelter management side.
        </Text>
      </View>

      {/* Error */}

      {error ? (
        <View className="p-3 mb-4 bg-red-50 rounded-2xl">
          <Text className="text-sm font-bold text-red-600">
            {error}
          </Text>
        </View>
      ) : null}

      {/* Resource Type */}

      <View className="mb-5">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">
          Resource Type
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {RESOURCE_TYPES.map(
            (type) => (
              <Pressable
                key={type}
                onPress={() =>
                  setResourceType(type)
                }
                className={`px-4 py-3 rounded-2xl border ${
                  resourceType === type
                    ? "bg-safeplus-green border-safeplus-green"
                    : "bg-white border-safeplus-border"
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    resourceType === type
                      ? "text-white"
                      : "text-safeplus-text"
                  }`}
                >
                  {type}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>

      {/* Resource Name */}

      <View className="mb-5">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">
          Resource Name
        </Text>

        <TextInput
          value={resourceName}
          onChangeText={setResourceName}
          placeholder="Example: Drinking water"
          placeholderTextColor="#8A8F98"
          className="h-12 px-4 bg-white border rounded-2xl border-safeplus-border"
        />
      </View>

      {/* Quantity */}

      <View className="mb-5">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">
          Quantity
        </Text>

        <TextInput
          value={quantity}
          onChangeText={handleQuantityChange}
          placeholder="Example: 100"
          placeholderTextColor="#8A8F98"
          keyboardType="number-pad"
          inputMode="numeric"
          className="h-12 px-4 bg-white border rounded-2xl border-safeplus-border"
        />

        <Text className="mt-1 text-xs text-safeplus-muted">
          Enter a whole number only.
        </Text>
      </View>

      {/* Unit */}

      <View className="mb-5">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">
          Unit
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {UNITS.map(
            (item) => (
              <Pressable
                key={item}
                onPress={() =>
                  setUnit(item)
                }
                className={`px-4 py-3 rounded-2xl border ${
                  unit === item
                    ? "bg-safeplus-green border-safeplus-green"
                    : "bg-white border-safeplus-border"
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    unit === item
                      ? "text-white"
                      : "text-safeplus-text"
                  }`}
                >
                  {item}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>

      {/* Urgency */}

      <View className="mb-5">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">
          Urgency
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {URGENCIES.map(
            (item) => (
              <Pressable
                key={item}
                onPress={() =>
                  setUrgency(item)
                }
                className={`px-5 py-3 rounded-2xl border ${
                  urgency === item
                    ? "bg-safeplus-green border-safeplus-green"
                    : "bg-white border-safeplus-border"
                }`}
              >
                <Text
                  className={`font-extrabold ${
                    urgency === item
                      ? "text-white"
                      : "text-safeplus-text"
                  }`}
                >
                  {item}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>
      {/* Required Date */}
      <View className="mb-5">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">
          Required Date
        </Text>

        {Platform.OS === "web" ? (
          createElement("input", {
            type: "date",
            "aria-label": "Required date",
            value: requiredDate ? formatDate(requiredDate) : "",
            min: formatDate(getToday()),
            disabled: saving,
            onChange: handleWebDateChange,
            style: {
              boxSizing: "border-box",
              width: "100%",
              height: 56,
              padding: "0 16px",
              border: "1px solid #d0d5dd",
              borderRadius: 16,
              backgroundColor: "#ffffff",
              color: "#101828",
              fontFamily: "inherit",
              fontSize: 16,
            },
          })
        ) : (
          <>
            <Pressable
              onPress={() => {
                setError("");
                setShowDatePicker(true);
              }}
              disabled={saving}
              className="flex-row items-center justify-between h-14 px-4 bg-white border rounded-2xl border-safeplus-border"
            >
              <Text
                className={
                  requiredDate
                    ? "text-base text-safeplus-text"
                    : "text-base text-safeplus-muted"
                }
              >
                {requiredDate
                  ? formatDate(requiredDate)
                  : "Select required date"}
              </Text>

              <View className="items-center justify-center w-10 h-10 ml-3 rounded-xl bg-safeplus-background">
                <Text className="text-xl">📅</Text>
              </View>
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={requiredDate || getToday()}
                mode="date"
                minimumDate={getToday()}
                display="default"
                onChange={handleDateChange}
              />
            )}
          </>
        )}

        <Text className="mt-1 text-xs text-safeplus-muted">
          {Platform.OS === "web"
            ? "Select a date using the calendar control."
            : "Tap here to select the required date."}
        </Text>
      </View>

      {/* District */}

      <View className="mb-5">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">
          District
        </Text>

        <TextInput
          value={district}
          onChangeText={setDistrict}
          placeholder="Example: Colombo"
          placeholderTextColor="#8A8F98"
          className="h-12 px-4 bg-white border rounded-2xl border-safeplus-border"
        />
      </View>

      
      {/* Location */}

      <View className="mb-5">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">
          Where is the resource needed?
        </Text>

        <TextInput
          value={location}
          onChangeText={(value) => {
            setLocation(value);
            setError("");
          }}
          placeholder="Example: Galle General Hospital, Unawatuna shelter, or a street address"
          placeholderTextColor="#8A8F98"
          multiline
          textAlignVertical="top"
          className="px-4 py-3 bg-white border rounded-2xl border-safeplus-border min-h-24"
        />

        <Text className="mt-1 text-xs text-safeplus-muted">
          Enter the specific address, shelter name, hospital, or area where the resources are needed.
        </Text>
      </View>

      {/* Description */}

      <View className="mb-6">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">
          Reason / Description
        </Text>

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Explain why this resource is needed..."
          placeholderTextColor="#8A8F98"
          multiline
          textAlignVertical="top"
          className="px-4 py-3 bg-white border rounded-2xl border-safeplus-border min-h-28"
        />
      </View>

      {/* Buttons */}

      <View className="gap-3">
        <Pressable
          onPress={handleSubmit}
          disabled={saving}
          className="items-center justify-center h-12 rounded-2xl bg-safeplus-green active:opacity-80"
        >
          {saving ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text className="text-base font-extrabold text-white">
              Submit Request
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={saving}
          className="items-center justify-center h-12 bg-white border rounded-2xl border-safeplus-border"
        >
          <Text className="text-base font-extrabold text-safeplus-text">
            Cancel
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}