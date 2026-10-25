> **Superseded** by [`docs/leaguekeep-dev-brief.md`](../leaguekeep-dev-brief.md) (Oct 24, 2026). Kept for history; don't plan from this file.

# NVASA production plan

This document turns the current NVASA prototype into a production build plan.

## Current state audit

The current app is a strong product prototype, but it is not production-ready yet.

### What exists now
- Next.js app-router prototype
- role-based screens for:
  - player
  - captain
  - admin
- registration flow prototypes
- game-pass flow prototypes
- captain roster and match roster UX
- multi-team account presentation
- mock league, player, team, and match data

### What is missing for production
- real authentication
- persistent database
- server-side authorization
- payment integration
- registration workflow persistence
- captain/admin action persistence
- document / printable roster generation
- background jobs for roster expiry and operational tasks
- logging, monitoring, backups, and deployment hardening
- tests
- environment configuration strategy
- email / notification flows

## Production recommendation

Do not keep evolving the prototype as if it were already the product.

Use the prototype as the UX and workflow reference, then implement a real application underneath it in phases.

## Suggested production stack

### Front end
- Next.js App Router
- TypeScript
- Tailwind CSS
- Server Components where useful
- Client Components only where interaction requires them

### Backend / data
- PostgreSQL
- Prisma ORM
- Next.js server actions and route handlers for internal workflows
- background jobs for scheduled cleanup and lifecycle tasks

### Auth
- Auth.js or Clerk
- email/password login
- password reset / account recovery
- role-aware sessions

Recommendation: use Auth.js if you want full ownership and lower SaaS dependence, use Clerk if you want faster auth implementation and polished account UX.

### Payments
- Stripe
- support for:
  - registration fees
  - single-game pass purchases
- keep payment state in database, never only in Stripe metadata

### Hosting / infrastructure
- Vercel for web app
- managed Postgres, preferably Neon, Supabase Postgres, or RDS
- object storage if later needed for exports, files, waivers, or documents

## Core production domains

### 1. Identity and access
Entities:
- User
- Role
- Session
- Permission scope

Roles should include at minimum:
- admin
- captain
- player

Important rule:
- user-level role and team-level role are not always the same thing
- example: someone may be a captain for one team and only a player for another

So production access should use membership-based permissions, not only one global role flag.

### 2. League structure
Entities:
- Season
- Division
- Team
- TeamMembership
- PlayerProfile

### 3. Registration
Entities:
- Registration
- RegistrationQuestionnaire or structured registration fields
- RegistrationStatusHistory
- TeamPreference
- CaptainRequest

### 4. Matches and rosters
Entities:
- Match
- MatchRoster
- MatchRosterPlayer
- AvailabilityStatus
- LineupStatus

### 5. Game passes
Entities:
- GamePassPurchase
- GamePassEligibility

Critical rules:
- one pass applies to one match only
- one pass does not create season roster membership
- when match is completed or pass date expires, the pass should no longer be active in roster selection
- expired pass players must not appear in future active roster pools

### 6. Payments
Entities:
- Payment
- CheckoutSessionReference
- Refund or adjustment support if needed later

## Recommended production schema outline

This is the minimum practical shape.

### users
- id
- email
- passwordHash or auth-provider reference
- createdAt
- updatedAt
- status

### player_profiles
- id
- userId
- firstName
- lastName
- phone
- dob
- preferredPosition
- emergencyContact
- notes

### seasons
- id
- name
- startsAt
- endsAt
- isActive

### divisions
- id
- seasonId
- name
- ageRule
- registrationFee

### teams
- id
- seasonId
- divisionId
- name
- status

### team_memberships
- id
- userId
- playerProfileId
- teamId
- seasonId
- role
- membershipType
- status
- joinedAt
- leftAt nullable

### registrations
- id
- userId nullable for pre-account workflows if needed
- playerProfileId
- seasonId
- divisionId nullable
- preferredTeamId nullable
- status
- paymentStatus
- submittedAt
- approvedAt nullable

### captain_requests
- id
- registrationId
- teamId nullable
- status
- notes

### matches
- id
- seasonId
- divisionId
- homeTeamId
- awayTeamId
- startsAt
- endsAt
- field
- status

### match_rosters
- id
- matchId
- teamId
- status
- finalizedAt nullable
- printedAt nullable

### match_roster_players
- id
- matchRosterId
- playerProfileId
- sourceType
- gamePassPurchaseId nullable
- availabilityStatus
- lineupStatus

`sourceType` should distinguish:
- season_membership
- single_match_pass

### game_pass_purchases
- id
- userId nullable
- playerProfileId
- matchId
- teamId nullable
- paymentId
- status
- validFrom
- validUntil
- consumedAt nullable

### payments
- id
- userId nullable
- stripePaymentIntentId nullable
- stripeCheckoutSessionId nullable
- amount
- currency
- status
- paymentType
- relatedEntityType
- relatedEntityId

## Authorization model

This matters a lot.

### Players can
- manage their own profile
- view their registrations
- print allowed match rosters
- view their own team memberships and game-pass history

### Players cannot
- manage team membership
- edit captain tools
- finalize team roster
- manage lineup roles

### Captains can
- manage only their own team
- manage match roster for their own team
- print game roster for their own team
- manage lineup availability for their own team

### Captains cannot
- administer other teams unless separately elevated
- perform league-wide admin actions

### Admins can
- manage league-wide registrations, teams, placements, matches, and divisions

Implementation note:
- check authorization on the server for every mutation
- do not rely on hidden buttons as permission control

## Required production workflows

### Registration workflow
1. User chooses:
   - team registration
   - game pass
2. User logs in, retrieves existing profile, or creates new profile
3. Registration is saved incrementally or submitted atomically
4. Payment is attached
5. Registration enters review / approval workflow if needed

### Game-pass workflow
1. User selects one specific match
2. User pays fixed fee
3. Eligibility becomes active only for that match
4. Captain roster tools may include the player for that match only
5. After completion or expiry, player is removed from active eligibility

### Match roster workflow
1. Captain opens upcoming match roster
2. System pulls only eligible season and active game-pass players
3. Captain adjusts availability / selection
4. Captain finalizes roster
5. Printable roster is generated

## Background jobs needed

Use cron or durable jobs for:
- expiring game-pass eligibility after match end
- syncing payment webhooks / retries
- sending reminders if needed later
- optional nightly integrity checks on rosters and registrations

## Printable roster strategy

Two practical options:

### Option A, print-optimized HTML
- easiest and fastest
- browser print stylesheet
- good first production version

### Option B, generated PDFs
- more controlled output
- better if NVASA needs standardized printable league forms

Recommendation:
- start with print-optimized HTML
- move to PDF only if league operations require exact formatting

## Testing requirements

Minimum:
- unit tests for roster eligibility and permission rules
- integration tests for registration and game-pass purchase flows
- end-to-end tests for:
  - player registration
  - game-pass purchase
  - captain roster finalization
  - admin registration review

## Observability and safety

Need in production:
- structured server logs
- error tracking
- database backups
- environment separation:
  - local
  - staging
  - production
- migration discipline
- audit logging for sensitive actions like roster finalization and team membership edits

## Recommended build phases

### Phase A, foundation
- create production branch or new app workspace
- add Prisma
- add Postgres
- add auth
- define schema and migrations
- seed realistic dev data

### Phase B, core identity and player profile
- login
- account recovery
- player profile persistence
- role-aware session handling

### Phase C, registration system
- seasonal registration persistence
- returning/new player flows
- admin review state
- payment integration for registration fees

### Phase D, team memberships and roles
- real team memberships
- per-team captain/player access
- multi-team account support

### Phase E, matches and rosters
- match model
- captain roster management
- print-friendly roster pages
- lineup/availability persistence

### Phase F, game passes
- single-match purchase flow
- eligibility enforcement
- automatic expiry after match completion
- exclusion from future active roster pools

### Phase G, admin operations
- registration queue
- placement workflow
- team and division management
- match administration

### Phase H, production hardening
- test suite
- monitoring
- audit logs
- deployment docs
- staging signoff

## Immediate next implementation tasks

1. Decide whether to continue inside `nvasa-prototype` or create `nvasa-app` as the real product codebase
2. Add Prisma and initial schema
3. Choose auth approach, Auth.js vs Clerk
4. Implement core entities first:
   - users
   - player_profiles
   - seasons
   - divisions
   - teams
   - team_memberships
   - registrations
   - matches
   - match_rosters
   - game_pass_purchases
5. Replace `src/lib/mock-data.ts` reads with real queries screen by screen

## My recommendation

Best path:
- keep `nvasa-prototype` as the reference prototype
- create a separate real app build if you want a clean production architecture

If you want to move faster in the same repo, that can work too, but we should still treat it as a structured rebuild rather than patching mocks one file at a time.
