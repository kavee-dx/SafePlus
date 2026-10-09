import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BAND_META,
  ShelterApiError,
  fetchNearbyShelters,
  formatDistance,
  mapsDirectionsUrl,
  occupancyPct,
  type NearbyShelter,
} from "../services/kaveesha-shelterApi";

/* ------------------------------------------------------------------ *
 * Nearby shelters (citizen, mobile).
 *
 * This is Thathsarani's original promise kept on a phone: stand where you are,
 * see the shelters nearest to furthest, and know honestly which still have room.
 * It reads the same central shelter records the district desk and the shelter
 * managers write, so the "Available / Limited / Full" you see is the live truth,
 * not a stale guess. When the handset has lost GPS the district search takes over
 * — the same answer, just not sorted by distance.
 * ------------------------------------------------------------------ */

interface NearbySheltersScreenProps {
  token: string;
  onBack: () => void;
}

interface Fix {
  latitude: number;
  longitude: number;
}

export default function KaveeshaNearbySheltersScreen({
  token,
  onBack,
}: NearbySheltersScreenProps) {
  const insets = useSafeAreaInsets();

  const [fix, setFix] = useState<Fix | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [districtInput, setDistrictInput] = useState("");

  const [shelters, setShelters] = useState<NearbyShelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // Ask for a GPS fix once, quietly. If the citizen declines or the signal is
  // gone, the district search below still gives them a real answer.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (cancelled) return;

        if (permission.status !== "granted") {
          setLocating(false);
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (cancelled) return;

        setFix({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch {
        if (!cancelled) {
          setError("We couldn't get your location. Search a district below.");
        }
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Read the shelters whenever the point, the district, or a manual refresh moves.
  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    fetchNearbyShelters(token, {
      latitude: fix?.latitude,
      longitude: fix?.longitude,
      district: district ?? undefined,
    })
      .then((rows) => {
        if (cancelled) return;
        setShelters(rows);
        setError(null);
      })
      .catch((cause: ShelterApiError) => {
        if (cancelled) return;
        setShelters([]);
        setError(cause.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, fix, district, reload]);

  const refresh = () => setReload((key) => key + 1);

  const searchDistrict = () => {
    const value = districtInput.trim();

    if (value === "") return;

    setError(null);
    setDistrict(value);
  };

  // The nearest shelter that can still take people is the one worth pointing at.
  const recommendedId = useMemo(() => {
    const open = shelters.find((s) => s.status !== "FULL");

    return open?.id ?? null;
  }, [shelters]);

  const statusLine = fix
    ? "Nearest first, from your location"
    : district
      ? `Shelters in ${district}`
      : locating
        ? "Finding your location…"
        : "Turn on location, or search a district";

  const openDirections = async (shelter: NearbyShelter) => {
    await Linking.openURL(mapsDirectionsUrl(shelter));
  };

  return (
    <View className="flex-1 bg-safeplus-background">
      {/* Header */}
      <View
        className="flex-row items-center gap-3 px-3 bg-safeplus-white border-b border-safeplus-border"
        style={{ paddingTop: insets.top + 8, paddingBottom: 10 }}
      >
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-10 h-10 rounded-full bg-safeplus-background items-center justify-center active:opacity-80"
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[17px] font-extrabold text-safeplus-navy">
            Nearby shelters
          </Text>
          <Text className="text-[12px] font-semibold text-safeplus-muted">
            {statusLine}
          </Text>
        </View>
        <Pressable
          onPress={refresh}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          className="w-10 h-10 rounded-full bg-safeplus-background items-center justify-center active:opacity-80"
        >
          <Ionicons name="refresh" size={20} color={loading ? "#98A2B3" : "#1570EF"} />
        </Pressable>
      </View>

      {/* Manual district search — the GPS-lost alternate, always available */}
      <View className="flex-row items-center gap-2 px-4 py-3 bg-safeplus-white border-b border-safeplus-border">
        <View className="flex-1 flex-row items-center rounded-2xl bg-safeplus-background border border-safeplus-border px-3">
          <Ionicons name="search" size={16} color="#98A2B3" style={{ marginRight: 8 }} />
          <TextInput
            value={districtInput}
            onChangeText={setDistrictInput}
            onSubmitEditing={searchDistrict}
            placeholder="Search by district"
            placeholderTextColor="#98A2B3"
            className="flex-1 py-2.5 text-[14px] text-safeplus-text"
          />
        </View>
        <Pressable
          onPress={searchDistrict}
          accessibilityRole="button"
          className="h-11 px-4 rounded-2xl bg-safeplus-navy items-center justify-center active:opacity-90"
        >
          <Text className="text-[13px] font-extrabold text-white">Search</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }}
      >
        {error && (
          <View className="mb-3 flex-row items-start gap-2 px-3.5 py-3 rounded-2xl bg-safeplus-lightRed border border-safeplus-red/20">
            <Ionicons name="alert-circle" size={17} color="#B42318" style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[12.5px] font-semibold text-safeplus-red">
              {error}
            </Text>
          </View>
        )}

        {loading ? (
          <View className="flex-row items-center justify-center gap-2 py-10">
            <ActivityIndicator size="small" color="#1570EF" />
            <Text className="text-[13px] font-semibold text-safeplus-muted">
              Loading shelters…
            </Text>
          </View>
        ) : shelters.length === 0 ? (
          <EmptyState hasDistrict={Boolean(district) || Boolean(fix)} />
        ) : (
          <View className="gap-3">
            {shelters.map((shelter) => (
              <ShelterCard
                key={shelter.id}
                shelter={shelter}
                recommended={shelter.id === recommendedId}
                onDirections={() => void openDirections(shelter)}
              />
            ))}
            <Text className="text-[11.5px] text-safeplus-muted text-center mt-2 leading-[16px]">
              Room changes as people are confirmed in. Pull refresh for the latest.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces.
 * ------------------------------------------------------------------ */

function ShelterCard({
  shelter,
  recommended,
  onDirections,
}: {
  shelter: NearbyShelter;
  recommended: boolean;
  onDirections: () => void;
}) {
  const meta = BAND_META[shelter.status];
  const pct = occupancyPct(shelter);
  const full = shelter.status === "FULL";

  return (
    <View
      className={
        "rounded-3xl bg-safeplus-white p-4 border " +
        (recommended ? "border-safeplus-blue" : "border-safeplus-border")
      }
    >
      {recommended && (
        <View className="self-start px-2.5 py-1 rounded-full bg-safeplus-lightBlue mb-2">
          <Text className="text-[10.5px] font-extrabold uppercase tracking-wide text-safeplus-blue">
            Nearest with room
          </Text>
        </View>
      )}

      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[16px] font-extrabold text-safeplus-navy leading-6">
            {shelter.name}
          </Text>
          <Text className="text-[12px] font-semibold text-safeplus-muted mt-0.5">
            {shelter.shelterCode} · {shelter.district} District
          </Text>
        </View>
        <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: meta.bg }}>
          <Text className="text-[11px] font-extrabold uppercase" style={{ color: meta.fg }}>
            {meta.label}
          </Text>
        </View>
      </View>

      {Boolean(shelter.address) && (
        <View className="flex-row items-start gap-2 mt-3">
          <Ionicons name="location-outline" size={15} color="#667085" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[13px] text-safeplus-text font-semibold">
            {shelter.address}
          </Text>
        </View>
      )}

      <View className="flex-row items-center gap-1.5 mt-2">
        <Ionicons name="navigate-outline" size={14} color="#667085" />
        <Text className="text-[12.5px] font-bold text-safeplus-muted">
          {formatDistance(shelter.distanceKm)} away
        </Text>
      </View>

      {/* Capacity bar + figures */}
      <View className="mt-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-[11px] font-extrabold uppercase tracking-wide text-safeplus-muted">
            {shelter.confirmedOccupancy} / {shelter.maxCapacity} inside
          </Text>
          <Text className="text-[11px] font-extrabold" style={{ color: full ? meta.fg : "#14532D" }}>
            {full ? "No beds left" : `${shelter.remainingAllocatable} room left`}
          </Text>
        </View>
        <View className="h-2.5 rounded-full bg-safeplus-border overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: meta.bar }}
          />
        </View>
      </View>

      {shelter.facilities.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mt-3">
          {shelter.facilities.slice(0, 4).map((facility) => (
            <View
              key={facility}
              className="px-2.5 py-1 rounded-full bg-safeplus-background border border-safeplus-border"
            >
              <Text className="text-[11px] font-bold text-safeplus-muted">{facility}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={onDirections}
        disabled={full}
        accessibilityRole="button"
        className={
          "mt-4 flex-row items-center justify-center gap-2 h-12 rounded-2xl active:opacity-90 " +
          (full ? "bg-safeplus-border" : "bg-safeplus-blue")
        }
      >
        <Ionicons name="navigate" size={17} color={full ? "#98A2B3" : "#FFFFFF"} />
        <Text
          className="text-[14px] font-extrabold"
          style={{ color: full ? "#98A2B3" : "#FFFFFF" }}
        >
          {full ? "Full — try another" : "Get directions"}
        </Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ hasDistrict }: { hasDistrict: boolean }) {
  return (
    <View className="items-center rounded-3xl bg-safeplus-white border border-safeplus-border px-6 py-10">
      <View className="w-16 h-16 rounded-full bg-safeplus-background items-center justify-center mb-4">
        <Ionicons name="business-outline" size={30} color="#98A2B3" />
      </View>
      <Text className="text-[16px] font-extrabold text-safeplus-navy">
        No shelters to show yet
      </Text>
      <Text className="text-[13px] text-safeplus-muted text-center mt-2 leading-5">
        {hasDistrict
          ? "Nothing is registered for this area right now. Try another district, or check back shortly."
          : "Turn on your location or search a district above to see nearby shelters."}
      </Text>
    </View>
  );
}
