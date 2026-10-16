"use client";
import {
  X,
  ArrowUpRight,
  ShieldCheck,
  SlidersHorizontal,
  ChartNoAxesCombined,
  Building2,
  MapPin,
  Wallet,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { Grade, Property } from "@/lib/domain";
export const money = (n: number, d = 0) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  }).format(n);
export const percent = (n: number) => `${n.toFixed(1)}%`;
export function GradeBadge({
  grade,
  large = false,
}: {
  grade: Grade;
  large?: boolean;
}) {
  return (
    <span
      className={`grade grade-${grade} ${large ? "grade-large" : ""}`}
      aria-label={`Grade ${grade}`}
    >
      {grade}
    </span>
  );
}
export function PropertyArt({ property }: { property: Property }) {
  const flat = property.propertyType.toLowerCase().includes("flat");
  return (
    <div
      className={`property-art ${flat ? "flat" : "house"}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 90">
        <path d="M0 78H100" stroke="currentColor" opacity=".2" />
        <path
          d={flat ? "M21 76V15H79V76Z" : "M17 76V37L50 13L83 37V76Z"}
          fill="currentColor"
          opacity=".14"
        />
        <path
          d={
            flat
              ? "M21 76V15H79V76M31 15V8H69V15"
              : "M12 39L50 10L88 39M20 34V76H80V34"
          }
          stroke="currentColor"
          fill="none"
          strokeWidth="2"
        />
        <path
          d="M43 76V56H57V76M28 42H38V52H28ZM62 42H72V52H62ZM28 60H38V70H28ZM62 60H72V70H62Z"
          fill="currentColor"
          opacity=".65"
        />
        {flat ? (
          <path
            d="M28 23H38V33H28ZM45 23H55V33H45ZM62 23H72V33H62Z"
            fill="currentColor"
            opacity=".65"
          />
        ) : (
          <path d="M44 30H56V42H44Z" fill="currentColor" opacity=".65" />
        )}
        <path d="M10 77H90" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Methodology({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="A score you can question." onClose={onClose}>
      <p className="muted">
        A starting point for due diligence. Every property, rent, area input and
        risk flag in this prototype is synthetic.
      </p>
      <div className="method-step">
        <Wallet />
        <div>
          <strong>Start with the economics</strong>
          <p>
            Net operating yield and cash-on-cash return feed the cash flow
            score. Costs include management, maintenance, vacancy, insurance and
            service charges.
          </p>
        </div>
      </div>
      <div className="method-step">
        <SlidersHorizontal />
        <div>
          <strong>Make the assumptions yours</strong>
          <p>
            Change financing and costs. Every view uses the same scenario.
            Balanced weights: cash flow 40%, demand 25%, quality 15%, market
            health 15%, risk 5%.
          </p>
        </div>
      </div>
      <div className="method-step">
        <ChartNoAxesCombined />
        <div>
          <strong>See the trade-offs</strong>
          <p>
            A ≥85 · B ≥70 · C ≥55 · D ≥40 · F &lt;40. There is no E in this
            illustrative model. Presets change weights; a high grade does not
            eliminate a red flag.
          </p>
        </div>
      </div>
      <div className="method-step">
        <ShieldCheck />
        <div>
          <strong>Verify before you act</strong>
          <p>
            These are unvalidated screening heuristics, not forecasts. Confirm
            achievable rent, condition, financing, licensing, title and costs
            with appropriate sources and professionals.
          </p>
        </div>
      </div>
      <div className="notice">
        No live listings or licensed property data have been imported. Links to
        official services are research starting points, not evidence for these
        fictional homes.
      </div>
    </Modal>
  );
}
export function RiskFlags({
  property,
  compact = false,
}: {
  property: Property;
  compact?: boolean;
}) {
  return (
    <div className={`risk-flags ${compact ? "compact" : ""}`}>
      {!["A", "B", "C"].includes(property.epcRating) && (
        <span className="risk">
          EPC {property.epcRating} ·{" "}
          {["F", "G"].includes(property.epcRating)
            ? "Letting eligibility to verify"
            : "Upgrade budget to check"}
        </span>
      )}
      {property.tenure === "leasehold" && (
        <span className="risk neutral">Leasehold · service charge</span>
      )}
      {property.floodRisk !== "low" && (
        <span className="risk">
          {property.floodRisk === "high" ? "High" : "Medium"} simulated flood
          risk
        </span>
      )}
      {property.epcRating <= "C" &&
        property.tenure === "freehold" &&
        property.floodRisk === "low" && (
          <span className="risk positive">
            EPC {property.epcRating} · freehold
          </span>
        )}
    </div>
  );
}
export { ArrowUpRight, Building2, MapPin };
