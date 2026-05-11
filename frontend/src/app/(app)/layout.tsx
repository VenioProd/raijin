"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth";
import type { User } from "@/lib/types";
import { AmbientBg } from "@/components/app-shell/ambient-bg";
import { Sidebar } from "@/components/app-shell/sidebar";
import { CommandPaletteProvider } from "@/components/command-palette";

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
      <div className="flex min-h-screen items-center justify-center bg-[#050508] text-sm text-white/50">
        {t("loading")}
      </div>
    );
  }

  return (
    <CommandPaletteProvider>
      <div className="raijin-shell relative min-h-screen overflow-hidden md:h-screen">
        <AmbientBg />
        <div className="relative z-10 flex min-h-screen w-full flex-col md:h-screen md:flex-row">
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.025] px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                  boxShadow: "0 0 20px rgba(139,92,246,0.35)",
                }}
              >
                <span className="text-sm font-bold text-white">R</span>
              </div>
              <span className="text-base font-semibold tracking-tight text-white/95">Raijin</span>
            </div>
            <span className="raijin-kbd">Preview</span>
          </div>
          <Sidebar user={user} />
          <main className="raijin-scroll relative flex-1 overflow-y-auto px-4 pb-8 pt-5 md:px-7 md:pb-10 md:pt-7">
            {children}
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
