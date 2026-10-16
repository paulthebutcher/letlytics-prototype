"use client";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { type Property, computeScore } from "@/lib/domain";
import "leaflet/dist/leaflet.css";
type Entry = { property: Property; score: ReturnType<typeof computeScore> };
function Frame({ entries }: { entries: Entry[] }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (entries.length)
        map.fitBounds(
          L.latLngBounds(entries.map((e) => [e.property.lat, e.property.lng])),
          { padding: [55, 65], maxZoom: 14, animate: false },
        );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [entries, map]);
  return null;
}
function Pins({
  entries,
  focused,
  onFocus,
}: {
  entries: Entry[];
  focused: string | null;
  onFocus: (id: string) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const groups = Object.values(
    entries.reduce<Record<string, Entry[]>>((acc, entry) => {
      (acc[entry.property.neighbourhood] ??= []).push(entry);
      return acc;
    }, {}),
  );
  if (zoom < 13)
    return (
      <>
        {groups.map((group) => {
          const best = [...group].sort(
            (a, b) => b.score.total - a.score.total,
          )[0];
          const p = best.property;
          return (
            <Marker
              key={p.neighbourhood}
              position={[p.lat, p.lng]}
              title={`${p.neighbourhood}: ${group.length} examples, top grade ${best.score.grade}. Zoom in to explore.`}
              icon={L.divIcon({
                className: `custom-pin cluster-pin ${group.some((e) => e.property.id === focused) ? "pin-focused" : ""}`,
                html: `<span class="cluster-label grade-${best.score.grade}"><b>${best.score.grade}</b><span>${group.length}</span></span><span class="cluster-name">${p.neighbourhood}</span>`,
                iconSize: [44, 38],
                iconAnchor: [22, 19],
              })}
              eventHandlers={{
                click: () => {
                  map.setView([p.lat, p.lng], 14, { animate: false });
                  onFocus(p.id);
                },
              }}
            />
          );
        })}
      </>
    );
  return (
    <>
      {entries.map(({ property: p, score: s }) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          title={`${p.neighbourhood}: grade ${s.grade}, £${Math.round(p.price / 1000)}k`}
          icon={L.divIcon({
            className: `custom-pin property-pin ${focused === p.id ? "pin-focused" : ""}`,
            html: `<span class="pin-label grade-${s.grade}"><b>${s.grade}</b></span>`,
            iconSize: [30, 32],
            iconAnchor: [15, 32],
          })}
          eventHandlers={{ click: () => onFocus(p.id) }}
        />
      ))}
    </>
  );
}
export default function MarketMap({
  entries,
  focused,
  onFocus,
}: {
  entries: Entry[];
  focused: string | null;
  onFocus: (id: string) => void;
}) {
  const [tileError, setTileError] = useState(false);
  return (
    <>
      <MapContainer
        center={[53.466, -2.235]}
        zoom={12}
        scrollWheelZoom={false}
        zoomControl={true}
        className="leaflet-map"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <Frame entries={entries} />
        <Pins entries={entries} focused={focused} onFocus={onFocus} />
      </MapContainer>
      <div className="map-hint">Area pins: top grade + home count · tap to explore</div>
      {tileError && (
        <div className="map-offline">
          <MapPin size={14} /> Map tiles unavailable. Example locations and the
          property list still work.
        </div>
      )}
    </>
  );
}
