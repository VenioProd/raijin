"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { apiFetch, ApiError } from "@/lib/api";
import type { AuthorizeResponse, CloudDriveSource, EmailSource } from "@/lib/types";
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
import { MyDataCard } from "@/components/mydata-card";
import { ErpCard } from "@/components/erp-card";

export default function IntegrationsPage() {
  const t = useTranslations("integrations");
  const locale = useLocale();
  const [emailSources, setEmailSources] = useState<EmailSource[]>([]);
  const [driveSources, setDriveSources] = useState<CloudDriveSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingOutlook, setConnectingOutlook] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState("");
  const searchParams = useSearchParams();

  const localeTag = locale === "fr" ? "fr-FR" : locale === "el" ? "el-GR" : "en-US";

  function formatRelative(iso: string | null): string {
    if (!iso) return t("never");
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return t("just_now");
    if (diff < 3_600_000) return t("minutes_ago", { count: Math.round(diff / 60_000) });
    if (diff < 86_400_000) return t("hours_ago", { count: Math.round(diff / 3_600_000) });
    return d.toLocaleDateString(localeTag);
  }

  const load = useCallback(async () => {
    try {
      const [emails, drives] = await Promise.all([
        apiFetch<EmailSource[]>("/integrations/email-sources"),
        apiFetch<CloudDriveSource[]>("/integrations/gdrive-sources"),
      ]);
      setEmailSources(emails);
      setDriveSources(drives);
    } catch {
      toast.error(t("load_error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");
    if (connected === "outlook") toast.success(t("connected_outlook"));
    else if (connected === "gmail") toast.success(t("connected_gmail"));
    else if (connected === "gdrive") toast.success(t("connected_gdrive"));
    else if (err) toast.error(t("connection_failed", { error: err }));
  }, [searchParams, t]);

  async function connectProvider(
    path: string,
    setLoading: (v: boolean) => void,
    label: string,
  ) {
    setLoading(true);
    try {
      const res = await apiFetch<AuthorizeResponse>(path, { method: "POST" });
      window.location.href = res.authorize_url;
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        toast.error(t("oauth_not_configured", { label }));
      } else {
        toast.error(t("cannot_start_connection"));
      }
      setLoading(false);
    }
  }

  async function connectDrive() {
    if (!driveFolderId.trim()) {
      toast.error(t("drive_folder_required"));
      return;
    }
    setConnectingDrive(true);
    try {
      const url = `/integrations/gdrive/authorize?folder_id=${encodeURIComponent(driveFolderId.trim())}`;
      const res = await apiFetch<AuthorizeResponse>(url, { method: "POST" });
      window.location.href = res.authorize_url;
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        toast.error(t("oauth_google_not_configured"));
      } else {
        toast.error(t("cannot_start_connection"));
      }
      setConnectingDrive(false);
    }
  }

  async function syncEmailNow(source: EmailSource) {
    try {
      await apiFetch(`/integrations/email-sources/${source.id}/sync`, { method: "POST" });
      toast.success(t("sync_started"));
    } catch {
      toast.error(t("sync_failed"));
    }
  }

  async function syncDriveNow(source: CloudDriveSource) {
    try {
      await apiFetch(`/integrations/gdrive-sources/${source.id}/sync`, { method: "POST" });
      toast.success(t("sync_drive_started"));
    } catch {
      toast.error(t("sync_failed"));
    }
  }

  async function disconnectEmail(source: EmailSource) {
    if (!confirm(t("confirm_disconnect_email", { email: source.account_email }))) return;
    try {
      await apiFetch(`/integrations/email-sources/${source.id}`, { method: "DELETE" });
      toast.success(t("source_disconnected"));
      await load();
    } catch {
      toast.error(t("disconnect_failed"));
    }
  }

  async function disconnectDrive(source: CloudDriveSource) {
    if (!confirm(t("confirm_disconnect_folder", { folder: source.folder_id }))) return;
    try {
      await apiFetch(`/integrations/gdrive-sources/${source.id}`, { method: "DELETE" });
      toast.success(t("source_disconnected"));
      await load();
    } catch {
      toast.error(t("disconnect_failed"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Microsoft Outlook</CardTitle>
            <CardDescription>{t("outlook_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => connectProvider("/integrations/outlook/authorize", setConnectingOutlook, "Microsoft")}
              disabled={connectingOutlook}
            >
              {connectingOutlook ? t("redirecting") : t("connect_outlook")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gmail</CardTitle>
            <CardDescription>{t("gmail_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => connectProvider("/integrations/gmail/authorize", setConnectingGmail, "Google")}
              disabled={connectingGmail}
            >
              {connectingGmail ? t("redirecting") : t("connect_gmail")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Google Drive</CardTitle>
            <CardDescription>{t("gdrive_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>{t("folder_id_label")}</Label>
            <Input
              value={driveFolderId}
              onChange={(e) => setDriveFolderId(e.target.value)}
              placeholder={t("folder_id_placeholder")}
            />
            <Button onClick={connectDrive} disabled={connectingDrive}>
              {connectingDrive ? t("redirecting") : t("connect_drive")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MyDataCard />
        <ErpCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("email_sources_title", { count: emailSources.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {!loading && emailSources.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("no_email_connected")}
            </p>
          )}
          {emailSources.length > 0 && (
            <ul className="divide-y">
              {emailSources.map((source) => (
                <li key={source.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{source.account_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.provider.toUpperCase()} · {t("folder")} {source.folder} ·{" "}
                      {source.is_active ? (
                        <span className="text-emerald-700">{t("active")}</span>
                      ) : (
                        <span className="text-rose-700">{t("inactive")}</span>
                      )}{" "}
                      · {t("last_sync")} : {formatRelative(source.last_sync_at)}
                    </p>
                    {source.last_error && (
                      <p className="mt-1 text-xs text-destructive">{t("error_label")} : {source.last_error}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => syncEmailNow(source)} disabled={!source.is_active}>
                      {t("sync")}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => disconnectEmail(source)}>
                      {t("disconnect")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("drive_sources_title", { count: driveSources.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {!loading && driveSources.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("no_folder_connected")}</p>
          )}
          {driveSources.length > 0 && (
            <ul className="divide-y">
              {driveSources.map((source) => (
                <li key={source.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{source.folder_name ?? source.folder_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.provider.toUpperCase()} · {source.account_email ?? "—"} ·{" "}
                      {source.is_active ? (
                        <span className="text-emerald-700">{t("active")}</span>
                      ) : (
                        <span className="text-rose-700">{t("inactive")}</span>
                      )}{" "}
                      · {t("last_sync")} : {formatRelative(source.last_sync_at)}
                    </p>
                    {source.last_error && (
                      <p className="mt-1 text-xs text-destructive">{t("error_label")} : {source.last_error}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => syncDriveNow(source)} disabled={!source.is_active}>
                      {t("sync")}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => disconnectDrive(source)}>
                      {t("disconnect")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
