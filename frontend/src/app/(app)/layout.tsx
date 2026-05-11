"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
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
        <div className="raijin-shell relative min-h-screen overflow-hidden md:h-screen">
          <div className="relative z-10 flex min-h-screen w-full flex-col md:h-screen md:flex-row">
            {/* Mobile-only top bar (sidebar is hidden below md) */}
            <div
              className="flex items-center justify-between border-b px-4 py-3 md:hidden"
              style={{
                background: "rgba(255, 255, 255, 0.025)",
                borderColor: "var(--raijin-line)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  style={{ background: "var(--theme-accent)" }}
                >
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="text-base font-semibold tracking-tight text-white/95">Raijin</span>
              </div>
            </div>
            <Sidebar user={user} />
            <main className="raijin-scroll relative flex-1 overflow-y-auto px-4 pb-8 pt-5 md:px-10 md:pb-16 md:pt-10">
              <div className="mx-auto w-full max-w-[920px]">{children}</div>
            </main>
          </div>
        </div>
      </CommandPaletteProvider>
    </ThemeProvider>
  );
}
