import test from "node:test";
import assert from "node:assert/strict";
import { clusterProperties } from "../src/lib/map-points";
import { getDailyFeed } from "../src/lib/daily-data";
const listing = getDailyFeed().properties[0];
const properties = [
  { ...listing, id: "a", lat: 53.48, lng: -2.24 },
  { ...listing, id: "b", lat: 53.4801, lng: -2.2401 },
  { ...listing, id: "c", lat: 53.5, lng: -2.3 },
];

test("nearby labels group at overview zoom and separate when zoomed in", () => {
  const project = (scale: number) => (p: typeof listing) => ({
    x: p.lng * scale,
    y: p.lat * scale,
  });
  const overview = clusterProperties(properties, project(2000));
  assert.equal(overview.length, 2);
  assert.deepEqual(
    overview[0].properties.map((p) => p.id),
    ["a", "b"],
  );
  const closeUp = clusterProperties(properties, project(1000000));
  assert.equal(closeUp.length, 3);
});
test("identical approximate locations retain every listing as a selectable group", () => {
  const shared = properties.map((p) => ({ ...p, lat: 53.48, lng: -2.24 }));
  const groups = clusterProperties(shared, () => ({ x: 20, y: 40 }));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].properties.length, 3);
  assert.equal(groups[0].lat, 53.48);
});
test("sorting results does not reshuffle clusters or mutate the property selection", () => {
  const before = JSON.stringify(properties);
  const project = (p: typeof listing) => ({ x: p.lng * 1000, y: p.lat * 1000 });
  assert.deepEqual(
    clusterProperties(properties, project),
    clusterProperties([...properties].reverse(), project),
  );
  assert.equal(JSON.stringify(properties), before);
});
test("empty filters create no pins; every property in a real selection is retained exactly once", () => {
  assert.deepEqual(
    clusterProperties([], () => ({ x: 0, y: 0 })),
    [],
  );
  const feed = getDailyFeed().properties;
  const groups = clusterProperties(feed, (p) => ({
    x: p.lng * 10000,
    y: p.lat * 10000,
  }));
  const ids = groups.flatMap((g) => g.properties.map((p) => p.id));
  assert.equal(ids.length, feed.length);
  assert.equal(new Set(ids).size, feed.length);
});
