import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import {
  ChoiceField,
  ErrorSummary,
  Field,
  FormScreenShell,
  FormSection,
  Notice,
  RequestError,
  SubmitButton,
} from "../components/dushani-RegistrationUI";
import { AlertApiError, fetchDistrictNames } from "../services/dushani-alertApi";
import {
  fetchMyReportDetail,
  resolveDistrictName,
  resubmitReport,
  submitDetailedReport,
  type EvidenceInput,
  type ExtendedReport,
} from "../services/amasha-reportApi";
import {
  isUnreachable,
  saveOfflineReport,
} from "../services/amasha-offlineReports";
import {
  HAZARD_LABELS,
  SEVERITY_LABELS,
  STEPS,
  draftFromPayload,
  emptyDraft,
  toPayload,
  validateStep,
  type ReportDraft,
  type ReportStep,
} from "../utils/amasha-reportForm";
import type { FieldErrors } from "../utils/dushani-registrationValidation";

const MAX_EVIDENCE = 4;

interface ReportHazardScreenProps {
  token: string;
  userKey: string;
  homeDistrict?: string | null;
  updateReportId?: string | null;
  onBack: () => void;
  onViewReports: () => void;
}

export default function ReportHazardScreen({
  token,
  userKey,
  homeDistrict,
  updateReportId,
  onBack,
  onViewReports,
}: ReportHazardScreenProps) {
  const isUpdate = Boolean(updateReportId);
  const [step, setStep] = useState<ReportStep>(0);
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft(homeDistrict));
  const [existing, setExisting] = useState<ExtendedReport | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(isUpdate);
  const [outcome, setOutcome] = useState<"sent" | "offline" | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    fetchDistrictNames()
      .then((names) => {
        setDistricts(names);
        setDistrictsError(null);
      })
      .catch((error) =>
        setDistrictsError(
          error instanceof AlertApiError ? error.message : "Districts could not load."
        )
      );
  }, []);

  useEffect(() => {
    if (!updateReportId) {
      return;
    }

    fetchMyReportDetail(token, updateReportId)
      .then((report) => {
        setExisting(report);
        setDraft(draftFromPayload(report));
        if (report.locationLat !== undefined) {
          setManualLat(String(report.locationLat));
        }
        if (report.locationLng !== undefined) {
          setManualLng(String(report.locationLng));
        }
        setLoadingUpdate(false);
      })
      .catch((error) => {
        setRequestError(
          error instanceof AlertApiError
            ? error.message
            : "This report could not be opened for updating."
        );
        setLoadingUpdate(false);
      });
  }, [token, updateReportId]);

  function patch(update: Partial<ReportDraft>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function goNext() {
    const nextErrors = validateStep(step, draft);
    setErrors(nextErrors);
    setRequestError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setStep((current) => Math.min(4, current + 1) as ReportStep);
  }

  function goBackStep() {
    setErrors({});
    setRequestError(null);
    setStep((current) => Math.max(0, current - 1) as ReportStep);
  }

  async function captureGps() {
    setLocating(true);
    setLocateError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setLocateError(
          "Location permission was declined. Enable it, retry, or enter coordinates."
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      patch({ latitude, longitude });
      setManualLat(latitude.toFixed(5));
      setManualLng(longitude.toFixed(5));

      const district = await resolveDistrictName(latitude, longitude);

      if (district) {
        patch({ latitude, longitude, district });
      }
    } catch {
      setLocateError(
        "GPS could not be captured. Retry, or enter the coordinates you have."
      );
    } finally {
      setLocating(false);
    }
  }

  function applyManualLocation(latText: string, lngText: string) {
    setManualLat(latText);
    setManualLng(lngText);

    const latitude = Number(latText);
    const longitude = Number(lngText);

    if (
      latText.trim() &&
      lngText.trim() &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      patch({ latitude, longitude });
      setErrors((current) => {
        const next = { ...current };
        delete next.locationLat;
        delete next.locationLng;
        return next;
      });
    } else {
      patch({ latitude: undefined, longitude: undefined });
    }
  }

  async function addEvidence(fromCamera: boolean) {
    setPicking(true);
    setEvidenceError(null);

    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        setEvidenceError(
          fromCamera
            ? "Camera permission was declined. You can pick a file or continue without evidence."
            : "Photo library permission was declined. You can continue without evidence."
        );
        return;
      }

      const picker = fromCamera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;
      const result = await picker({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.45,
        base64: true,
        videoMaxDuration: 12,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const converted = toEvidence(result.assets[0]);

      if (!converted) {
        setEvidenceError(
          "That file could not be attached. Retry, remove it, or continue without evidence."
        );
        return;
      }

      if (converted.dataUrl.length > 11_000_000) {
        setEvidenceError(
          "That file is too large. Retry with a shorter clip or a smaller photo, or continue without it."
        );
        return;
      }

      if (draft.attachments.length >= MAX_EVIDENCE) {
        setEvidenceError(`You can attach at most ${MAX_EVIDENCE} files.`);
        return;
      }

      patch({ attachments: [...draft.attachments, converted] });
    } catch {
      setEvidenceError(
        "Evidence upload failed. Retry, remove the file, or continue without it."
      );
    } finally {
      setPicking(false);
    }
  }

  function removeEvidence(index: number) {
    patch({
      attachments: draft.attachments.filter((_, current) => current !== index),
    });
    setEvidenceError(null);
  }

  async function handleSubmit() {
    const built = toPayload(draft);
    setErrors("errors" in built ? built.errors : {});
    setRequestError(null);

    if ("errors" in built) {
      const firstInvalid: ReportStep = built.errors.hazardType || built.errors.severityLevel
        ? 0
        : built.errors.description || built.errors.observedAt
          ? 1
          : 3;
      setStep(firstInvalid);
      return;
    }

    setSaving(true);

    try {
      const report = isUpdate && updateReportId
        ? await resubmitReport(token, updateReportId, built.payload)
        : await submitDetailedReport(token, built.payload);

      setReference(report.reportId);
      setOutcome("sent");
    } catch (error) {
      if (isUnreachable(error) && !isUpdate) {
        const saved = await saveOfflineReport(userKey, built.payload);
        setReference(saved.id);
        setOutcome("offline");
        return;
      }

      if (error instanceof AlertApiError) {
        setRequestError(error.message);
        setErrors(error.fieldErrors);
        if (error.fieldErrors.hazardType || error.fieldErrors.severityLevel) {
          setStep(0);
        } else if (error.fieldErrors.description || error.fieldErrors.observedAt) {
          setStep(1);
        } else if (error.fieldErrors.locationDistrict || error.fieldErrors.locationLat) {
          setStep(3);
        }
      } else {
        setRequestError("The report could not be sent. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loadingUpdate) {
    return (
      <FormScreenShell
        title="Update report"
        subtitle="Loading what the officer asked you to add."
        onBack={onBack}
      >
        <FormSection>
          <ActivityIndicator color="#1570EF" />
        </FormSection>
      </FormScreenShell>
    );
  }

  if (outcome) {
    return (
      <FormScreenShell
        title={outcome === "offline" ? "Saved on this phone" : "Report sent"}
        subtitle={
          outcome === "offline"
            ? "No network. The report is stored as Pending Synchronization."
            : "A DMC officer is notified and will verify it before any alert is issued."
        }
        badge={reference ?? undefined}
        onBack={onBack}
      >
        <FormSection>
          <Notice
            tone={outcome === "offline" ? "pending" : "info"}
            title={
              outcome === "offline"
                ? "Pending synchronization"
                : isUpdate
                  ? "Back in the verification queue"
                  : "Awaiting verification"
            }
            body={
              outcome === "offline"
                ? "When you are online again, open My reports and we will send this to SafePlus automatically."
                : "You will see the officer's decision, including any request for more information, on your reports page."
            }
          />
          <View className="mt-5">
            <Pressable
              onPress={onViewReports}
              accessibilityRole="button"
              className="flex-row items-center justify-center h-14 rounded-xl bg-safeplus-navy active:opacity-85"
            >
              <Text className="text-base font-extrabold text-white">See my reports</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" className="ml-2.5" />
            </Pressable>
          </View>
        </FormSection>
      </FormScreenShell>
    );
  }

  return (
    <FormScreenShell
      title={isUpdate ? "Update incident report" : "Report incident"}
      subtitle={
        isUpdate
          ? existing?.infoRequestReason
            ? `Officer asked: ${existing.infoRequestReason}`
            : "Add the missing information and send it back for verification."
          : "Tell the disaster management centre what you can see on the ground."
      }
      badge={`${step + 1} / ${STEPS.length}`}
      onBack={onBack}
      headerExtra={<StepStrip step={step} />}
    >
      <ErrorSummary count={Object.keys(errors).length} />
      <RequestError message={requestError} />
      {districtsError && <RequestError message={districtsError} />}

      {step === 0 && (
        <FormSection title="Incident type" icon="alert-circle-outline">
          <ChoiceField
            label="What is happening"
            value={draft.hazardLabel}
            options={HAZARD_LABELS}
            error={errors.hazardType}
            onChange={(value) => patch({ hazardLabel: value })}
          />
          <View className="mt-5">
            <ChoiceField
              label="Severity / urgency"
              value={draft.severityLabel}
              options={SEVERITY_LABELS}
              error={errors.severityLevel}
              hint="Critical means people need to move now"
              onChange={(value) => patch({ severityLabel: value })}
            />
          </View>
        </FormSection>
      )}

      {step === 1 && (
        <FormSection title="Incident details" icon="chatbox-outline">
          <Field
            label="Description"
            value={draft.description}
            multiline
            autoCapitalize="sentences"
            placeholder="What you see, who is affected, and any visible danger."
            error={errors.description}
            onChange={(value) => patch({ description: value })}
          />
          <View className="mt-5">
            <Field
              label="Date observed"
              value={draft.observedDate}
              placeholder="YYYY-MM-DD"
              error={errors.observedAt}
              onChange={(value) => patch({ observedDate: value })}
            />
          </View>
          <View className="mt-5">
            <Field
              label="Time observed"
              value={draft.observedTime}
              placeholder="HH:MM"
              onChange={(value) => patch({ observedTime: value })}
            />
          </View>
          <View className="mt-5">
            <Field
              label="Affected area / landmark"
              optional
              value={draft.landmark}
              placeholder="Road, village, building, or nearby landmark"
              autoCapitalize="words"
              onChange={(value) => patch({ landmark: value })}
            />
          </View>
          <View className="mt-5">
            <Field
              label="Estimated people affected"
              optional
              value={draft.population}
              placeholder="250"
              keyboardType="number-pad"
              error={errors.affectedPopulation}
              onChange={(value) => patch({ population: value })}
            />
          </View>
          <Pressable
            onPress={() => patch({ immediateDanger: !draft.immediateDanger })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: draft.immediateDanger }}
            className={`flex-row items-center mt-5 px-4 h-14 rounded-xl border ${
              draft.immediateDanger
                ? "bg-safeplus-lightRed border-safeplus-red"
                : "bg-safeplus-fieldBg border-safeplus-hairline"
            }`}
          >
            <Ionicons
              name={draft.immediateDanger ? "warning" : "warning-outline"}
              size={18}
              color={draft.immediateDanger ? "#D92D20" : "#1570EF"}
              className="mr-3"
            />
            <Text className="flex-1 text-sm font-bold text-safeplus-navy">
              Immediate danger to people or property
            </Text>
          </Pressable>
        </FormSection>
      )}

      {step === 2 && (
        <FormSection
          title="Photo / video evidence"
          caption="Optional. You can continue without it."
          icon="camera-outline"
        >
          {existing && existing.attachments.length > 0 && (
            <Text className="mb-3 text-xs text-safeplus-slate">
              {existing.attachments.length} file(s) already on this report. New files are added
              alongside them.
            </Text>
          )}

          <View className="flex-row flex-wrap gap-3 mb-4">
            {draft.attachments.map((file, index) => (
              <View key={`${file.fileKind}-${index}`} className="w-24">
                {file.fileKind === "PHOTO" ? (
                  <Image
                    source={{ uri: file.dataUrl }}
                    className="w-24 h-24 rounded-xl bg-safeplus-fieldBg"
                  />
                ) : (
                  <View className="items-center justify-center w-24 h-24 rounded-xl bg-safeplus-navy">
                    <Ionicons name="videocam" size={22} color="#FFFFFF" />
                    <Text className="mt-1 text-[10px] font-bold text-white">Video</Text>
                  </View>
                )}
                <Pressable onPress={() => removeEvidence(index)} className="mt-1">
                  <Text className="text-[11px] font-bold text-safeplus-red">Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => void addEvidence(true)}
              disabled={picking}
              className="flex-1 items-center justify-center h-12 rounded-xl border border-safeplus-hairline bg-safeplus-fieldBg"
            >
              <Text className="text-sm font-bold text-safeplus-navy">
                {picking ? "Opening…" : "Camera"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void addEvidence(false)}
              disabled={picking}
              className="flex-1 items-center justify-center h-12 rounded-xl border border-safeplus-hairline bg-safeplus-fieldBg"
            >
              <Text className="text-sm font-bold text-safeplus-navy">Upload</Text>
            </Pressable>
          </View>

          {evidenceError && (
            <Text className="mt-3 text-xs font-semibold text-safeplus-red">{evidenceError}</Text>
          )}

          <View className="mt-4">
            <Notice
              tone="info"
              title="Evidence is optional"
              body="If you cannot capture a photo or video, continue. Officers can still verify from the description, location and a call-back."
            />
          </View>
        </FormSection>
      )}

      {step === 3 && (
        <FormSection
          title="Location"
          caption="GPS is preferred. If it fails, enter the coordinates you have."
          icon="location-outline"
        >
          {districts.length > 0 ? (
            <ChoiceField
              label="District"
              value={draft.district}
              options={districts}
              error={errors.locationDistrict}
              onChange={(value) => patch({ district: value })}
            />
          ) : (
            <ActivityIndicator color="#1570EF" />
          )}

          <Pressable
            onPress={() => void captureGps()}
            disabled={locating}
            className="flex-row items-center self-start px-4 h-12 mt-5 rounded-xl border border-safeplus-hairline bg-safeplus-fieldBg"
          >
            <Ionicons name="navigate-outline" size={18} color="#1570EF" className="mr-2" />
            <Text className="text-sm font-bold text-safeplus-navy">
              {locating
                ? "Capturing GPS…"
                : draft.latitude !== undefined
                  ? "Recapture GPS"
                  : "Capture GPS"}
            </Text>
          </Pressable>

          {draft.latitude !== undefined && draft.longitude !== undefined && (
            <Text className="mt-2 text-xs text-safeplus-slate">
              {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}
            </Text>
          )}

          {locateError && (
            <Text className="mt-2 text-xs font-semibold text-safeplus-red">{locateError}</Text>
          )}

          <View className="mt-5">
            <Field
              label="Latitude"
              value={manualLat}
              placeholder="6.9271"
              keyboardType="decimal-pad"
              error={errors.locationLat}
              onChange={(value) => applyManualLocation(value, manualLng)}
            />
          </View>
          <View className="mt-5">
            <Field
              label="Longitude"
              value={manualLng}
              placeholder="79.8612"
              keyboardType="decimal-pad"
              error={errors.locationLng}
              onChange={(value) => applyManualLocation(manualLat, value)}
            />
          </View>
        </FormSection>
      )}

      {step === 4 && (
        <FormSection title="Preview" icon="eye-outline">
          <PreviewRow label="Incident type" value={draft.hazardLabel} />
          <PreviewRow label="Severity" value={draft.severityLabel} />
          <PreviewRow
            label="Observed"
            value={`${draft.observedDate} ${draft.observedTime}`}
          />
          <PreviewRow label="District" value={draft.district} />
          <PreviewRow
            label="GPS"
            value={
              draft.latitude !== undefined && draft.longitude !== undefined
                ? `${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}`
                : "Not attached"
            }
          />
          <PreviewRow label="Landmark" value={draft.landmark || "—"} />
          <PreviewRow
            label="People affected"
            value={draft.population || "—"}
          />
          <PreviewRow
            label="Immediate danger"
            value={draft.immediateDanger ? "Yes" : "No"}
          />
          <PreviewRow
            label="Evidence"
            value={
              draft.attachments.length === 0
                ? "None (optional)"
                : `${draft.attachments.length} file(s)`
            }
          />
          <Text className="mt-4 text-sm leading-6 text-safeplus-navy">{draft.description}</Text>
        </FormSection>
      )}

      <View className="flex-row gap-3">
        {step > 0 && (
          <Pressable
            onPress={goBackStep}
            className="flex-1 items-center justify-center h-14 rounded-xl border border-safeplus-hairline bg-white"
          >
            <Text className="text-base font-extrabold text-safeplus-navy">Back</Text>
          </Pressable>
        )}
        <View className="flex-[2]">
          {step < 4 ? (
            <SubmitButton onPress={goNext} label={`Continue · ${STEPS[step + 1]}`} />
          ) : (
            <SubmitButton
              onPress={() => void handleSubmit()}
              disabled={saving}
              label={saving ? "Submitting…" : isUpdate ? "Resubmit report" : "Submit report"}
            />
          )}
        </View>
      </View>
    </FormScreenShell>
  );
}

function StepStrip({ step }: { step: ReportStep }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {STEPS.map((label, index) => (
        <View
          key={label}
          className={`px-3 py-1.5 rounded-full border ${
            index === step
              ? "bg-white border-white"
              : index < step
                ? "bg-safeplus-navySoft border-safeplus-navyLine"
                : "bg-transparent border-safeplus-navyLine"
          }`}
        >
          <Text
            className={`text-[10px] font-extrabold uppercase ${
              index === step ? "text-safeplus-navy" : "text-safeplus-navyText"
            }`}
          >
            {index + 1}. {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-safeplus-hairline">
      <Text className="text-xs font-bold uppercase text-safeplus-slate">{label}</Text>
      <Text className="ml-4 flex-1 text-right text-sm font-semibold text-safeplus-navy">
        {value}
      </Text>
    </View>
  );
}

function toEvidence(asset: ImagePicker.ImagePickerAsset): EvidenceInput | null {
  if (!asset.base64) {
    return null;
  }

  const mime =
    asset.mimeType ??
    (asset.type === "video" ? "video/mp4" : "image/jpeg");
  const isVideo = asset.type === "video" || mime.startsWith("video");

  return {
    dataUrl: `data:${mime};base64,${asset.base64}`,
    fileKind: isVideo ? "VIDEO" : "PHOTO",
    contentType: mime,
  };
}
