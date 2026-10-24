# NVASA prototype build checklist

This checklist turns the current prototype notes into an execution order for the existing Next.js app.

## Backlog: before the Phase 2 launch (LeagueKeep)

- [ ] **Read-side RLS: try a per-page transaction, then re-measure.** Writes-only RLS is shipped
  (migration `20261025000000_rls_writes`). Restricting reads too cost pages +13–31 ms p95 on
  Vercel. Try running each page's data loading in one `leagueTransaction`, apply
  `prisma/rls/read-side.sql` to a throwaway Neon branch, and re-measure on a `leaguekeep` preview
  with the timing route described in `docs/rls.md`. Ship only if page p95 grows by less than 10 ms.

## Phase 1, registration entry flow

Goal: make the front-door registration UX match the desired branching flow before deeper portal logic is expanded.

### 1. Confirm and finish the registration entry split
- [x] `src/app/register/page.tsx`
  - Team registration path
  - Game pass path
- [ ] Add the missing game pass entry options so they mirror team registration more closely
  - Returning player
  - Login
  - Retrieve player information
  - New player
- [ ] Verify route destinations for each button so each path lands in the correct flow

### 2. Make the team registration flow reflect the real sequence
- [ ] `src/components/registration-flow.tsx`
  - Validate step order against the current live site
  - Keep New Player flowing into the full registration wizard
- [ ] `src/app/register/**`
  - Check whether the route set supports returning player, login, and retrieve-info entry states cleanly
  - Add any missing route wrappers or state handling

### 3. Make the game pass flow mirror the same entry logic
- [ ] `src/components/game-pass-flow.tsx`
  - Add parity messaging for returning player vs new player vs login/retrieve flow
- [ ] `src/app/register/game-pass/**`
  - Ensure the flow is explicitly single-match and not treated like seasonal registration

## Phase 2, game pass business rules

Goal: enforce the rule that a game pass is valid for one match only and should not create lasting roster membership.

### 4. Model single-match game pass behavior in prototype data
- [ ] `src/lib/mock-data.ts`
  - Add explicit game-pass player records tied to a specific match id/date
  - Distinguish season roster membership from temporary match eligibility
  - Add expired game pass examples for testing UI states

### 5. Reflect roster expiry behavior in the UI
- [ ] `src/app/portal/page.tsx`
  - Show current user game-roster access without implying permanent team membership
- [ ] `src/app/captain/page.tsx`
  - Show that match rosters can include temporary game-pass players
- [ ] captain roster / match roster routes
  - Ensure expired game-pass players disappear after the match ends

## Phase 3, roles and permissions

Goal: separate player access from captain access cleanly.

### 6. Formalize captain role behavior
- [ ] `src/lib/mock-data.ts`
  - Keep captain as a dedicated role, not just implied team ownership
- [ ] `src/app/captain/page.tsx`
  - Captain can manage own team
  - Captain can print own game roster

### 7. Limit normal player permissions
- [ ] `src/app/portal/page.tsx`
  - Logged-in players can print the game roster
  - Logged-in players cannot manage the team
- [ ] Shared nav / role shell components
  - Ensure links and actions differ clearly for player vs captain roles

## Phase 4, multi-team account support

Goal: make additional team registrations show up properly on the player account.

### 8. Expand the player account model for multiple teams
- [x] `src/lib/mock-data.ts`
  - Represent primary team plus additional team memberships more explicitly
  - Include edge cases: one team, multiple teams, captain on one team but player on another

### 9. Make the portal present multiple teams as first-class views
- [x] `src/app/portal/page.tsx`
  - Turn the current static team tabs into a clearer multi-team account pattern
  - Let each team feel like its own account section/view
  - Show access level per team if roles differ

## Phase 5, roster printing and polish

Goal: connect the above rules into realistic match-day behavior.

### 10. Final roster UX pass
- [x] player-facing roster print flow
- [x] captain-facing roster print flow
- [x] confirm game-pass players only appear on the relevant match roster
- [x] confirm additional team memberships are visible from the account
- [x] confirm dark buttons always use high-contrast light text

## Recommended implementation order

1. `src/app/register/page.tsx`
2. `src/components/game-pass-flow.tsx`
3. `src/app/register/game-pass/**`
4. `src/lib/mock-data.ts`
5. `src/app/portal/page.tsx`
6. `src/app/captain/page.tsx`
7. match roster-related routes/components

## Notes from Safa
- Game passes are single-game only, valid only for the day of the game.
- After the game ends, the player should drop off the roster and no longer appear there.
- Additional team registrations should appear on the player account as separate team views.
- Captains need a dedicated custom role.
- Captains can manage their own team and print their own game roster from the front end.
- Logged-in players can print the game roster, but they should not be able to manage the team.
- Register should first branch into team registration vs game pass, with returning/new/login/retrieve options.
