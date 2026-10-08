import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { CircleDot, Eraser, Undo2 } from "lucide-react";

import { Colors } from "../constants/theme";
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
        color: Colors.blue,
        weight: 2,
        dashArray: "6 4",
        fillColor: Colors.blueLight,
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
          color: Colors.red,
          weight: 2,
          fillColor: Colors.red,
          fillOpacity: 0.22,
        }
      ).addTo(layer);
    } else {
      L.polyline(
        polygon.map((point) => [point.lat, point.lng] as [number, number]),
        { color: Colors.red, weight: 2 }
      ).addTo(layer);
    }

    polygon.forEach((point, index) => {
      L.circleMarker([point.lat, point.lng], {
        radius: 8,
        color: Colors.white,
        weight: 2,
        fillColor: Colors.redDark,
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
            border: 1px solid ${Colors.border};
            border-radius: 12px;
            overflow: hidden;
            background: ${Colors.white};
          }

          .target-map-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 14px;
            border-bottom: 1px solid ${Colors.border};
            flex-wrap: wrap;
          }

          .target-map-mode {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 700;
            color: ${Colors.text};
          }

          .target-map-mode svg {
            color: ${Colors.red};
          }

          .target-map-actions {
            display: flex;
            gap: 8px;
          }

          .target-map-button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border: 1px solid ${Colors.border};
            border-radius: 8px;
            background: ${Colors.white};
            color: ${Colors.text};
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          }

          .target-map-button:hover:not(:disabled) {
            border-color: ${Colors.red};
            color: ${Colors.red};
          }

          .target-map-button:disabled {
            opacity: 0.45;
            cursor: not-allowed;
          }

          .target-map-canvas {
            height: 360px;
          }

          .target-map-footer {
            padding: 10px 14px;
            border-top: 1px solid ${Colors.border};
          }

          .target-map-hint {
            font-size: 12px;
            color: ${Colors.muted};
          }

          .target-map-hint-error {
            color: ${Colors.redDark};
            font-weight: 600;
          }
        `}
      </style>
    </div>
  );
}
