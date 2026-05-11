"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Bell,
  Building2,
  FileText,
  Home,
  LogOut,
  Plug,
  Search,
  Settings,
  Shield,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "@/components/command-palette";

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: Home },
  { labelKey: "invoices", href: "/invoices", icon: FileText },
  { labelKey: "reports", href: "/reports", icon: BarChart3 },
  { labelKey: "suppliers", href: "/suppliers", icon: Building2 },
  { labelKey: "upload", href: "/upload", icon: Upload },
  { labelKey: "integrations", href: "/integrations", icon: Plug, adminOnly: true },
];

const ADMIN_NAV: NavItem[] = [
  { labelKey: "users", href: "/admin/users", icon: Users, adminOnly: true },
  { labelKey: "audit", href: "/admin/audit", icon: BarChart3 },
  { labelKey: "ip_rules", href: "/admin/security/ip-rules", icon: Shield, adminOnly: true },
  { labelKey: "saml", href: "/admin/security/saml", icon: Shield, adminOnly: true },
  { labelKey: "notifications", href: "/notifications", icon: Bell },
  { labelKey: "settings", href: "/settings", icon: Settings },
];

function IconLink({
  item,
  active,
  label,
  badge,
}: {
  item: NavItem;
  active: boolean;
  label: string;
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex h-9 w-9 items-center justify-center rounded-lg transition",
        active
          ? "text-white"
          : "text-white/40 hover:bg-white/[0.05] hover:text-white/90",
      )}
      style={
        active
          ? {
              background: "var(--theme-accent-soft)",
              boxShadow: "inset 0 0 0 1px rgba(var(--theme-accent-rgb), 0.35)",
            }
          : undefined
      }
      aria-label={label}
    >
      <Icon className="h-[17px] w-[17px]" />
      {active && (
        <span
          className="pointer-events-none absolute -left-[10px] top-[7px] bottom-[7px] w-[2px] rounded"
          style={{ background: "var(--theme-accent-strong)" }}
        />
      )}
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute -right-1 -top-1 grid h-[14px] min-w-[14px] place-items-center rounded-full px-1 text-[9px] font-bold text-white"
          style={{ background: "var(--theme-accent)" }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      {/* Tooltip on hover */}
      <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md border border-white/10 bg-[#15151a] px-2 py-1 text-[11px] font-medium text-white/90 shadow-lg group-hover:block">
        {label}
      </span>
    </Link>
  );
}

export function Sidebar({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const cmd = useCommandPalette();
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    function fetchUnread() {
      apiFetch<{ unread: number }>("/notifications?limit=1")
        .then((r) => {
          if (!cancelled) setUnread(r.unread);
        })
        .catch(() => {});
    }
    fetchUnread();
    const t = setInterval(fetchUnread, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pathname]);

  const initials = (user?.full_name ?? user?.email ?? "??")
    .split(/[@.\s]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="relative flex h-screen w-[56px] shrink-0 flex-col items-center overflow-visible border-r py-4"
      style={{
        background: "rgba(255, 255, 255, 0.015)",
        borderColor: "var(--raijin-line)",
      }}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="mb-4 grid h-8 w-8 place-items-center rounded-lg"
        style={{
          background: "var(--theme-accent)",
        }}
        aria-label="Raijin"
      >
        <Zap className="h-4 w-4 text-white" />
      </Link>

      {/* Search */}
      <button
        type="button"
        onClick={cmd.open}
        className="group relative mb-2 grid h-9 w-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/[0.05] hover:text-white/90"
        aria-label={tApp("search_placeholder")}
      >
        <Search className="h-[17px] w-[17px]" />
        <span className="pointer-events-none absolute left-full ml-2 hidden items-center gap-1 whitespace-nowrap rounded-md border border-white/10 bg-[#15151a] px-2 py-1 text-[11px] font-medium text-white/90 shadow-lg group-hover:flex">
          {tApp("search_placeholder")}
          <span className="raijin-kbd">⌘K</span>
        </span>
      </button>

      <div className="my-1 h-px w-6 bg-white/[0.06]" />

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5">
        {MAIN_NAV.filter((i) => !i.adminOnly || isAdmin).map((item) => (
          <IconLink key={item.href} item={item} active={isActive(item.href)} label={tNav(item.labelKey)} />
        ))}
      </nav>

      <div className="my-2 h-px w-6 bg-white/[0.06]" />

      {/* Admin nav */}
      <nav className="flex flex-col gap-0.5">
        {ADMIN_NAV.filter((i) => !i.adminOnly || isAdmin).map((item) => (
          <IconLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            label={tNav(item.labelKey)}
            badge={item.href === "/notifications" ? unread : undefined}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2">
        {/* Profile */}
        <button
          type="button"
          onClick={logout}
          className="group relative grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/[0.05]"
          aria-label={user?.email ?? "logout"}
        >
          <span
            className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white"
            style={{
              background: "var(--theme-accent)",
            }}
          >
            {initials || "??"}
          </span>
          <span className="pointer-events-none absolute bottom-0 left-full ml-2 hidden whitespace-nowrap rounded-md border border-white/10 bg-[#15151a] px-2 py-1 text-[11px] font-medium text-white/90 shadow-lg group-hover:block">
            <span className="block text-white/95">{user?.full_name ?? "—"}</span>
            <span className="block text-white/45">{user?.email ?? ""}</span>
            <span className="mt-1 flex items-center gap-1 text-white/45">
              <LogOut className="h-3 w-3" /> {tApp("logout") || "Logout"}
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}
