"use client";

import { useRef, useState } from "react";

import { SectionLabel } from "@/components/ui";
import { themeForTrip, themeVars } from "@/components/theme";
import { useI18n } from "@/i18n/react";

/** Curated trip-icon emoji (PRD §8.1 / §12 — the icon is one of the 3 theme knobs). */
const ICONS = [
  "🏔️", "⛺", "🏕️", "🌲", "🏖️", "🏝️", "⛵", "🚲", "🏂", "🎿",
  "🔥", "🌅", "🏛️", "🎡", "🏟️", "🍻", "🚗", "🚂", "✈️", "🗺️",
];

/** Accent presets, led by the three designed palettes (sage / cobalt / coral). */
const ACCENTS = ["#2f9e73", "#3a5bff", "#f0653c", "#e8a93b", "#9b5de5", "#d8503f", "#2b6f8f", "#1f9e9e"];

/**
 * Branding inputs for the create/settings forms (T-201): cover-photo upload with
 * live preview, an emoji icon picker, and an accent-color picker — the design's
 * three theming knobs. State drives a live preview card (re-skinned via
 * `themeForTrip`/`themeVars`) and writes to named inputs the parent form/action
 * reads: a `cover` file input, plus hidden `icon` and `accent`.
 */
export function BrandingFields({
  initialAccent,
  initialIcon,
  initialCoverUrl,
}: {
  initialAccent?: string | null;
  initialIcon?: string | null;
  initialCoverUrl?: string | null;
}) {
  const { m } = useI18n();
  const [accent, setAccent] = useState(initialAccent ?? "#2f9e73");
  const [icon, setIcon] = useState(initialIcon ?? "");
  const [coverPreview, setCoverPreview] = useState<string | null>(initialCoverUrl ?? null);
  const [coverCleared, setCoverCleared] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const theme = themeForTrip(accent, coverPreview);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCoverPreview(URL.createObjectURL(file));
      setCoverCleared(false);
    }
  }
  function clearCover() {
    setCoverPreview(null);
    setCoverCleared(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Live preview */}
      <div
        style={themeVars(theme)}
        className="overflow-hidden rounded-card border border-line bg-card"
      >
        <div className="bg-photo relative flex h-28 items-end p-3">
          {icon ? <span className="text-3xl drop-shadow">{icon}</span> : null}
          <span className="mono ml-auto text-[10px] uppercase tracking-[0.14em] text-white/90">
            {m.branding.preview}
          </span>
        </div>
        <div className="flex items-center gap-1.5 p-3">
          <span className="h-5 w-5 rounded-md bg-accent" />
          <span className="h-5 w-5 rounded-md bg-accent-ink" />
          <span className="h-5 w-5 rounded-md bg-accent-soft" />
        </div>
      </div>

      {/* Cover photo */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>{m.branding.coverPhoto}</SectionLabel>
        <input
          ref={fileRef}
          type="file"
          name="cover"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
        {/* When editing, a hidden flag tells the action the cover was removed. */}
        {coverCleared ? <input type="hidden" name="coverCleared" value="1" /> : null}
        {coverPreview ? (
          <div className="overflow-hidden rounded-card border border-line">
            <div
              className="h-32 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${JSON.stringify(coverPreview)})` }}
            />
            <div className="flex gap-2 p-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-btn border border-line px-3 py-1.5 text-[13px] font-semibold"
              >
                {m.branding.change}
              </button>
              <button
                type="button"
                onClick={clearCover}
                className="rounded-btn border border-line px-3 py-1.5 text-[13px] font-semibold text-owing"
              >
                {m.branding.remove}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line bg-card text-sm font-semibold text-muted"
          >
            <span>{m.branding.upload}</span>
            <span className="text-[12px] font-normal text-sand">{m.branding.coverHint}</span>
          </button>
        )}
      </div>

      {/* Icon */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>{m.branding.icon}</SectionLabel>
        <input type="hidden" name="icon" value={icon} />
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setIcon(icon === e ? "" : e)}
              aria-pressed={icon === e}
              className="flex h-10 w-10 items-center justify-center rounded-btn border text-xl"
              style={
                icon === e
                  ? { borderColor: "var(--accent)", background: "var(--accent-soft)" }
                  : { borderColor: "var(--line)" }
              }
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Accent */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>{m.branding.accent}</SectionLabel>
        <input type="hidden" name="accent" value={accent} />
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              aria-pressed={accent === c}
              aria-label={c}
              className="h-8 w-8 rounded-full"
              style={{
                background: c,
                boxShadow: accent === c ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : "none",
              }}
            />
          ))}
          <label className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-2 text-[12px] text-muted">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
