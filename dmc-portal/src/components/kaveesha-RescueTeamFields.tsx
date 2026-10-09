import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Check,
  Compass,
  Eraser,
  LocateFixed,
  Loader2,
  MapPin,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import {
  CAPABILITY_ICONS,
  EQUIPMENT_ICONS,
  TEAM_CAPABILITIES,
  TEAM_EQUIPMENT,
  toList,
  type VerifiedOrganization,
} from "../constants/kaveesha-rescueTeamOptions";
import { fetchDistrictRings, resolveDistrictAt } from "../services/dushani-alertApi";

/* ------------------------------------------------------------------ *
 * Team affiliation switch
 * ------------------------------------------------------------------ */

const AFFILIATIONS: {
  value: string;
  title: string;
  body: string;
  verifier: string;
  icon: LucideIcon;
}[] = [
  {
    value: "ORGANIZATION",
    title: "Organization",
    body: "My team belongs to a rescue organization that is already verified on SafePlus.",
    verifier: "Approved by the organization admin",
    icon: Building2,
  },
  {
    value: "INDEPENDENT",
    title: "Independent / Community",
    body: "My team is a community response team and is not part of any organization.",
    verifier: "Approved by a DMC Super Admin",
    icon: Users,
  },
];

export function AffiliationToggle({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="rtf-field field-span">
      <span className="rtf-label">Team affiliation *</span>

      <div className="rtf-aff-grid">
        {AFFILIATIONS.map((option) => {
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={`rtf-aff-card ${active ? "rtf-aff-card-on" : ""}`}
              onClick={() => onChange(option.value)}
              aria-pressed={active}
            >
              <span className="rtf-aff-icon">
                <option.icon size={18} />
              </span>

              <span className="rtf-aff-body">
                <span className="rtf-aff-title">{option.title}</span>
                <span className="rtf-aff-text">{option.body}</span>
                <span className="rtf-aff-verifier">
                  <BadgeCheck size={13} />
                  {option.verifier}
                </span>
              </span>

              <span className="rtf-aff-radio">
                {active && <Check size={11} />}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <span className="field-error">
          <AlertCircle size={12} />
          {error}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Chip style multi select (capabilities / equipment)
 * ------------------------------------------------------------------ */

export function ChipGroupField({
  id,
  label,
  caption,
  options,
  icons,
  value,
  onChange,
  onBlur,
  error,
  optional,
}: {
  id: string;
  label: string;
  caption: string;
  options: readonly string[];
  icons: Record<string, LucideIcon>;
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
  error?: string;
  optional?: boolean;
}) {
  const picked = toList(value);

  const toggle = (option: string) => {
    const next = picked.includes(option)
      ? picked.filter((item) => item !== option)
      : [...picked, option];

    onChange(next.join(","));
    onBlur();
  };

  return (
    <div className="rtf-field field-span" id={id}>
      <div className="rtf-label-row">
        <span className="rtf-label">{label}</span>
        {optional ? (
          <span className="optional-tag">Optional</span>
        ) : (
          <span className="rtf-count">
            {picked.length} selected
          </span>
        )}
      </div>

      <p className="rtf-caption">{caption}</p>

      <div className="rtf-chips" role="group" aria-label={label}>
        {options.map((option) => {
          const Icon = icons[option] ?? Check;
          const active = picked.includes(option);

          return (
            <button
              key={option}
              type="button"
              className={`rtf-chip ${active ? "rtf-chip-on" : ""}`}
              onClick={() => toggle(option)}
              aria-pressed={active}
            >
              <span className="rtf-chip-box">
                {active ? <Check size={11} /> : null}
              </span>
              <Icon size={15} />
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <span className="field-error">
          <AlertCircle size={12} />
          {error}
        </span>
      )}
    </div>
  );
}

export function CapabilityField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
  error?: string;
}) {
  return (
    <ChipGroupField
      id="capabilities"
      label="Capabilities *"
      caption="What this team can be tasked to do. Pick at least one."
      options={TEAM_CAPABILITIES}
      icons={CAPABILITY_ICONS}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
    />
  );
}

export function EquipmentField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
  error?: string;
}) {
  return (
    <ChipGroupField
      id="equipment"
      label="Equipment"
      caption="The kit this team can deploy with. Leave empty if nothing is listed."
      options={TEAM_EQUIPMENT}
      icons={EQUIPMENT_ICONS}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      optional
    />
  );
}

/* ------------------------------------------------------------------ *
 * Verified organization picker
 * ------------------------------------------------------------------ */

export function VerifiedOrganizationField({
  organizations,
  loading,
  value,
  onPick,
  onBlur,
  error,
}: {
  organizations: VerifiedOrganization[];
  loading: boolean;
  value: string;
  onPick: (organization: VerifiedOrganization | null) => void;
  onBlur: () => void;
  error?: string;
}) {
  const selected = organizations.find((row) => row.registrationId === value) ?? null;

  return (
    <div className="rtf-field field-span">
      <div className="rtf-label-row">
        <span className="rtf-label">Organization *</span>
        <span className="rtf-count">
          <BadgeCheck size={12} />
          Verified organizations only
        </span>
      </div>

      <div className={`input-wrapper ${error ? "invalid" : ""}`}>
        <Building2 size={17} />
        <select
          id="organizationName"
          value={value}
          disabled={loading}
          onChange={(event) => {
            const chosen = organizations.find(
              (row) => row.registrationId === event.target.value
            );
            onPick(chosen ?? null);
          }}
          onBlur={onBlur}
        >
          <option value="">
            {loading
              ? "Loading verified organizations..."
              : "Select a verified organization"}
          </option>
          {organizations.map((organization) => (
            <option
              key={organization.registrationId}
              value={organization.registrationId}
            >
              {organization.name} — {organization.registrationId}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <span className="field-error">
          <AlertCircle size={12} />
          {error}
        </span>
      )}

      {!loading && organizations.length === 0 && (
        <div className="rtf-org-empty">
          <TriangleAlert size={15} />
          <span>
            No rescue organization has been verified yet. Choose{" "}
            <strong>Independent / Community</strong> above and a Super Admin will
            verify your team directly.
          </span>
        </div>
      )}

      {selected && (
        <div className="rtf-org-strip">
          <span className="rtf-org-chip">{selected.type}</span>
          <span className="rtf-org-chip">{selected.district} District</span>
          <span className="rtf-org-chip">ID {selected.registrationId}</span>
          <span className="rtf-org-note">
            This organization was verified by a Super Admin, so its teams can be
            approved by its own admin.
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Base location map picker
 * ------------------------------------------------------------------ */

const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718];

export function LocationPickerField({
  latitude,
  longitude,
  district,
  onPick,
  error,
}: {
  latitude: string;
  longitude: string;
  district: string;
  onPick: (next: { baseLatitude: string; baseLongitude: string }) => void;
  error?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const ringsRef = useRef<L.LayerGroup | null>(null);
  const pinRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);

  const [hint, setHint] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(SRI_LANKA_CENTER, 8);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);

    ringsRef.current = L.layerGroup().addTo(map);
    pinRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on("click", (event: L.LeafletMouseEvent) => {
      pickRef.current({
        baseLatitude: event.latlng.lat.toFixed(6),
        baseLongitude: event.latlng.lng.toFixed(6),
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      ringsRef.current = null;
      pinRef.current = null;
    };
  }, []);

  // Draw the chosen district so the leader can see the operating area.
  useEffect(() => {
    const layer = ringsRef.current;

    if (!layer) return;

    layer.clearLayers();

    const name = district.trim();

    if (!name) return;

    let cancelled = false;

    fetchDistrictRings(name)
      .then((rings) => {
        if (cancelled || !ringsRef.current) return;

        const bounds: [number, number][] = [];

        for (const ring of rings) {
          const latLngs = ring.map(
            (point) => [point.lat, point.lng] as [number, number]
          );

          bounds.push(...latLngs);

          L.polygon(latLngs, {
            color: Colors.blue,
            weight: 2,
            dashArray: "6 4",
            fillColor: Colors.blueLight,
            fillOpacity: 0.18,
            interactive: false,
          }).addTo(ringsRef.current);
        }

        if (bounds.length > 0 && mapRef.current) {
          mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [28, 28] });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHint(`Could not load the ${name} District outline on the map.`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [district]);

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasPoint =
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  // Keep the pin in step with the picked coordinates.
  useEffect(() => {
    const layer = pinRef.current;

    if (!layer) return;

    layer.clearLayers();

    if (!hasPoint) return;

    L.circleMarker([lat, lng], {
      radius: 16,
      color: Colors.blue,
      weight: 1,
      fillColor: Colors.blue,
      fillOpacity: 0.18,
      interactive: false,
    }).addTo(layer);

    L.circleMarker([lat, lng], {
      radius: 8,
      color: Colors.white,
      weight: 3,
      fillColor: Colors.blueDark,
      fillOpacity: 1,
    }).addTo(layer);

    mapRef.current?.panInside?.([lat, lng]);
  }, [hasPoint, lat, lng]);

  // Name the district the pin actually falls in. The label only renders while
  // a point exists, so there is nothing to clear here when it is removed.
  useEffect(() => {
    if (!hasPoint) return;

    let cancelled = false;

    resolveDistrictAt(lat, lng)
      .then((name) => {
        if (!cancelled) setResolved(name);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });

    return () => {
      cancelled = true;
    };
  }, [hasPoint, lat, lng]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setHint("This browser cannot share a location. Tap the map instead.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);

        const point = {
          baseLatitude: position.coords.latitude.toFixed(6),
          baseLongitude: position.coords.longitude.toFixed(6),
        };

        mapRef.current?.setView(
          [position.coords.latitude, position.coords.longitude],
          13
        );

        pickRef.current(point);
      },
      () => {
        setLocating(false);
        setHint(
          "Your device location was not shared. Tap the map to place the base."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="rtf-field field-span">
      <div className="rtf-label-row">
        <span className="rtf-label">Base location *</span>
        {hasPoint ? (
          <span className="rtf-count rtf-count-on">
            <MapPin size={12} />
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
        ) : (
          <span className="rtf-count">
            <MapPin size={12} />
            No point chosen yet
          </span>
        )}
      </div>

      <p className="rtf-caption">
        Tap the map where this team stages from. There is no need to type
        latitude and longitude by hand.
      </p>

      <div className={`rtf-map-card ${error ? "rtf-map-card-invalid" : ""}`}>
        <div className="rtf-map-bar">
          <span className="rtf-map-mode">
            <Compass size={14} />
            {hasPoint
              ? "Base location placed — tap again to move it"
              : `${district.trim() ? `${district} District shown` : "Click the map to drop the base pin"}`}
          </span>

          <span className="rtf-map-actions">
            <button
              type="button"
              className="rtf-map-button"
              onClick={useMyLocation}
              disabled={locating}
            >
              {locating ? (
                <Loader2 size={14} className="rtf-spin" />
              ) : (
                <LocateFixed size={14} />
              )}
              Use my location
            </button>
            <button
              type="button"
              className="rtf-map-button"
              onClick={() => {
                onPick({ baseLatitude: "", baseLongitude: "" });
                setHint(null);
              }}
              disabled={!hasPoint}
            >
              <Eraser size={14} />
              Clear
            </button>
          </span>
        </div>

        <div ref={containerRef} className="rtf-map-canvas" />

        <div className="rtf-map-foot">
          {error ? (
            <span className="rtf-map-note rtf-map-note-error">
              <AlertCircle size={13} />
              {error}
            </span>
          ) : (
            <span className="rtf-map-note">
              <MapPin size={13} />
              {hasPoint
                ? resolved
                  ? `This point sits inside ${resolved} District.`
                  : "This point is outside the district boundary lines."
                : "The pin is saved as coordinates, so dispatch can map it."}
            </span>
          )}
        </div>
      </div>

      {hint && (
        <span className="rtf-map-hint">
          <TriangleAlert size={12} />
          {hint}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared styles for these team registration fields
 * ------------------------------------------------------------------ */

export const RESCUE_TEAM_FIELDS_CSS = `
  .rtf-field {
    display: flex;
    flex-direction: column;
    grid-column: 1 / -1;
  }

  .rtf-label-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 9px;
  }

  .rtf-label {
    font-size: 13.5px;
    font-weight: 700;
    color: ${Colors.navy};
  }

  .rtf-count {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 11px;
    border-radius: 999px;
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
    color: ${Colors.muted};
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  .rtf-count-on {
    background: ${Colors.blueLight};
    border-color: ${Colors.blue};
    color: ${Colors.blueDark};
  }

  .rtf-caption {
    font-size: 12.5px;
    color: ${Colors.muted};
    line-height: 1.55;
    margin: -2px 0 14px;
  }

  .rtf-aff-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 14px;
  }

  .rtf-aff-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 18px;
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    background: ${Colors.white};
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 170ms ease,
      box-shadow 170ms ease,
      background 170ms ease,
      transform 170ms ease;
  }

  .rtf-aff-card:hover {
    border-color: ${Colors.blue};
    transform: translateY(-2px);
    box-shadow: 0 14px 30px rgba(21, 112, 239, 0.14);
  }

  .rtf-aff-card-on {
    border-color: ${Colors.blue};
    background: rgba(21, 112, 239, 0.05);
    box-shadow: 0 14px 30px rgba(21, 112, 239, 0.14);
  }

  .rtf-aff-icon {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 12px;
    background: ${Colors.blueLight};
    color: ${Colors.blue};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rtf-aff-card-on .rtf-aff-icon {
    background: ${Colors.blue};
    color: ${Colors.white};
  }

  .rtf-aff-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .rtf-aff-title {
    font-size: 14px;
    font-weight: 800;
    color: ${Colors.navy};
    letter-spacing: -0.01em;
  }

  .rtf-aff-text {
    font-size: 12.5px;
    color: ${Colors.muted};
    line-height: 1.6;
  }

  .rtf-aff-verifier {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 800;
    color: ${Colors.blueDark};
  }

  .rtf-aff-radio {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 2px solid ${Colors.border};
    background: ${Colors.white};
    color: ${Colors.white};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rtf-aff-card-on .rtf-aff-radio {
    border-color: ${Colors.blue};
    background: ${Colors.blue};
  }

  .rtf-chips {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 10px;
  }

  .rtf-chip {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 12px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 13px;
    background: ${Colors.background};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
    transition:
      border-color 160ms ease,
      background 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .rtf-chip:hover {
    border-color: ${Colors.blue};
    transform: translateY(-1px);
  }

  .rtf-chip-on {
    background: ${Colors.navy};
    border-color: ${Colors.navy};
    color: ${Colors.white};
  }

  .rtf-chip-box {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
    border-radius: 6px;
    border: 1.5px solid ${Colors.border};
    background: ${Colors.white};
    color: ${Colors.navy};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rtf-chip-on .rtf-chip-box {
    border-color: ${Colors.success};
    background: ${Colors.success};
    color: ${Colors.white};
  }

  .rtf-org-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 12px;
    padding: 13px 15px;
    border-radius: 14px;
    background: rgba(18, 183, 106, 0.09);
    border: 1px solid rgba(18, 183, 106, 0.4);
  }

  .rtf-org-chip {
    padding: 5px 11px;
    border-radius: 999px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.navy};
    font-size: 11.5px;
    font-weight: 800;
  }

  .rtf-org-note {
    font-size: 11.5px;
    color: ${Colors.muted};
    line-height: 1.55;
    flex: 1;
    min-width: 200px;
  }

  .rtf-org-empty {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 12px;
    padding: 14px 16px;
    border-radius: 14px;
    background: ${Colors.amberLight};
    border: 1px solid ${Colors.amber};
    color: ${Colors.amberText};
    font-size: 12px;
    line-height: 1.6;
  }

  .rtf-map-card {
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    overflow: hidden;
    background: ${Colors.white};
  }

  .rtf-map-card-invalid {
    border-color: ${Colors.red};
  }

  .rtf-map-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 11px 14px;
    border-bottom: 1px solid ${Colors.border};
    background: ${Colors.background};
  }

  .rtf-map-mode {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    color: ${Colors.navy};
  }

  .rtf-map-mode svg { color: ${Colors.blue}; }

  .rtf-map-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rtf-map-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 13px;
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease;
  }

  .rtf-map-button:hover:not(:disabled) {
    border-color: ${Colors.blue};
    color: ${Colors.blue};
  }

  .rtf-map-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rtf-map-canvas {
    height: 340px;
  }

  .rtf-map-foot {
    padding: 11px 14px;
    border-top: 1px solid ${Colors.border};
  }

  .rtf-map-note {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    color: ${Colors.muted};
    line-height: 1.5;
  }

  .rtf-map-note-error {
    color: ${Colors.redDark};
    font-weight: 700;
  }

  .rtf-map-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 9px;
    font-size: 11.5px;
    font-weight: 600;
    color: ${Colors.amberText};
  }

  .rtf-spin { animation: rtf-turn 900ms linear infinite; }

  @keyframes rtf-turn {
    to { transform: rotate(360deg); }
  }
`;
