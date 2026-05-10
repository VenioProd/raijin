"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";
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

interface SamlConfig {
  id?: string;
  entity_id: string | null;
  sso_url: string | null;
  certificate: string | null;
  is_enabled: boolean;
}

const EMPTY: SamlConfig = {
  entity_id: "",
  sso_url: "",
  certificate: "",
  is_enabled: false,
};

export default function AdminSamlPage() {
  const t = useTranslations("admin");
  const tApp = useTranslations("app");
  const tCommon = useTranslations("common");
  const [config, setConfig] = useState<SamlConfig>(EMPTY);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6200";

  useEffect(() => {
    Promise.all([
      apiFetch<SamlConfig | null>("/security/saml").catch(() => null),
      apiFetch<User>("/auth/me").catch(() => null),
    ]).then(([cfg, me]) => {
      if (cfg) setConfig({ ...EMPTY, ...cfg });
      if (me) setUser(me);
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const updated = await apiFetch<SamlConfig>("/security/saml", {
        method: "PUT",
        json: {
          entity_id: config.entity_id || null,
          sso_url: config.sso_url || null,
          certificate: config.certificate || null,
          is_enabled: config.is_enabled,
        },
      });
      setConfig({ ...EMPTY, ...updated });
      toast.success(t("saml.toast_saved"));
    } catch (err) {
      const msg = err instanceof ApiError ? t("common.error_status", { status: err.status }) : tCommon("error_network");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const slug = user?.tenant?.slug ?? "tenant-slug";
  const acsUrl = `${apiUrl}/auth/saml/acs/${slug}`;
  const entityId = `${apiUrl}/auth/saml/metadata/${slug}`;
  const metadataUrl = `${apiUrl}/auth/saml/metadata/${slug}`;

  if (loading) {
    return <div className="text-sm text-white/50">{tApp("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("saml.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("saml.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("saml.sp_title")}</CardTitle>
          <CardDescription>
            {t("saml.sp_description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/45">{t("saml.entity_id_label")}</div>
            <code className="block break-all rounded-md bg-white/[0.04] px-2 py-1 font-mono text-violet-200">
              {entityId}
            </code>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/45">{t("saml.acs_url_label")}</div>
            <code className="block break-all rounded-md bg-white/[0.04] px-2 py-1 font-mono text-violet-200">
              {acsUrl}
            </code>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/45">{t("saml.metadata_label")}</div>
            <a
              href={metadataUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-violet-300 underline-offset-4 hover:underline"
            >
              {metadataUrl}
            </a>
          </div>
          <p className="text-[11px] text-white/45">
            {t("saml.nameid_prefix")} <code className="text-violet-200">emailAddress</code>. {t("saml.attributes_prefix")}
            <code className="ml-1 text-violet-200">email</code> {t("saml.or")} <code className="text-violet-200">emailAddress</code>,
            {t("saml.optionally")} <code className="text-violet-200">displayName</code> {t("saml.or")}{" "}
            <code className="text-violet-200">givenName</code> + <code className="text-violet-200">surname</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("saml.idp_title")}</CardTitle>
          <CardDescription>
            {t("saml.idp_description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="idp-entity">{t("saml.idp_entity_id_label")}</Label>
            <Input
              id="idp-entity"
              placeholder={t("saml.idp_entity_id_placeholder")}
              value={config.entity_id ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, entity_id: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idp-sso">{t("saml.sso_url_label")}</Label>
            <Input
              id="idp-sso"
              placeholder={t("saml.sso_url_placeholder")}
              value={config.sso_url ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, sso_url: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idp-cert">{t("saml.certificate_label")}</Label>
            <Textarea
              id="idp-cert"
              placeholder={"-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"}
              value={config.certificate ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, certificate: e.target.value }))}
              className="min-h-[140px] font-mono text-[12px]"
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-white/80">
            <input
              type="checkbox"
              checked={config.is_enabled}
              onChange={(e) => setConfig((c) => ({ ...c, is_enabled: e.target.checked }))}
            />
            {t("saml.enable_checkbox")}
          </label>
          <Button onClick={save} disabled={saving}>
            {saving ? t("saml.saving") : t("saml.save")}
          </Button>
        </CardContent>
      </Card>

      {config.is_enabled && user?.tenant?.slug && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("saml.test_title")}</CardTitle>
            <CardDescription>
              {t("saml.test_description_prefix")}
              <code className="ml-1 text-violet-200">{user.tenant.slug}</code>. {t("saml.test_description_suffix")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href={`${apiUrl}/auth/saml/login/${user.tenant.slug}`}
              className="btn-glass inline-flex"
            >
              {t("saml.test_link")}
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
