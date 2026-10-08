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
  AlertApiError,
  broadcastWarning,
  createDraft,
  fetchDistricts,
  fetchDistrictRings,
  fetchVerifiedReports,
  previewAudience,
  standDownWarning,
  synthesizeMessages,
  updateDraft,
} from "../services/dushani-alertApi";
import TargetMap from "./dushani-TargetMap";

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

const STEPS = ["Report", "Target area", "Message", "Authorize", "Delivery"];

function preferredDistrict(items: DistrictBoundary[]): string {
  return items.some((item) => item.district === "Colombo")
    ? "Colombo"
    : (items[0]?.district ?? "");
}

const AUDIENCE_DEBOUNCE_MS = 450;

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
  const [generating, setGenerating] = useState(false);

  // Step 4/5 — authorization and telemetry.
  const [warning, setWarning] = useState<DisasterWarning | null>(null);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<string[]>(["", "", "", "", "", ""]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcast, setBroadcast] = useState<DisasterWarning | null>(null);
  const [standDownBusy, setStandDownBusy] = useState(false);

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
      reportId,
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
    }),
    [
      channels,
      englishMessage,
      hazardType,
      mode,
      polygon,
      reportId,
      safetyInstructions,
      severityLevel,
      sinhalaMessage,
      targetDistrict,
      tamilMessage,
    ]
  );

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
      return (
        englishMessage.trim().length >= 20 &&
        sinhalaMessage.trim().length >= 15 &&
        tamilMessage.trim().length >= 15 &&
        (channels.push || channels.sms || channels.siren)
      );
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
        ? await updateDraft(warning.id, payload)
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
      const result = await broadcastWarning(draft.id, pin.join(""));

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

  const handleStandDown = async () => {
    if (!broadcast) {
      return;
    }

    setStandDownBusy(true);
    setError(null);

    try {
      setBroadcast(await standDownWarning(broadcast.id));
    } catch (standDownError) {
      setError(messageOf(standDownError));
    } finally {
      setStandDownBusy(false);
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
            generating={generating}
            saving={saving}
            hasDraft={Boolean(warning)}
            fieldErrors={fieldErrors}
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
        <StepDelivery warning={broadcast} />
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
            className="wz-button wz-button-danger"
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

          {broadcast.status === "ACTIVE" && (
            <button
              type="button"
              className="wz-button wz-button-danger"
              onClick={() => void handleStandDown()}
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

  return (
    <section className="wz-card">
      <h2 className="wz-card-title">Which report is this warning for?</h2>
      <p className="wz-card-lead">
        Every warning is linked to one verified ground report. The link is
        enforced by the database, not just by this screen.
      </p>

      <div className="wz-report-list">
        {reports.map((report) => (
          <button
            type="button"
            key={report.id}
            className={`wz-report ${report.id === selectedId ? "wz-report-selected" : ""}`}
            onClick={() => onSelect(report)}
          >
            <span className="wz-report-radio">
              {report.id === selectedId ? <CheckCircle size={18} /> : null}
            </span>
            <span className="wz-report-body">
              <span className="wz-report-headline">
                {humanize(report.hazardType)} · {humanize(report.severityLevel)} ·{" "}
                {report.locationDistrict}
              </span>
              <span className="wz-report-desc">{report.description}</span>
              <span className="wz-report-meta">
                {report.reportId} · reported by {report.reporterName ?? "a citizen"} ·{" "}
                {relativeTime(report.createdAt)}
                {report.warningCount ? ` · ${report.warningCount} warning(s) issued` : ""}
              </span>
            </span>
          </button>
        ))}
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
  generating: boolean;
  saving: boolean;
  hasDraft: boolean;
  fieldErrors: Record<string, string>;
  onHazardTypeChange: (value: string) => void;
  onSeverityChange: (value: SeverityLevel) => void;
  onSafetyChange: (value: string) => void;
  onEnglishChange: (value: string) => void;
  onSinhalaChange: (value: string) => void;
  onTamilChange: (value: string) => void;
  onChannelsChange: (value: ChannelSelection) => void;
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

      <button
        type="button"
        className="wz-button wz-button-ghost"
        onClick={props.onSaveDraft}
        disabled={props.saving}
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
  ].filter(Boolean);

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
        <SummaryRow
          label="Verified report"
          value={report ? `${report.reportId} · ${humanize(report.hazardType)}` : "—"}
        />
        <SummaryRow
          label="Target"
          value={
            warning
              ? `${warning.targetDistrict}${
                  warning.gisPolygon?.source === "CUSTOM" ? " (drawn polygon)" : " (whole district)"
                }`
              : "—"
          }
        />
        <SummaryRow label="Severity" value={humanize(severityLevel)} />
        <SummaryRow
          label="Audience"
          value={
            warning
              ? `${warning.audienceCount} accounts (${warning.smsRecipientCount} SMS)`
              : audience
                ? `${audience.audienceCount} accounts`
                : "—"
          }
        />
        <SummaryRow label="Channels" value={activeChannels.join(" · ") || "None"} />
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="wz-summary-row">
      <span className="wz-summary-label">{label}</span>
      <span className="wz-summary-value">{value}</span>
    </div>
  );
}

function StepDelivery({ warning }: { warning: DisasterWarning }) {
  const logs = warning.broadcastLogs ?? [];

  return (
    <section className="wz-card">
      <div className="wz-delivered">
        <CheckCircle size={30} />
        <div>
          <h2 className="wz-card-title">Broadcast dispatched</h2>
          <p className="wz-card-lead">
            {warning.warningId} · {warning.targetDistrict} District ·{" "}
            {warning.audienceCount} accounts · status {humanize(warning.status)}
          </p>
        </div>
      </div>

      <div className="wz-channel-results">
        {logs.map((log) => (
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
                {humanize(log.channelType)}
              </span>
              <span className="wz-result-status">{humanize(log.status)}</span>
            </div>
            <div className="wz-result-metrics">
              <span>{log.targetCount} targeted</span>
              <span>{log.deliveryCount} delivered</span>
              <span>{log.failureCount} failed</span>
            </div>
            {log.errorMessage && (
              <p className="wz-result-error">{log.errorMessage}</p>
            )}
            {!log.errorMessage && log.status !== "SUCCESS" && (
              <p className="wz-result-note">
                {log.channelType === "siren"
                  ? "Siren relay unavailable — push and SMS still went out."
                  : "Channel reported a partial delivery."}
              </p>
            )}
          </div>
        ))}
      </div>

      {warning.expiresAt && (
        <p className="wz-help">
          This warning expires {new Date(warning.expiresAt).toLocaleString()}.
        </p>
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const WIZARD_STYLES = `
  .wz {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 940px;
  }

  .wz-steps {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: 6px;
    flex-wrap: wrap;
  }

  .wz-step {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 20px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    font-size: 12px;
    font-weight: 700;
    color: ${Colors.muted};
  }

  .wz-step-active {
    border-color: ${Colors.red};
    color: ${Colors.redDark};
    background: ${Colors.redLight};
  }

  .wz-step-done {
    border-color: ${Colors.success};
    color: #166534;
    background: #dcfce7;
  }

  .wz-step-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: currentColor;
    color: ${Colors.white};
    font-size: 10px;
    font-weight: 800;
  }

  .wz-step-done .wz-step-dot {
    background: transparent;
    color: ${Colors.success};
  }

  .wz-card {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    padding: 26px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .wz-card-title {
    margin: 0;
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.02em;
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
    padding: 13px 15px;
    border-radius: 11px;
    font-size: 13px;
    font-weight: 600;
  }

  .wz-banner-error {
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }

  .wz-state {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 22px;
    border: 1px dashed ${Colors.border};
    border-radius: 12px;
    background: ${Colors.white};
    color: ${Colors.muted};
    font-size: 13px;
  }

  .wz-empty {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    padding: 44px 26px;
    text-align: center;
    color: ${Colors.muted};
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .wz-empty h3 {
    margin: 0;
    font-size: 17px;
    color: ${Colors.text};
  }

  .wz-empty p {
    margin: 0;
    max-width: 460px;
    font-size: 13px;
    line-height: 1.6;
  }

  .wz-report-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .wz-report {
    display: flex;
    gap: 12px;
    text-align: left;
    padding: 16px;
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    background: ${Colors.white};
    cursor: pointer;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  .wz-report:hover {
    border-color: ${Colors.red};
  }

  .wz-report-selected {
    border-color: ${Colors.red};
    box-shadow: 0 0 0 3px ${Colors.redLight};
  }

  .wz-report-radio {
    color: ${Colors.red};
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 18px;
    margin-top: 2px;
  }

  .wz-report-body {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .wz-report-headline {
    font-size: 14px;
    font-weight: 800;
    color: ${Colors.text};
  }

  .wz-report-desc {
    font-size: 13px;
    color: ${Colors.text};
    line-height: 1.5;
  }

  .wz-report-meta {
    font-size: 11px;
    color: ${Colors.muted};
  }

  .wz-field-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .wz-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .wz-field label {
    font-size: 12px;
    font-weight: 700;
    color: ${Colors.text};
  }

  .wz-field select,
  .wz-field textarea {
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.text};
    font-size: 14px;
    font-family: inherit;
    padding: 11px 12px;
  }

  .wz-field select {
    height: 46px;
  }

  .wz-field textarea {
    resize: vertical;
    line-height: 1.5;
  }

  .wz-field select:focus,
  .wz-field textarea:focus {
    outline: none;
    border-color: ${Colors.red};
    box-shadow: 0 0 0 3px ${Colors.redLight};
  }

  .wz-help {
    font-size: 12px;
    color: ${Colors.muted};
    line-height: 1.5;
  }

  .wz-field-error-text {
    color: ${Colors.redDark};
    font-weight: 600;
  }

  .wz-segment {
    display: flex;
    gap: 6px;
  }

  .wz-segment-button {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 46px;
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.muted};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .wz-segment-active {
    border-color: ${Colors.navy};
    background: ${Colors.navy};
    color: ${Colors.white};
  }

  .wz-audience {
    border-top: 1px solid ${Colors.border};
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .wz-audience h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    color: ${Colors.text};
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wz-audience-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }

  .wz-stat {
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .wz-stat-value {
    font-size: 20px;
    font-weight: 800;
    color: ${Colors.text};
  }

  .wz-stat-label {
    font-size: 11px;
    color: ${Colors.muted};
    font-weight: 600;
  }

  .wz-audience-line {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${Colors.muted};
  }

  .wz-audience-ok {
    color: #166534;
  }

  .wz-audience-block {
    color: ${Colors.redDark};
  }

  .wz-message-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
  }

  .wz-channels {
    border-top: 1px solid ${Colors.border};
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .wz-channels h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
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
    gap: 9px;
    padding: 12px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    color: ${Colors.muted};
    cursor: pointer;
  }

  .wz-channel input {
    accent-color: ${Colors.red};
  }

  .wz-channel-on {
    border-color: ${Colors.red};
    color: ${Colors.redDark};
    background: ${Colors.redLight};
  }

  .wz-channel-locked {
    cursor: not-allowed;
    opacity: 0.85;
  }

  .wz-authorize {
    border-color: ${Colors.red};
  }

  .wz-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px 18px;
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    padding: 16px;
  }

  .wz-summary-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .wz-summary-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .wz-summary-value {
    font-size: 13px;
    font-weight: 700;
    color: ${Colors.text};
  }

  .wz-pinbox {
    display: flex;
    gap: 10px;
    justify-content: center;
    padding: 8px 0;
  }

  .wz-pinbox-digit {
    width: 52px;
    height: 62px;
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    text-align: center;
    font-size: 26px;
    font-weight: 800;
    color: ${Colors.text};
    background: ${Colors.white};
  }

  .wz-pinbox-digit:focus {
    outline: none;
    border-color: ${Colors.red};
    box-shadow: 0 0 0 3px ${Colors.redLight};
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
  }

  .wz-delivered {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .wz-delivered > svg {
    color: ${Colors.success};
    flex-shrink: 0;
  }

  .wz-channel-results {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .wz-result {
    border: 1px solid ${Colors.border};
    border-left-width: 4px;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .wz-result-success {
    border-left-color: ${Colors.success};
  }

  .wz-result-partial {
    border-left-color: ${Colors.amber};
  }

  .wz-result-failed,
  .wz-result-pending {
    border-left-color: ${Colors.red};
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
    color: ${Colors.text};
  }

  .wz-result-status {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${Colors.muted};
  }

  .wz-result-metrics {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 12px;
    color: ${Colors.muted};
  }

  .wz-result-error {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: ${Colors.redDark};
  }

  .wz-result-note {
    margin: 0;
    font-size: 12px;
    color: ${Colors.muted};
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
    gap: 9px;
    height: 44px;
    padding: 0 20px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .wz-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wz-button-primary {
    background: ${Colors.red};
    color: ${Colors.white};
  }

  .wz-button-primary:hover:not(:disabled) {
    background: ${Colors.redDark};
  }

  .wz-button-danger {
    background: ${Colors.red};
    color: ${Colors.white};
  }

  .wz-button-danger:hover:not(:disabled) {
    background: ${Colors.redDark};
  }

  .wz-button-ghost {
    background: ${Colors.white};
    border-color: ${Colors.border};
    color: ${Colors.text};
  }

  .wz-button-ghost:hover:not(:disabled) {
    border-color: ${Colors.navy};
    color: ${Colors.navy};
  }

  .wz-button-soft {
    align-self: flex-start;
    background: ${Colors.blueLight};
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

  @media (max-width: 720px) {
    .wz-card {
      padding: 18px;
    }

    .wz-pinbox-digit {
      width: 42px;
      height: 52px;
      font-size: 20px;
    }
  }
`;
