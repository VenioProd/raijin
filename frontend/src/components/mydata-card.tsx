"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import type {
  MyDataConnector,
  MyDataConnectorInput,
  MyDataConnectorKind,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function MyDataCard() {
  const t = useTranslations("integrations");

  const KIND_LABELS: Record<MyDataConnectorKind, string> = {
    epsilon_digital: t("mydata_kind_epsilon_digital"),
    softone_mydata: t("mydata_kind_softone"),
    aade_direct: t("mydata_kind_aade_direct"),
  };

  const CREDENTIAL_FIELDS: Record<MyDataConnectorKind, string[]> = {
    epsilon_digital: ["api_key"],
    softone_mydata: ["client_id", "client_secret", "subscription_id"],
    aade_direct: ["user_id", "subscription_key"],
  };

  const [connector, setConnector] = useState<MyDataConnector | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [kind, setKind] = useState<MyDataConnectorKind>("epsilon_digital");
  const [baseUrl, setBaseUrl] = useState("");
  const [issuerVat, setIssuerVat] = useState("");
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MyDataConnector | null>("/integrations/mydata");
      setConnector(data);
      if (data) {
        setKind(data.kind);
        setBaseUrl(data.base_url);
        setIssuerVat(data.issuer_vat_number ?? "");
        setAutoSubmit(data.auto_submit);
      }
    } catch {
      toast.error(t("mydata_load_error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const missing = CREDENTIAL_FIELDS[kind].filter((f) => !credentials[f]);
    if (missing.length > 0) {
      toast.error(t("missing_fields", { fields: missing.join(", ") }));
      return;
    }

    setSaving(true);
    try {
      const body: MyDataConnectorInput = {
        kind,
        base_url: baseUrl,
        credentials,
        issuer_vat_number: issuerVat || null,
        auto_submit: autoSubmit,
        is_active: true,
      };
      const updated = await apiFetch<MyDataConnector>("/integrations/mydata", {
        method: "PUT",
        json: body,
      });
      setConnector(updated);
      setEditing(false);
      setCredentials({});
      toast.success(t("mydata_saved"));
    } catch {
      toast.error(t("save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    if (!confirm(t("confirm_disable_mydata"))) return;
    try {
      await apiFetch("/integrations/mydata", { method: "DELETE" });
      toast.success(t("connector_disabled"));
      await load();
    } catch {
      toast.error(t("disable_failed"));
    }
  }

  const showForm = editing || !connector;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("mydata_title")}</CardTitle>
        <CardDescription>{t("mydata_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

        {!loading && connector && !editing && (
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">{t("connector_label")} :</span> {KIND_LABELS[connector.kind]}
            </p>
            <p className="text-muted-foreground">{t("base_url")} : {connector.base_url}</p>
            {connector.issuer_vat_number && (
              <p className="text-muted-foreground">
                {t("issuer_vat")} : {connector.issuer_vat_number}
              </p>
            )}
            <p>
              <span className="font-medium">{t("auto_submit")} :</span>{" "}
              {connector.auto_submit ? t("enabled") : t("disabled")} ·{" "}
              <span className={connector.is_active ? "text-emerald-700" : "text-rose-700"}>
                {connector.is_active ? t("status_active") : t("status_inactive")}
              </span>
            </p>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                {t("edit")}
              </Button>
              {connector.is_active && (
                <Button size="sm" variant="destructive" onClick={disable}>
                  {t("disable")}
                </Button>
              )}
            </div>
          </div>
        )}

        {!loading && showForm && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("connector_type")}</Label>
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as MyDataConnectorKind);
                  setCredentials({});
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {(Object.keys(KIND_LABELS) as MyDataConnectorKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>{t("base_url")}</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.mon-connecteur.gr"
              />
            </div>

            <div className="space-y-1">
              <Label>{t("issuer_vat_label")}</Label>
              <Input
                value={issuerVat}
                onChange={(e) => setIssuerVat(e.target.value.toUpperCase())}
                placeholder="123456789"
              />
            </div>

            {CREDENTIAL_FIELDS[kind].map((field) => (
              <div className="space-y-1" key={field}>
                <Label>{field}</Label>
                {field.includes("secret") || field.includes("key") ? (
                  <Textarea
                    rows={2}
                    value={credentials[field] ?? ""}
                    onChange={(e) =>
                      setCredentials({ ...credentials, [field]: e.target.value })
                    }
                    placeholder={t("secret_value_placeholder")}
                  />
                ) : (
                  <Input
                    value={credentials[field] ?? ""}
                    onChange={(e) =>
                      setCredentials({ ...credentials, [field]: e.target.value })
                    }
                  />
                )}
              </div>
            ))}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mydata-auto"
                checked={autoSubmit}
                onChange={(e) => setAutoSubmit(e.target.checked)}
              />
              <Label htmlFor="mydata-auto">
                {t("auto_submit_each_validated")}
              </Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving || !baseUrl}>
                {saving ? t("saving") : t("save")}
              </Button>
              {connector && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  {t("cancel")}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
