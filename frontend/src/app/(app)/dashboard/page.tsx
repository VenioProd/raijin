"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";

type Range = "1J" | "1S" | "1M" | "3M" | "6M" | "YTD" | "1A" | "TOUT";
const ALL_RANGES: Range[] = ["1J", "1S", "1M", "3M", "6M", "YTD", "1A", "TOUT"];

interface MetricsResponse {
  invoices: { counters: Record<string, number>; total: number };
  ocr: { success_rate: number | null; mean_confidence: number | null };
  review: { corrections_total: number };
  amounts?: {
    ht: number;
    tva: number;
    ttc: number;
    mean: number;
    median: number;
    max: number;
  };
  series?: { date: string; amount: number }[];
  previous_period_ttc?: number;
}

interface SupplierListItem {
  id: string;
  name: string;
  vat_number: string | null;
  invoice_count: number;
  total_ttc: number;
}

interface SuppliersResponse {
  items: SupplierListItem[];
  total: number;
}

function fmtEUR(n: number, opts?: { compact?: boolean }) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: opts?.compact ? 0 : 2,
    minimumFractionDigits: opts?.compact ? 0 : 2,
  });
}

function fmtPct(n: number, opts?: { signed?: boolean }) {
  if (!Number.isFinite(n)) return "—";
  const v = n.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return opts?.signed && n > 0 ? `+${v} %` : `${v} %`;
}

function buildAreaPath(values: number[], width = 800, height = 220): { area: string; line: string } {
  if (values.length < 2) return { area: "", line: "" };
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - 20 - ((v - min) / span) * (height - 40);
    return { x, y };
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;
  return { area, line };
}

function sparklinePath(values: number[], width = 100, height = 32): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - 4 - ((v - min) / span) * (height - 8)).toFixed(1)}`)
    .join(" ");
}

function deterministicSpark(seed: string, n = 9): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push((h % 1000) / 1000);
  }
  return out;
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [range, setRange] = useState<Range>("1M");

  useEffect(() => {
    apiFetch<MetricsResponse>("/metrics").then(setMetrics).catch(() => {});
    apiFetch<SuppliersResponse>("/suppliers?page=1&page_size=5")
      .then((r) => setSuppliers(r.items))
      .catch(() => {});
  }, []);

  const amounts = metrics?.amounts;
  const series = useMemo(() => metrics?.series ?? [], [metrics]);
  const previousTtc = metrics?.previous_period_ttc;
  const ttcNow = amounts?.ttc ?? 0;
  const deltaAbs = previousTtc !== undefined ? ttcNow - previousTtc : null;
  const deltaPct =
    previousTtc !== undefined && previousTtc !== 0 ? ((ttcNow - previousTtc) / previousTtc) * 100 : null;

  const chartValues = useMemo(() => {
    if (series.length >= 2) return series.map((p) => p.amount);
    return [];
  }, [series]);

  const paths = useMemo(() => buildAreaPath(chartValues), [chartValues]);

  const counters = metrics?.invoices.counters ?? {};
  const pending = counters.ready_for_review ?? 0;

  return (
    <div>
      {/* Kicker */}
      <p className="v6-kicker">{t("portfolio_kicker")}</p>

      {/* Hero number */}
      <h1 className="v6-hero">{amounts ? fmtEUR(ttcNow) : "—"}</h1>

      {/* Delta */}
      {deltaAbs !== null && deltaPct !== null && (
        <div className={`v6-delta${deltaAbs < 0 ? " neg" : ""}`}>
          <span>
            {deltaAbs >= 0 ? "▲" : "▼"} {fmtEUR(Math.abs(deltaAbs))}
          </span>
          <span className="sec">
            {fmtPct(deltaPct, { signed: true })} {t("vs_previous")}
          </span>
        </div>
      )}

      {/* Time chips */}
      <div className="v6-chips" role="tablist" aria-label={t("range_label")}>
        {ALL_RANGES.map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={range === r}
            className={`v6-chip${range === r ? " active" : ""}`}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Area chart */}
      <div className="v6-chart">
        <svg viewBox="0 0 800 220" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="raijin-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--theme-accent-strong)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--theme-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {paths.area ? (
            <>
              <path d={paths.area} fill="url(#raijin-area)" />
              <path
                d={paths.line}
                fill="none"
                stroke="var(--theme-accent-strong)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <line
              x1="0"
              y1="180"
              x2="800"
              y2="180"
              stroke="rgba(255,255,255,0.1)"
              strokeDasharray="4 4"
            />
          )}
        </svg>
      </div>

      {/* Stats grid */}
      <div className="v6-stats">
        <div className="v6-stat">
          <div className="k">{t("stat_ht")}</div>
          <div className="v">{amounts ? fmtEUR(amounts.ht, { compact: true }) : "—"}</div>
        </div>
        <div className="v6-stat">
          <div className="k">{t("stat_tva")}</div>
          <div className="v">{amounts ? fmtEUR(amounts.tva, { compact: true }) : "—"}</div>
        </div>
        <div className="v6-stat">
          <div className="k">{t("stat_ttc")}</div>
          <div className="v">{amounts ? fmtEUR(amounts.ttc, { compact: true }) : "—"}</div>
        </div>
        <div className="v6-stat">
          <div className="k">{t("stat_pending")}</div>
          <div className="v">{pending}</div>
        </div>
        <div className="v6-stat">
          <div className="k">{t("stat_median")}</div>
          <div className="v">{amounts ? fmtEUR(amounts.median, { compact: true }) : "—"}</div>
        </div>
        <div className="v6-stat">
          <div className="k">{t("stat_mean")}</div>
          <div className="v">{amounts ? fmtEUR(amounts.mean, { compact: true }) : "—"}</div>
        </div>
        <div className="v6-stat">
          <div className="k">{t("stat_max")}</div>
          <div className="v">{amounts ? fmtEUR(amounts.max, { compact: true }) : "—"}</div>
        </div>
        <div className="v6-stat">
          <div className="k">{t("stat_ocr")}</div>
          <div className="v">
            {metrics?.ocr.mean_confidence !== null && metrics?.ocr.mean_confidence !== undefined
              ? fmtPct(metrics.ocr.mean_confidence * 100)
              : "—"}
          </div>
        </div>
      </div>

      {/* Top suppliers */}
      <p className="v6-section-cap">
        {t("top_suppliers")}
        <Link className="right" href="/suppliers">
          {t("see_all")} →
        </Link>
      </p>
      <div>
        {suppliers.length === 0 ? (
          <p className="py-6 text-[13px] text-white/40">{t("no_suppliers_yet")}</p>
        ) : (
          suppliers.map((s) => {
            const vals = deterministicSpark(s.id);
            const path = sparklinePath(vals);
            const positive = vals[vals.length - 1] > vals[0];
            return (
              <Link key={s.id} href={`/suppliers/${s.id}`} className="v6-row">
                <div>
                  <div className="name">{s.name}</div>
                  <div className="meta">
                    {t("invoice_count", { count: s.invoice_count })}
                    {s.vat_number ? ` · ${s.vat_number}` : ""}
                  </div>
                </div>
                <svg className="v6-spark" width="100" height="32" viewBox="0 0 100 32" aria-hidden="true">
                  <path
                    d={path}
                    fill="none"
                    stroke={positive ? "var(--raijin-green)" : "var(--raijin-red)"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className={`v6-block ${positive ? "green" : "red"}`}>
                  <div className="big">{fmtEUR(s.total_ttc, { compact: true })}</div>
                  <div className="small">{t("invoice_count_short", { count: s.invoice_count })}</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
