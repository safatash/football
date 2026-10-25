import type { ReactNode } from "react";
import { Jersey, PosTag } from "@/components/league";
import { PublicTopNav } from "@/components/shell/app-nav";
import { Badge, GamePassTag, MatchStatusBadge, PaymentBadge, PlayerStatusBadge, RegistrationBadge, RoleTag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, Notice, StatCard } from "@/components/ui/card";
import { CheckBox } from "@/components/ui/controls";
import { StandingsTable } from "@/app/admin/_components/standings-table";
import { DemoControls } from "./demo-controls";

// Style-sheet example rows (this page shows components, not league data)
const EXAMPLE_STANDINGS = (
  [
    ["ffx", "Fairfax United", "FU", "#0F3D2E", 5, 1, 1, 17, 7],
    ["alx", "Alexandria FC", "AFC", "#7A1F2B", 4, 2, 1, 14, 8],
    ["pot", "Potomac Valkyries", "PV", "#27407A", 4, 0, 3, 11, 10],
    ["brk", "Burke Athletic", "BA", "#8A5A12", 2, 1, 4, 6, 13],
  ] as const
).map(([id, name, shortName, color, w, d, l, gf, ga]) => ({
  team: { id, code: id, name, shortName, color },
  played: w + d + l,
  w,
  d,
  l,
  gf,
  ga,
  gd: gf - ga,
  adj: 0,
  pts: w * 3 + d,
}));

export const metadata = {
  title: "Components & styles",
  description: "Design tokens, type and shared components.",
};

function Swatch({ name, token, note }: { name: string; token: string; note?: string }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="h-16" style={{ background: `var(${token})` }} />
      <p className="px-2.5 py-2 text-[12.5px]">
        <b>{name}</b>
        <br />
        <span className="font-mono text-muted">{token}</span>
        {note ? (
          <>
            <br />
            <span className="text-xs text-muted">{note}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="border-b-2 border-fg pb-1.5 text-[30px]">{title}</h2>
      {children}
    </section>
  );
}

function TypeRow({ sample, spec }: { sample: ReactNode; spec: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      {sample}
      <span className="font-mono text-[13px] text-muted">{spec}</span>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-[var(--radius-field)] border border-line bg-surface-2 p-3.5 font-mono text-[12.5px] leading-[1.55]">{children}</pre>;
}

const THEME_CODE = `/* src/app/globals.css — Tailwind v4: tokens are CSS variables, @theme maps them to utilities */
@import "tailwindcss";

:root {
  --pitch: #0f3d2e;  --pitch-2: #155a43;  --pitch-tint: #e2eee7;  --on-pitch: #ffffff;
  --lime: #c8f04a;   --lime-2: #b5df2f;   --lime-ink: #13240a;
  --bg: #f2f4ef;     --surface: #ffffff;  --surface-2: #eaeee6;   --surface-3: #dfe5da;
  --line: #d6ddd1;   --line-strong: #b9c3b3;
  --fg: #13201a;     --muted: #55645b;    --faint: #7d8b82;
  --ok: #17693c;     --warn: #7a4e00;     --bad: #b42318;  --pass: #5536c9;  --info: #1c5598;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --pitch: #1b6a4d; --bg: #0b1410; --fg: #e6eee9; --ok: #74d69d; /* … */ }
}

@theme inline {
  --color-pitch: var(--pitch);        /* bg-pitch, text-pitch, border-pitch */
  --color-pitch-2: var(--pitch-2);
  --color-pitch-tint: var(--pitch-tint);
  --color-on-pitch: var(--on-pitch);
  --color-lime: var(--lime);          /* key action · dark text only */
  --color-lime-ink: var(--lime-ink);
  --color-bg: var(--bg);
  --color-surface: var(--surface);    /* bg-surface, bg-surface-2, bg-surface-3 */
  --color-line: var(--line);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-ok: var(--ok);   --color-ok-bg: var(--ok-bg);
  --color-warn: var(--warn); --color-warn-bg: var(--warn-bg);
  --color-bad: var(--bad); --color-bad-bg: var(--bad-bg);
  --color-pass: var(--pass); --color-pass-bg: var(--pass-bg);
  --color-info: var(--info); --color-info-bg: var(--info-bg);

  --font-display: "Barlow Condensed", "Arial Narrow", Impact, sans-serif;
  --font-sans: "Figtree Variable", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  --radius-card: 18px;   /* rounded-[var(--radius-card)] */
  --radius-field: 12px;  /* rounded-[var(--radius-field)] */
}`;

const COMPONENT_CODE = `// Component map
<Button variant="accent|primary|ghost|quiet|danger|link" size="md|sm" />   @/components/ui/button
<ButtonLink href variant size />
<RegistrationBadge status /> <PaymentBadge status /> <PlayerStatusBadge status />
<MatchStatusBadge status /> <GamePassStatusBadge status />                   @/components/ui/badge
<RoleTag role="Captain|Player|Admin" />      shown on every team view
<GamePassTag />                              dashed pass border · "Game pass · This match only"
<Stepper current={3} total={7} label="Contact" />                            @/components/ui/stepper
<ChoiceGroup /> <CheckRow /> <Switch /> <Segmented items active />           @/components/ui/controls
<Dialog open onClose title actions /> <Toast /> useToast()
<Card /> <CardHeader /> <HeroCard /> <StatCard /> <Notice /> <EmptyState /> <KeyValue />
<TableWrap><DataTable> … <RowLink href /> … </DataTable></TableWrap>       @/components/ui/table
<Crest teamId /> <Jersey n gamePass /> <VsRow /> <MatchMeta /> <PageHeading />  @/components/league`;

const BRAND = [
  ["Pitch", "--pitch", "Primary · dark buttons, headers"],
  ["Pitch 2", "--pitch-2", "Hover, selected"],
  ["Pitch tint", "--pitch-tint", "Selected background"],
  ["Lime", "--lime", "Key actions · dark text only"],
  ["Background", "--bg"],
  ["Surface", "--surface"],
  ["Surface 2", "--surface-2"],
  ["Line", "--line"],
  ["Text", "--fg"],
  ["Muted text", "--muted"],
] as const;
const STATUS = [
  ["Approved · Paid · Active", "--ok"],
  ["Pending · Scheduled", "--warn"],
  ["Suspended · Denied · Expired", "--bad"],
  ["Game pass", "--pass"],
  ["Submitted · Info", "--info"],
] as const;

export default function DesignPage() {
  return (
    <>
      <PublicTopNav />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-9 px-4 pt-8 pb-20">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Design handoff · Next.js + Tailwind</span>
          <h1 className="text-[44px] lg:text-[56px]">Components & styles</h1>
          <p className="max-w-[62ch] text-muted">
            Tokens, type and the shared components used across the player, captain and league-office views. Every color has a light and dark value; all text pairs meet WCAG AA.
          </p>
        </div>

        <Section title="Color">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {BRAND.map(([n, t, note]) => (
              <Swatch key={t} name={n} token={t} note={note} />
            ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {STATUS.map(([n, t]) => (
              <Swatch key={t} name={n} token={t} />
            ))}
          </div>
        </Section>

        <Section title="Type">
          <Card className="flex flex-col gap-3.5">
            <TypeRow sample={<span className="font-display text-[44px] leading-none font-extrabold uppercase lg:text-[56px]">Display 56</span>} spec="Barlow Condensed 800 · hero, page titles" />
            <TypeRow sample={<h1 className="text-[34px]">Heading 1 · 34</h1>} spec="Barlow Condensed 800" />
            <TypeRow sample={<h2 className="text-[26px]">Heading 2 · 26</h2>} spec="Barlow Condensed 800" />
            <TypeRow sample={<h3 className="text-[20px]">Heading 3 · 20</h3>} spec="Barlow Condensed 700" />
            <TypeRow sample={<span className="text-[15px]">Body 15 · Figtree for everything people read and fill in.</span>} spec="Figtree 400–700" />
            <TypeRow sample={<span className="eyebrow">Eyebrow label 11.5</span>} spec="Figtree 700 · +0.09em caps" />
            <TypeRow sample={<span className="font-mono">Game #204 · R-2041</span>} spec="IBM Plex Mono 500 · IDs" />
          </Card>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2.5">
            <ButtonLink href="/register" variant="accent">
              Register for the season
            </ButtonLink>
            <Button variant="primary">Finalize roster</Button>
            <Button variant="ghost">Save draft</Button>
            <Button variant="quiet">Quiet</Button>
            <Button variant="danger">Deny</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="link">Text link</Button>
          </div>
          <p className="text-[13px] text-muted">44px min height (36px small). Lime = the one key action per screen. Pitch = primary. Dark fills always carry white text.</p>
        </Section>

        <Section title="Badges & tags">
          <div className="flex flex-wrap gap-2">
            <RegistrationBadge status="Submitted" />
            <RegistrationBadge status="Pending Review" />
            <RegistrationBadge status="Approved" />
            <RegistrationBadge status="Denied" />
          </div>
          <div className="flex flex-wrap gap-2">
            <PaymentBadge status="Unpaid" />
            <PaymentBadge status="Pending" />
            <PaymentBadge status="Paid" />
            <PlayerStatusBadge status="Active" />
            <PlayerStatusBadge status="Pending Approval" />
            <PlayerStatusBadge status="Suspended" />
          </div>
          <div className="flex flex-wrap gap-2">
            <MatchStatusBadge status="Scheduled" />
            <MatchStatusBadge status="Completed" />
            <Badge tone="ok">Active for match day</Badge>
            <Badge tone="bad">Expired</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <RoleTag role="Captain" />
            <RoleTag role="Player" />
            <RoleTag role="Admin" />
            <GamePassTag />
          </div>
        </Section>

        <Section title="Form controls">
          <DemoControls />
        </Section>

        <Section title="Cards, rows & tables">
          <div className="grid gap-[18px] lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <StatCard label="Pending registrations" value={6} note="Oldest from May 9" />
                <StatCard label="Match roster" value={16} suffix="/18" note="Draft" />
              </div>
              <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                <div className="flex min-h-[60px] items-center gap-3 border-b border-line bg-lime/12 px-3.5 py-2.5">
                  <CheckBox checked />
                  <Jersey n={9} />
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">Maya Johnson (C)</b>
                    <div className="text-xs font-bold text-ok">Available</div>
                  </div>
                  <PosTag pos="FWD" />
                </div>
                <div className="flex min-h-[60px] items-center gap-3 border-b border-line bg-gradient-to-r from-pass-bg to-transparent to-70% px-3.5 py-2.5 shadow-[inset_3px_0_0_var(--pass)]">
                  <CheckBox checked />
                  <Jersey n={14} gamePass />
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">Jordan Lee</b>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-ok">Available</span>
                      <GamePassTag />
                    </div>
                  </div>
                  <PosTag pos="FWD" />
                </div>
                <div className="flex min-h-[60px] items-center gap-3 px-3.5 py-2.5 opacity-60">
                  <CheckBox checked={false} />
                  <Jersey n={21} />
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">Carmen Vega</b>
                    <div className="text-xs font-bold text-bad">Suspended</div>
                  </div>
                  <PosTag pos="MID" />
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-3.5">
              <StandingsTable rows={EXAMPLE_STANDINGS} highlight="ffx" linkBase={null} />
              <EmptyState icon="users" title="No players waiting">
                New players without a team will show up here.
              </EmptyState>
            </div>
          </div>
        </Section>

        <Section title="Notices & dialogs">
          <div className="grid gap-[18px] lg:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <Notice tone="info" title="No team? No problem.">
                You’ll go to placement.
              </Notice>
              <Notice tone="warn" title="Lauren Fitch is marked unavailable." />
              <Notice tone="bad" title="Carmen Vega is suspended." />
              <Notice tone="pass" title="This match only.">
                Expires after the final whistle.
              </Notice>
              <Notice tone="ok">Roster finalized.</Notice>
            </div>
            <div role="group" aria-label="Dialog example" className="flex flex-col gap-3.5 self-start rounded-[22px] border border-line bg-surface p-[22px] shadow-2xl">
              <h2 className="text-[26px]">Finalize match roster?</h2>
              <p className="text-muted">16 players for Game #204. The referee and Alexandria FC’s captain will see this roster.</p>
              <div className="flex flex-wrap justify-end gap-2.5">
                <Button variant="ghost">Keep editing</Button>
                <Button variant="primary">Finalize</Button>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Tailwind tokens">
          <Code>{THEME_CODE}</Code>
          <Code>{COMPONENT_CODE}</Code>
        </Section>
      </main>
    </>
  );
}
