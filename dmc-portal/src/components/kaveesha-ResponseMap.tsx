import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Layers, Minus, Plus } from "lucide-react";

import { Colors } from "../constants/theme";
import { fetchDistrictRings } from "../services/dushani-alertApi";

/* ------------------------------------------------------------------ *
 * The response map.
 *
 * One map for the whole job: where the incident is, where each team would
 * come from, and how far. The numbered pin is the same number the ranked
 * list uses, so the officer never has to match a name against a dot.
 * ------------------------------------------------------------------ */

export type MarkerTone = "incident" | "lead" | "team" | "mission" | "done";

export interface ResponseMapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Short badge text: a rank number, or nothing. */
  badge?: string;
  title: string;
  lines?: string[];
  tone: MarkerTone;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export interface ResponseMapLine {
  from: [number, number];
  to: [number, number];
  label?: string;
  /** The recommended route is drawn solid; the rest are faint. */
  primary?: boolean;
}

interface ResponseMapProps {
  markers: ResponseMapMarker[];
  lines?: ResponseMapLine[];
  /** Draw this district's outline so people can see the operating area. */
  boundaryDistrict?: string;
  height?: number;
  fallbackCenter?: [number, number];
  caption?: string;
}

const TONE_COLORS: Record<MarkerTone, string> = {
  incident: Colors.red,
  lead: Colors.success,
  team: Colors.blue,
  mission: Colors.amber,
  done: Colors.muted,
};

const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718];

function pointOf(marker: ResponseMapMarker): [number, number] {
  return [marker.lat, marker.lng];
}

function badgeHtml(marker: ResponseMapMarker): string {
  const color = TONE_COLORS[marker.tone];
  const isIncident = marker.tone === "incident";
  const size = marker.selected ? 40 : isIncident ? 38 : 30;
  const ring = marker.selected
    ? `box-shadow:0 0 0 4px rgba(255,255,255,0.9), 0 0 0 7px ${color};`
    : "box-shadow:0 3px 10px rgba(11,31,51,0.35);";

  return `
    <div style="
      width:${size}px;height:${size}px;border-radius:999px;
      background:${color};border:2.5px solid #FFFFFF;${ring}
      display:flex;align-items:center;justify-content:center;
      color:#FFFFFF;font-family:Inter,system-ui,sans-serif;
      font-size:${isIncident ? 15 : 12.5}px;font-weight:800;line-height:1;">
      ${isIncident ? "&#9650;" : marker.badge ?? ""}
    </div>
  `;
}

export default function KaveeshaResponseMap({
  markers,
  lines = [],
  boundaryDistrict,
  height = 360,
  fallbackCenter,
  caption,
}: ResponseMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const boundaryRef = useRef<L.LayerGroup | null>(null);
  const linkRef = useRef<L.LayerGroup | null>(null);
  const pinRef = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef<ResponseMapMarker["onSelect"]>(undefined);

  const [boundaryNote, setBoundaryNote] = useState<string | null>(null);

  useEffect(() => {
    selectRef.current = markers.find((marker) => marker.selected)?.onSelect;
  }, [markers]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
    }).setView(fallbackCenter ?? SRI_LANKA_CENTER, 8);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);

    L.control
      .zoom({ position: "bottomright" })
      .remove()
      .addTo(map);

    boundaryRef.current = L.layerGroup().addTo(map);
    linkRef.current = L.layerGroup().addTo(map);
    pinRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      boundaryRef.current = null;
      linkRef.current = null;
      pinRef.current = null;
    };
  }, [fallbackCenter]);

  // The district outline, so a pin outside the line is obviously mutual aid.
  useEffect(() => {
    const layer = boundaryRef.current;

    if (!layer) return;

    layer.clearLayers();

    const name = boundaryDistrict?.trim();

    if (!name) return;

    let cancelled = false;

    fetchDistrictRings(name)
      .then((rings) => {
        if (cancelled || !boundaryRef.current) return;

        for (const ring of rings) {
          L.polygon(ring.map((point) => [point.lat, point.lng] as [number, number]), {
            color: Colors.blue,
            weight: 1.6,
            dashArray: "6 5",
            fillColor: Colors.blueLight,
            fillOpacity: 0.12,
            interactive: false,
          }).addTo(boundaryRef.current);
        }

        setBoundaryNote(null);
      })
      .catch(() => {
        if (!cancelled) setBoundaryNote(`${name} District outline is unavailable.`);
      });

    return () => {
      cancelled = true;
    };
  }, [boundaryDistrict]);

  // Route lines: the recommended team's journey is solid, the others faint.
  useEffect(() => {
    const layer = linkRef.current;

    if (!layer) return;

    layer.clearLayers();

    for (const line of lines) {
      L.polyline([line.from, line.to], {
        color: line.primary ? Colors.success : Colors.blue,
        weight: line.primary ? 3.5 : 1.8,
        opacity: line.primary ? 0.85 : 0.35,
        dashArray: line.primary ? undefined : "7 7",
        interactive: false,
      }).addTo(layer);

      if (line.label) {
        const mid: [number, number] = [
          (line.from[0] + line.to[0]) / 2,
          (line.from[1] + line.to[1]) / 2,
        ];

        L.marker(mid, {
          interactive: false,
          icon: L.divIcon({
            className: "krm-distance",
            html: `<span style="
              background:rgba(255,255,255,0.94);border:1px solid ${Colors.border};
              border-radius:999px;padding:2px 8px;font-family:Inter,system-ui,sans-serif;
              font-size:10.5px;font-weight:800;color:${Colors.navy};white-space:nowrap;">
              ${line.label}</span>`,
            iconSize: [60, 20],
            iconAnchor: [30, 10],
          }),
        }).addTo(layer);
      }
    }
  }, [lines]);

  // Pins, with the incident in the middle of the frame.
  useEffect(() => {
    const layer = pinRef.current;

    if (!layer) return;

    layer.clearLayers();

    if (markers.length === 0) return;

    const bounds: [number, number][] = [];

    for (const marker of markers) {
      const position = pointOf(marker);

      bounds.push(position);

      const icon = L.divIcon({
        className: "krm-pin",
        html: badgeHtml(marker),
        iconSize: [marker.selected ? 40 : 38, marker.selected ? 40 : 38],
        iconAnchor: marker.selected ? [20, 20] : [19, 19],
      });

      const pin = L.marker(position, { icon, zIndexOffset: marker.tone === "incident" ? 600 : 300 });

      pin.bindPopup(
        `<strong>${marker.title}</strong>${(marker.lines ?? [])
          .map((line) => `<br/><span>${line}</span>`)
          .join("")}`,
        { closeButton: false, offset: [0, -6] }
      );

      if (marker.onSelect) {
        pin.on("click", () => {
          selectRef.current = marker.onSelect;
          marker.onSelect?.(marker.id);
        });
      }

      pin.addTo(layer);
    }

    if (mapRef.current && bounds.length > 0) {
      const box = L.latLngBounds(bounds);

      mapRef.current.fitBounds(box, {
        padding: [42, 42],
        maxZoom: box.getNorth() === box.getSouth() ? 13 : 14,
      });
    }
  }, [markers]);

  const legend = useMemo(() => {
    const tones: [MarkerTone, string][] = [
      ["incident", "Incident"],
      ["lead", "Best fit"],
      ["team", "Other teams"],
      ["mission", "On mission"],
    ];

    return tones.filter(([tone]) => markers.some((marker) => marker.tone === tone));
  }, [markers]);

  return (
    <div className="krm-card">
      <div className="krm-bar">
        <span className="krm-bar-title">
          <Layers size={14} />
          {caption ?? "Response map"}
        </span>

        {legend.length > 0 && (
          <span className="krm-legend">
            {legend.map(([tone, label]) => (
              <span key={tone} className="krm-legend-item">
                <i style={{ background: TONE_COLORS[tone] }} />
                {label}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="krm-canvas-wrap" style={{ height }}>
        <div ref={containerRef} className="krm-canvas" />

        {markers.length === 0 && (
          <div className="krm-blank">
            <Plus size={15} />
            <span>Nothing to plot yet — a team needs a base location and the incident needs a map point.</span>
          </div>
        )}
      </div>

      {boundaryNote && (
        <div className="krm-foot">
          <Minus size={13} />
          {boundaryNote}
        </div>
      )}

      <style>{RESPONSE_MAP_CSS}</style>
    </div>
  );
}

const RESPONSE_MAP_CSS = `
  .krm-card {
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    overflow: hidden;
    background: ${Colors.white};
  }

  .krm-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 10px 14px;
    border-bottom: 1px solid ${Colors.border};
    background: ${Colors.background};
  }

  .krm-bar-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 800;
    color: ${Colors.navy};
  }

  .krm-bar-title svg { color: ${Colors.blue}; }

  .krm-legend {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .krm-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: ${Colors.muted};
  }

  .krm-legend-item i {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    border: 2px solid ${Colors.white};
    box-shadow: 0 0 0 1px ${Colors.border};
  }

  .krm-canvas-wrap { position: relative; }

  .krm-canvas { width: 100%; height: 100%; }

  .krm-blank {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
    background: rgba(245, 247, 250, 0.86);
    color: ${Colors.muted};
    font-size: 12px;
    line-height: 1.6;
  }

  .krm-foot {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 14px;
    border-top: 1px solid ${Colors.border};
    font-size: 11.5px;
    color: ${Colors.muted};
  }

  .krm-pin, .krm-distance { background: transparent; border: none; }

  .krm-distance span { box-shadow: 0 2px 8px rgba(11, 31, 51, 0.12); }

  .leaflet-popup-content-wrapper {
    border-radius: 12px;
    box-shadow: 0 12px 28px rgba(11, 31, 51, 0.18);
  }

  .leaflet-popup-content {
    margin: 11px 14px;
    font-family: Inter, system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: ${Colors.navy};
  }

  .leaflet-popup-content span { color: ${Colors.muted}; font-size: 11.5px; }
`;
