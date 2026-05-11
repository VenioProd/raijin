"use client";

import { useEffect, useState } from "react";
import { Key, Shield, Sparkles, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError, apiFetch } from "@/lib/api";
import type { ApiKey, User, UserSession } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

type Tab = "profile" | "security" | "preferences";

const inputClass =
  "h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white placeholder:text-white/35 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-60";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass p-6" style={{ borderRadius: 18 }}>
      <div className="relative z-10">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-[12px] text-white/45">{description}</p>
        )}
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tApp = useTranslations("app");
  const tCommon = useTranslations("common");
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("profile");

  const [fullName, setFullName] = useState("");
  const [locale, setLocale] = useState("fr");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [newKeyName, setNewKeyName] = useState("Integration key");
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [totpUrl, setTotpUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, { in_app: boolean; email: boolean }>>({});

  const TABS: { value: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "profile", label: t("tab_profile"), icon: UserCircle },
    { value: "security", label: t("tab_security"), icon: Shield },
    { value: "preferences", label: t("tab_preferences"), icon: Sparkles },
  ];

  useEffect(() => {
    apiFetch<User>("/auth/me")
      .then((u) => {
        setUser(u);
        setFullName(u.full_name ?? "");
        setLocale(u.locale ?? "fr");
      })
      .catch(() => toast.error(t("profile_load_failed")));
  }, [t]);

  useEffect(() => {
    if (tab === "security") {
      apiFetch<ApiKey[]>("/security/api-keys").then(setApiKeys).catch(() => {});
      apiFetch<UserSession[]>("/security/sessions").then(setSessions).catch(() => {});
    }
    if (tab === "preferences") {
      apiFetch<Record<string, { in_app: boolean; email: boolean }>>("/me/notification-preferences")
        .then(setNotificationPrefs)
        .catch(() => {});
    }
  }, [tab]);

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    try {
      const updated = await apiFetch<User>("/me/profile", {
        method: "PATCH",
        json: { full_name: fullName || null, locale },
      });
      setUser(updated);
      toast.success(t("profile_saved"));
      if (locale !== (user.locale ?? "fr")) {
        document.cookie = `raijin.locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
        window.location.reload();
      }
    } catch {
      toast.error(t("save_failed"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function createApiKey() {
    try {
      const created = await apiFetch<{ api_key: ApiKey; secret: string }>("/security/api-keys", {
        method: "POST",
        json: {
          name: newKeyName,
          scopes: ["invoices:read", "invoices:write"],
        },
      });
      setApiKeys((items) => [created.api_key, ...items]);
      setNewKeySecret(created.secret);
      toast.success(t("api_key_created"));
    } catch {
      toast.error(t("api_key_create_failed"));
    }
  }

  async function revokeApiKey(id: string) {
    await apiFetch(`/security/api-keys/${id}/revoke`, { method: "POST" });
    setApiKeys((items) =>
      items.map((item) => (item.id === id ? { ...item, revoked_at: new Date().toISOString() } : item)),
    );
  }

  async function setupTotp() {
    const setup = await apiFetch<{ otpauth_url: string; backup_codes: string[] }>("/security/totp/setup", { method: "POST" });
    setTotpUrl(setup.otpauth_url);
    setBackupCodes(setup.backup_codes);
    toast.success(t("totp_secret_generated"));
  }

  async function enableTotp() {
    await apiFetch("/security/totp/enable", { method: "POST", json: { code: totpCode } });
    setUser((u) => (u ? { ...u, totp_enabled: true } : u));
    toast.success(t("totp_enabled_toast"));
  }

  async function saveNotificationPrefs() {
    await apiFetch("/me/notification-preferences", {
      method: "PUT",
      json: { preferences: notificationPrefs },
    });
    toast.success(t("preferences_saved"));
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      toast.error(t("password_mismatch"));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("password_too_short"));
      return;
    }
    setSavingPwd(true);
    try {
      await apiFetch("/me/password", {
        method: "POST",
        json: { current_password: currentPassword, new_password: newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("password_updated"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error(t("password_current_incorrect"));
      } else {
        toast.error(t("password_change_failed"));
      }
    } finally {
      setSavingPwd(false);
    }
  }

  if (!user) return <p className="text-sm text-white/50">{tApp("loading")}</p>;

  const notificationKinds: { key: string; label: string }[] = [
    { key: "invoice_ready", label: t("notif_invoice_ready") },
    { key: "invoice_failed", label: t("notif_invoice_failed") },
    { key: "integration_synced", label: t("notif_integration_synced") },
    { key: "mydata_submitted", label: t("notif_mydata_submitted") },
    { key: "erp_exported", label: t("notif_erp_exported") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-italic text-[30px] leading-none text-white/95">
          {t("title")}
        </h1>
        <p className="mt-1 text-[13px] text-white/60">
          {t("subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
              tab === value
                ? "text-white"
                : "bg-white/[0.05] text-white/60 hover:bg-white/[0.08]"
            }`}
            style={
              tab === value
                ? {
                    background:
                      "linear-gradient(90deg, rgba(139,92,246,0.3) 0%, rgba(99,102,241,0.2) 100%)",
                    border: "1px solid rgba(139,92,246,0.4)",
                  }
                : { border: "1px solid rgba(255,255,255,0.06)" }
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="max-w-2xl space-y-4">
          <Section title={t("identity_title")} description={t("identity_desc")}>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-white/55">{t("email_label")}</Label>
              <input
                value={user.email}
                disabled
                className={`${inputClass} cursor-not-allowed font-mono-display`}
              />
              <p className="text-[11px] text-white/35">
                {t("email_locked_hint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-full-name" className="text-[11px] text-white/55">{t("full_name_label")}</Label>
              <Input
                id="settings-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:ring-violet-500/50"
                placeholder={t("full_name_placeholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-white/55">{t("role_label")}</Label>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-violet-300"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(139,92,246,0.2), rgba(99,102,241,0.2))",
                  }}
                >
                  {user.role}
                </span>
                <span className="text-[11px] text-white/45">
                  · {user.tenant.name}
                </span>
              </div>
            </div>
            <div>
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="btn-primary-violet disabled:opacity-60"
              >
                {savingProfile ? t("saving") : tCommon("save")}
              </button>
            </div>
          </Section>
        </div>
      )}

      {tab === "security" && (
        <div className="max-w-2xl space-y-4">
          <Section
            title={t("password_title")}
            description={t("password_desc")}
          >
            <div className="space-y-1.5">
              <Label htmlFor="settings-current-password" className="text-[11px] text-white/55">{t("current_password")}</Label>
              <PasswordInput
                id="settings-current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:ring-violet-500/50"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-new-password" className="text-[11px] text-white/55">{t("new_password")}</Label>
                <PasswordInput
                  id="settings-new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:ring-violet-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-confirm-password" className="text-[11px] text-white/55">{t("confirm_password")}</Label>
                <PasswordInput
                  id="settings-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:ring-violet-500/50"
                />
              </div>
            </div>
            <div>
              <button
                onClick={savePassword}
                disabled={savingPwd || !currentPassword || !newPassword}
                className="btn-primary-violet disabled:opacity-60"
              >
                {savingPwd ? t("updating") : t("change_password")}
              </button>
            </div>
          </Section>

          <Section
            title={t("api_keys_title")}
            description={t("api_keys_desc")}
          >
            <div className="flex gap-2">
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="border-white/10 bg-white/[0.04] text-white"
              />
              <button className="btn-primary-violet" onClick={createApiKey}>
                {t("create")}
              </button>
            </div>
            {newKeySecret && (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 font-mono text-[11px] text-emerald-100">
                {newKeySecret}
              </div>
            )}
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                >
                  <div>
                    <p className="text-[13px] text-white/80">{key.name}</p>
                    <p className="font-mono text-[11px] text-white/35">
                      {key.key_prefix} · {key.scopes.join(", ")}
                    </p>
                  </div>
                  <button
                    className="btn-glass disabled:opacity-40"
                    disabled={Boolean(key.revoked_at)}
                    onClick={() => revokeApiKey(key.id)}
                  >
                    {key.revoked_at ? t("revoked") : t("revoke")}
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t("totp_title")} description={t("totp_desc")}>
            <div className="flex gap-2">
              <button className="btn-glass" onClick={setupTotp}>{t("generate")}</button>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder={t("totp_code_placeholder")}
                className="max-w-[160px] border-white/10 bg-white/[0.04] font-mono text-white"
              />
              <button className="btn-primary-violet" onClick={enableTotp} disabled={!totpUrl || !totpCode}>
                {user.totp_enabled ? t("enabled") : t("enable")}
              </button>
            </div>
            {totpUrl && (
              <div className="space-y-2">
                <p className="break-all rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 font-mono text-[11px] text-white/55">
                  {totpUrl}
                </p>
                {backupCodes.length > 0 && (
                  <div className="grid gap-1 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 font-mono text-[11px] text-amber-100 sm:grid-cols-2">
                    {backupCodes.map((code) => (
                      <span key={code}>{code}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title={t("sessions_title")} description={t("sessions_desc")}>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12px]"
                >
                  <p className="text-white/80">{session.ip_address ?? t("ip_unknown")}</p>
                  <p className="truncate text-white/35">{session.user_agent ?? t("user_agent_missing")}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === "preferences" && (
        <div className="max-w-2xl space-y-4">
          <Section title={t("language")} description={t("language_desc")}>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-white/55">{t("language")}</Label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white"
              >
                <option value="fr">{t("language_fr")}</option>
                <option value="en">{t("language_en")}</option>
                <option value="el">{t("language_el")}</option>
              </select>
              <p className="text-[11px] text-white/35">
                {t("language_hint")}
              </p>
              <button className="btn-glass" onClick={saveProfile}>
                {t("save_language")}
              </button>
            </div>
          </Section>

          <Section title={t("notifications_title")} description={t("notifications_desc")}>
            {notificationKinds.map((n) => (
              <div
                key={n.key}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <span className="text-[13px] text-white/80">{n.label}</span>
                <div className="flex items-center gap-3 text-[11px] text-white/55">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={notificationPrefs[n.key]?.in_app ?? true}
                      onChange={(e) =>
                        setNotificationPrefs((prefs) => ({
                          ...prefs,
                          [n.key]: {
                            in_app: e.target.checked,
                            email: prefs[n.key]?.email ?? false,
                          },
                        }))
                      }
                    />
                    {t("channel_app")}
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={notificationPrefs[n.key]?.email ?? false}
                      onChange={(e) =>
                        setNotificationPrefs((prefs) => ({
                          ...prefs,
                          [n.key]: {
                            in_app: prefs[n.key]?.in_app ?? true,
                            email: e.target.checked,
                          },
                        }))
                      }
                    />
                    {t("channel_email")}
                  </label>
                </div>
              </div>
            ))}
            <button className="btn-primary-violet" onClick={saveNotificationPrefs}>
              {t("save_preferences")}
            </button>
          </Section>

          <Section
            title={t("my_data_title")}
            description={t("my_data_desc")}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className="btn-glass"
                onClick={async () => {
                  try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6200";
                    const token = (await import("@/lib/auth")).getAccessToken();
                    const res = await fetch(`${apiUrl}/security/gdpr/export`, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    if (!res.ok) throw new Error(`status_${res.status}`);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "raijin-gdpr-export.zip";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast.success(t("export_downloaded"));
                  } catch {
                    toast.error(t("export_failed"));
                  }
                }}
              >
                {t("download_my_data")}
              </button>
              <button
                className="btn-glass text-rose-200 hover:text-rose-100"
                onClick={async () => {
                  if (!confirm(t("delete_confirm"))) return;
                  try {
                    await apiFetch("/security/gdpr/delete-request", { method: "POST" });
                    toast.success(t("delete_requested"));
                  } catch (err) {
                    const msg = err instanceof ApiError ? t("error_with_status", { status: err.status }) : tCommon("error_network");
                    toast.error(msg);
                  }
                }}
              >
                {t("request_deletion")}
              </button>
            </div>
            <p className="text-[11px] text-white/35">
              {t("my_data_footer")}
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}
