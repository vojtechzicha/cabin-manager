"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Avatar } from "./Avatar";

export type NavItem = { key: string; href: string; label: string; icon: string };
export type TripChip = { slug: string; shortName: string; accent: string; photo: string };
export type ShellUser = { initials: string; name: string; role: string };

type AppShellProps = {
  slug: string;
  brand?: string;
  nav: NavItem[];
  trips: TripChip[];
  user: ShellUser;
  children: ReactNode;
};

function useIsActive(slug: string) {
  const pathname = usePathname();
  return (href: string) => {
    if (href === `/${slug}`) return pathname === `/${slug}`;
    return pathname === href || pathname.startsWith(href + "/");
  };
}

/**
 * The mobile-first app shell: a left side-rail on desktop, a floating glass
 * bottom nav on phones. Layout is fixed across trips; only the accent/photo
 * theming (from the wrapping TripTheme) re-skins it (PRD §12).
 */
export function AppShell({ slug, brand = "Chata", nav, trips, user, children }: AppShellProps) {
  const isActive = useIsActive(slug);

  return (
    <div className="min-h-screen">
      {/* ───────── Desktop sidebar ───────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-card px-5 py-6 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-1">
          <span className="h-8 w-8 rounded-[10px] bg-photo" />
          <span className="display text-xl font-extrabold tracking-tight">{brand}</span>
        </Link>

        <div className="mono px-1 pb-2 text-[10px] uppercase tracking-[0.12em] text-sand">
          Your trips
        </div>
        <nav className="flex flex-col gap-1">
          {trips.map((t) => {
            const active = t.slug === slug;
            return (
              <Link
                key={t.slug}
                href={`/${t.slug}`}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-paper"
                style={active ? { background: `color-mix(in srgb, ${t.accent} 16%, #fff)` } : undefined}
              >
                <span className="h-6 w-6 shrink-0 rounded-lg" style={{ background: t.photo }} />
                <span
                  className="truncate text-[13px]"
                  style={{ color: active ? t.accent : "var(--muted)", fontWeight: active ? 700 : 500 }}
                >
                  {t.shortName}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mono px-1 pb-2 pt-6 text-[10px] uppercase tracking-[0.12em] text-sand">
          Sections
        </div>
        <nav className="flex flex-col gap-0.5 text-[13px]">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 rounded-[9px] px-2.5 py-2 transition-colors"
                style={
                  active
                    ? { background: "var(--paper)", color: "var(--ink)", fontWeight: 700 }
                    : { color: "var(--muted)" }
                }
              >
                <span className="w-5 text-center text-[15px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2.5 px-1 pt-4">
          <Avatar initials={user.initials} name={user.name} size={32} />
          <div>
            <div className="text-xs font-semibold">{user.name}</div>
            <div className="text-[10px] text-sand">{user.role}</div>
          </div>
        </div>
      </aside>

      {/* ───────── Content ───────── */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-[760px] pb-28 lg:max-w-[860px] lg:pb-12">
          {children}
        </div>
      </main>

      {/* ───────── Mobile bottom nav ───────── */}
      <nav
        className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-[22px] border border-line px-3 py-2.5 shadow-[0_14px_30px_-14px_rgba(20,30,25,.45)] lg:hidden"
        aria-label="Primary"
      >
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-0.5"
              style={{ color: active ? "var(--accent-ink)" : "#a89f8f" }}
              aria-current={active ? "page" : undefined}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[9px]" style={{ fontWeight: active ? 700 : 600 }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
