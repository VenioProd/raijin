"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckSquare,
  Download,
  FileText,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import type { InvoiceStats } from "@/lib/types";

// ────────────────────────────────────────────────────────────
// Atoms
// ────────────────────────────────────────────────────────────

export function Card({
  children,
  className = "",
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`glass glass-hover relative p-[22px] ${glow ? "glass-glow" : ""} ${className}`}
      style={{ borderRadius: 18 }}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function WidgetTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.10em] text-white/35">
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Hero — factures à valider
// ────────────────────────────────────────────────────────────

function generateSparkbars(seed: number, count = 7): number[] {
  const bars: number[] = [];
  let x = seed;
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280;
    bars.push(0.35 + (x / 233280) * 0.65);
  }
  return bars;
}

export function HeroPending({
  pending,
  total,
}: {
  pending: number | null;
  total: number | null;
}) {
  const t = useTranslations("dashboard");
  const bars = useMemo(() => generateSparkbars(pending ?? 23), [pending]);
  const DAYS_KEYS = ["day_mon", "day_tue", "day_wed", "day_thu", "day_fri", "day_sat", "day_sun"] as const;
  const isLoading = pending === null;
  const isOnboarding = !isLoading && (total ?? 0) === 0;
  const isCaughtUp = !isLoading && !isOnboarding && (pending ?? 0) === 0;

  // ─── Onboarding (aucune facture du tout) ────────────────────────
  if (isOnboarding) {
    return (
      <Card glow className="col-span-2 row-span-1 min-h-[240px]">
        <div className="flex h-full flex-col items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-300">
              <Sparkles className="h-3 w-3" />
              {t("onboarding_badge")}
            </div>
            <h2 className="font-serif-italic mt-3 text-[32px] leading-[1.05] text-white/95">
              {t("onboarding_title")}
            </h2>
            <p className="mt-2 max-w-[320px] text-[13px] leading-snug text-white/60">
              {t("onboarding_desc")}
            </p>
          </div>
          <Link
            href="/upload"
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-semibold text-white transition"
            style={{
              background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
              boxShadow: "0 10px 30px -10px rgba(139,92,246,0.55)",
            }}
          >
            {t("onboarding_cta")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    );
  }

  // ─── Inbox zéro ───────────────────────────────────────────────
  if (isCaughtUp) {
    return (
      <Card glow className="col-span-2 row-span-1 min-h-[240px]">
        <div className="flex h-full flex-col items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-300">
              <Check className="h-3 w-3" strokeWidth={3} />
              {t("inbox_zero_badge")}
            </div>
            <h2 className="font-serif-italic mt-3 text-[32px] leading-[1.05] text-white/95">
              {t("inbox_zero_title")}
            </h2>
            <p className="mt-2 max-w-[320px] text-[13px] leading-snug text-white/60">
              {t("inbox_zero_desc")}
            </p>
          </div>
          <Link
            href="/upload"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] px-3.5 py-2 text-[12px] font-medium text-white/60 transition hover:border-violet-500/40 hover:bg-violet-500/20 hover:text-white"
          >
            {t("import_document")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    );
  }

  // ─── Default: pending > 0 ─────────────────────────────────────
  return (
    <Card glow className="col-span-2 row-span-1 min-h-[240px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-serif-display text-[96px] leading-[0.9] text-white/95">
            {pending ?? "—"}
          </div>
          <p className="mt-2 max-w-[200px] text-[13px] leading-snug text-white/60">
            {(pending ?? 0) > 1 ? t("pending_invoices_plural") : t("pending_invoices_singular")}
            <br />
            <span className="text-white/35">{t("pending_invoices_window")}</span>
          </p>
        </div>
        <Link
          href="/dashboard?filter=ready_for_review"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] px-3.5 py-2 text-[12px] font-medium text-white/60 transition hover:border-violet-500/40 hover:bg-violet-500/20 hover:text-white"
        >
          {t("start_review")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-6 flex flex-col">
        <div className="flex h-11 items-end gap-1">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md transition"
              style={{
                height: `${h * 100}%`,
                minHeight: 6,
                background:
                  "linear-gradient(180deg, rgba(139,92,246,0.9) 0%, rgba(99,102,241,0.5) 100%)",
              }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex gap-1">
          {DAYS_KEYS.map((dk, i) => (
            <div
              key={i}
              className="flex-1 text-center font-mono-display text-[10px] text-white/35"
            >
              {t(dk)}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Jauge radiale confidence
// ────────────────────────────────────────────────────────────

export function ConfidenceGauge({ confidence }: { confidence: number | null }) {
  const t = useTranslations("dashboard");
  const pct = confidence !== null ? Math.round(confidence * 100) : null;
  const R = 52;
  const C = Math.PI * R;
  const filled = pct !== null ? (pct / 100) * C : 0;
  const isEmpty = pct === null;

  return (
    <Card>
      <WidgetTitle>{t("confidence_title")}</WidgetTitle>
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-[90px] w-[140px]">
          <svg viewBox="0 0 140 90" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="gaugeGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <path
              d="M 18 82 A 52 52 0 0 1 122 82"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
            />
            {!isEmpty && (
              <path
                d="M 18 82 A 52 52 0 0 1 122 82"
                stroke="url(#gaugeGrad)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${C}`}
                style={{ transition: "stroke-dasharray 500ms ease" }}
              />
            )}
          </svg>
          <div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 text-center">
            {isEmpty ? (
              <div className="font-serif-italic text-[22px] leading-none text-white/40">—</div>
            ) : (
              <div className="font-serif-display text-[42px] leading-none text-white/95">
                {pct}%
              </div>
            )}
          </div>
        </div>
        <div className="text-center text-[11px] leading-[1.5] text-white/35">
          {isEmpty ? (
            <>
              {t("confidence_empty_title")}
              <br />
              <span className="text-white/45">{t("confidence_empty_desc")}</span>
            </>
          ) : (
            <>
              {t("confidence_avg")}
              <br />
              <span className={pct >= 90 ? "text-emerald-400" : "text-amber-400"}>
                {pct >= 90 ? t("confidence_above_threshold") : t("confidence_watch")}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Ce mois
// ────────────────────────────────────────────────────────────

export function MonthCard({
  totalTtc,
  totalHt,
  totalVat,
  docsCount,
  delta,
}: {
  totalTtc: string;
  totalHt: string;
  totalVat: string;
  docsCount: number;
  delta: number;
}) {
  const t = useTranslations("dashboard");
  const isEmpty = docsCount === 0;
  const isPositive = delta >= 0;
  const now = new Date();
  const monthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <Card>
      <WidgetTitle>{t("month_title", { month: monthLabel })}</WidgetTitle>
      {isEmpty ? (
        <>
          <div className="font-serif-italic text-[28px] leading-tight text-white/50">
            {t("month_empty_line1")}<br />{t("month_empty_line2")}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-white/35">
            {t("month_empty_desc")}
          </p>
        </>
      ) : (
        <>
          <div className="font-serif-display mb-3.5 text-[46px] leading-none text-white/95">
            {totalTtc}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between font-mono-display text-[11px]">
              <span className="text-white/35">{t("month_ht")}</span>
              <span className="text-white/60">{totalHt}</span>
            </div>
            <div className="flex items-center justify-between font-mono-display text-[11px]">
              <span className="text-white/35">{t("month_vat")}</span>
              <span className="text-white/60">{totalVat}</span>
            </div>
            <div className="flex items-center justify-between font-mono-display text-[11px]">
              <span className="text-white/35">{t("month_docs")}</span>
              <span className="text-white/60">{docsCount}</span>
            </div>
          </div>
          <div
            className={`mt-3.5 flex items-center gap-1 font-mono-display text-[12px] ${
              isPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isPositive ? "↑" : "↓"} {t("month_delta_vs", { value: Math.abs(delta) })}
          </div>
        </>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Pipeline OCR
// ────────────────────────────────────────────────────────────

export function Pipeline({ stats }: { stats: InvoiceStats | null }) {
  const t = useTranslations("dashboard");
  const counters = stats?.counters ?? {};
  const uploaded = counters.uploaded ?? 0;
  const processing = counters.processing ?? 0;
  const review = counters.ready_for_review ?? 0;
  const confirmed = counters.confirmed ?? 0;

  const sum = uploaded + processing + review + confirmed;
  const total = Math.max(1, sum);
  const isEmpty = sum === 0;

  const steps = [
    { label: t("pipeline_received"), value: uploaded, pct: uploaded / total },
    { label: t("pipeline_processing"), value: processing, pct: processing / total, pulse: processing > 0 },
    { label: t("pipeline_to_validate"), value: review, pct: review / total },
    { label: t("pipeline_validated"), value: confirmed, pct: confirmed / total },
  ];

  return (
    <Card className="col-span-4">
      <WidgetTitle>{t("pipeline_title")}</WidgetTitle>
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, i) => (
          <div key={step.label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 flex-col items-center gap-2">
              {isEmpty ? (
                <div className="font-serif-italic text-[28px] leading-none text-white/25">—</div>
              ) : (
                <div
                  className={`font-serif-display text-[38px] leading-none text-white/95 ${
                    step.pulse ? "animate-pulse" : ""
                  }`}
                >
                  {step.value}
                </div>
              )}
              <div className="text-[11px] text-white/35">{step.label}</div>
              {!isEmpty && (
                <div className="h-[3px] w-4/5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(5, step.pct * 100)}%`,
                      background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
                    }}
                  />
                </div>
              )}
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="h-4 w-4 shrink-0 text-white/25" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Activité récente (audit log)
// ────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
}
interface AuditResponse {
  items: AuditEntry[];
}

function formatRel(
  iso: string,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return t("rel_now");
  if (diff < 3_600_000) return t("rel_minutes_ago", { value: Math.round(diff / 60_000) });
  if (diff < 86_400_000) return t("rel_hours_ago", { value: Math.round(diff / 3_600_000) });
  return d.toLocaleDateString("fr-FR");
}

function actionColor(action: string): string {
  if (action.includes("confirm")) return "bg-violet-500";
  if (action.includes("reject")) return "bg-rose-500";
  if (action.includes("create") || action.includes("ingest")) return "bg-emerald-500";
  if (action.includes("fail")) return "bg-amber-500";
  return "bg-sky-400";
}

function humanAction(
  action: string,
  entity: string,
  t: (k: string) => string,
): string {
  const KEY_MAP: Record<string, string> = {
    "invoice.confirm": "action_invoice_confirm",
    "invoice.reject": "action_invoice_reject",
    "invoice.reopen": "action_invoice_reopen",
    "user.create": "action_user_create",
    "user.update": "action_user_update",
    "user.deactivate": "action_user_deactivate",
  };
  const key = KEY_MAP[action];
  return key ? t(key) : `${entity} · ${action}`;
}

export function ActivityFeed() {
  const t = useTranslations("dashboard");
  const tApp = useTranslations("app");
  const [items, setItems] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    apiFetch<AuditResponse>("/audit?page_size=6")
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  return (
    <Card className="col-span-2">
      <WidgetTitle>{t("activity_title")}</WidgetTitle>
      {items === null && <p className="text-[12px] text-white/35">{tApp("loading")}</p>}
      {items !== null && items.length === 0 && (
        <p className="text-[12px] text-white/35">{t("activity_empty")}</p>
      )}
      {items !== null && items.length > 0 && (
        <div className="flex flex-col gap-3.5">
          {items.slice(0, 6).map((ev) => (
            <div key={ev.id} className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full ${actionColor(ev.action)}`}
                style={{ boxShadow: "0 0 6px currentColor" }}
              />
              <div className="flex-1">
                <div className="font-mono-display text-[10px] text-white/35">
                  {formatRel(ev.created_at, t)}
                </div>
                <div className="text-[12px] leading-[1.4] text-white/60">
                  {humanAction(ev.action, ev.entity_type, t)}
                  {ev.entity_id && (
                    <span className="ml-2 font-mono-display text-[10px] text-violet-300/80">
                      {ev.entity_id.slice(0, 8)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Top fournisseurs (mock pour l'instant — endpoint dédié à venir)
// ────────────────────────────────────────────────────────────

export function TopSuppliers() {
  const t = useTranslations("dashboard");
  const MOCK = [
    { name: "ΕΛΛΗΝΙΚΗ ΒΙΟΜΗΧΑΝΙΑ ΑΕ", count: 18, amount: "€12 840" },
    { name: "Acme SA", count: 14, amount: "€8 920" },
    { name: "Olivier Logistics SARL", count: 9, amount: "€4 310" },
    { name: "Epsilon Hellas Ltd", count: 7, amount: "€3 180" },
    { name: "Nord Energy", count: 5, amount: "€2 450" },
  ];
  const max = Math.max(...MOCK.map((s) => s.count));

  return (
    <Card className="col-span-2">
      <WidgetTitle>{t("top_suppliers_title")}</WidgetTitle>
      <div className="flex flex-col gap-3">
        {MOCK.map((s, i) => (
          <div key={s.name} className="flex items-center gap-2.5">
            <span className="w-3.5 shrink-0 text-right font-mono-display text-[10px] text-white/35">
              {i + 1}
            </span>
            <span className="flex-1 truncate text-[12px] text-white/60">{s.name}</span>
            <div className="h-[3px] w-[70px] shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(s.count / max) * 100}%`,
                  background: "linear-gradient(90deg, #8b5cf6, rgba(99,102,241,0.6))",
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono-display text-[11px] text-white/60">
              {s.amount}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Santé intégrations
// ────────────────────────────────────────────────────────────

interface HealthState {
  outlook: "ok" | "warn" | "off";
  gmail: "ok" | "warn" | "off";
  gdrive: "ok" | "warn" | "off";
  mydata: "ok" | "warn" | "off";
  erp: "ok" | "warn" | "off";
}

export function IntegrationsHealth() {
  const t = useTranslations("dashboard");
  const [state, setState] = useState<HealthState>({
    outlook: "off",
    gmail: "off",
    gdrive: "off",
    mydata: "off",
    erp: "off",
  });

  useEffect(() => {
    Promise.all([
      apiFetch<{ provider: string; is_active: boolean }[]>("/integrations/email-sources").catch(
        () => [],
      ),
      apiFetch<unknown[]>("/integrations/gdrive-sources").catch(() => []),
      apiFetch<{ is_active: boolean } | null>("/integrations/mydata").catch(() => null),
      apiFetch<{ is_active: boolean } | null>("/integrations/erp").catch(() => null),
    ]).then(([emails, drives, mydata, erp]) => {
      const outlook = emails.find((s) => s.provider === "outlook");
      const gmail = emails.find((s) => s.provider === "gmail");
      setState({
        outlook: outlook ? (outlook.is_active ? "ok" : "warn") : "off",
        gmail: gmail ? (gmail.is_active ? "ok" : "warn") : "off",
        gdrive: drives.length > 0 ? "ok" : "off",
        mydata: mydata?.is_active ? "ok" : "off",
        erp: erp?.is_active ? "ok" : "off",
      });
    });
  }, []);

  const CHIPS: Array<{ key: keyof HealthState; label: string }> = [
    { key: "outlook", label: "Outlook" },
    { key: "gmail", label: "Gmail" },
    { key: "gdrive", label: "Drive" },
    { key: "mydata", label: "myDATA" },
    { key: "erp", label: "ERP" },
  ];

  return (
    <Card>
      <WidgetTitle>{t("integrations_title")}</WidgetTitle>
      <div className="flex flex-col gap-2">
        {CHIPS.map(({ key, label }) => {
          const s = state[key];
          return (
            <div
              key={key}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/60"
            >
              <span
                className={`h-[7px] w-[7px] rounded-full ${
                  s === "ok"
                    ? "bg-emerald-500"
                    : s === "warn"
                      ? "animate-pulse bg-amber-500"
                      : "bg-white/20"
                }`}
                style={{
                  boxShadow:
                    s === "ok"
                      ? "0 0 6px #10b981"
                      : s === "warn"
                        ? "0 0 6px #f59e0b"
                        : undefined,
                }}
              />
              <span className="flex-1">{label}</span>
              <span
                className={`font-mono-display text-[10px] ${
                  s === "ok"
                    ? "text-emerald-400"
                    : s === "warn"
                      ? "text-amber-400"
                      : "text-white/25"
                }`}
              >
                {s === "ok" ? t("integration_connected") : s === "warn" ? t("integration_warning") : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// À faire aujourd'hui
// ────────────────────────────────────────────────────────────

export function TodoList({ stats }: { stats: InvoiceStats | null }) {
  const t = useTranslations("dashboard");
  const c = stats?.counters ?? {};
  const reviewCount = c.ready_for_review ?? 0;
  const failedCount = c.failed ?? 0;
  const items = [
    {
      done: false,
      label:
        reviewCount > 1
          ? t("todo_validate_plural", { count: reviewCount })
          : t("todo_validate_singular", { count: reviewCount }),
    },
    {
      done: failedCount === 0,
      label:
        failedCount > 1
          ? t("todo_failures_plural", { count: failedCount })
          : t("todo_failures_singular", { count: failedCount }),
    },
    { done: false, label: t("todo_export_batch") },
  ];

  return (
    <Card>
      <WidgetTitle>{t("todo_title")}</WidgetTitle>
      <div className="flex flex-col gap-2.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5 text-[12px] text-white/60">
            <div
              className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border transition ${
                it.done
                  ? "border-transparent"
                  : "border-white/[0.08] bg-white/[0.03] hover:border-violet-500/50 hover:bg-violet-500/10"
              }`}
              style={
                it.done
                  ? {
                      background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                    }
                  : undefined
              }
            >
              {it.done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
            </div>
            <span className={it.done ? "text-white/35 line-through" : ""}>{it.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Raccourcis
// ────────────────────────────────────────────────────────────

export function Shortcuts() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const tiles = [
    { href: "/upload", icon: Upload, label: tNav("upload") },
    { href: "#", icon: Search, label: "⌘K" },
    { href: "#", icon: Download, label: t("shortcut_export") },
    { href: "/admin/audit", icon: FileText, label: tNav("audit") },
  ];

  return (
    <Card className="col-span-2">
      <WidgetTitle>{t("shortcuts_title")}</WidgetTitle>
      <div className="grid grid-cols-4 gap-2.5">
        {tiles.map(({ href, icon: Icon, label }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-4 transition hover:scale-[1.03] hover:border-violet-500/30 hover:bg-violet-500/10"
          >
            <Icon className="h-5 w-5 text-violet-300" />
            <span className="text-[11px] font-medium text-white/60">{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Greeting topbar
// ────────────────────────────────────────────────────────────

export function Greeting({ name, total }: { name: string; total: number | null }) {
  const t = useTranslations("dashboard");
  const hour = new Date().getHours();
  const salut =
    hour < 12 ? t("greeting_morning") : hour < 18 ? t("greeting_afternoon") : t("greeting_evening");
  const firstName = name.split(" ")[0] || name;

  return (
    <div>
      <h1 className="font-serif-italic text-[30px] leading-none tracking-tight text-white/95">
        {salut} {firstName}
      </h1>
      <p className="mt-1 text-[13px] text-white/60">
        {total !== null
          ? t("greeting_subtitle", { count: total })
          : t("greeting_subtitle_loading")}
      </p>
    </div>
  );
}
