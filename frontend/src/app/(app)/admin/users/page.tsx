"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import type {
  TenantUser,
  UserCreatePayload,
  UserCreatedResponse,
  UserRole,
} from "@/lib/types";
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

const ROLES: UserRole[] = ["admin", "reviewer", "viewer"];

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const tApp = useTranslations("app");

  function roleLabel(role: UserRole): string {
    switch (role) {
      case "admin":
        return t("users.role.admin");
      case "reviewer":
      case "user":
        return t("users.role.reviewer");
      case "viewer":
        return t("users.role.viewer");
    }
  }
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activationLink, setActivationLink] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("reviewer");

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<TenantUser[]>("/users");
      setUsers(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error(t("users.error_forbidden"));
      } else {
        toast.error(t("users.error_load"));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser() {
    if (!newEmail) return;
    setCreating(true);
    try {
      const body: UserCreatePayload = {
        email: newEmail,
        full_name: newName || null,
        role: newRole,
      };
      const res = await apiFetch<UserCreatedResponse>("/users", {
        method: "POST",
        json: body,
      });
      setActivationLink(res.activation_link);
      setNewEmail("");
      setNewName("");
      setNewRole("reviewer");
      await load();
      toast.success(t("users.toast_invited"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(t("users.error_email_used"));
      } else {
        toast.error(t("users.error_create"));
      }
    } finally {
      setCreating(false);
    }
  }

  async function updateRole(user: TenantUser, role: UserRole) {
    try {
      await apiFetch(`/users/${user.id}`, {
        method: "PATCH",
        json: { role },
      });
      toast.success(t("users.toast_role_updated", { role: roleLabel(role) }));
      await load();
    } catch {
      toast.error(t("users.error_update"));
    }
  }

  async function toggleActive(user: TenantUser) {
    try {
      await apiFetch(`/users/${user.id}`, {
        method: "PATCH",
        json: { is_active: !user.is_active },
      });
      toast.success(user.is_active ? t("users.toast_deactivated") : t("users.toast_reactivated"));
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(t("users.error_self_deactivate"));
      } else {
        toast.error(t("users.error_action"));
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("users.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("users.subtitle")}
        </p>
      </div>

      {activationLink && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="text-sm font-medium">{t("users.activation_link_label")}</p>
            <a
              href={activationLink}
              className="block break-all rounded-md bg-muted px-3 py-2 text-sm underline-offset-4 hover:underline"
            >
              {activationLink}
            </a>
            <Button variant="outline" size="sm" onClick={() => setActivationLink(null)}>
              {t("users.hide")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("users.add_title")}</CardTitle>
          <CardDescription>
            {t("users.add_description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="invite-email">{t("users.email")}</Label>
            <Input
              id="invite-email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              type="email"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-name">{t("users.name")}</Label>
            <Input
              id="invite-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-role">{t("users.role_label")}</Label>
            <select
              id="invite-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4">
            <Button onClick={createUser} disabled={creating || !newEmail}>
              {creating ? t("users.sending") : t("users.invite")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("users.team")} ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{tApp("loading")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">{t("users.email")}</th>
                  <th className="py-2">{t("users.name")}</th>
                  <th className="py-2">{t("users.role_label")}</th>
                  <th className="py-2">{t("users.status")}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 font-medium">{u.email}</td>
                    <td className="py-3 text-muted-foreground">{u.full_name ?? "—"}</td>
                    <td className="py-3">
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u, e.target.value as UserRole)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      {u.is_active ? (
                        <span className="text-emerald-700">{t("users.status_active")}</span>
                      ) : (
                        <span className="text-rose-700">{t("users.status_inactive")}</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>
                        {u.is_active ? t("users.deactivate") : t("users.reactivate")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
