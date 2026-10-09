import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { CircleDot, Eraser, Undo2 } from "lucide-react";

import { Console, ConsoleTokens } from "../styles/dushani-consoleTheme";
import type { Coordinate } from "../types/warning";
import { pointInDistrict, polygonAreaSqKm } from "../utils/dushani-geo";

interface TargetMapProps {
  district: string;
  rings: Coordinate[][];
  polygon: Coordinate[];
  mode: "district" | "custom";
  onPolygonChange: (next: Coordinate[]) => void;
  readOnly?: boolean;
}

const SRI_LANKA_CENTER = [7.8731, 80.7718] as [number, number];

const Hairline = Console.line;
const Divider = Console.lineSoft;
const Surface = Console.surfaceAlt;
const Card = Console.surface;
const Ink = Console.ink;
const InkDim = Console.inkDim;
const Line = Console.line;
const RedTint = Console.redTint;
const RedText = Console.redInk;
const ShadowCard = ConsoleTokens.ShadowCard;
const FocusRing = ConsoleTokens.FocusRing;

/**
 * The one place a target area is chosen. The outline it draws and the district
 * named in the dropdown come from the same boundary asset, and a click outside
 * that outline is refused here as well as on the server.
 */
export default function TargetMap({
  district,
  rings,
  polygon,
  mode,
  onPolygonChange,
  readOnly = false,
}: TargetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const districtLayerRef = useRef<L.LayerGroup | null>(null);
  const targetLayerRef = useRef<L.LayerGroup | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      SRI_LANKA_CENTER,
      8
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    districtLayerRef.current = L.layerGroup().addTo(map);
    targetLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      districtLayerRef.current = null;
      targetLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = districtLayerRef.current;

    if (!layer) {
      return;
    }

    layer.clearLayers();

    const bounds: [number, number][] = [];

    for (const ring of rings) {
      const latLngs = ring.map(
        (point) => [point.lat, point.lng] as [number, number]
      );

      bounds.push(...latLngs);
      L.polygon(latLngs, {
        color: Console.blueSoft,
        weight: 2,
        dashArray: "6 4",
        fillColor: Console.blue,
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(layer);
    }

    if (mapRef.current && bounds.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [24, 24] });
    }
  }, [district, rings]);

  useEffect(() => {
    const layer = targetLayerRef.current;

    if (!layer) {
      return;
    }

    layer.clearLayers();

    if (mode !== "custom" || polygon.length === 0) {
      return;
    }

    if (polygon.length >= 3) {
      L.polygon(
        polygon.map((point) => [point.lat, point.lng] as [number, number]),
        {
          color: Console.red,
          weight: 2,
          fillColor: Console.red,
          fillOpacity: 0.22,
        }
      ).addTo(layer);
    } else {
      L.polyline(
        polygon.map((point) => [point.lat, point.lng] as [number, number]),
        { color: Console.red, weight: 2 }
      ).addTo(layer);
    }

    polygon.forEach((point, index) => {
      L.circleMarker([point.lat, point.lng], {
        radius: 8,
        color: Console.ink,
        weight: 2,
        fillColor: Console.red,
        fillOpacity: 1,
      })
        .bindTooltip(`${index + 1}`, { permanent: true, direction: "top" })
        .addTo(layer);
    });
  }, [mode, polygon]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || readOnly || mode !== "custom") {
      return;
    }

    const handleClick = (event: L.LeafletMouseEvent) => {
      const point = { lat: event.latlng.lat, lng: event.latlng.lng };

      if (rings.length > 0 && !pointInDistrict(point, rings)) {
        setHint(
          `That spot is outside ${district} District. Draw the area inside the highlighted boundary.`
        );
        return;
      }

      setHint(null);
      onPolygonChange([...polygon, point]);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [district, mode, onPolygonChange, polygon, readOnly, rings]);

  const area = polygonAreaSqKm(polygon);

  return (
    <div className="target-map">
      <div className="target-map-toolbar">
        <span className="target-map-mode">
          <CircleDot size={14} />
          {mode === "custom"
            ? `Click the map to add corners (${polygon.length} placed)`
            : `${district} District - whole district will be targeted`}
        </span>

        {mode === "custom" && !readOnly && (
          <span className="target-map-actions">
            <button
              type="button"
              className="target-map-button"
              onClick={() => onPolygonChange(polygon.slice(0, -1))}
              disabled={polygon.length === 0}
            >
              <Undo2 size={14} /> Undo
            </button>
            <button
              type="button"
              className="target-map-button"
              onClick={() => {
                onPolygonChange([]);
                setHint(null);
              }}
              disabled={polygon.length === 0}
            >
              <Eraser size={14} /> Clear
            </button>
          </span>
        )}
      </div>

      <div ref={containerRef} className="target-map-canvas" />

      <div className="target-map-footer">
        {hint ? (
          <span className="target-map-hint target-map-hint-error">{hint}</span>
        ) : (
          <span className="target-map-hint">
            {mode === "custom" && polygon.length >= 3
              ? `Enclosed area: ${area} km². Boundary source: geoBoundaries LKA ADM2 (ODbL).`
              : "Blue dashed outline = the district you selected. Red shape = your drawn area."}
          </span>
        )}
      </div>

      <style>
        {`
          .target-map {
            border: 1px solid ${Hairline};
            border-radius: 14px;
            overflow: hidden;
            background: ${Card};
            box-shadow: ${ShadowCard};
            color: ${Ink};
            color-scheme: dark;
            text-align: left;
            font-variant-numeric: tabular-nums;
          }

          .target-map-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 11px 14px;
            border-bottom: 1px solid ${Divider};
            background: ${Surface};
            flex-wrap: wrap;
          }

          .target-map-mode {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: -0.005em;
            color: ${Ink};
          }

          .target-map-mode svg {
            color: ${Console.red};
            flex-shrink: 0;
          }

          .target-map-actions {
            display: flex;
            gap: 8px;
          }

          .target-map-button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 30px;
            padding: 0 12px;
            border: 1px solid ${Line};
            border-radius: 8px;
            background: ${Card};
            color: ${Ink};
            font-family: inherit;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
            box-shadow: none;
            transition: border-color 140ms ease, color 140ms ease,
              background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
          }

          .target-map-button:hover:not(:disabled) {
            border-color: ${Console.blueSoft};
            color: ${Console.blueInk};
            box-shadow: ${ShadowCard};
          }

          .target-map-button:active:not(:disabled) {
            transform: translateY(1px);
          }

          .target-map-button:focus-visible {
            outline: none;
            border-color: ${Console.red};
            box-shadow: ${FocusRing};
          }

          .target-map-button:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            box-shadow: none;
          }

          .target-map-canvas {
            height: 360px;
            background: ${Surface};
          }

          .target-map-footer {
            padding: 10px 14px;
            border-top: 1px solid ${Divider};
          }

          .target-map-hint {
            display: block;
            font-size: 11.5px;
            font-weight: 500;
            line-height: 1.5;
            color: ${InkDim};
          }

          .target-map-hint-error {
            padding: 9px 12px;
            border: 1px solid var(--sp-red-line, #5F1D22);
            border-radius: 9px;
            background: ${RedTint};
            color: ${RedText};
            font-weight: 700;
          }

          @media (prefers-reduced-motion: reduce) {
            .target-map,
            .target-map * {
              animation-duration: 0.01ms !important;
              transition-duration: 0.01ms !important;
            }
          }

          @media (max-width: 720px) {
            .target-map-canvas {
              height: 280px;
            }

            .target-map-toolbar {
              align-items: flex-start;
              flex-direction: column;
              gap: 10px;
            }
          }
        `}
      </style>
    </div>
  );
}
