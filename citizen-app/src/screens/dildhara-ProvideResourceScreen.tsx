import { useState } from "react";

import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthApiError } from "../services/dildhara-authApi";

import { createResource } from "../services/dildhara-resourceApi";

interface Props {
  token: string;
  cancelLabel?: string;
  onSuccess: () => void;
  onCancel: () => void;
  onSessionExpired: () => void;
}

const RESOURCE_TYPES = [
  "Food",
  "Water",
  "Medicine",
  "Blankets",
  "Clothing",
  "Shelter Materials",
  "Rescue Equipment",
  "Hygiene Supplies",
  "Other",
];

const UNITS = [
  "Pieces",
  "Bottles",
  "Packets",
  "Packs",
  "Boxes",
  "Kits",
  "Kg",
  "Litres",
  "Units",
];

type DateField = "availableFrom" | "availableUntil" | "expiryDate";

function startOfToday(): Date {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function displayDate(value: string): string {
  if (!value) {
    return "Select a date";
  }

  const parts = value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function ProvideResourceScreen({
  token,
  cancelLabel = "Back to Profile",
  onSuccess,
  onCancel,
  onSessionExpired,
}: Props) {
  const [resourceType, setResourceType] = useState("Food");
  const [resourceName, setResourceName] = useState("");
  const [description, setDescription] = useState("");

  const [quantity, setQuantity] = useState("");

  const [unit, setUnit] = useState("Pieces");
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState("");

  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [datePicker, setDatePicker] = useState<DateField | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  /* Only allow digits in the quantity field. */
  const handleQuantityChange = (value: string) => {
    const onlyNumbers = value.replace(/[^0-9]/g, "");

    setQuantity(onlyNumbers);
  };

  const getDateValue = (field: DateField): string => {
    if (field === "availableFrom") {
      return availableFrom;
    }

    if (field === "availableUntil") {
      return availableUntil;
    }

    return expiryDate;
  };

  const parseDate = (value: string): Date | null => {
    if (!value) {
      return null;
    }

    const parts = value.split("-");

    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setHours(0, 0, 0, 0);

    return date;
  };

  const getMinimumDate = (field: DateField): Date => {
    const today = startOfToday();

    if (field === "availableUntil" && availableFrom) {
      const fromDate = parseDate(availableFrom);

      if (fromDate && fromDate > today) {
        return fromDate;
      }
    }

    if (field === "expiryDate" && availableFrom) {
      const fromDate = parseDate(availableFrom);

      if (fromDate && fromDate > today) {
        return fromDate;
      }
    }

    return today;
  };

  const openDatePicker = (field: DateField) => {
    setDatePicker(field);
  };

  const closeDatePicker = () => {
    setDatePicker(null);
  };

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setDatePicker(null);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    const formatted = formatDate(selectedDate);

    if (datePicker === "availableFrom") {
      setAvailableFrom(formatted);

      /* Clear Available Until if it is now before Available From. */
      if (availableUntil) {
        const untilDate = parseDate(availableUntil);

        if (untilDate && selectedDate > untilDate) {
          setAvailableUntil("");
        }
      }

      /* Clear Expiry Date if it is now before Available From. */
      if (expiryDate) {
        const expiry = parseDate(expiryDate);

        if (expiry && selectedDate > expiry) {
          setExpiryDate("");
        }
      }
    }

    if (datePicker === "availableUntil") {
      setAvailableUntil(formatted);
    }

    if (datePicker === "expiryDate") {
      setExpiryDate(formatted);
    }

    if (Platform.OS === "ios") {
      setDatePicker(null);
    }
  };

  const getPickerDate = (field: DateField): Date => {
    const value = getDateValue(field);
    const parsed = parseDate(value);

    if (parsed) {
      return parsed;
    }

    return getMinimumDate(field);
  };

  const handleSubmit = async () => {
    if (saving) {
      return;
    }

    setErrorMessage("");

    if (!resourceName.trim()) {
      setErrorMessage("Please enter the resource name.");
      return;
    }

    if (!quantity.trim()) {
      setErrorMessage("Please enter the quantity.");
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setErrorMessage("Quantity must be a whole number greater than zero.");
      return;
    }

    if (!district.trim()) {
      setErrorMessage("Please enter the district.");
      return;
    }

    const today = startOfToday();

    const fromDate = parseDate(availableFrom);
    const untilDate = parseDate(availableUntil);
    const expiry = parseDate(expiryDate);

    /* Extra frontend validation. The backend also validates the dates. */

    if (fromDate && fromDate < today) {
      setErrorMessage("Available from cannot be a past date.");
      return;
    }

    if (untilDate && untilDate < today) {
      setErrorMessage("Available until cannot be a past date.");
      return;
    }

    if (expiry && expiry < today) {
      setErrorMessage("Expiry date cannot be a past date.");
      return;
    }

    if (fromDate && untilDate && untilDate < fromDate) {
      setErrorMessage("Available until cannot be before available from.");
      return;
    }

    if (fromDate && expiry && expiry < fromDate) {
      setErrorMessage("Expiry date cannot be before available from.");
      return;
    }

    setSaving(true);

    try {
      await createResource(token, {
        resourceType,
        resourceName: resourceName.trim(),
        description: description.trim(),
        quantity: parsedQuantity,
        unit,
        location: location.trim(),
        district: district.trim(),
        availableFrom: availableFrom ? `${availableFrom}T00:00:00` : undefined,
        availableUntil: availableUntil
          ? `${availableUntil}T23:59:59`
          : undefined,
        expiryDate: expiryDate ? `${expiryDate}T23:59:59` : undefined,
      });

      /* The parent decides where to go next (profile or resources list). */
      onSuccess();
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.status === 401) {
          onSessionExpired();
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const renderDatePicker = () => {
    if (!datePicker) {
      return null;
    }

    const minimumDate = getMinimumDate(datePicker);
    const pickerDate = getPickerDate(datePicker);

    /* Native Android / iOS date picker. */
    if (Platform.OS !== "web") {
      return (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="calendar"
          minimumDate={minimumDate}
          onChange={handleDateChange}
        />
      );
    }

    /* Web fallback. */
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={closeDatePicker}
      >
        <View className="items-center justify-center flex-1 px-5 bg-black/40">
          <View className="w-full max-w-md p-5 bg-white rounded-3xl">
            <Text className="mb-4 text-lg font-extrabold text-safeplus-darkGreen">
              Select date
            </Text>

            <input
              type="date"
              value={getDateValue(datePicker)}
              min={formatDate(minimumDate)}
              onChange={(event) => {
                const value = event.target.value;

                if (!value) {
                  return;
                }

                if (datePicker === "availableFrom") {
                  setAvailableFrom(value);
                }

                if (datePicker === "availableUntil") {
                  setAvailableUntil(value);
                }

                if (datePicker === "expiryDate") {
                  setExpiryDate(value);
                }

                closeDatePicker();
              }}
              style={{
                width: "100%",
                height: 48,
                padding: 10,
                fontSize: 16,
              }}
            />

            <Pressable
              onPress={closeDatePicker}
              className="items-center justify-center h-12 mt-4 rounded-2xl bg-safeplus-green"
            >
              <Text className="font-extrabold text-white">Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View>
      <Pressable
        onPress={onCancel}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        className="self-start px-4 py-2 mb-4 bg-white border rounded-xl border-safeplus-border"
      >
        <Text className="text-sm font-extrabold text-safeplus-darkGreen">
          ← {cancelLabel}
        </Text>
      </Pressable>

      <Text className="mb-1 text-2xl font-extrabold text-safeplus-darkGreen">
        Provide Resource
      </Text>

      <Text className="mb-6 text-sm leading-5 text-safeplus-muted">
        Add a relief resource that you are willing to provide for emergency
        operations.
      </Text>

      <View className="p-5 mb-4 bg-white border rounded-3xl border-safeplus-border">
        <Text className="mb-3 text-base font-extrabold text-safeplus-darkGreen">
          Resource type
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {RESOURCE_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => setResourceType(type)}
              className={`px-4 py-2 rounded-full ${
                resourceType === type
                  ? "bg-safeplus-green"
                  : "bg-safeplus-paleGreen"
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  resourceType === type
                    ? "text-white"
                    : "text-safeplus-darkGreen"
                }`}
              >
                {type}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FormField
        label="Resource name"
        value={resourceName}
        onChangeText={setResourceName}
        placeholder="e.g. Bottled Drinking Water"
      />

      <FormField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the resource"
        multiline
      />

      <FormField
        label="Quantity"
        value={quantity}
        onChangeText={handleQuantityChange}
        placeholder="100"
        keyboardType="numeric"
      />

      <View className="mb-4">
        <Text className="mb-2 text-sm font-bold text-safeplus-text">Unit</Text>

        <View className="flex-row flex-wrap gap-2">
          {UNITS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setUnit(item)}
              className={`px-3 py-2 rounded-xl ${
                unit === item ? "bg-safeplus-green" : "bg-safeplus-paleGreen"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  unit === item ? "text-white" : "text-safeplus-darkGreen"
                }`}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FormField
        label="Current location"
        value={location}
        onChangeText={setLocation}
        placeholder="Where is the resource stored?"
      />

      <FormField
        label="District"
        value={district}
        onChangeText={setDistrict}
        placeholder="e.g. Colombo"
      />

      <DateFieldButton
        label="Available from"
        value={availableFrom}
        onPress={() => openDatePicker("availableFrom")}
      />

      <DateFieldButton
        label="Available until"
        value={availableUntil}
        onPress={() => openDatePicker("availableUntil")}
      />

      <DateFieldButton
        label="Expiry date"
        value={expiryDate}
        onPress={() => openDatePicker("expiryDate")}
      />

      {errorMessage ? (
        <Text className="mb-4 text-sm font-bold text-red-600">
          {errorMessage}
        </Text>
      ) : null}

      <View className="flex-row gap-3 mb-8">
        <Pressable
          onPress={onCancel}
          disabled={saving}
          className="items-center justify-center flex-1 h-12 bg-white border rounded-2xl border-safeplus-border"
        >
          <Text className="text-base font-extrabold text-safeplus-text">
            {cancelLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={saving}
          className="items-center justify-center flex-1 h-12 rounded-2xl bg-safeplus-green"
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-extrabold text-white">
              Provide Resource
            </Text>
          )}
        </Pressable>
      </View>

      {renderDatePicker()}
    </View>
  );
}

function DateFieldButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-bold text-safeplus-text">{label}</Text>

      <Pressable
        onPress={onPress}
        className="flex-row items-center justify-between h-12 px-4 bg-white border rounded-2xl border-safeplus-border"
      >
        <Text
          className={
            value
              ? "text-base text-safeplus-text"
              : "text-base text-safeplus-muted"
          }
        >
          {displayDate(value)}
        </Text>

        <Text className="text-lg">📅</Text>
      </Pressable>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-bold text-safeplus-text">{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A948F"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        className={`px-4 bg-white border rounded-2xl border-safeplus-border text-safeplus-text ${
          multiline ? "h-28 pt-4" : "h-12"
        }`}
      />
    </View>
  );
}