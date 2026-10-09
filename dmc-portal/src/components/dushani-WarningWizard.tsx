import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle,
  ChevronLeft,
  ClipboardList,
  CircleDot,
  Clock,
  Loader2,
  Map as MapIcon,
  Megaphone,
  MessageSquare,
  Save,
  ShieldCheck,
  Siren,
  Smartphone,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type { HazardReport, SeverityLevel } from "../types/hazardReport";
import type {
  AudiencePreview,
  ChannelSelection,
  Coordinate,
  DisasterWarning,
  DistrictBoundary,
} from "../types/warning";
import {
  EXPIRY_EXTENSION_HOURS,
  WARNING_LIFETIME_HOURS,
} from "../types/warning";
import {
  AlertApiError,
  broadcastWarning,
  createDraft,
  extendWarningExpiry,
  fetchDistricts,
  fetchDistrictRings,
  fetchVerifiedReports,
  previewAudience,
  standDownWarning,
  synthesizeMessages,
  updateDraft,
  pinProblem,
} from "../services/dushani-alertApi";
import TargetMap from "./dushani-TargetMap";
import PinChallengeModal from "./dushani-PinChallengeModal";
import {
  DATA_STYLES,
  channelLabel,
  deliveryLabel,
  isDeliveryError,
  severityPill,
  skippedCopy,
  statusPill,
} from "../styles/dushani-dataStyles";

interface WarningWizardProps {
  initialReportId?: string;
  onExit: () => void;
  onSetupPin: () => void;
  onViewHistory: () => void;
}

const HAZARD_TYPES = [
  "FLOOD",
  "LANDSLIDE",
  "TSUNAMI",
  "CYCLONE",
  "HEAVY_RAIN",
  "STRONG_WIND",
  "LIGHTNING",
  "DROUGHT",
  "WILDFIRE",
  "COASTAL_EROSION",
  "EPIDEMIC",
  "INDUSTRIAL_ACCIDENT",
  "OTHER",
];

const SEVERITY_OPTIONS: SeverityLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const DEFAULT_LIFETIME_HOURS = 24;

const STEPS = ["Report", "Target area", "Message", "Authorize", "Delivery"];

function preferredDistrict(items: DistrictBoundary[]): string {
  return items.some((item) => item.district === "Colombo")
    ? "Colombo"
    : (items[0]?.district ?? "");
}

const AUDIENCE_DEBOUNCE_MS = 450;

// Mirrors backend/validators/dushani-alertValidators.ts so an officer sees the
// reason before the request is refused with a 400.
const SINHALA_SCRIPT = /[\u0d80-\u0dff]/;
const TAMIL_SCRIPT = /[\u0b80-\u0bff]/;

export default function WarningWizard({
  initialReportId,
  onExit,
  onSetupPin,
  onViewHistory,
}: WarningWizardProps) {
  const [step, setStep] = useState(1);

  // Step 1 — the verified report a warning must be raised on.
  const [verifiedReports, setVerifiedReports] = useState<HazardReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportId, setReportId] = useState(initialReportId ?? "");

  // Step 2 — target area.
  const [districts, setDistricts] = useState<DistrictBoundary[]>([]);
  const [targetDistrict, setTargetDistrict] = useState("");
  const [mode, setMode] = useState<"district" | "custom">("district");
  const [rings, setRings] = useState<Coordinate[][]>([]);
  const [polygon, setPolygon] = useState<Coordinate[]>([]);
  const [audience, setAudience] = useState<AudiencePreview | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // Step 3 — payload.
  const [hazardType, setHazardType] = useState("FLOOD");
  const [severityLevel, setSeverityLevel] = useState<SeverityLevel>("HIGH");
  const [safetyInstructions, setSafetyInstructions] = useState("");
  const [englishMessage, setEnglishMessage] = useState("");
  const [sinhalaMessage, setSinhalaMessage] = useState("");
  const [tamilMessage, setTamilMessage] = useState("");
  const [channels, setChannels] = useState<ChannelSelection>({
    push: true,
    sms: true,
    siren: false,
  });
  const [expiresInHours, setExpiresInHours] = useState(DEFAULT_LIFETIME_HOURS);
  const [generating, setGenerating] = useState(false);

  // Step 4/5 — authorization and telemetry.
  const [warning, setWarning] = useState<DisasterWarning | null>(null);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<string[]>(["", "", "", "", "", ""]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcast, setBroadcast] = useState<DisasterWarning | null>(null);
  const [standDownBusy, setStandDownBusy] = useState(false);
  const [extendHours, setExtendHours] = useState(EXPIRY_EXTENSION_HOURS[1]);
  const [extendBusy, setExtendBusy] = useState(false);
  const [liveAction, setLiveAction] = useState<"none" | "extend" | "stand-down">(
    "none"
  );
  const [liveError, setLiveError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const pinInputs = useRef<(HTMLInputElement | null)[]>([]);
  const districtTouched = useRef(false);

  const selectedReport = useMemo(
    () => verifiedReports.find((report) => report.id === reportId) ?? null,
    [reportId, verifiedReports]
  );

  useEffect(() => {
    fetchVerifiedReports()
      .then((reports) => {
        setVerifiedReports(reports);
        setReportsLoading(false);

        const wanted = reports.find(
          (report) => report.id === initialReportId
        );

        if (!wanted) {
          return;
        }

        if ((wanted.warningCount ?? 0) > 0) {
          setError(
            `${wanted.reportId} already carries a warning. One report raises one warning - reopen it from Alert history.`
          );
          return;
        }

        // Deep-linked from the queue: this report owns the target district.
        districtTouched.current = true;
        setReportId(wanted.id);
        setHazardType(
          HAZARD_TYPES.includes(wanted.hazardType) ? wanted.hazardType : "OTHER"
        );
        setSeverityLevel(wanted.severityLevel);
        setTargetDistrict(wanted.locationDistrict);
        setPolygon([]);
      })
      .catch((loadError) => {
        setReportsLoading(false);
        setError(messageOf(loadError));
      });
  }, [initialReportId]);

  useEffect(() => {
    fetchDistricts()
      .then((items) => {
        setDistricts(items);

        if (!districtTouched.current && items.length > 0) {
          setTargetDistrict(preferredDistrict(items));
        }
      })
      .catch(() => setDistricts([]));
  }, []);

  // The outline drawn on the map is the same asset the dropdown lists and the
  // server validates against, so the two can never disagree.
  useEffect(() => {
    if (!targetDistrict) {
      return;
    }

    let cancelled = false;

    fetchDistrictRings(targetDistrict)
      .then((loaded) => {
        if (!cancelled) {
          setRings(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRings([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [targetDistrict]);

  function selectDistrict(name: string) {
    districtTouched.current = true;
    setTargetDistrict(name);
    setPolygon([]);
  }

  function applyReportDefaults(report: HazardReport) {
    setHazardType(
      HAZARD_TYPES.includes(report.hazardType) ? report.hazardType : "OTHER"
    );
    setSeverityLevel(report.severityLevel);
    selectDistrict(report.locationDistrict);
  }

  useEffect(() => {
    if (step !== 2 || !targetDistrict) {
      return;
    }

    const timer = setTimeout(() => {
      if (mode === "custom" && polygon.length > 0 && polygon.length < 3) {
        setAudience(null);
        return;
      }

      setAudienceLoading(true);

      previewAudience(
        targetDistrict,
        mode === "custom" && polygon.length >= 3 ? closedBoundary(polygon) : undefined
      )
        .then((result) => {
          setAudience(result);
          setError(null);
        })
        .catch((previewError) => {
          setAudience(null);

          if (previewError instanceof AlertApiError) {
            setError(previewError.message);
            setFieldErrors(previewError.fieldErrors);
          } else {
            setError(messageOf(previewError));
          }
        })
        .finally(() => setAudienceLoading(false));
    }, AUDIENCE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [mode, polygon, step, targetDistrict]);

  const payload = useMemo(
    () => ({
      // The API resolves reports by their human readable RPT-... id.
      reportId: selectedReport?.reportId ?? reportId,
      hazardType,
      severityLevel,
      targetDistrict,
      ...(mode === "custom" && polygon.length >= 3
        ? { customBoundary: closedBoundary(polygon) }
        : {}),
      ...(safetyInstructions ? { safetyInstructions } : {}),
      englishMessage,
      sinhalaMessage,
      tamilMessage,
      channels,
      expiresInHours,
    }),
    [
      channels,
      englishMessage,
      expiresInHours,
      hazardType,
      mode,
      polygon,
      reportId,
      safetyInstructions,
      selectedReport,
      severityLevel,
      sinhalaMessage,
      targetDistrict,
      tamilMessage,
    ]
  );

  const draftIssues = useMemo(() => {
    const issues: Record<string, string> = {};
    const english = englishMessage.trim();
    const sinhala = sinhalaMessage.trim();
    const tamil = tamilMessage.trim();
    const safety = safetyInstructions.trim();

    if (!selectedReport) {
      issues.reportId = "Pick the verified report in step 1.";
    } else if ((selectedReport.warningCount ?? 0) > 0) {
      issues.reportId =
        "This report already carries a warning. One report raises one warning only.";
    }

    if (!targetDistrict) {
      issues.targetDistrict = "Pick the district to alert.";
    }

    if (english.length < 20) {
      issues.englishMessage = "English message needs at least 20 characters.";
    }

    if (sinhala.length < 15) {
      issues.sinhalaMessage = "Sinhala message needs at least 15 characters.";
    } else if (!SINHALA_SCRIPT.test(sinhala)) {
      issues.sinhalaMessage = "Write the Sinhala message in Sinhala script.";
    }

    if (tamil.length < 15) {
      issues.tamilMessage = "Tamil message needs at least 15 characters.";
    } else if (!TAMIL_SCRIPT.test(tamil)) {
      issues.tamilMessage = "Write the Tamil message in Tamil script.";
    }

    if (safety && safety.length < 10) {
      issues.safetyInstructions =
        "Either leave this empty or write at least 10 characters.";
    }

    if (!channels.push && !channels.sms && !channels.siren) {
      issues.channels = "Choose at least one channel to reach people.";
    }

    return issues;
  }, [
    channels,
    englishMessage,
    safetyInstructions,
    selectedReport,
    sinhalaMessage,
    tamilMessage,
    targetDistrict,
  ]);

  const canContinue = () => {
    if (step === 1) return Boolean(selectedReport);

    if (step === 2) {
      return (
        Boolean(targetDistrict) &&
        (mode === "district" || polygon.length >= 3) &&
        Boolean(audience?.canBroadcast)
      );
    }

    if (step === 3) {
      return Object.keys(draftIssues).length === 0;
    }

    return true;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const messages = await synthesizeMessages({
        hazardType,
        severityLevel,
        targetDistrict,
        safetyInstructions: safetyInstructions || undefined,
      });

      setEnglishMessage(messages.english);
      setSinhalaMessage(messages.sinhala);
      setTamilMessage(messages.tamil);
    } catch (generateError) {
      setError(messageOf(generateError));
    } finally {
      setGenerating(false);
    }
  };

  const persistDraft = async (): Promise<DisasterWarning | null> => {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const saved = warning
        ? await updateDraft(warning.warningId, payload)
        : await createDraft(payload);

      setWarning(saved);
      return saved;
    } catch (saveError) {
      if (saveError instanceof AlertApiError) {
        setError(saveError.message);
        setFieldErrors(saveError.fieldErrors);

        // E2: an invalid geometry sends the officer back to the map step.
        if (saveError.fieldErrors.customBoundary || saveError.status === 422) {
          setStep(2);
        }
      } else {
        setError(messageOf(saveError));
      }

      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleBroadcast = async () => {
    const draft = warning ?? (await persistDraft());

    if (!draft) {
      return;
    }

    setBroadcasting(true);
    setError(null);
    setFieldErrors({});

    try {
      const result = await broadcastWarning(draft.warningId, pin.join(""));

      setBroadcast(result);
      setWarning(result);
      setStep(5);
    } catch (broadcastError) {
      if (broadcastError instanceof AlertApiError) {
        handleBroadcastFailure(broadcastError);
      } else {
        setError(messageOf(broadcastError));
      }
    } finally {
      setBroadcasting(false);
    }
  };

  const handleBroadcastFailure = (failure: AlertApiError) => {
    setPin(["", "", "", "", "", ""]);
    pinInputs.current[0]?.focus();

    if (failure.status === 428) {
      setError(
        "You have no clearance PIN yet, so the broadcast was refused. Set one and come back."
      );
      return;
    }

    if (failure.status === 401) {
      setError(
        "Incorrect clearance PIN. The broadcast was halted and the attempt was recorded in the audit log."
      );
      return;
    }

    if (failure.status === 422) {
      setError(failure.message);
      setStep(2);
      return;
    }

    setError(failure.message);
  };

  /** A live-warning action needs the clearance PIN, so it runs from the dialog. */
  const handleStandDown = async (securityPin: string) => {
    if (!broadcast) {
      return;
    }

    setStandDownBusy(true);
    setError(null);

    try {
      setBroadcast(await standDownWarning(broadcast.warningId, securityPin));
      setLiveAction("none");
    } catch (standDownError) {
      setLiveError(pinProblem(standDownError));
    } finally {
      setStandDownBusy(false);
    }
  };

  const handleExtendExpiry = async (securityPin: string) => {
    if (!broadcast) {
      return;
    }

    setExtendBusy(true);
    setError(null);

    try {
      const extended = await extendWarningExpiry(
        broadcast.warningId,
        extendHours,
        securityPin
      );

      setBroadcast(extended);
      setWarning(extended);
      setLiveAction("none");
    } catch (extendError) {
      setLiveError(pinProblem(extendError));
    } finally {
      setExtendBusy(false);
    }
  };

  const goNext = async () => {
    setError(null);
    setFieldErrors({});

    if (step === 3) {
      const saved = await persistDraft();

      if (!saved) {
        return;
      }

      setStep(4);
      setTimeout(() => pinInputs.current[0]?.focus(), 50);
      return;
    }

    setStep((current) => Math.min(5, current + 1));
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <StepReport
            reports={verifiedReports}
            loading={reportsLoading}
            selectedId={reportId}
            onSelect={(report) => {
              setReportId(report.id);
              applyReportDefaults(report);
              setMode("district");
              setPolygon([]);
            }}
            onExit={onExit}
          />
        );

      case 2:
        return (
          <StepTarget
            districts={districts}
            targetDistrict={targetDistrict}
            onDistrictChange={selectDistrict}
            mode={mode}
            onModeChange={(next) => {
              setMode(next);
              setPolygon([]);
            }}
            rings={rings}
            polygon={polygon}
            onPolygonChange={setPolygon}
            audience={audience}
            audienceLoading={audienceLoading}
          />
        );

      case 3:
        return (
          <StepMessage
            hazardType={hazardType}
            severityLevel={severityLevel}
            safetyInstructions={safetyInstructions}
            englishMessage={englishMessage}
            sinhalaMessage={sinhalaMessage}
            tamilMessage={tamilMessage}
            channels={channels}
            expiresInHours={expiresInHours}
            generating={generating}
            saving={saving}
            hasDraft={Boolean(warning)}
            draftReady={canContinue()}
            fieldErrors={{ ...draftIssues, ...fieldErrors }}
            onHazardTypeChange={setHazardType}
            onSeverityChange={(value) => {
              setSeverityLevel(value);

              // A1: a critical warning always drives sirens.
              if (value === "CRITICAL") {
                setChannels((current) => ({ ...current, siren: true }));
              }
            }}
            onSafetyChange={setSafetyInstructions}
            onEnglishChange={setEnglishMessage}
            onSinhalaChange={setSinhalaMessage}
            onTamilChange={setTamilMessage}
            onChannelsChange={setChannels}
            onExpiryChange={setExpiresInHours}
            onGenerate={() => void handleGenerate()}
            onSaveDraft={() => void persistDraft()}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="wz">
      <ol className="wz-steps">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const state =
            number < step ? "wz-step-done" : number === step ? "wz-step-active" : "";

          return (
            <li key={label} className={`wz-step ${state}`}>
              <span className="wz-step-dot">
                {number < step ? <CheckCircle size={14} /> : number}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="wz-banner wz-banner-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {step === 4 ? (
        <StepAuthorize
          report={selectedReport}
          warning={warning}
          audience={audience}
          channels={channels}
          severityLevel={severityLevel}
          pin={pin}
          broadcasting={broadcasting}
          pinInputs={pinInputs}
          onPinChange={(index, value) => {
            const next = [...pin];

            next[index] = value.replace(/\D/g, "").slice(-1);
            setPin(next);

            if (next[index] && index < 5) {
              pinInputs.current[index + 1]?.focus();
            }
          }}
          onPaste={(digits) => {
            const next = [0, 1, 2, 3, 4, 5].map((i) => digits[i] ?? "");

            setPin(next);
            pinInputs.current[Math.min(5, digits.length - 1)]?.focus();
          }}
          onBackKey={(index) => {
            if (index > 0) {
              pinInputs.current[index - 1]?.focus();
            }
          }}
          onSetupPin={onSetupPin}
        />
      ) : step === 5 && broadcast ? (
        <StepDelivery
          warning={broadcast}
          extendHours={extendHours}
          onExtendHoursChange={setExtendHours}
          onRequestExtend={() => {
            setLiveError(null);
            setLiveAction("extend");
          }}
        />
      ) : (
        renderStepContent()
      )}

      {step === 4 && (
        <div className="wz-footer">
          <button
            type="button"
            className="wz-button wz-button-ghost"
            onClick={() => setStep(3)}
            disabled={broadcasting}
          >
            <ChevronLeft size={16} /> Back to message
          </button>

          <button
            type="button"
            className="wz-button wz-button-primary"
            onClick={() => void handleBroadcast()}
            disabled={broadcasting || pin.join("").length !== 6}
          >
            {broadcasting ? (
              <Loader2 className="wz-spin" size={16} />
            ) : (
              <Megaphone size={16} />
            )}
            Authorize and broadcast
          </button>
        </div>
      )}

      {step === 5 && broadcast && (
        <div className="wz-footer">
          <button
            type="button"
            className="wz-button wz-button-ghost"
            onClick={onViewHistory}
          >
            <ClipboardList size={16} /> Alert history
          </button>

          {(broadcast.status === "ACTIVE" || broadcast.status === "EXPIRED") && (
            <button
              type="button"
              className="wz-button wz-button-danger"
              onClick={() => {
                setLiveError(null);
                setLiveAction("stand-down");
              }}
              disabled={standDownBusy}
            >
              {standDownBusy ? (
                <Loader2 className="wz-spin" size={16} />
              ) : (
                <Ban size={16} />
              )}
              Stand down warning
            </button>
          )}
        </div>
      )}

      {liveAction !== "none" && (
        <PinChallengeModal
          title={
            liveAction === "extend"
              ? `Clearance for a ${extendHours} hour extension`
              : "Clearance to stand this warning down"
          }
          description={
            liveAction === "extend"
              ? `This keeps ${broadcast?.warningId ?? "the warning"} live for ${extendHours} more hours and re-activates it if it already expired. Enter your six digit clearance PIN.`
              : `This pulls ${broadcast?.warningId ?? "the warning"} off every handset in ${broadcast?.targetDistrict ?? "the area"} District. Enter your six digit clearance PIN.`
          }
          confirmLabel={liveAction === "extend" ? "Extend expiry" : "Stand down"}
          busy={liveAction === "extend" ? extendBusy : standDownBusy}
          error={liveError}
          onCancel={() => {
            setLiveAction("none");
            setLiveError(null);
          }}
          onConfirm={(securityPin) => {
            if (liveAction === "extend") {
              void handleExtendExpiry(securityPin);
            } else if (liveAction === "stand-down") {
              void handleStandDown(securityPin);
            }
          }}
        />
      )}

      {step === 3 && Object.keys(draftIssues).length > 0 && (
        <div className="wz-banner wz-banner-warn">
          <AlertTriangle size={16} />
          <div>
            <span>Still needed before this warning can be saved:</span>
            <ul className="wz-requirements">
              {Object.entries(draftIssues).map(([field, issue]) => (
                <li key={field}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {step < 4 && (
        <div className="wz-footer">
          <button
            type="button"
            className="wz-button wz-button-ghost"
            onClick={() => (step === 1 ? onExit() : setStep(step - 1))}
          >
            <ArrowLeft size={16} /> {step === 1 ? "Dashboard" : STEPS[step - 2]}
          </button>

          {step > 1 && (
            <button
              type="button"
              className="wz-button wz-button-ghost"
              onClick={() => onExit()}
            >
              <Save size={16} /> {warning ? "Draft saved — leave" : "Leave without draft"}
            </button>
          )}

          <button
            type="button"
            className="wz-button wz-button-primary"
            onClick={() => void goNext()}
            disabled={!canContinue()}
          >
            {STEPS[step]} <ArrowRight size={16} />
          </button>
        </div>
      )}

      <style>{WIZARD_STYLES}</style>
      <style>{DATA_STYLES}</style>
    </div>
  );
}

function StepReport({
  reports,
  loading,
  selectedId,
  onSelect,
  onExit,
}: {
  reports: HazardReport[];
  loading: boolean;
  selectedId: string;
  onSelect: (report: HazardReport) => void;
  onExit: () => void;
}) {
  if (loading) {
    return (
      <div className="wz-state">
        <Loader2 className="wz-spin" size={18} /> Loading verified reports…
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="wz-empty">
        <ShieldCheck size={26} />
        <h3>No verified report to warn on</h3>
        <p>
          A warning can only be issued on top of a citizen report a DMC officer
          has verified. Verify one in the report queue first.
        </p>
        <button type="button" className="wz-button wz-button-primary" onClick={onExit}>
          Open report queue
        </button>
      </div>
    );
  }

  if (reports.every((report) => (report.warningCount ?? 0) > 0)) {
    return (
      <div className="wz-empty">
        <Ban size={26} />
        <h3>Every verified report is already alerted on</h3>
        <p>
          One report raises one warning, so there is nothing left to warn on
          here. Verify a fresh ground report, or reopen an existing warning from
          Alert history to extend or stand it down.
        </p>
        <button type="button" className="wz-button wz-button-primary" onClick={onExit}>
          Open report queue
        </button>
      </div>
    );
  }

  return (
    <section className="wz-card">
      <h2 className="wz-card-title">Which report is this warning for?</h2>
      <p className="wz-card-lead">
        Every warning is linked to one verified ground report, and one report
        raises exactly one warning. A report that has already been alerted on is
        closed here - reopen that warning from Alert history instead.
      </p>

      <div className="wz-report-list">
        {reports.map((report) => {
          const used = (report.warningCount ?? 0) > 0;

          return (
            <button
              type="button"
              key={report.id}
              className={`wz-report ${
                report.id === selectedId ? "wz-report-selected" : ""
              } ${used ? "wz-report-used" : ""}`}
              disabled={used}
              title={
                used
                  ? "This report already has a warning. Reopen it from Alert history."
                  : undefined
              }
              onClick={() => {
                if (used) {
                  return;
                }

                onSelect(report);
              }}
            >
              <span className="wz-report-radio">
                {used ? (
                  <Ban size={18} />
                ) : report.id === selectedId ? (
                  <CheckCircle size={18} />
                ) : null}
              </span>
              <span className="wz-report-body">
                <span className="wz-report-headline">
                  {humanize(report.hazardType)}
                </span>
                <span className="sp-badges">
                  <span className={`sp-pill ${severityPill(report.severityLevel)}`}>
                    {humanize(report.severityLevel)} severity
                  </span>
                  <span className="sp-pill sp-pill-blue">
                    {report.locationDistrict} District
                  </span>
                  {used && <span className="sp-pill sp-pill-slate">Already alerted</span>}
                </span>
                <span className="sp-facts">
                  <span className="sp-fact">
                    <span className="sp-label">Reference</span>
                    <span className="sp-value sp-mono">{report.reportId}</span>
                  </span>
                  <span className="sp-fact">
                    <span className="sp-label">Reported by</span>
                    <span className="sp-value">
                      {report.reporterName ?? "A citizen"}
                    </span>
                  </span>
                  <span className="sp-fact">
                    <span className="sp-label">Received</span>
                    <span className="sp-value">{relativeTime(report.createdAt)}</span>
                  </span>
                  {used && (
                    <span className="sp-fact">
                      <span className="sp-label">Warnings raised</span>
                      <span className="sp-value">{report.warningCount ?? 0}</span>
                    </span>
                  )}
                </span>
                <span className="wz-report-desc">{report.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StepTarget({
  districts,
  targetDistrict,
  onDistrictChange,
  mode,
  onModeChange,
  rings,
  polygon,
  onPolygonChange,
  audience,
  audienceLoading,
}: {
  districts: DistrictBoundary[];
  targetDistrict: string;
  onDistrictChange: (name: string) => void;
  mode: "district" | "custom";
  onModeChange: (next: "district" | "custom") => void;
  rings: Coordinate[][];
  polygon: Coordinate[];
  onPolygonChange: (next: Coordinate[]) => void;
  audience: AudiencePreview | null;
  audienceLoading: boolean;
}) {
  return (
    <section className="wz-card">
      <h2 className="wz-card-title">Define the target area</h2>
      <p className="wz-card-lead">
        Pick the district, or draw a smaller polygon inside it. The map outline,
        the dropdown and the server check all read the same boundary file, so a
        drawn area can never belong to a different district than the one shown.
      </p>

      <div className="wz-field-row">
        <div className="wz-field">
          <label htmlFor="wz-district">District</label>
          <select
            id="wz-district"
            value={targetDistrict}
            onChange={(event) => onDistrictChange(event.target.value)}
          >
            <option value="">Loading districts…</option>
            {districts.map((item) => (
              <option key={item.district} value={item.district}>
                {item.district} District
              </option>
            ))}
          </select>
        </div>

        <div className="wz-field">
          <label>Target shape</label>
          <div className="wz-segment">
            <button
              type="button"
              className={`wz-segment-button ${mode === "district" ? "wz-segment-active" : ""}`}
              onClick={() => onModeChange("district")}
            >
              <MapIcon size={14} /> Whole district
            </button>
            <button
              type="button"
              className={`wz-segment-button ${mode === "custom" ? "wz-segment-active" : ""}`}
              onClick={() => onModeChange("custom")}
            >
              <CircleDot size={14} /> Draw inside it
            </button>
          </div>
        </div>
      </div>

      {targetDistrict && (
        <TargetMap
          district={targetDistrict}
          rings={rings}
          polygon={polygon}
          mode={mode}
          onPolygonChange={onPolygonChange}
        />
      )}

      <div className="wz-audience">
        <h3>
          <Smartphone size={15} /> Who can be reached there?
        </h3>

        {audienceLoading && (
          <p className="wz-audience-line">
            <Loader2 className="wz-spin" size={14} /> Counting registered accounts…
          </p>
        )}

        {!audienceLoading && audience && (
          <>
            <div className="wz-audience-grid">
              <Stat label="Registered in district" value={audience.registeredResidents} />
              <Stat label="Push capable" value={audience.pushCapable} />
              <Stat label="SMS capable" value={audience.smsCapable} />
              <Stat
                label={
                  audience.hasCustomBoundary ? "Outside drawn polygon" : "Outside target"
                }
                value={audience.outsideBoundary}
              />
            </div>

            {audience.canBroadcast ? (
              <p className="wz-audience-line wz-audience-ok">
                <CheckCircle size={14} />{" "}
                {new Intl.NumberFormat().format(audience.audienceCount)} accounts will be
                alerted{audience.hasCustomBoundary ? " inside the drawn polygon." : "."}
              </p>
            ) : (
              <p className="wz-audience-line wz-audience-block">
                <AlertTriangle size={14} /> No registered account is currently placed in{" "}
                {audience.targetDistrict} District, so nothing can be broadcast. Choose
                another district or wait for coverage.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="wz-stat">
      <span className="wz-stat-value">{new Intl.NumberFormat().format(value)}</span>
      <span className="wz-stat-label">{label}</span>
    </div>
  );
}

function StepMessage(props: {
  hazardType: string;
  severityLevel: SeverityLevel;
  safetyInstructions: string;
  englishMessage: string;
  sinhalaMessage: string;
  tamilMessage: string;
  channels: ChannelSelection;
  expiresInHours: number;
  generating: boolean;
  saving: boolean;
  hasDraft: boolean;
  draftReady: boolean;
  fieldErrors: Record<string, string>;
  onHazardTypeChange: (value: string) => void;
  onSeverityChange: (value: SeverityLevel) => void;
  onSafetyChange: (value: string) => void;
  onEnglishChange: (value: string) => void;
  onSinhalaChange: (value: string) => void;
  onTamilChange: (value: string) => void;
  onChannelsChange: (value: ChannelSelection) => void;
  onExpiryChange: (value: number) => void;
  onGenerate: () => void;
  onSaveDraft: () => void;
}) {
  const sirenLocked = props.severityLevel === "CRITICAL";

  return (
    <section className="wz-card">
      <h2 className="wz-card-title">Compose the warning</h2>
      <p className="wz-card-lead">
        Hazard and severity start from the verified report. The three languages
        are generated from your safety instructions and stay editable before
        they are frozen into the alert payload.
      </p>

      <div className="wz-field-row">
        <div className="wz-field">
          <label htmlFor="wz-hazard">Hazard type</label>
          <select
            id="wz-hazard"
            value={props.hazardType}
            onChange={(event) => props.onHazardTypeChange(event.target.value)}
          >
            {HAZARD_TYPES.map((type) => (
              <option key={type} value={type}>
                {humanize(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="wz-field">
          <label htmlFor="wz-severity">Severity</label>
          <select
            id="wz-severity"
            value={props.severityLevel}
            onChange={(event) =>
              props.onSeverityChange(event.target.value as SeverityLevel)
            }
          >
            {SEVERITY_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {humanize(level)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="wz-field">
        <label htmlFor="wz-safety">Safety instructions (optional)</label>
        <textarea
          id="wz-safety"
          rows={3}
          value={props.safetyInstructions}
          placeholder="Move to higher ground now. Do not cross flooded roads."
          onChange={(event) => props.onSafetyChange(event.target.value)}
        />
        <span className="wz-help">
          Left empty, the wording falls back to the standard advice for this
          hazard and severity.
        </span>
        {props.fieldErrors.safetyInstructions && (
          <p className="wz-field-error-text">{props.fieldErrors.safetyInstructions}</p>
        )}
      </div>

      <button
        type="button"
        className="wz-button wz-button-soft"
        onClick={props.onGenerate}
        disabled={props.generating}
      >
        {props.generating ? <Loader2 className="wz-spin" size={15} /> : <MessageSquare size={15} />}
        Generate Sinhala and Tamil wording
      </button>

      <div className="wz-message-grid">
        <MessageField
          id="wz-en"
          label="English"
          value={props.englishMessage}
          error={props.fieldErrors.englishMessage}
          onChange={props.onEnglishChange}
        />
        <MessageField
          id="wz-si"
          label="Sinhala"
          value={props.sinhalaMessage}
          error={props.fieldErrors.sinhalaMessage}
          onChange={props.onSinhalaChange}
        />
        <MessageField
          id="wz-ta"
          label="Tamil"
          value={props.tamilMessage}
          error={props.fieldErrors.tamilMessage}
          onChange={props.onTamilChange}
        />
      </div>

      <div className="wz-channels">
        <h3>Channels</h3>
        <div className="wz-channel-grid">
          <ChannelToggle
            icon={<Smartphone size={16} />}
            label="Push to app"
            checked={props.channels.push}
            onChange={(checked) => props.onChannelsChange({ ...props.channels, push: checked })}
          />
          <ChannelToggle
            icon={<MessageSquare size={16} />}
            label="SMS"
            checked={props.channels.sms}
            onChange={(checked) => props.onChannelsChange({ ...props.channels, sms: checked })}
          />
          <ChannelToggle
            icon={<Siren size={16} />}
            label="Siren"
            checked={props.channels.siren}
            locked={sirenLocked}
            onChange={(checked) => props.onChannelsChange({ ...props.channels, siren: checked })}
          />
        </div>

        {sirenLocked && (
          <p className="wz-help">
            Critical severity always drives the siren network. A siren failure
            cannot block push or SMS — the dispatcher reports each channel
            separately.
          </p>
        )}

        {props.fieldErrors.channels && (
          <p className="wz-field-error-text">{props.fieldErrors.channels}</p>
        )}
      </div>

      <div className="wz-field">
        <label htmlFor="wz-lifetime">Alert valid for</label>
        <select
          id="wz-lifetime"
          value={props.expiresInHours}
          onChange={(event) => props.onExpiryChange(Number(event.target.value))}
        >
          {WARNING_LIFETIME_HOURS.map((hours) => (
            <option key={hours} value={hours}>
              {hours === 1 ? "1 hour" : `${hours} hours`}
            </option>
          ))}
        </select>
        <span className="wz-help">
          The countdown starts when the warning is broadcast, and citizens see
          it as the expiry time on the alert. A live warning can be extended
          later from the delivery screen.
        </span>
        {props.fieldErrors.expiresInHours && (
          <p className="wz-field-error-text">{props.fieldErrors.expiresInHours}</p>
        )}
      </div>

      <button
        type="button"
        className="wz-button wz-button-ghost"
        onClick={props.onSaveDraft}
        disabled={props.saving || !props.draftReady}
        title={
          props.draftReady
            ? undefined
            : "Fill all three message boxes first (English 20+, Sinhala 15+, Tamil 15+) and pick a channel."
        }
      >
        {props.saving ? <Loader2 className="wz-spin" size={15} /> : <Save size={15} />}
        {props.hasDraft ? "Update draft" : "Save warning as draft"}
      </button>
    </section>
  );
}

function MessageField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="wz-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={4}
        value={value}
        maxLength={480}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className={`wz-help ${error ? "wz-field-error-text" : ""}`}>
        {error ?? `${value.trim().length}/480 characters`}
      </span>
    </div>
  );
}

function ChannelToggle({
  icon,
  label,
  checked,
  locked = false,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  locked?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`wz-channel ${checked ? "wz-channel-on" : ""} ${locked ? "wz-channel-locked" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {icon}
      {label}
    </label>
  );
}

function StepAuthorize({
  report,
  warning,
  audience,
  channels,
  severityLevel,
  pin,
  broadcasting,
  pinInputs,
  onPinChange,
  onPaste,
  onBackKey,
  onSetupPin,
}: {
  report: HazardReport | null;
  warning: DisasterWarning | null;
  audience: AudiencePreview | null;
  channels: ChannelSelection;
  severityLevel: SeverityLevel;
  pin: string[];
  broadcasting: boolean;
  pinInputs: { current: (HTMLInputElement | null)[] };
  onPinChange: (index: number, value: string) => void;
  onPaste: (digits: string) => void;
  onBackKey: (index: number) => void;
  onSetupPin: () => void;
}) {
  const activeChannels = [
    channels.push ? "Push" : null,
    channels.sms ? "SMS" : null,
    channels.siren ? "Siren" : null,
  ].filter((channel): channel is string => channel !== null);

  return (
    <section className="wz-card wz-authorize">
      <h2 className="wz-card-title">Authorize the broadcast</h2>
      <p className="wz-card-lead">
        Enter your 6 digit operational clearance PIN. This is the last gate: a
        wrong PIN stops the broadcast immediately and is logged as an
        unauthorized attempt.
      </p>

      <div className="wz-summary">
        <SummaryRow label="Warning" value={warning?.warningId ?? "Not saved yet"} />
        <SummaryRow label="Verified report" value={report?.reportId ?? "—"} />
        <SummaryRow
          label="Hazard"
          value={report ? humanize(report.hazardType) : "—"}
        />
        <SummaryRow
          label="Target"
          value={
            warning
              ? warning.gisPolygon?.source === "CUSTOM"
                ? "Drawn polygon"
                : "Whole district"
              : "—"
          }
        />
        <SummaryRow
          label="District"
          value={warning?.targetDistrict ?? "—"}
        />
        <SummaryRow
          label="Severity"
          value={
            <span className={`sp-pill ${severityPill(severityLevel)}`}>
              {humanize(severityLevel)}
            </span>
          }
        />
        <SummaryRow
          label="Accounts targeted"
          value={
            warning
              ? String(warning.audienceCount)
              : audience
                ? String(audience.audienceCount)
                : "—"
          }
        />
        <SummaryRow
          label="SMS recipients"
          value={warning ? String(warning.smsRecipientCount) : "—"}
        />
        <SummaryRow
          label="Channels"
          value={
            activeChannels.length > 0 ? (
              <span className="sp-badges">
                {activeChannels.map((channel) => (
                  <span key={channel} className="sp-pill sp-pill-plain">
                    {channel}
                  </span>
                ))}
              </span>
            ) : (
              "None"
            )
          }
        />
        <SummaryRow
          label="Reach estimate"
          value={
            warning?.estimatedReach !== undefined
              ? `${warning.estimatedReach.toFixed(1)}%`
              : "—"
          }
        />
      </div>

      <div className="wz-pinbox" aria-label="Clearance PIN">
        {pin.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              pinInputs.current[index] = element;
            }}
            className="wz-pinbox-digit"
            value={digit ? "•" : ""}
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            disabled={broadcasting}
            onChange={(event) => onPinChange(index, event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              onPaste(event.clipboardData.getData("text"));
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit) {
                onBackKey(index);
              }
            }}
          />
        ))}
      </div>

      <p className="wz-help">
        Forgotten it?{" "}
        <button type="button" className="wz-link" onClick={onSetupPin}>
          Set a new PIN
        </button>{" "}
        first — changing it needs the current one.
      </p>
    </section>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="wz-summary-row">
      <span className="wz-summary-label">{label}</span>
      <span className="wz-summary-value">{value}</span>
    </div>
  );
}

function StepDelivery({
  warning,
  extendHours,
  onExtendHoursChange,
  onRequestExtend,
}: {
  warning: DisasterWarning;
  extendHours: number;
  onExtendHoursChange: (hours: number) => void;
  onRequestExtend: () => void;
}) {
  const logs = warning.broadcastLogs ?? [];
  const canExtend = warning.status === "ACTIVE" || warning.status === "EXPIRED";

  return (
    <section className="wz-card">
      <div className="wz-delivered">
        <CheckCircle size={30} />
        <div>
          <h2 className="wz-card-title">Broadcast dispatched</h2>
          <div className="sp-badges">
            <span className={`sp-pill ${statusPill(warning.status)}`}>
              {humanize(warning.status)}
            </span>
            <span className="sp-pill sp-pill-blue">
              {warning.targetDistrict} District
            </span>
          </div>
          <div className="sp-facts">
            <span className="sp-fact">
              <span className="sp-label">Reference</span>
              <span className="sp-value sp-mono">{warning.warningId}</span>
            </span>
            <span className="sp-fact">
              <span className="sp-label">Audience</span>
              <span className="sp-value">
                {warning.audienceCount} accounts
              </span>
            </span>
            <span className="sp-fact">
              <span className="sp-label">SMS recipients</span>
              <span className="sp-value">{warning.smsRecipientCount}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="wz-channel-results">
        {logs.map((log) => {
          const skip = log.status === "SKIPPED" ? skippedCopy(log.channelType) : null;

          return (
            <div key={log.id} className={`wz-result wz-result-${log.status.toLowerCase()}`}>
              <div className="wz-result-head">
                <span className="wz-result-channel">
                  {log.channelType === "push" ? (
                    <Smartphone size={15} />
                  ) : log.channelType === "sms" ? (
                    <MessageSquare size={15} />
                  ) : (
                    <Siren size={15} />
                  )}
                  {channelLabel(log.channelType)}
                </span>
                <span className="wz-result-status">{deliveryLabel(log.status)}</span>
              </div>

              {skip ? (
                <div className="sp-facts">
                  <span className="sp-fact">
                    <span className="sp-label">Why</span>
                    <span className="sp-value sp-muted">{skip.reason}</span>
                  </span>
                  <span className="sp-fact">
                    <span className="sp-label">Next step</span>
                    <span className="sp-value sp-muted">{skip.nextStep}</span>
                  </span>
                </div>
              ) : (
                <>
                  <div className="wz-result-metrics">
                    <span>{log.targetCount} targeted</span>
                    <span>{log.deliveryCount} delivered</span>
                    <span>{log.failureCount} failed</span>
                  </div>

                  {log.errorMessage && (
                    <p
                      className={
                        isDeliveryError(log.status)
                          ? "wz-result-error"
                          : "wz-result-note"
                      }
                    >
                      {log.errorMessage}
                    </p>
                  )}

                  {!log.errorMessage && log.status !== "SUCCESS" && (
                    <p className="wz-result-note">
                      {log.channelType === "siren"
                        ? "Siren relay unavailable - push and SMS still went out."
                        : "Channel reported a partial delivery."}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="wz-summary">
        <div className="wz-summary-row">
          <span className="wz-summary-label">Posted</span>
          <span className="wz-summary-value">
            {warning.broadcastAt
              ? new Date(warning.broadcastAt).toLocaleString()
              : "Not broadcast yet"}
          </span>
        </div>

        {warning.broadcastAt && (
          <div className="wz-summary-row">
            <span className="wz-summary-label">Elapsed</span>
            <span className="wz-summary-value">
              {relativeTime(warning.broadcastAt)}
            </span>
          </div>
        )}

        <div className="wz-summary-row">
          <span className="wz-summary-label">Active until</span>
          <span className="wz-summary-value">
            {warning.expiresAt
              ? new Date(warning.expiresAt).toLocaleString()
              : "No expiry set"}
          </span>
        </div>

        {warning.expiresAt && (
          <div className="wz-summary-row">
            <span className="wz-summary-label">Time remaining</span>
            <span className="wz-summary-value">
              {remainingTime(warning.expiresAt)}
            </span>
          </div>
        )}
      </div>

      {canExtend && (
        <div className="wz-extend">
          <div className="wz-field">
            <label htmlFor="wz-extend">Extend the warning by</label>
            <select
              id="wz-extend"
              value={extendHours}
              onChange={(event) => onExtendHoursChange(Number(event.target.value))}
            >
              {EXPIRY_EXTENSION_HOURS.map((hours) => (
                <option key={hours} value={hours}>
                  {hours === 1 ? "1 hour" : `${hours} hours`}
                </option>
              ))}
            </select>
            <span className="wz-help">
              {warning.status === "EXPIRED"
                ? "This warning has expired. Extending it brings it back live with a fresh countdown."
                : "Time still runs from now, so the new expiry is added on top of the remaining minutes."}
            </span>
          </div>

          <button
            type="button"
            className="wz-button wz-button-soft"
            onClick={onRequestExtend}
          >
            <Clock size={15} />
            Extend expiry
          </button>
        </div>
      )}
    </section>
  );
}

function closedBoundary(points: Coordinate[]): Coordinate[] {
  return [...points, points[0]];
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function remainingTime(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);

  if (minutes <= 0) return "expired";

  if (minutes < 60) return `${minutes} min left`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} h ${minutes % 60} min left`;

  return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

// Shared with src/styles/dushani-dashboardStyles.ts so the wizard and the
// dashboard read from one visual system: same elevation, radii and focus ring.
const Hairline = "#EAECF0";
const Divider = "#F2F4F7";
const Surface = "#F9FAFB";
const RedTint = "#FEF3F2";
const GreenTint = "#DCFCE7";
const GreenText = "#166534";
const ShadowCard = "0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.06)";
const ShadowRaised = "0 4px 12px rgba(16, 24, 40, 0.09), 0 2px 4px rgba(16, 24, 40, 0.05)";
const FocusRing = "0 0 0 3px rgba(217, 45, 32, 0.16)";

const WIZARD_STYLES = `
  .wz {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 940px;
    color: ${Colors.text};
    font-variant-numeric: tabular-nums;
  }

  .wz *,
  .wz *::before,
  .wz *::after {
    box-sizing: border-box;
  }

  .wz button,
  .wz input,
  .wz select,
  .wz textarea,
  .wz label {
    font-family: inherit;
  }

  .wz-steps {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: 8px;
    flex-wrap: wrap;
  }

  .wz-step {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 13px 7px 9px;
    border-radius: 999px;
    background: ${Colors.white};
    border: 1px solid ${Hairline};
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: ${Colors.muted};
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  }

  .wz-step-active {
    border-color: #fda29b;
    color: ${Colors.redDark};
    background: ${RedTint};
  }

  .wz-step-done {
    border-color: #a7f3c0;
    color: ${GreenText};
    background: ${GreenTint};
  }

  .wz-step-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 19px;
    height: 19px;
    border-radius: 50%;
    background: ${Colors.border};
    color: ${Colors.white};
    font-size: 10.5px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .wz-step-active .wz-step-dot {
    background: ${Colors.red};
    color: ${Colors.white};
  }

  .wz-step-done .wz-step-dot {
    background: transparent;
    color: ${Colors.success};
  }

  .wz-card {
    position: relative;
    background: ${Colors.white};
    border: 1px solid ${Hairline};
    border-radius: 16px;
    padding: 26px 28px;
    box-shadow: ${ShadowCard};
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .wz-card-title {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.text};
  }

  .wz-card-lead {
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
    color: ${Colors.muted};
  }

  .wz-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 13px 16px;
    border: 1px solid transparent;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
    box-shadow: ${ShadowCard};
  }

  .wz-banner svg {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .wz-banner-error {
    background: ${RedTint};
    color: ${Colors.redDark};
    border-color: #fda29b;
  }

  .wz-banner-warn {
    background: ${Colors.amberLight};
    color: ${Colors.amberText};
    border-color: #fdcf5f;
  }

  .wz-requirements {
    margin: 6px 0 0;
    padding-left: 18px;
    display: grid;
    gap: 4px;
    font-size: 12.5px;
    font-weight: 600;
  }

  .wz-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 22px;
    border: 1px dashed ${Colors.border};
    border-radius: 14px;
    background: ${Surface};
    color: ${Colors.muted};
    font-size: 13px;
    font-weight: 600;
  }

  .wz-state svg {
    color: ${Colors.red};
  }

  .wz-empty {
    background: ${Colors.white};
    border: 1px solid ${Hairline};
    border-radius: 16px;
    padding: 46px 26px;
    box-shadow: ${ShadowCard};
    text-align: center;
    color: ${Colors.muted};
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .wz-empty > svg {
    color: ${Colors.red};
    opacity: 0.9;
  }

  .wz-empty h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.text};
  }

  .wz-empty p {
    margin: 0;
    max-width: 460px;
    font-size: 13px;
    line-height: 1.65;
  }

  .wz-report-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .wz-report {
    position: relative;
    display: flex;
    gap: 14px;
    text-align: left;
    padding: 16px 18px;
    border: 1px solid ${Hairline};
    border-radius: 14px;
    background: ${Colors.white};
    box-shadow: ${ShadowCard};
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease,
      transform 160ms ease, background 160ms ease;
  }

  .wz-report:hover:not(.wz-report-used) {
    border-color: ${Colors.border};
    box-shadow: ${ShadowRaised};
    transform: translateY(-1px);
  }

  .wz-report:focus-visible {
    outline: none;
    border-color: ${Colors.red};
    box-shadow: ${FocusRing};
  }

  .wz-report-selected {
    border-color: ${Colors.red};
    background: ${RedTint};
    box-shadow: 0 1px 3px rgba(217, 45, 32, 0.16);
  }

  .wz-report-selected:hover:not(.wz-report-used) {
    border-color: ${Colors.redDark};
    transform: none;
  }

  .wz-report-used,
  .wz-report-used:hover {
    border-color: ${Hairline};
    background: ${Surface};
    box-shadow: none;
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .wz-report-used .wz-report-radio {
    color: ${Colors.muted};
  }

  .wz-report-radio {
    color: ${Colors.red};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    margin-top: 1px;
  }

  .wz-report-body {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .wz-report-headline {
    font-size: 13.5px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.text};
  }

  .wz-report-desc {
    font-size: 13px;
    font-weight: 500;
    color: ${Colors.text};
    line-height: 1.55;
  }

  .wz-field-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .wz-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }

  .wz-field label {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .wz-field select,
  .wz-field textarea {
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.text};
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }

  .wz-field select {
    height: 38px;
    padding: 0 12px;
  }

  .wz-field textarea {
    padding: 10px 12px;
    line-height: 1.55;
    resize: vertical;
  }

  .wz-field select:hover:not(:disabled),
  .wz-field textarea:hover:not(:disabled) {
    border-color: ${Colors.navy};
  }

  .wz-field select:focus,
  .wz-field textarea:focus {
    outline: none;
    border-color: ${Colors.red};
  }

  .wz-field select:focus-visible,
  .wz-field textarea:focus-visible {
    box-shadow: ${FocusRing};
  }

  .wz-field select:disabled,
  .wz-field textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wz-help {
    font-size: 12px;
    font-weight: 500;
    color: ${Colors.muted};
    line-height: 1.55;
  }

  .wz-field-error-text {
    color: ${Colors.redDark};
    font-weight: 600;
  }

  .wz-segment {
    display: flex;
    width: 100%;
    height: 38px;
    gap: 3px;
    padding: 3px;
    background: ${Surface};
    border: 1px solid ${Colors.border};
    border-radius: 10px;
  }

  .wz-segment-button {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: ${Colors.muted};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: background 140ms ease, color 140ms ease, box-shadow 140ms ease;
  }

  .wz-segment-button:hover {
    color: ${Colors.text};
    background: ${Colors.white};
  }

  .wz-segment-button:focus-visible {
    outline: none;
    box-shadow: ${FocusRing};
  }

  .wz-segment-active {
    background: ${Colors.navy};
    color: ${Colors.white};
    box-shadow: 0 1px 3px rgba(11, 31, 51, 0.28);
  }

  .wz-segment-active:hover {
    color: ${Colors.white};
    background: ${Colors.navy};
  }

  .wz-audience {
    border-top: 1px solid ${Divider};
    padding-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .wz-audience h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.text};
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wz-audience-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }

  .wz-stat {
    position: relative;
    overflow: hidden;
    border: 1px solid ${Hairline};
    border-radius: 12px;
    padding: 14px 16px 14px 18px;
    background: ${Colors.white};
    box-shadow: ${ShadowCard};
    display: flex;
    flex-direction: column;
    gap: 3px;
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .wz-stat::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${Colors.border};
  }

  .wz-stat:nth-child(1)::before {
    background: ${Colors.blue};
  }

  .wz-stat:nth-child(2)::before {
    background: ${Colors.success};
  }

  .wz-stat:nth-child(3)::before {
    background: ${Colors.amber};
  }

  .wz-stat:nth-child(4)::before {
    background: ${Colors.red};
  }

  .wz-stat:hover {
    transform: translateY(-2px);
    box-shadow: ${ShadowRaised};
  }

  .wz-stat-value {
    font-size: 24px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.text};
    font-variant-numeric: tabular-nums;
  }

  .wz-stat-label {
    font-size: 11px;
    color: ${Colors.muted};
    font-weight: 600;
    line-height: 1.35;
  }

  .wz-audience-line {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid ${Hairline};
    border-radius: 10px;
    background: ${Surface};
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${Colors.muted};
    font-variant-numeric: tabular-nums;
  }

  .wz-audience-ok {
    background: ${GreenTint};
    border-color: #a7f3c0;
    color: ${GreenText};
  }

  .wz-audience-block {
    background: ${RedTint};
    border-color: #fda29b;
    color: ${Colors.redDark};
  }

  .wz-message-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .wz-channels {
    border-top: 1px solid ${Divider};
    padding-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .wz-channels h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.text};
  }

  .wz-channel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }

  .wz-channel {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    background: ${Colors.white};
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    font-size: 13px;
    font-weight: 700;
    color: ${Colors.muted};
    cursor: pointer;
    transition: border-color 140ms ease, background 140ms ease, color 140ms ease,
      box-shadow 140ms ease;
  }

  .wz-channel:hover {
    border-color: ${Colors.navy};
    color: ${Colors.text};
  }

  .wz-channel:focus-within {
    outline: none;
    border-color: ${Colors.red};
    box-shadow: ${FocusRing};
  }

  .wz-channel input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: ${Colors.red};
    cursor: pointer;
    flex-shrink: 0;
  }

  .wz-channel-on {
    border-color: ${Colors.red};
    color: ${Colors.redDark};
    background: ${RedTint};
    box-shadow: 0 1px 3px rgba(217, 45, 32, 0.14);
  }

  .wz-channel-on:hover {
    border-color: ${Colors.redDark};
    color: ${Colors.redDark};
  }

  .wz-channel-locked {
    cursor: not-allowed;
    opacity: 0.8;
  }

  .wz-channel-locked:hover {
    border-color: ${Colors.border};
  }

  .wz-authorize::before {
    content: "";
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 4px;
    border-radius: 0 4px 4px 0;
    background: linear-gradient(180deg, ${Colors.red} 0%, ${Colors.redDark} 100%);
  }

  .wz-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px 20px;
    background: ${Surface};
    border: 1px solid ${Hairline};
    border-radius: 14px;
    padding: 18px 20px;
  }

  .wz-summary-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .wz-summary-label {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .wz-summary-value {
    font-size: 13px;
    font-weight: 700;
    color: ${Colors.text};
    word-break: break-word;
    font-variant-numeric: tabular-nums;
  }

  .wz-pinbox {
    display: flex;
    gap: 10px;
    justify-content: center;
    padding: 12px 0 4px;
  }

  .wz-pinbox-digit {
    width: 52px;
    height: 60px;
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    text-align: center;
    font-size: 24px;
    font-weight: 800;
    color: ${Colors.text};
    background: ${Colors.white};
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }

  .wz-pinbox-digit:hover:not(:disabled) {
    border-color: ${Colors.navy};
  }

  .wz-pinbox-digit:focus {
    outline: none;
    border-color: ${Colors.red};
  }

  .wz-pinbox-digit:focus-visible {
    box-shadow: ${FocusRing};
  }

  .wz-pinbox-digit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wz-link {
    border: none;
    background: none;
    padding: 0;
    color: ${Colors.blue};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .wz-link:hover {
    color: ${Colors.blueDark};
  }

  .wz-link:focus-visible {
    outline: none;
    border-radius: 4px;
    box-shadow: 0 0 0 3px rgba(21, 112, 239, 0.2);
  }

  .wz-delivered {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .wz-delivered > svg {
    color: ${GreenText};
    background: ${GreenTint};
    border: 1px solid #a7f3c0;
    border-radius: 999px;
    padding: 8px;
    width: 48px;
    height: 48px;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .wz-channel-results {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .wz-result {
    position: relative;
    overflow: hidden;
    border: 1px solid ${Hairline};
    border-radius: 14px;
    padding: 16px 16px 16px 19px;
    background: ${Colors.white};
    box-shadow: ${ShadowCard};
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .wz-result::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: ${Colors.border};
  }

  .wz-result:hover {
    border-color: ${Colors.border};
    box-shadow: ${ShadowRaised};
  }

  .wz-result-success::before {
    background: ${Colors.success};
  }

  .wz-result-partial::before {
    background: ${Colors.amber};
  }

  .wz-result-failed::before,
  .wz-result-pending::before {
    background: ${Colors.red};
  }

  .wz-result-skipped::before {
    background: ${Colors.border};
  }

  .wz-result-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .wz-result-channel {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.text};
  }

  .wz-result-channel svg {
    color: ${Colors.muted};
    flex-shrink: 0;
  }

  .wz-result-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid ${Colors.border};
    background: ${Surface};
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
    color: ${Colors.muted};
  }

  .wz-result-status::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .wz-result-success .wz-result-status {
    background: ${GreenTint};
    border-color: #a7f3c0;
    color: ${GreenText};
  }

  .wz-result-partial .wz-result-status {
    background: ${Colors.amberLight};
    border-color: #fdcf5f;
    color: ${Colors.amberText};
  }

  .wz-result-failed .wz-result-status {
    background: ${Colors.redLight};
    border-color: #fda29b;
    color: ${Colors.redDark};
  }

  .wz-result-pending .wz-result-status {
    background: ${Colors.blueLight};
    border-color: #b5d8fb;
    color: ${Colors.blueDark};
  }

  .wz-result-skipped .wz-result-status {
    background: ${Colors.background};
    border-color: ${Colors.border};
    color: ${Colors.muted};
  }

  .wz-result-metrics {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    font-size: 12px;
    font-weight: 600;
    color: ${Colors.muted};
    font-variant-numeric: tabular-nums;
  }

  .wz-result-error {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: ${RedTint};
    font-size: 12px;
    font-weight: 600;
    color: ${Colors.redDark};
  }

  .wz-result-note {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: ${Colors.muted};
    line-height: 1.5;
  }

  .wz-extend {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    flex-wrap: wrap;
  }

  .wz-extend .wz-field {
    flex: 1 1 220px;
  }

  .wz-card > .wz-button {
    align-self: flex-start;
  }

  .wz-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .wz-footer .wz-button-primary {
    margin-left: auto;
  }

  .wz-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 38px;
    padding: 0 15px;
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.text};
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease,
      transform 140ms ease, box-shadow 140ms ease;
  }

  .wz-button:hover:not(:disabled) {
    border-color: ${Colors.navy};
    color: ${Colors.navy};
    box-shadow: ${ShadowCard};
  }

  .wz-button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .wz-button:focus-visible {
    outline: none;
    border-color: ${Colors.red};
    box-shadow: ${FocusRing};
  }

  .wz-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wz-button-primary {
    background: ${Colors.red};
    border-color: ${Colors.red};
    color: ${Colors.white};
    box-shadow: 0 1px 3px rgba(217, 45, 32, 0.32);
  }

  .wz-button-primary:hover:not(:disabled) {
    background: ${Colors.redDark};
    border-color: ${Colors.redDark};
    color: ${Colors.white};
    box-shadow: 0 4px 12px -4px rgba(180, 35, 24, 0.5);
  }

  .wz-button-danger {
    background: ${RedTint};
    border-color: #fda29b;
    color: ${Colors.redDark};
  }

  .wz-button-danger:hover:not(:disabled) {
    background: ${Colors.redLight};
    border-color: ${Colors.red};
    color: ${Colors.redDark};
  }

  .wz-button-ghost {
    background: ${Colors.white};
    border-color: ${Colors.border};
    color: ${Colors.text};
  }

  .wz-button-soft {
    background: ${Colors.blueLight};
    border-color: #b5d8fb;
    color: ${Colors.blueDark};
    box-shadow: 0 1px 2px rgba(21, 112, 239, 0.12);
  }

  .wz-button-soft:hover:not(:disabled) {
    background: #bcdcfb;
    border-color: ${Colors.blue};
    color: ${Colors.blueDark};
  }

  .wz-spin {
    animation: wz-spin 900ms linear infinite;
  }

  @keyframes wz-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wz *,
    .wz *::before,
    .wz *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  @media (max-width: 720px) {
    .wz {
      gap: 16px;
    }

    .wz-card {
      padding: 20px 18px;
    }

    .wz-field-row,
    .wz-message-grid {
      grid-template-columns: 1fr;
    }

    .wz-pinbox {
      gap: 7px;
    }

    .wz-pinbox-digit {
      width: 42px;
      height: 54px;
      font-size: 20px;
    }

    .wz-footer {
      gap: 10px;
    }

    .wz-footer .wz-button {
      flex: 1 1 auto;
    }

    .wz-footer .wz-button-primary {
      margin-left: 0;
    }
  }
`;
