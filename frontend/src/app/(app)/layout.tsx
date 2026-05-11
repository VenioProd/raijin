"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth";
import type { User } from "@/lib/types";
import { Sidebar } from "@/components/app-shell/sidebar";
import { CommandPaletteProvider } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("app");
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<User>("/auth/me")
      .then((u) => {
        setUser(u);
        setReady(true);
      })
      .catch(() => {
        clearTokens();
        router.replace("/login");
      });
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0d] text-sm text-white/50">
        {t("loading")}
      </div>
    );
  }

  return (
    <ThemeProvider>
      <CommandPaletteProvider>
        <div className="raijin-shell relative flex h-screen overflow-hidden">
          <Sidebar user={user} />
          <main className="raijin-scroll relative flex-1 overflow-y-auto px-10 pb-16 pt-10">
            <div className="mx-auto w-full max-w-[920px]">{children}</div>
          </main>
        </div>
      </CommandPaletteProvider>
    </ThemeProvider>
  );
}
