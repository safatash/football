# NVASA — public results, team, player and standings pages

Work in this repo (Next.js 16 App Router, Tailwind v4, Prisma 6 + Neon, NextAuth v4) on branch `redesign/ui`. Read `AGENTS.md` first: this Next.js has breaking changes, and `params`/`searchParams` are Promises. Follow the design system that already exists (`src/app/globals.css` tokens, `src/components/{ui,league,shell}`, `/design`). Don't restyle anything.

This is a separate track from `CLAUDE_CODE_PROMPT.md`. If its Phase 1 schema (game numbers, jerseys, MatchReport/PlayerMatchStat, Team colors) isn't done yet, add only the fields listed below, in a migration of their own.

## Source of truth: the old ColdFusion site
The full legacy site is at `~/Documents/nvasa/wwwroot`. It is read only: never modify it, and never copy credentials from `application.cfm`. Many files there are iCloud placeholders. Opening them downloads them, which is fine.

Files to study:
- `results.cfm` → `inc/results.cfm`
- `team.cfm` → `inc/teamscores.cfm` + `inc/teaminfo.cfm`
- `player.cfm` → `inc/player.cfm`
- `divisions.cfm` → `inc/newdiv.cfm`
- `division.cfm` → `inc/divisionscores.cfm`
- `gamereport/index.cfm`
- `export.cfm`
- `inc/menu.cfm`

What the legacy site does (verify against the code):

**Seasons.** Each season is its own MySQL database (a "datasource"). The main `nvasa` DB has `seasons(id, name, datasource, activeSite)`. Every page takes `?season=<datasource>` and defaults to the active one. Legacy ids are only unique **within a season**.

**Per-season tables used by public pages:**
- `divisions(id, name, cat, orderit, bbm, bbf)`
- `teams` / `teamdiv(id, did, name, logo, teamphoto, htshirt, hshort, atshirt, ashort, formation, points, avg)`
- `teamPlayers` / `teamroster(pid, tid, captain, finalapproval, status, jno)`
- `players(id, first, last, gender, position, photo, status)`. `status = 2` means suspended.
- `schedule(id, gameno, gamedate, gametime, home, away, scoreHome, scoreAway, location, did, ref, refl, refr)`
- `fields(id, complex, field, address, city, state, zip)`
- `finalscores(pid, gid, did, home, away, goal, assist, yellow, yellow2, red, ingame, note)`
- `standingfinal(tid, total, win, tie, lost, goals, concived)`
- `jersey(pid, tid, jno)`

Referees live in `nvasa.users` with `accounttype = 3`.

**Legacy behaviors to drop:**
- SQL built from URL params, which is injectable.
- Standings pages that `UPDATE teamdiv` while rendering (write-on-read).
- N+1 queries per table row.
- The new pages must be read-only, use parameterized Prisma queries, and do no writes on GET.

### Legacy page inventory → new pages

**1. `/results.cfm?id=0&season=<ds>` — "NVASA Game Results"**
- Season select.
- One sortable, searchable table of every game with both scores entered: DATE (mm/dd/yyyy), DAY, TIME, HOME (logo + link to team), SCORE (winner's number green, loser's red, "h : a"), AWAY (logo + link), DIVISION, LOCATION (complex, (field) - city, plus a "GPS" Google Maps link).

**2. `/team.cfm?id=<id>&season=<ds>` — team page.** Tabs: TEAM INFO, SCORES/SCHEDULES (`#matches`), STANDINGS (links to `/divisions.cfm?season=`).
- **Team info:**
  - Logo (placeholder `team-holder.jpg`), team name, season name.
  - Home uniform and away uniform swatches (shirt + shorts colors).
  - Formation (or "Captain hasn't picked a formation yet").
  - Season select. If the team didn't exist that season, show "Your team wasn't registered for selected season."
  - CAPTAINS (names only).
  - Team photo (placeholder `no-photo.png`).
- **TEAM ROSTER:**
  - Columns: `#` (jersey), Player Name with photo linking to `/player.cfm?id=&season=`, a "C" badge for captains, and position, or "SUSPENDED" with a red square and a pink row.
  - Stats columns: GP (games with `ingame = In`), G, A, Yellow (yellow + yellow2 count), Red.
  - Only players with `finalapproval = 1`, ordered by jersey.
- **STANDINGS:** the team's division table with Rank, Team, Pts, GP, W, D, L, GF, GA, GD.
- **GOAL LEAD** and **ASSIST LEAD** player cards for the team.
- **Scores/Schedules:**
  - "Sync to Calendar" (`export.cfm?id=` → .ics, each event 90 minutes, location "complex - field - address city state zip", summary "Game No: N - Home Vs Away").
  - Table: GAME# (zero-padded to 3 digits), DAY, DATE, TIME, HOME, SCORE (links to the game report; "N/A" before a result), AWAY, LOCATION + GPS.
  - Signed-in users also get a VIEW/MANAGE link per game (captains get MANAGE) and a Print link.

**3. `/player.cfm?id=<id>&season=<ds>` — player page**
- Player card: photo or placeholder, first/last name, position (or a red square if suspended), current team logo + name, or "(SUSPENDED)".
- PLAYER HISTORY ("Teams Played") table: Season and Team Played (logo + link), across all seasons.

**4. `/divisions.cfm?season=<ds>` — STANDINGS**
- Season select.
- For every division (ordered by `orderit`): "<Division> Standings" table with Rank (trophy icon on #1), Team (logo + link), Pts, GP, W, D, L, GF, GA, GD. Sorted by points desc, then goal difference desc.
- Next to each: "DIVISION GOAL LEADERS", the top 3 scorers as cards (photo, first name, team logo, goal count).

**5. `/division.cfm?id=<did>` — one division**
- Division tabs.
- Grid of teams with points and a "VIEW TEAM" link.
- Each team's schedule (GAME#, HOME, SCORE/VS, AWAY, DAY, DATE, TIME, LOCATION).
- Standings.
- Goal leader + assist leader.
- Paginated player stats table: Name, G, A, GP, Yellow, Red.

**6. `/gamereport/index.cfm?home=&away=&gid=&id=` — game report**
- Header row: GAME#, DATE ("ddd, mmm dd"), TIME, HOME, SCORE, AWAY, LOCATION.
- Referees: center, left AR, right AR.
- For each team: big logo + name + score, then a table: `#`, PLAYER, G, A, Y, 2nd Y, R, IN, OUT, NOTE.
- Captains of either team see "EDIT GAME #N".

**7. Main nav** (`inc/menu.cfm`): Home, My Profile (signed in), STANDINGS, RESULTS, Info (CMS pages with `cat = 'Quick Links'`), REFEREES, MEDIA, plus Facebook and Twitter links.

## Build these public pages (no login required)

Mobile-first: tables become stacked cards or horizontally scrolling `TableWrap`s on phones. Each page exports `metadata` (title + description). Server Components, with ISR `export const revalidate = 60` on all read-only public pages.

**1. `/results`**
- Season `Segmented`/select (`?season=` slug like `spring-2026`), division filter chips, team filter, and a search box (GET form).
- Completed games only, newest first. Group by date on mobile, show a table on desktop.
- Columns: Date, Day, Time, Home, Score, Away, Division, Location.
- Winner's score in `text-ok`, loser's in `text-bad`, draws neutral.
- Location shows complex · field · city with a "Directions" link (`https://www.google.com/maps/search/?api=1&query=<encoded address>`).
- Score links to the match page; team names link to team pages.
- Empty state.

**2. `/schedule`** (new, same filters): upcoming games. Optional, but it's cheap once `/results` exists.

**3. `/teams`** (new index): every team for the season, grouped by division, with Crest, record and points.

**4. `/teams/[teamId]`** (`?season=`; the canonical URL uses the new team id). Sections, as anchors and tabs: **Team info** (`#info`), **Scores & schedule** (`#matches`), **Roster** (`#roster`), **Standings** (`#standings`).
- **Info:**
  - Crest/logo, name, division, season.
  - Home/away kit swatches: shirt and shorts color chips, labelled.
  - Formation, or "No formation set yet".
  - Captains as names only; never emails or phones.
  - Record W-D-L and points.
  - Team photo, if any.
  - Season select. If the team has no entry in the selected season, show a Notice: "This team didn't play in <season>."
- **Scores & schedule:**
  - Table: Game # (zero-padded "#007" for display), Day, Date, Time, Home, Score ("—" before a result), Away, Location + Directions.
  - "Add to calendar" downloads `/teams/[teamId]/calendar.ics` (same fields as the legacy export, 90-minute events, `America/New_York`, stable `UID` = `match-<id>@nvasa.org`, proper CRLF line endings, text escaping).
  - Signed-in team members also see a Print link per game (`/matches/[id]/print`). The team's captains also get "Manage" (→ captain match roster).
- **Roster:**
  - Columns: jersey, avatar, name (→ player page), Captain RoleTag, position, GP, G, A, Yellow, Red. Sortable on desktop.
  - Only approved, active seasonal members. Game-pass players never appear here.
  - Suspended players: show the "Suspended" badge **only to signed-in users**. Publicly, just list them.
- **Standings:** the division table (Rank, Team, Pts, GP, W, D, L, GF, GA, GD) with this team's row highlighted (`BodyRow highlight`), plus links to the full standings.
- **Leaders:** Goal leader and Assist leader cards (name, photo or initials, count).

**5. `/players/[playerId]`**
- Card with name, position, current team crest + link, and photo only if `player.social` is true (otherwise initials). Suspended status only for signed-in users.
- **Team history** table: Season, Team (link), Division, plus this player's G / A / GP for that team-season.
- Never show email, phone, DOB, address or age.

**6. `/standings`** (`?season=`): for each division in display order, the standings table (trophy on rank 1) and the top-3 goal leaders. Rows link to teams.

**7. `/divisions/[code]`** (public; the admin version stays at `/admin/divisions/[code]`):
- Division header (fee, age rule, level).
- Team cards with points and View team.
- Standings.
- Goal + assist leaders.
- Paginated player stats (Name, Team, G, A, GP, Yellow, Red; 25 per page, `?page=`).
- Full schedule/results for the division.

**8. `/matches/[matchId]`** (public game report):
- Header: Game #, date, time, division, both crests with names and score, location + Directions, referees (Center, AR1, AR2).
- For each team, the player stats table (#, Player, G, A, Yellow, 2nd yellow, Red, In, Out, Note) from the confirmed/submitted match report. Before a report exists: "Result not reported yet."
- A captain of either team sees "Edit report" (→ captain report page).

**9. Navigation:**
- Add **Standings**, **Results**, **Schedule** and **Teams** to `PublicTopNav` and to a public mobile menu (a hamburger sheet or a horizontal scroller under the header).
- Signed-in users keep their nav, plus a "League" link to `/standings`.
- Landing page: "This Sunday" cards link to `/matches/[id]`; add "Latest results" (last 6) linking to `/results`.
- Footer: Facebook (`https://www.facebook.com/groups/nvasa/`) and Twitter/X (`https://twitter.com/NVASA`).

## Data model additions (migration `public-pages`)
- **Season:** `slug` (unique, e.g. `spring-2026`), `legacyDatasource` (e.g. `spring2026`).
- **Team:** `legacyId Int?` and `@@unique([seasonId, legacyId])`; `logoUrl`, `photoUrl`, `homeShirt`, `homeShorts`, `awayShirt`, `awayShorts` (hex), `formation`.
- **Player:** `legacyKey` (stable across seasons, e.g. email or the legacy player id per season) and `photoUrl`.
- **Match:** `gameNumber`, `legacyId` + `@@unique([seasonId, legacyId])`, a `fieldId` relation, `ref1`/`ref2`/`ref3` (or a `Referee` model).
- **Field** model: `complex`, `name` (field), `address`, `city`, `state`, `zip`.
- **PlayerMatchStat** (if not already added): `goals`, `assists`, `yellow`, `secondYellow`, `red`, `inGame` (`IN | OUT | DNP`), `note`.
- **TeamRoster:** `jerseyNumber`.
- **Standings:** computed in SQL/Prisma from completed matches with both scores. Points = 3·W + D; GD = GF − GA; sort by Pts desc, GD desc, GF desc, then name. Put it in `src/lib/queries/standings.ts` and reuse it in admin. No stored points column.

## Legacy URL redirects (must keep old links working)
Implement as route handlers (folder names may contain dots, e.g. `src/app/team.cfm/route.ts`). Each looks up the new id by `(season.legacyDatasource, legacyId)`, uses the active season when `season` is missing or `0`, and returns **301**. When no match is found, redirect to the closest list page with a notice param.

| Legacy URL | Redirects to |
| --- | --- |
| `/results.cfm?season=` | `/results?season=` |
| `/team.cfm?id=&season=` | `/teams/[teamId]?season=` (`#matches` stays client-side) |
| `/player.cfm?id=&season=` | `/players/[playerId]` |
| `/divisions.cfm?season=` | `/standings?season=` |
| `/division.cfm?id=` | `/divisions/[code]` |
| `/gamereport/index.cfm?gid=…` | `/matches/[matchId]` |
| `/export.cfm?id=` | `/teams/[teamId]/calendar.ics` |
| `/register.cfm` | `/register` |
| `/login.cfm` | `/login` |
| `/forgotNew.cfm` | `/login` |
| `/?home=1` | `/` |

## Legacy data import (script only — ask before running)
- Write `scripts/import-legacy.ts` (`npm run import:legacy -- --season spring2026 [--dry-run]`). It reads the legacy MySQL with `mysql2` from `LEGACY_MYSQL_URL` (base URL; the database name = the season datasource) and the main `nvasa` DB for `seasons` and referee `users`.
- Upsert, in this order: Season → divisions → fields → teams (colors, formation, logo/photo filenames) → players + roster rows (jersey, captain, finalapproval, status 2 → Suspension) → matches (gameno, date+time in America/New_York, scores, field, referees) → finalscores → PlayerMatchStat.
- Idempotent via the legacy ids.
- `--dry-run` prints counts and the first five mapping problems.
- Images: copy `wwwroot/images/teams/*` and `wwwroot/images/players/*` that are referenced into `public/legacy/teams` and `public/legacy/players` (or Vercel Blob if configured), and store their URLs.
- Never import passwords. Players log in through "Retrieve player info" or a password reset.
- Document it in the README. **Don't run it against the production database without asking me.**

## Quality bar
- Accessibility: `<th scope>`, `<caption class="sr-only">` on tables, and score colors not the only signal (add a "W"/"L"/"D" text or `aria-label` like "Fairfax United won 2 to 0").
- Performance: one query per table (no N+1); use `include`/`groupBy` or raw SQL for aggregates.
- SEO: `generateMetadata` per team/player/match, canonical URLs, add teams/players/matches to `app/sitemap.ts`, JSON-LD `SportsTeam` on team pages and `SportsEvent` on match pages.
- Privacy: no emails, phones, addresses, DOBs or ages on public pages. Photos only with `player.social`. Suspension status only for signed-in users.
- Tests (Vitest):
  - standings computation (wins/draws/losses, tie-breakers, no games)
  - ICS output (valid, escaped, CRLF, timezone)
  - legacy redirect lookups (found, wrong season, missing → list page)
  - zero-padded game numbers
- `npx tsc --noEmit`, `npx eslint .`, `npm test`, `npm run build` all pass. Check every new page at 390px and 1366px wide with no horizontal scroll.
- Update the README with the new public routes, the redirect table and the import steps. Commit in small steps and summarize what you built and any decisions you made.
