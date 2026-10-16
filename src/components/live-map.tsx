"use client";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  ScaleControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import L from "leaflet";
import type { LiveProperty } from "@/lib/live-types";
import { clusterProperties } from "@/lib/map-points";
import "leaflet/dist/leaflet.css";

function fitProperties(map: L.Map, properties: LiveProperty[]) {
  if (!properties.length) return;
  const small = map.getSize().x < 500;
  map.fitBounds(L.latLngBounds(properties.map((p) => [p.lat, p.lng])), {
    paddingTopLeft: [50, 75],
    paddingBottomRight: [70, small ? 80 : 65],
    maxZoom: 15,
    animate: false,
  });
}

function MapWorkspace({
  properties,
  focused,
  onFocus,
}: {
  properties: LiveProperty[];
  focused: string | null;
  onFocus: (id: string) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const lastGeometry = useRef("");
  const controls = useRef<HTMLDivElement>(null);
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  useEffect(() => {
    const geometry = properties
      .map((p) => `${p.id}:${p.lat}:${p.lng}`)
      .sort()
      .join("|");
    if (lastGeometry.current === geometry) return;
    lastGeometry.current = geometry;
    map.invalidateSize({ pan: false });
    fitProperties(map, properties);
  }, [map, properties]);
  useEffect(() => {
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resize.observe(map.getContainer());
    if (controls.current) {
      L.DomEvent.disableClickPropagation(controls.current);
      L.DomEvent.disableScrollPropagation(controls.current);
    }
    return () => resize.disconnect();
  }, [map]);
  useEffect(() => {
    const property = properties.find((p) => p.id === focused);
    if (property)
      map.panInside([property.lat, property.lng], {
        paddingTopLeft: [60, 85],
        paddingBottomRight: [80, 200],
        animate: false,
      });
  }, [map, focused, properties]);
  const clusters = useMemo(
    () =>
      clusterProperties(properties, (p) => map.project([p.lat, p.lng], zoom)),
    [properties, map, zoom],
  );
  return (
    <>
      <div className="live-map-tools" ref={controls}>
        <button
          onClick={() => fitProperties(map, properties)}
          disabled={!properties.length}
          title="Fit all filtered properties"
        >
          <LocateFixed size={16} /> Fit results
        </button>
      </div>
      <div className="live-map-caption">
        <MapPin size={14} />
        <span>
          <strong>{properties.length} properties</strong>
          <small>Asking prices · approximate locations</small>
        </span>
      </div>
      {!properties.length && (
        <div className="live-map-empty">
          No matching properties. Broaden your filters to explore the map.
        </div>
      )}
      {clusters.map((group) => {
        const count = group.properties.length;
        const first = group.properties[0];
        const selected = group.properties.some((p) => p.id === focused);
        const sameLocation = group.properties.every(
          (p) => p.lat === first.lat && p.lng === first.lng,
        );
        const canExpand = count > 1 && zoom < 18 && !sameLocation;
        return (
          <Marker
            key={group.properties.map((p) => p.id).join("-")}
            position={[group.lat, group.lng]}
            title={
              count > 1
                ? `${count} properties — ${canExpand ? "zoom in" : "choose a property"}`
                : `${first.address}, £${first.price.toLocaleString("en-GB")}`
            }
            zIndexOffset={selected ? 2000 : count > 1 ? 500 : 0}
            icon={L.divIcon({
              className: "live-pin",
              html: `<span class="${selected ? "focused " : ""}${count > 1 ? "cluster" : ""}">${count > 1 ? `<b>${count}</b> homes` : `£${(first.price / 1000).toLocaleString("en-GB", { maximumFractionDigits: first.price < 100000 ? 1 : 0 })}k`}</span>`,
              iconSize: [78, 36],
              iconAnchor: [39, 18],
            })}
            eventHandlers={{
              click: () => {
                if (count === 1) onFocus(first.id);
                else if (canExpand)
                  map.fitBounds(
                    L.latLngBounds(group.properties.map((p) => [p.lat, p.lng])),
                    {
                      padding: [70, 70],
                      maxZoom: Math.min(18, zoom + 2),
                      animate: false,
                    },
                  );
              },
            }}
          >
            {count > 1 && !canExpand && (
              <Popup
                className="live-cluster-popup"
                maxWidth={290}
                maxHeight={230}
                autoPanPadding={[45, 65]}
              >
                <strong>{count} properties in this area</strong>
                <p>Locations are approximate. Choose a listing to inspect.</p>
                {group.properties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onFocus(p.id);
                      map.closePopup();
                    }}
                  >
                    <span>{p.address}</span>
                    <b>£{p.price.toLocaleString("en-GB")}</b>
                  </button>
                ))}
              </Popup>
            )}
          </Marker>
        );
      })}
    </>
  );
}
export default function LiveMap(props: {
  properties: LiveProperty[];
  focused: string | null;
  onFocus: (id: string) => void;
}) {
  return (
    <MapContainer
      center={[53.48, -2.24]}
      zoom={13}
      className="live-leaflet"
      scrollWheelZoom
      touchZoom
      doubleClickZoom
      keyboard
      zoomControl={false}
      zoomSnap={0.5}
      zoomDelta={0.5}
      minZoom={5}
      maxZoom={19}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <ScaleControl position="bottomleft" imperial={false} />
      <MapWorkspace {...props} />
    </MapContainer>
  );
}
