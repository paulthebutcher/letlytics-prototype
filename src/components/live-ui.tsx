"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Check,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import type { LiveProperty } from "@/lib/live-types";
import { useLive } from "./live-context";

export const liveMoney = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
export const livePercent = (value: number) => `${value.toFixed(1)}%`;
export const liveDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
export function ShortlistButton({
  property,
  compact = false,
}: {
  property: LiveProperty;
  compact?: boolean;
}) {
  const { selected, toggle } = useLive();
  const active = selected.includes(property.id);
  return (
    <button
      className={`live-shortlist ${active ? "selected" : ""} ${compact ? "compact" : ""}`}
      onClick={() => toggle(property.id)}
      aria-pressed={active}
      aria-label={`${active ? "Remove" : "Shortlist"} ${property.address}`}
      title={active ? "Remove from shortlist" : "Add to comparison"}
    >
      {active ? <Check size={16} /> : <Plus size={16} />}
      {compact
        ? active
          ? "Shortlisted"
          : "Shortlist"
        : active
          ? "Shortlisted for comparison"
          : "Add to comparison"}
    </button>
  );
}
export function LiveState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="live-state">
      <Building2 size={30} />
      <h2>{title}</h2>
      <p>{detail}</p>
      <Link className="live-inline-link" href="/live">
        Explore properties <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}
export function PropertyPhoto({
  property,
  hero = false,
}: {
  property: LiveProperty;
  hero?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const image =
    property.imageUrl && failedUrl !== property.imageUrl
      ? property.imageUrl
      : null;
  return (
    <div className={`live-property-photo ${hero ? "hero" : ""}`}>
      {image ? (
        <img
          src={image}
          alt={`Listing photograph for ${property.address}`}
          width={hero ? 320 : 192}
          height={hero ? 240 : 160}
          loading={hero ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(property.imageUrl ?? null)}
        />
      ) : (
        <div className="live-photo-fallback">
          <Building2 size={24} strokeWidth={1.3} />
          <span>Photo unavailable</span>
        </div>
      )}
    </div>
  );
}
export function focusScenarioField(id: string) {
  const field = document.getElementById(id);
  if (!field) return;
  let ancestor = field.parentElement;
  while (ancestor) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
  field.scrollIntoView({ behavior: "auto", block: "center" });
  field.focus({ preventScroll: true });
}
export function NumericField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000000,
  step = 1,
  prefix,
  suffix,
  hint,
  optional = false,
  placeholder = "Unknown",
  fieldId,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
  fieldId?: string;
}) {
  const generatedId = useId();
  const id = fieldId ?? generatedId;
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [value]);
  const commit = () => {
    if (!draft.trim()) {
      if (optional) onChange(undefined);
      else setDraft(value === undefined ? "" : String(value));
      return;
    }
    const number = Number(draft);
    if (!Number.isFinite(number)) {
      setDraft(value === undefined ? "" : String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, number));
    setDraft(String(clamped));
    onChange(clamped);
  };
  return (
    <div className="live-field">
      <label htmlFor={id}>{label}</label>
      <div className="live-number">
        {prefix && <span>{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {suffix && <span>{suffix}</span>}
      </div>
      {hint && <p id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}
export function LiveAssumptions({ property }: { property?: LiveProperty }) {
  const {
    assumptions: a,
    setAssumptions,
    overrides,
    setOverride,
    reset,
  } = useLive();
  const o = property ? (overrides[property.id] ?? {}) : {};
  return (
    <section className="live-scenario" id="scenario">
      <div className="live-section-title">
        <SlidersHorizontal size={17} />
        <h2>Your scenario</h2>
      </div>
      <p className="live-small">
        Offer, rent and charges apply here. Financing and cost assumptions apply
        across your shortlist.
      </p>
      {property && (
        <div className="live-property-inputs">
          <span className="live-eyebrow">THIS PROPERTY</span>
          <NumericField
            fieldId="scenario-offer"
            label="Offer / purchase price"
            prefix="£"
            value={o.purchasePrice ?? property.price}
            onChange={(value) =>
              setOverride(property.id, { purchasePrice: value })
            }
            min={1}
            step={1000}
            hint={`Listed at ${liveMoney(property.price)}. Your offer changes this scenario only.`}
          />
          <NumericField
            fieldId="scenario-rent"
            label="Monthly rent assumption"
            prefix="£"
            value={o.monthlyRent ?? property.rent?.monthlyEstimate}
            onChange={(value) =>
              setOverride(property.id, { monthlyRent: value })
            }
            step={25}
            optional
            hint={
              o.monthlyRent !== undefined
                ? "Your rent assumption. Clear to use available market evidence."
                : property.rent
                  ? "Based on nearby advertised asking rents. Edit after checking achievable rent."
                  : "Enter a rent to calculate cash flow. Confirm it with a local letting agent."
            }
          />
          <NumericField
            fieldId="scenario-charge"
            label="Annual service / estate charge"
            prefix="£"
            value={
              o.annualServiceCharge ?? property.annualServiceCharge ?? undefined
            }
            onChange={(value) =>
              setOverride(property.id, { annualServiceCharge: value })
            }
            optional
            hint="Not supplied by the listing feed. Enter 0 only if you have confirmed no charge applies."
          />
        </div>
      )}
      <div className="live-field-grid">
        <NumericField
          label="Deposit"
          value={a.depositPct}
          onChange={(value) =>
            setAssumptions({ depositPct: value ?? a.depositPct })
          }
          suffix="%"
          min={0}
          max={100}
        />
        <NumericField
          label="Mortgage rate"
          value={a.mortgageRate}
          onChange={(value) =>
            setAssumptions({ mortgageRate: value ?? a.mortgageRate })
          }
          suffix="%"
          step={0.1}
          max={30}
        />
      </div>
      <div className="live-field">
        <label htmlFor="live-mortgage-type">Mortgage type</label>
        <select
          id="live-mortgage-type"
          value={a.mortgageType}
          onChange={(event) =>
            setAssumptions({
              mortgageType: event.target.value as typeof a.mortgageType,
            })
          }
        >
          <option value="interest-only">Interest only</option>
          <option value="repayment">Repayment</option>
        </select>
      </div>
      {a.mortgageType === "repayment" && (
        <NumericField
          label="Mortgage term"
          value={a.mortgageTermYears}
          onChange={(value) =>
            setAssumptions({ mortgageTermYears: value ?? a.mortgageTermYears })
          }
          suffix="years"
          min={1}
          max={40}
        />
      )}
      <details className="live-advanced">
        <summary>Operating costs &amp; buying costs</summary>
        <div className="live-field-grid">
          <NumericField
            label="Management"
            value={a.lettingFeePct}
            onChange={(value) =>
              setAssumptions({ lettingFeePct: value ?? a.lettingFeePct })
            }
            suffix="% rent"
            max={50}
          />
          <NumericField
            label="Maintenance"
            value={a.maintenancePct}
            onChange={(value) =>
              setAssumptions({ maintenancePct: value ?? a.maintenancePct })
            }
            suffix="% rent"
            max={50}
          />
        </div>
        <NumericField
          label="Annual insurance"
          value={a.annualInsurance}
          onChange={(value) =>
            setAssumptions({ annualInsurance: value ?? a.annualInsurance })
          }
          prefix="£"
        />
        <NumericField
          label="Buying costs"
          value={a.buyingCosts}
          onChange={(value) =>
            setAssumptions({ buyingCosts: value ?? a.buyingCosts })
          }
          prefix="£"
          hint="Your allowance for taxes, legal and acquisition fees. Not a stamp-duty calculation."
        />
        {property && (
          <NumericField
            label="Vacancy allowance"
            value={o.vacancyPct ?? 5}
            onChange={(value) =>
              setOverride(property.id, { vacancyPct: value })
            }
            suffix="% rent"
            max={100}
            hint="5% starting assumption, not a measured local vacancy rate."
          />
        )}
        <label className="live-checkbox">
          <input
            type="checkbox"
            checked={a.landlordPaysCouncilTax}
            onChange={(event) =>
              setAssumptions({ landlordPaysCouncilTax: event.target.checked })
            }
          />
          I pay council tax
        </label>
        {property && a.landlordPaysCouncilTax && (
          <NumericField
            fieldId="scenario-council-tax"
            label="Annual council tax"
            value={o.annualCouncilTax ?? property.annualCouncilTax ?? undefined}
            onChange={(value) =>
              setOverride(property.id, { annualCouncilTax: value })
            }
            prefix="£"
            optional
            hint="Check the actual bill and who pays during a tenancy or void."
          />
        )}
      </details>
      <button className="live-reset" onClick={reset}>
        <RefreshCw size={13} />
        Reset all scenario inputs
      </button>
      <div className="live-note">
        <AlertCircle size={14} />
        <p>
          Pre-tax illustration. Ground rent, one-off repairs and sale costs are
          excluded. Verify property condition and letting eligibility
          separately.
        </p>
      </div>
    </section>
  );
}
export function LiveBack({ label = "Back to properties" }: { label?: string }) {
  return (
    <Link href="/live" className="live-back">
      <ArrowLeft size={15} />
      {label}
    </Link>
  );
}
