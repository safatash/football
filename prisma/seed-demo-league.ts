/**
 * "Demo League": a second, small league for trying multi-tenancy and for the isolation tests.
 * It deliberately overlaps NVASA: the same season name, the same team names and codes, and the same
 * player email (maya.johnson@example.com has a separate player profile in each league).
 *
 * Open it at demo.app.localhost:3000 (or ?org=demo in development).
 */
import { Prisma } from '@prisma/client'
import { hashPassword } from '../src/lib/password'
import { clientForOrg } from '../src/platform/db'

export const DEMO_ORG_ID = 'org_demo'
const db = clientForOrg(DEMO_ORG_ID)
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** A user (shared login across leagues) with a membership and player profile in the Demo League. */
async function member(email: string, password: string, role: 'OWNER' | 'ADMIN' | 'PLAYER', profile: { firstName: string; lastName: string; gender: 'MALE' | 'FEMALE' }) {
  const user = await db.user.upsert({ where: { email }, update: {}, create: { email, password: await hashPassword(password) } })
  await db.organizationMember.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: DEMO_ORG_ID } },
    update: {},
    create: { userId: user.id, organizationId: DEMO_ORG_ID, role, joinedAt: new Date() },
  })
  const player = await db.player.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: DEMO_ORG_ID } },
    update: {},
    create: {
      userId: user.id,
      ...profile,
      dob: day('1994-05-05'),
      phone: '(555) 555-0100',
      address: '1 Demo Way',
      city: 'Springfield',
      state: 'VA',
      zip: '22150',
      position: 'MID',
      tshirtSize: 'Adult M',
      status: 'ACTIVE',
      finalApproval: 'APPROVED',
    },
  })
  return { user, player }
}

export async function seedDemoLeague() {
  await db.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: {},
    create: { id: DEMO_ORG_ID, name: 'Demo League', slug: 'demo', status: 'ACTIVE', plan: 'trial', contactEmail: 'office@demo-league.example.com', supportEmail: 'office@demo-league.example.com' },
  })
  await db.organizationSettings.upsert({ where: { organizationId: DEMO_ORG_ID }, update: {}, create: { organizationId: DEMO_ORG_ID, gamePassFee: 10, maxMatchRoster: 16, eligibilityMode: 'NONE' } })

  const owner = await member('demo.office@example.com', 'DemoOffice26', 'OWNER', { firstName: 'Dana', lastName: 'Office', gender: 'FEMALE' })
  const maya = await member('maya.johnson@example.com', 'unused', 'PLAYER', { firstName: 'Maya', lastName: 'Johnson (Demo)', gender: 'FEMALE' })

  const season = await db.season.upsert({
    where: { organizationId_name: { organizationId: DEMO_ORG_ID, name: 'Spring 2026' } },
    update: {},
    create: { name: 'Spring 2026', slug: 'spring-2026', startDate: day('2026-04-05'), endDate: day('2026-06-28'), isActive: true },
  })
  await db.leagueSettings.upsert({ where: { seasonId: season.id }, update: {}, create: { seasonId: season.id } })
  const division = await db.division.upsert({
    where: { seasonId_code: { seasonId: season.id, code: 'wp' } },
    update: {},
    create: { seasonId: season.id, code: 'wp', name: 'Women Premier', registrationFee: new Prisma.Decimal(80) },
  })
  const team = (code: string, name: string) =>
    db.team.upsert({ where: { seasonId_code: { seasonId: season.id, code } }, update: {}, create: { seasonId: season.id, divisionId: division.id, code, name, shortName: code.toUpperCase() } })
  const ffx = await team('ffx', 'Fairfax United')
  const alx = await team('alx', 'Alexandria FC')

  if (!(await db.teamRoster.findFirst({ where: { playerId: maya.player.id, teamId: ffx.id } }))) {
    await db.teamRoster.create({ data: { playerId: maya.player.id, teamId: ffx.id, divisionId: division.id, isCaptain: true, jerseyNumber: 9 } })
  }

  if (!(await db.registration.findFirst({ where: { playerId: maya.player.id, seasonId: season.id } }))) {
    const payment = await db.payment.create({ data: { userId: maya.player.id, amount: new Prisma.Decimal(80), paymentType: 'REGISTRATION_FEE', status: 'PAID', method: 'CASH', paidAt: new Date(), relatedEntityType: 'registration' } })
    await db.registration.create({ data: { playerId: maya.player.id, seasonId: season.id, divisionId: division.id, totalAmount: new Prisma.Decimal(80), status: 'APPROVED', paymentStatus: 'PAID', paymentId: payment.id } })
  }

  const park = await db.park.upsert({ where: { organizationId_name: { organizationId: DEMO_ORG_ID, name: 'Demo Park' } }, update: {}, create: { name: 'Demo Park', city: 'Springfield', state: 'VA' } })
  const field = await db.field.upsert({ where: { parkId_name: { parkId: park.id, name: 'Field 1' } }, update: {}, create: { parkId: park.id, name: 'Field 1' } })
  const ref = (await db.referee.findFirst({ where: { name: 'Demo Referee' } })) ?? (await db.referee.create({ data: { name: 'Demo Referee', email: 'demo.referee@example.com' } }))

  const match = await db.match.upsert({
    where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: 1 } },
    update: {},
    create: { seasonId: season.id, divisionId: division.id, gameNumber: 1, homeTeamId: ffx.id, awayTeamId: alx.id, scheduledAt: new Date('2026-05-17T13:00:00-04:00'), fieldId: field.id, field: 'Demo Park · Field 1' },
  })
  await db.matchOfficial.upsert({ where: { matchId_role: { matchId: match.id, role: 'CENTER' } }, update: {}, create: { matchId: match.id, refereeId: ref.id, role: 'CENTER' } })

  console.log(`✅ Demo League (slug "demo"): owner ${owner.user.email} / DemoOffice26; Maya has a separate profile here`)
}
