import type { ReactNode } from "react";

import { Avatar, AvatarStack } from "@/components/Avatar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { themeVars, sampleThemes } from "@/components/theme";
import {
  Button,
  Card,
  Field,
  Input,
  List,
  ListItem,
  SectionLabel,
  Sheet,
  StatusBadge,
  type StatusTone,
} from "@/components/ui";
import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";

export const metadata = { title: "Design system — Chata" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <SectionLabel className="mb-3">{title}</SectionLabel>
      {children}
    </section>
  );
}

const STATUS_TONES: StatusTone[] = [
  "settled",
  "confirmed",
  "owing",
  "overdue",
  "due",
  "provisional",
  "neutral",
];

export default async function GalleryPage() {
  const locale = await getRequestLocale();
  const { m, t } = getTranslator(locale);

  return (
    <main className="mx-auto max-w-[760px] px-5 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-3xl font-extrabold tracking-tight">{m.gallery.title}</h1>
          <p className="mt-1 text-sm text-muted">{m.gallery.subtitle}</p>
        </div>
        <LanguageSwitcher />
      </div>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">{m.status.confirmed}</Button>
          <Button variant="secondary">{m.nav.plan}</Button>
          <Button variant="ghost">{m.nav.info}</Button>
          <Button variant="primary" disabled>
            {m.status.provisional}
          </Button>
        </div>
      </Section>

      <Section title="Status badges (colorblind-safe: glyph + label)">
        <div className="flex flex-wrap gap-2">
          {STATUS_TONES.map((tone) => (
            <StatusBadge key={tone} tone={tone}>
              {tone}
            </StatusBadge>
          ))}
        </div>
      </Section>

      <Section title="Cards & sheet">
        <Card>
          <SectionLabel>{m.nav.money}</SectionLabel>
          <div className="mt-1 text-2xl font-bold">
            {getTranslator(locale).m.status.settled}
          </div>
          <p className="mt-1 text-sm text-muted">
            {t((mm) => mm.reminders.payUp, { name: "Jana", trip: "Cabin", amount: "0 Kč" })}
          </p>
        </Card>
        <div className="mt-3 overflow-hidden rounded-card border border-line">
          <div className="bg-photo h-24" />
          <Sheet className="mt-0 rounded-t-sheet">
            <SectionLabel>Sheet</SectionLabel>
            <p className="pb-4 text-sm text-muted">Overlapping cream sheet over a hero photo.</p>
          </Sheet>
        </div>
      </Section>

      <Section title="List">
        <List>
          <ListItem trailing={<StatusBadge tone="confirmed">{m.status.confirmed}</StatusBadge>}>
            <div className="text-sm font-semibold">Petr Novák</div>
          </ListItem>
          <ListItem trailing={<StatusBadge tone="due">{m.status.due}</StatusBadge>}>
            <div className="text-sm font-semibold">Jana Dvořáková</div>
          </ListItem>
          <ListItem trailing={<StatusBadge tone="owing">{m.status.owing}</StatusBadge>}>
            <div className="text-sm font-semibold">Tomáš Z.</div>
          </ListItem>
        </List>
      </Section>

      <Section title="Form controls">
        <div className="flex max-w-sm flex-col gap-4">
          <Field label={m.common.language} hint="cs / en">
            <Input placeholder="Čeština" defaultValue="" />
          </Field>
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex items-center gap-4">
          <Avatar initials="PN" name="Petr Novák" />
          <Avatar initials="JD" name="Jana Dvořáková" size={40} />
          <AvatarStack
            members={[
              { initials: "PN", name: "Petr" },
              { initials: "JD", name: "Jana" },
              { initials: "TZ", name: "Tomáš" },
            ]}
            extra={4}
          />
        </div>
      </Section>

      <Section title="Per-trip theming (one system, re-skinned)">
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(sampleThemes).map(([name, theme]) => (
            <div key={name} style={themeVars(theme)}>
              <Card>
                <div className="bg-photo mb-3 h-16 rounded-lg" />
                <SectionLabel>{name}</SectionLabel>
                <div className="mt-2">
                  <Button variant="primary" className="w-full">
                    {m.status.confirmed}
                  </Button>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </Section>

      <Section title="App shell — mobile bottom nav">
        <nav className="glass flex items-center justify-between rounded-[22px] border border-line px-3 py-2.5">
          {[
            { key: "dashboard", icon: "◇", label: m.nav.dashboard },
            { key: "plan", icon: "▦", label: m.nav.plan },
            { key: "stay", icon: "◑", label: m.nav.stay },
            { key: "money", icon: "₵", label: m.nav.money },
            { key: "info", icon: "ⓘ", label: m.nav.info },
          ].map((item, i) => (
            <span
              key={item.key}
              className="flex flex-1 flex-col items-center gap-0.5 py-0.5"
              style={{ color: i === 0 ? "var(--accent-ink)" : "#a89f8f" }}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[9px]" style={{ fontWeight: i === 0 ? 700 : 600 }}>
                {item.label}
              </span>
            </span>
          ))}
        </nav>
        <p className="mt-2 text-xs text-muted">
          Full <code>AppShell</code> (side-rail + bottom nav) wraps trip pages in Epic 2.
        </p>
      </Section>
    </main>
  );
}
