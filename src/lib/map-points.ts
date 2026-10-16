import type { LiveProperty } from "./live-types";

type Point = { x: number; y: number };
export type PropertyCluster = {
  properties: LiveProperty[];
  lat: number;
  lng: number;
  x: number;
  y: number;
};

/** Group nearby screen positions, so price labels separate naturally as you zoom. */
export function clusterProperties(
  properties: LiveProperty[],
  project: (property: LiveProperty) => Point,
  radius = 84,
): PropertyCluster[] {
  const groups: PropertyCluster[] = [];
  for (const property of [...properties].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const point = project(property);
    const nearby = groups
      .map((group) => ({
        group,
        distance: Math.hypot(group.x - point.x, group.y - point.y),
      }))
      .filter(({ distance }) => distance < radius)
      .sort((a, b) => a.distance - b.distance)[0]?.group;
    if (!nearby) {
      groups.push({
        properties: [property],
        lat: property.lat,
        lng: property.lng,
        ...point,
      });
      continue;
    }
    const n = nearby.properties.length;
    nearby.x = (nearby.x * n + point.x) / (n + 1);
    nearby.y = (nearby.y * n + point.y) / (n + 1);
    nearby.lat = (nearby.lat * n + property.lat) / (n + 1);
    nearby.lng = (nearby.lng * n + property.lng) / (n + 1);
    nearby.properties.push(property);
  }
  return groups;
}
