"use client";

import { useTranslations } from "next-intl";
import { THEMES, useTheme, type ThemeName } from "@/components/theme-provider";

const SWATCH_COLOR: Record<ThemeName, string> = {
  graphite: "#737373",
  indigo: "#6366f1",
  forest: "#15803d",
  bronze: "#a16207",
  wine: "#9f1239",
  slate: "#475569",
};

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("settings");

  return (
    <div className="flex flex-wrap gap-2">
      {THEMES.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => setTheme(name)}
          className={`theme-swatch${theme === name ? " active" : ""}`}
          aria-pressed={theme === name}
          aria-label={t(`theme_${name}`)}
        >
          <span className="dot" style={{ background: SWATCH_COLOR[name] }} />
          <span className="lbl">{t(`theme_${name}`)}</span>
        </button>
      ))}
    </div>
  );
}
