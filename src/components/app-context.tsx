"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowLeftRight, RotateCcw, X, Info } from "lucide-react";
import {
  DEFAULT_ASSUMPTIONS,
  properties,
  EMPHASIS_PRESETS,
  type Assumptions,
  type Emphasis,
} from "@/lib/domain";
import { Methodology } from "./ui";
type Discovery = {
  query: string;
  grade: string;
  budget: string;
  sort: string;
  view: string;
};
type Session = {
  discovery: Discovery;
  assumptions: Assumptions;
  emphasis: Emphasis;
  selected: string[];
  viewed: string[];
};
const fresh = (): Session => ({
  discovery: {
    query: "",
    grade: "all",
    budget: "all",
    sort: "score",
    view: "split",
  },
  assumptions: { ...DEFAULT_ASSUMPTIONS },
  emphasis: "Balanced",
  selected: [],
  viewed: [],
});
type Context = Session & {
  ready: boolean;
  setDiscovery: (v: Discovery) => void;
  setAssumptions: (v: Assumptions) => void;
  setEmphasis: (v: Emphasis) => void;
  toggleSelect: (id: string) => void;
  recordView: (id: string) => void;
  notify: (message: string) => void;
  showMethod: () => void;
};
const AppContext = createContext<Context | null>(null);
export const useApp = () => useContext(AppContext)!;
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(fresh);
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState(false);
  const [toast, setToast] = useState("");
  const pathname = usePathname();
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("letlytics-demo-v2");
      if (saved) {
        const value = JSON.parse(saved);
        if (Array.isArray(value.selected) && Array.isArray(value.viewed)) {
          setSession({
            ...fresh(),
            ...value,
            emphasis:
              value.emphasis in EMPHASIS_PRESETS ? value.emphasis : "Balanced",
            assumptions: { ...DEFAULT_ASSUMPTIONS, ...value.assumptions },
            selected: value.selected
              .filter((id: string) => properties.some((p) => p.id === id))
              .slice(0, 4),
          });
        }
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem("letlytics-demo-v2", JSON.stringify(session));
      } catch {}
  }, [session, ready]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const recordView = useCallback(
    (id: string) =>
      setSession((s) =>
        s.viewed.includes(id) ? s : { ...s, viewed: [...s.viewed, id] },
      ),
    [],
  );
  const toggleSelect = (id: string) => {
    if (!session.selected.includes(id) && session.selected.length >= 4) {
      setToast("Your comparison has 4 homes. Remove one to add another.");
      return;
    }
    setSession((s) => ({
      ...s,
      selected: s.selected.includes(id)
        ? s.selected.filter((v) => v !== id)
        : [...s.selected, id],
    }));
  };
  const value: Context = {
    ...session,
    ready,
    setDiscovery: (v) => setSession((s) => ({ ...s, discovery: v })),
    recordView,
    toggleSelect,
    setAssumptions: (v) => setSession((s) => ({ ...s, assumptions: v })),
    setEmphasis: (v) => setSession((s) => ({ ...s, emphasis: v })),
    notify: setToast,
    showMethod: () => setMethod(true),
  };
  // Live routes provide their own source-aware shell and shortlist state.
  if (pathname.startsWith("/live")) return <>{children}</>;
  return (
    <AppContext.Provider value={value}>
      <div className="demo-strip">
        <span>
          <span className="status-dot" /> Interactive prototype{" "}
          <span className="demo-long">
            · Manchester · All property data is simulated
          </span>
        </span>
        <button
          onClick={() => {
            setSession(fresh());
            setToast("Demo reset. All tools are ready to explore.");
          }}
        >
          <RotateCcw size={13} /> Reset demo
        </button>
      </div>
      <header className="site-header">
        <Link className="brand" href="/discover" aria-label="Letlytics home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          letlytics<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/live">Properties</Link>
          <Link
            className={pathname === "/discover" ? "active" : ""}
            href="/discover"
          >
            Discover
          </Link>
          <Link
            className={pathname === "/compare" ? "active" : ""}
            href="/compare"
          >
            Compare
            {session.selected.length > 0 && (
              <span className="nav-count">{session.selected.length}</span>
            )}
          </Link>
          <button onClick={() => setMethod(true)}>
            How we score <Info size={14} />
          </button>
        </nav>
        <span className="plan-pill">
          <span className="status-dot" /> Manchester demo
        </span>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <span className="footer-brand">letlytics.</span>
        <span>Prototype · Synthetic data · Not for investment decisions.</span>
        <button onClick={() => setMethod(true)}>
          Data & methodology <ArrowRight size={13} />
        </button>
      </footer>
      {session.selected.length > 0 && pathname != "/compare" && (
        <div className="compare-tray">
          <div>
            <span className="tray-icon">
              <ArrowLeftRight size={18} />
            </span>
            <strong>
              {session.selected.length}{" "}
              {session.selected.length === 1 ? "property" : "properties"}{" "}
              shortlisted
            </strong>
            <span className="muted desktop-only">
              {session.selected.length < 2
                ? "Add one more to compare."
                : "See the trade-offs, side by side."}
            </span>
          </div>
          <div>
            <button
              className="text-button"
              onClick={() => setSession((s) => ({ ...s, selected: [] }))}
            >
              Clear
            </button>
            <Link className="button primary" href="/compare">
              Compare <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {method && <Methodology onClose={() => setMethod(false)} />}
    </AppContext.Provider>
  );
}
