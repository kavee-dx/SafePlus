import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

/* ------------------------------------------------------------------ *
 * The scene map — native build.
 *
 * A REAL map of the actual place. react-native-maps is not an option in
 * Expo Go (its native binary is not bundled), so we render OpenStreetMap
 * tiles inside a react-native-webview — which Expo Go does ship — with a
 * Leaflet map centred on the incident and a pulsing marker on the exact
 * spot, mirroring the officer's portal. The map is drawn non-interactive;
 * a transparent overlay catches the tap and hands the route to the maps
 * app, so the embedded map never fights the page ScrollView.
 * ------------------------------------------------------------------ */

interface MissionMapProps {
  destination: { lat: number; lng: number };
  title?: string;
  description?: string;
  onPress: () => void;
}

const MARKER = "#D92D20";
const INK = "#0B1B34";

function buildMapHtml(lat: number, lng: number): string {
  return [
    '<!DOCTYPE html><html><head>',
    '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">',
    '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>',
    "<style>",
    "html,body,#map{height:100%;margin:0;}",
    ".leaflet-container{background:#E7EEF8;}",
    ".pin{position:relative;width:22px;height:22px;border-radius:50%;background:" + MARKER + ";border:3px solid #FFFFFF;box-shadow:0 3px 8px rgba(11,27,52,0.4);}",
    ".pin::after{content:\"\";position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:2px solid " + MARKER + ";animation:ping 1.7s ease-out infinite;}",
    "@keyframes ping{0%{transform:scale(0.6);opacity:0.7}70%{transform:scale(2.3);opacity:0}100%{opacity:0}}",
    "</style></head><body>",
    '<div id="map"></div>',
    '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></' + "script>",
    "<script>",
    'var m=L.map("map",{dragging:false,zoomControl:false,scrollWheelZoom:false,touchZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,attributionControl:false});',
    "m.setView([" + lat + "," + lng + "],15);",
    'L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(m);',
    'var icon=L.divIcon({className:"",html:"<div class=pin></div>",iconSize:[22,22],iconAnchor:[11,11]});',
    "L.marker([" + lat + "," + lng + "],{icon:icon,interactive:false}).addTo(m);",
    "</" + "script></body></html>",
  ].join("");
}

export default function MissionMap({ destination, title, onPress }: MissionMapProps) {
  const html = useMemo(
    () => buildMapHtml(destination.lat, destination.lng),
    [destination.lat, destination.lng],
  );

  return (
    <View
      style={{
        height: 200,
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#D7E3F7",
        backgroundColor: "#E7EEF8",
        marginBottom: 12,
      }}
    >
      <WebView
        style={{ flex: 1, backgroundColor: "#E7EEF8" }}
        source={{ html }}
        originWhitelist={["*"]}
        scrollEnabled={false}
        overScrollMode="never"
        zoomEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
      />

      {/* Transparent tap surface: the map itself is inert, so one tap opens the route. */}
      <Pressable onPress={onPress} accessibilityRole="button" style={StyleSheet.absoluteFill}>
        {/* landmark + coordinates, labelled like a map pin */}
        <View pointerEvents="none" style={{ position: "absolute", left: 12, bottom: 12, maxWidth: "58%" }}>
          <View style={{ backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: INK, fontSize: 12.5, fontWeight: "800" }} numberOfLines={1}>
              {title ?? "Incident location"}
            </Text>
            <Text style={{ color: "#7A8699", fontSize: 10.5, fontWeight: "600", marginTop: 1 }}>
              {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
            </Text>
          </View>
        </View>

        {/* route affordance */}
        <View
          pointerEvents="none"
          className="flex-row items-center gap-1.5"
          style={{ position: "absolute", right: 12, bottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: INK }}
        >
          <Ionicons name="navigate-outline" size={13} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" }}>Open route</Text>
        </View>
      </Pressable>
    </View>
  );
}
