"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface IpRule {
  id: string;
  cidr: string;
  is_active: boolean;
}

export default function AdminIpRulesPage() {
  const t = useTranslations("admin");
  const tApp = useTranslations("app");
  const tCommon = useTranslations("common");
  const [rules, setRules] = useState<IpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [cidr, setCidr] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<IpRule[]>("/security/ip-rules");
      setRules(list);
    } catch (err) {
      const msg = err instanceof ApiError ? t("common.error_status", { status: err.status }) : tCommon("error_network");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (!cidr.trim()) return;
    setCreating(true);
    try {
      const created = await apiFetch<IpRule>("/security/ip-rules", {
        method: "POST",
        json: { cidr: cidr.trim() },
      });
      setRules((prev) => [created, ...prev]);
      setCidr("");
      toast.success(t("ip_rules.toast_created"));
    } catch (err) {
      const msg = err instanceof ApiError ? t("common.error_status", { status: err.status }) : tCommon("error_network");
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm(t("ip_rules.confirm_delete"))) return;
    try {
      await apiFetch(`/security/ip-rules/${id}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success(t("ip_rules.toast_deleted"));
    } catch (err) {
      const msg = err instanceof ApiError ? t("common.error_status", { status: err.status }) : tCommon("error_network");
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("ip_rules.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("ip_rules.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("ip_rules.add_title")}</CardTitle>
          <CardDescription>
            {t("ip_rules.cidr_help_prefix")} <code className="text-violet-300">192.168.1.0/24</code>,{" "}
            <code className="text-violet-300">10.0.0.5/32</code> {t("ip_rules.cidr_help_single")}{" "}
            <code className="text-violet-300">2001:db8::/32</code> {t("ip_rules.cidr_help_ipv6")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex items-end gap-3" onSubmit={createRule}>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="cidr">{t("ip_rules.cidr_label")}</Label>
              <Input
                id="cidr"
                placeholder={t("ip_rules.cidr_placeholder")}
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                disabled={creating}
                required
              />
            </div>
            <Button type="submit" disabled={creating || !cidr.trim()}>
              {creating ? t("ip_rules.adding") : t("ip_rules.add")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("ip_rules.active_title")}</CardTitle>
          <CardDescription>
            {loading
              ? tApp("loading")
              : rules.length === 0
                ? t("ip_rules.empty")
                : t("ip_rules.count", { count: rules.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length > 0 && (
            <ul className="divide-y divide-white/[0.06]">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <code className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-sm text-violet-200">
                      {rule.cidr}
                    </code>
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wider ${
                        rule.is_active ? "text-emerald-300" : "text-white/35"
                      }`}
                    >
                      {rule.is_active ? t("ip_rules.status_active") : t("ip_rules.status_inactive")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteRule(rule.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-rose-200 transition hover:bg-rose-500/[0.08] hover:text-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {tCommon("delete")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
