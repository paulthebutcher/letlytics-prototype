"use client";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import type { LiveProperty } from "@/lib/live-types";
import "leaflet/dist/leaflet.css";

function Frame({ properties }: { properties: LiveProperty[] }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (properties.length)
        map.fitBounds(L.latLngBounds(properties.map((p) => [p.lat, p.lng])), {
          padding: [45, 45],
          maxZoom: 14,
          animate: false,
        });
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(map.getContainer());
    return () => resize.disconnect();
  }, [properties, map]);
  return null;
}
export default function LiveMap({
  properties,
  focused,
  onFocus,
}: {
  properties: LiveProperty[];
  focused: string | null;
  onFocus: (id: string) => void;
}) {
  return (
    <MapContainer
      center={[53.48, -2.24]}
      zoom={12}
      className="live-leaflet"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Frame properties={properties} />
      {properties.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          title={`${p.address}, £${p.price.toLocaleString("en-GB")}`}
          icon={L.divIcon({
            className: "live-pin",
            html: `<span class="${focused === p.id ? "focused" : ""}">£${Math.round(p.price / 1000)}k</span>`,
            iconSize: [65, 31],
            iconAnchor: [32, 31],
          })}
          eventHandlers={{ click: () => onFocus(p.id) }}
        />
      ))}
    </MapContainer>
  );
}
