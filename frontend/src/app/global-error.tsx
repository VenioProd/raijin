"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { captureFrontendError } from "@/lib/sentry-lite";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("auth");
  useEffect(() => {
    captureFrontendError(error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="fr">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
          <p className="font-serif text-sm italic text-primary">Raijin</p>
          <h1 className="mt-3 text-3xl font-semibold">{t("global_error_title")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("global_error_subtitle")}
          </p>
          <button className="btn-primary-violet mt-6 w-fit" onClick={reset}>
            {t("retry")}
          </button>
        </main>
      </body>
    </html>
  );
}
