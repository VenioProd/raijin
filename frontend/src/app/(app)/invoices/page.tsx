"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckSquare, Download, Send, Trash2, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { InvoiceListResponse, InvoiceStatus } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6200";

const STATUS_FILTER_VALUES: (InvoiceStatus | "all")[] = [
  "all",
  "ready_for_review",
  "processing",
  "confirmed",
  "rejected",
  "failed",
  "uploaded",
];

function formatMoney(amount: string | null, currency: string): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [paid, setPaid] = useState<"all" | "paid" | "unpaid">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page), page_size: "30" });
    if (filter !== "all") qs.set("status_filter", filter);
    if (query.trim()) qs.set("q", query.trim());
    if (paid !== "all") qs.set("paid", String(paid === "paid"));
    apiFetch<InvoiceListResponse>(`/invoices?${qs.toString()}`)
      .then(setData)
      .catch(() => setError(t("load_error")));
  }, [page, filter, query, paid, t]);

  const pageCount = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.page_size));
  }, [data]);

  function buildListQuery(): string {
    const qs = new URLSearchParams({ page: String(page), page_size: "30" });
    if (filter !== "all") qs.set("status_filter", filter);
    if (query.trim()) qs.set("q", query.trim());
    if (paid !== "all") qs.set("paid", String(paid === "paid"));
    return qs.toString();
  }

  async function refreshList() {
    setData(await apiFetch<InvoiceListResponse>(`/invoices?${buildListQuery()}`));
  }

  async function exportExcel(selectedOnly = false) {
    setExporting(true);
    try {
      const token = getAccessToken();
      const qs = new URLSearchParams();
      if (selectedOnly) {
        for (const id of selected) qs.append("ids", id);
      }
      const queryString = qs.toString();
      const path = queryString ? `/exports/excel?${queryString}` : "/exports/excel";
      const res = await fetch(`${API_URL}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      link.download = match ? match[1] : "raijin-export.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  }

  async function bulk(
    action: "confirm" | "mark_paid" | "reopen" | "reject" | "submit_mydata" | "export_erp" | "delete",
    ids = Array.from(selected),
  ) {
    await apiFetch("/invoices/bulk", {
      method: "POST",
      json: { ids, action },
    });
    setSelected(new Set());
    await refreshList();
  }

  async function dropToStatus(status: InvoiceStatus | "all") {
    if (!draggedId || status === "all") return;
    const actionByStatus: Partial<Record<InvoiceStatus, "confirm" | "reopen" | "reject">> = {
      confirmed: "confirm",
      ready_for_review: "reopen",
      rejected: "reject",
    };
    const action = actionByStatus[status];
    setDraggedId(null);
    if (action) await bulk(action, [draggedId]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif-italic text-[30px] leading-none text-white/95">
            {t("title")}
          </h1>
          <p className="mt-1 text-[13px] text-white/60">
            {data
              ? t("count_summary", { count: data.total, page: data.page, pages: pageCount })
              : t("loading")}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => exportExcel()} className="btn-glass" disabled={exporting}>
            <Download className="h-3.5 w-3.5" />
            {exporting ? t("export_in_progress") : t("export_excel")}
          </button>
          <Link href="/upload" className="btn-primary-violet">
            <Upload className="h-3.5 w-3.5" />
            {t("import")}
          </Link>
        </div>
      </div>

      {/* Filtres pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTER_VALUES.map((value) => (
          <button
            key={value}
            onDragOver={(e) => {
              if (draggedId) e.preventDefault();
            }}
            onDrop={() => dropToStatus(value)}
            onClick={() => {
              setFilter(value);
              setPage(1);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === value
                ? "text-white"
                : "bg-white/[0.05] text-white/60 hover:bg-white/[0.08]",
            )}
            style={
              filter === value
                ? {
                    background:
                      "linear-gradient(90deg, rgba(139,92,246,0.3) 0%, rgba(99,102,241,0.2) 100%)",
                    border: "1px solid rgba(139,92,246,0.4)",
                  }
                : { border: "1px solid rgba(255,255,255,0.06)" }
            }
          >
            {t(`filters.${value}` as "filters.all")}
          </button>
        ))}
      </div>

      <div className="glass flex flex-wrap items-center gap-2 p-3" style={{ borderRadius: 14 }}>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={t("search_placeholder")}
          className="h-9 min-w-[240px] rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white placeholder:text-white/35 outline-none"
        />
        <select
          value={paid}
          onChange={(e) => {
            setPaid(e.target.value as typeof paid);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white"
        >
          <option value="all">{t("payment_filter.all")}</option>
          <option value="paid">{t("payment_filter.paid")}</option>
          <option value="unpaid">{t("payment_filter.unpaid")}</option>
        </select>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2 text-[12px] text-white/60">
            <CheckSquare className="h-4 w-4 text-violet-200" />
            {t("selected_count", { count: selected.size })}
            <button className="btn-glass" onClick={() => bulk("confirm")}>{t("bulk.confirm")}</button>
            <button className="btn-glass" onClick={() => bulk("mark_paid")}>{t("bulk.mark_paid")}</button>
            <button className="btn-glass" onClick={() => exportExcel(true)}>
              <Download className="h-3.5 w-3.5" />
              {t("bulk.export")}
            </button>
            <button className="btn-glass" onClick={() => bulk("submit_mydata")}>
              <Send className="h-3.5 w-3.5" />
              {t("bulk.mydata")}
            </button>
            <button className="btn-glass" onClick={() => bulk("export_erp")}>{t("bulk.erp")}</button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] font-medium text-rose-200"
              onClick={() => bulk("delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("bulk.delete")}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="glass overflow-hidden" style={{ borderRadius: 18 }}>
        <div className="relative z-10">
          {data && data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center text-sm text-white/60">
              <p>{t("empty_state")}</p>
              <Link href="/upload" className="btn-glass">
                <Upload className="h-3.5 w-3.5" />
                {t("import_invoice")}
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.10em] text-white/35">
                  <th className="px-5 py-3"></th>
                  <th className="px-5 py-3">{t("col_file")}</th>
                  <th className="px-5 py-3">{t("col_number")}</th>
                  <th className="px-5 py-3">{t("col_date")}</th>
                  <th className="px-5 py-3">{t("col_total_ttc")}</th>
                  <th className="px-5 py-3">{t("col_status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data?.items.map((inv) => (
                  <tr
                    key={inv.id}
                    draggable
                    onDragStart={() => setDraggedId(inv.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className="cursor-pointer transition hover:bg-white/[0.03]"
                    onClick={() => {
                      window.location.href = `/invoices/${inv.id}`;
                    }}
                  >
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        onChange={(e) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (e.target.checked) next.add(inv.id);
                            else next.delete(inv.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="px-5 py-3 text-white/90">{inv.source_file_name}</td>
                    <td className="px-5 py-3 font-mono-display text-[12px] text-white/60">
                      <div className="flex items-center gap-2">
                        <span>{inv.invoice_number ?? "—"}</span>
                        {inv.possible_duplicate_of_id && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            {t("duplicate_badge")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-white/60">{formatDate(inv.issue_date)}</td>
                    <td className="px-5 py-3 font-mono-display text-white/80">
                      {formatMoney(inv.total_ttc, inv.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={inv.status} />
                        {inv.paid_at && (
                          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                            {t("paid_badge")}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data && data.total > data.page_size && (
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-[12px] text-white/45">
              <span>
                {t("pagination_summary", {
                  page: data.page,
                  pages: pageCount,
                  count: data.total,
                })}
              </span>
              <div className="flex gap-2">
                <button
                  className="btn-glass disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("previous")}
                </button>
                <button
                  className="btn-glass disabled:opacity-40"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  {t("next")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
