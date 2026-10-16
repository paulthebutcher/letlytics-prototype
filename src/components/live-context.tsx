"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ArrowRight, ChartNoAxesCombined, Check, X } from "lucide-react";
import { DEFAULT_ASSUMPTIONS } from "@/lib/scoring";
import type { Assumptions } from "@/lib/types";
import type { LiveFeed, LiveOverrides } from "@/lib/live-types";

type Filters = {
  query: string;
  type: string;
  budget: string;
  sort: string;
  map: boolean;
};
const initialFilters: Filters = {
  query: "",
  type: "all",
  budget: "all",
  sort: "price",
  map: false,
};
const STORAGE = "letlytics-live-session-v1";
type LiveState = {
  feed: LiveFeed;
  selected: string[];
  toggle: (id: string) => void;
  clear: () => void;
  assumptions: Assumptions;
  setAssumptions: (patch: Partial<Assumptions>) => void;
  overrides: Record<string, LiveOverrides>;
  setOverride: (id: string, patch: Partial<LiveOverrides>) => void;
  reset: () => void;
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
};
const LiveContext = createContext<LiveState | null>(null);
export function useLive() {
  const value = useContext(LiveContext);
  if (!value) throw new Error("LiveProvider is required");
  return value;
}

export function LiveProvider({
  children,
  initialFeed,
}: {
  children: React.ReactNode;
  initialFeed: LiveFeed;
}) {
  const pathname = usePathname();
  const feed = initialFeed;
  const [selected, setSelected] = useState<string[]>([]);
  const [assumptions, changeAssumptions] = useState<Assumptions>({
    ...DEFAULT_ASSUMPTIONS,
  });
  const [overrides, changeOverrides] = useState<Record<string, LiveOverrides>>(
    {},
  );
  const [filters, changeFilters] = useState<Filters>(initialFilters);
  const [restored, setRestored] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.selected))
          setSelected(
            saved.selected
              .filter((s: unknown) => typeof s === "string")
              .slice(0, 4),
          );
        if (saved.assumptions)
          changeAssumptions({ ...DEFAULT_ASSUMPTIONS, ...saved.assumptions });
        if (saved.overrides) changeOverrides(saved.overrides);
        if (saved.filters)
          changeFilters({ ...initialFilters, ...saved.filters });
      }
    } catch {
      /* Session persistence is optional. */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (restored) {
      try {
        sessionStorage.setItem(
          STORAGE,
          JSON.stringify({ selected, assumptions, overrides, filters }),
        );
      } catch {
        /* Private browsing can disable storage. */
      }
    }
  }, [selected, assumptions, overrides, filters, restored]);
  useEffect(() => {
    if (!restored) return;
    const available = new Set(feed.properties.map((property) => property.id));
    setSelected((previous) => {
      const current = previous.filter((id) => available.has(id));
      return current.length === previous.length ? previous : current;
    });
  }, [restored, feed]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  const toggle = useCallback(
    (id: string) => {
      if (!selected.includes(id) && selected.length >= 4) {
        setNotice(
          "Your comparison has four properties. Remove one to add another.",
        );
        return;
      }
      setSelected(
        selected.includes(id)
          ? selected.filter((item) => item !== id)
          : [...selected, id],
      );
    },
    [selected],
  );
  const count = selected.filter((id) =>
    feed.properties.some((p) => p.id === id),
  ).length;
  const state: LiveState = {
    feed,
    selected,
    toggle,
    clear: () => setSelected([]),
    assumptions,
    setAssumptions: (patch) =>
      changeAssumptions((previous) => ({ ...previous, ...patch })),
    overrides,
    setOverride: (id, patch) =>
      changeOverrides((previous) => ({
        ...previous,
        [id]: { ...previous[id], ...patch },
      })),
    reset: () => {
      changeAssumptions({ ...DEFAULT_ASSUMPTIONS });
      changeOverrides({});
    },
    filters,
    setFilters: (patch) =>
      changeFilters((previous) => ({ ...previous, ...patch })),
  };
  return (
    <LiveContext.Provider value={state}>
      <div className="live-app">
        <header className="live-header">
          <Link
            href="/live"
            className="brand"
            aria-label="Letlytics property explorer"
          >
            <ChartNoAxesCombined size={27} strokeWidth={1.7} />
            letlytics<span>.</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link className={pathname === "/live" ? "active" : ""} href="/live">
              Discover
            </Link>
            <Link
              className={pathname === "/live/compare" ? "active" : ""}
              href="/live/compare"
            >
              Compare <span className="live-count">{count}</span>
            </Link>
            <Link href="/discover" className="live-demo-link">
              Synthetic demo <ArrowRight size={12} />
            </Link>
          </nav>
        </header>
        <div className="live-data-updated">
          <time dateTime={feed.fetchedAt}>
            Last updated{" "}
            {new Date(feed.fetchedAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/London",
              timeZoneName: "short",
            })}
          </time>
        </div>
        {children}
        <footer className="live-footer">
          <span className="live-footer-brand">letlytics.</span>
          <span>
            PropertyData · asking prices and advertised rents. Verify
            availability and costs.
          </span>
          <a href="https://propertydata.co.uk" target="_blank" rel="noreferrer">
            Data source ↗
          </a>
        </footer>
        {count > 0 && pathname !== "/live/compare" && (
          <div className="live-tray">
            <span>
              <Check size={17} /> <strong>{count} of 4 shortlisted</strong>
            </span>
            <button onClick={() => setSelected([])} className="text-button">
              Clear
            </button>
            {count >= 2 ? (
              <Link href="/live/compare" className="button primary">
                Compare {count} <ArrowRight size={16} />
              </Link>
            ) : (
              <span className="live-tray-hint">Add one more to compare</span>
            )}
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={17} />
            </button>
          </div>
        )}
      </div>
    </LiveContext.Provider>
  );
}
