"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoiceLine } from "@/lib/types";

export function InvoiceLinesEditor({
  lines,
  onChange,
}: {
  lines: InvoiceLine[];
  onChange: (lines: InvoiceLine[]) => void;
}) {
  const t = useTranslations("invoice_review");

  function updateLine(idx: number, patch: Partial<InvoiceLine>) {
    const next = [...lines];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function removeLine(idx: number) {
    const next = lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, line_number: i + 1 }));
    onChange(next);
  }

  function addLine() {
    onChange([
      ...lines,
      {
        line_number: lines.length + 1,
        description: "",
        quantity: null,
        unit_price: null,
        vat_rate: null,
        line_total_ht: null,
        line_total_ttc: null,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">{t("col_description")}</th>
              <th className="p-2 w-24">{t("col_quantity")}</th>
              <th className="p-2 w-28">{t("col_unit_price")}</th>
              <th className="p-2 w-24">{t("col_vat")}</th>
              <th className="p-2 w-28">{t("col_total_ht")}</th>
              <th className="p-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line, idx) => (
              <tr key={idx}>
                <td className="p-2 text-xs text-muted-foreground">{line.line_number}</td>
                <td className="p-2">
                  <Input
                    value={line.description ?? ""}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                    className="h-8"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={line.quantity ?? ""}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value || null })}
                    className="h-8"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={line.unit_price ?? ""}
                    onChange={(e) => updateLine(idx, { unit_price: e.target.value || null })}
                    className="h-8"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={line.vat_rate ?? ""}
                    onChange={(e) => updateLine(idx, { vat_rate: e.target.value || null })}
                    className="h-8"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={line.line_total_ht ?? ""}
                    onChange={(e) => updateLine(idx, { line_total_ht: e.target.value || null })}
                    className="h-8"
                  />
                </td>
                <td className="p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(idx)}
                    aria-label={t("remove_line")}
                  >
                    ×
                  </Button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-sm text-muted-foreground">
                  {t("no_lines_extracted")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        {t("add_line")}
      </Button>
    </div>
  );
}
