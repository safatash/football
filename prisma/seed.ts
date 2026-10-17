import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Seed Positions
  const positions = [
    { name: 'Goalkeeper', category: 'Goalkeeper' },
    { name: 'Center Back', category: 'Defender' },
    { name: 'Left Back', category: 'Defender' },
    { name: 'Right Back', category: 'Defender' },
    { name: 'Defensive Midfielder', category: 'Midfielder' },
    { name: 'Center Midfielder', category: 'Midfielder' },
    { name: 'Attacking Midfielder', category: 'Midfielder' },
    { name: 'Left Winger', category: 'Midfielder' },
    { name: 'Right Winger', category: 'Midfielder' },
    { name: 'Striker', category: 'Forward' },
    { name: 'Center Forward', category: 'Forward' },
  ]

  console.log('Seeding positions...')
  for (const position of positions) {
    await prisma.position.upsert({
      where: { name: position.name },
      update: {},
      create: position,
    })
  }
  console.log(`✅ Created ${positions.length} positions`)

  // Seed T-shirt Sizes
  const sizes = [
    { size: 'Youth S', displayOrder: 1 },
    { size: 'Youth M', displayOrder: 2 },
    { size: 'Youth L', displayOrder: 3 },
    { size: 'Adult S', displayOrder: 4 },
    { size: 'Adult M', displayOrder: 5 },
    { size: 'Adult L', displayOrder: 6 },
    { size: 'Adult XL', displayOrder: 7 },
    { size: 'Adult 2XL', displayOrder: 8 },
    { size: 'Adult 3XL', displayOrder: 9 },
  ]

  console.log('Seeding t-shirt sizes...')
  for (const size of sizes) {
    await prisma.tshirtSize.upsert({
      where: { size: size.size },
      update: {},
      create: size,
    })
  }
  console.log(`✅ Created ${sizes.length} t-shirt sizes`)

  // Seed Fairfax County Zip Codes (sample - add more as needed)
  const fairfaxZips = [
    { zipCode: '22003', city: 'Annandale', state: 'VA' },
    { zipCode: '22015', city: 'Burke', state: 'VA' },
    { zipCode: '22030', city: 'Fairfax', state: 'VA' },
    { zipCode: '22031', city: 'Fairfax', state: 'VA' },
    { zipCode: '22032', city: 'Fairfax', state: 'VA' },
    { zipCode: '22033', city: 'Fairfax', state: 'VA' },
    { zipCode: '22039', city: 'Fairfax Station', state: 'VA' },
    { zipCode: '22041', city: 'Falls Church', state: 'VA' },
    { zipCode: '22042', city: 'Falls Church', state: 'VA' },
    { zipCode: '22043', city: 'Falls Church', state: 'VA' },
    { zipCode: '22044', city: 'Falls Church', state: 'VA' },
    { zipCode: '22046', city: 'Falls Church', state: 'VA' },
    { zipCode: '22060', city: 'Fort Belvoir', state: 'VA' },
    { zipCode: '22079', city: 'Lorton', state: 'VA' },
    { zipCode: '22081', city: 'Dunn Loring', state: 'VA' },
    { zipCode: '22096', city: 'Reston', state: 'VA' },
    { zipCode: '22101', city: 'McLean', state: 'VA' },
    { zipCode: '22102', city: 'McLean', state: 'VA' },
    { zipCode: '22124', city: 'Oakton', state: 'VA' },
    { zipCode: '22151', city: 'Springfield', state: 'VA' },
    { zipCode: '22152', city: 'Springfield', state: 'VA' },
    { zipCode: '22153', city: 'Springfield', state: 'VA' },
    { zipCode: '22180', city: 'Vienna', state: 'VA' },
    { zipCode: '22181', city: 'Vienna', state: 'VA' },
    { zipCode: '22182', city: 'Vienna', state: 'VA' },
  ]

  console.log('Seeding Fairfax County zip codes...')
  for (const zip of fairfaxZips) {
    await prisma.allowedZipCode.upsert({
      where: { zipCode: zip.zipCode },
      update: {},
      create: zip,
    })
  }
  console.log(`✅ Created ${fairfaxZips.length} allowed zip codes`)

  // Create a sample active season
  const currentSeason = await prisma.season.upsert({
    where: { name: 'Spring 2026' },
    update: {},
    create: {
      name: 'Spring 2026',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
    },
  })
  console.log(`✅ Created season: ${currentSeason.name}`)

  // Create sample divisions
  const divisions = [
    {
      name: 'Men\'s Open',
      seasonId: currentSeason.id,
      registrationFee: 125.00,
      maleBirthDateAfter: new Date('1900-01-01'),
      femaleBirthDateAfter: null,
      displayOrder: 1,
    },
    {
      name: 'Women\'s Open',
      seasonId: currentSeason.id,
      registrationFee: 125.00,
      maleBirthDateAfter: null,
      femaleBirthDateAfter: new Date('1900-01-01'),
      displayOrder: 2,
    },
    {
      name: 'Coed Recreational',
      seasonId: currentSeason.id,
      registrationFee: 110.00,
      maleBirthDateAfter: new Date('1900-01-01'),
      femaleBirthDateAfter: new Date('1900-01-01'),
      displayOrder: 3,
    },
    {
      name: 'Men\'s Over 30',
      seasonId: currentSeason.id,
      registrationFee: 125.00,
      maleBirthDateAfter: new Date('1900-01-01'),
      femaleBirthDateAfter: null,
      displayOrder: 4,
    },
  ]

  console.log('Seeding divisions...')
  for (const div of divisions) {
    await prisma.division.upsert({
      where: {
        seasonId_name: {
          seasonId: div.seasonId,
          name: div.name,
        },
      },
      update: {},
      create: div,
    })
  }
  console.log(`✅ Created ${divisions.length} divisions`)

  // Create a test admin user
  const adminPassword = await hashPassword('Admin123!')
  const adminUser = await prisma.user.upsert({
    where: { email: 'safatash@gmail.com' },
    update: {},
    create: {
      email: 'safatash@gmail.com',
      password: adminPassword,
      player: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
          gender: 'MALE',
          dob: new Date('1980-01-01'),
          phone: '703-555-0100',
          address: '123 Admin St',
          city: 'Fairfax',
          state: 'VA',
          zip: '22030',
          fairfaxCounty: true,
          position: 'Center Midfielder',
          tshirtSize: 'Adult L',
          finalApproval: 'APPROVED',
          status: 'ACTIVE',
        },
      },
    },
  })
  console.log(`✅ Created admin user: ${adminUser.email} (password: Admin123! — change it after first login)`)


  // ------------------------------------------------------------------
  // NVASA Spring 2026 league data (divisions, teams, matches) and a demo player
  // ------------------------------------------------------------------
  const nvasaDivisions = [
    { code: 'wp', name: 'Women Premier', fee: 95, order: 10 },
    { code: 'md1', name: 'Men D1', fee: 105, order: 11 },
    { code: 'd3', name: 'D3 Coed', fee: 55, order: 12 },
    { code: 'mc', name: 'Masters Coed', fee: 45, order: 13 },
    { code: 'cc', name: 'Combination Coed', fee: 60, order: 14 },
  ]
  const divIds: Record<string, string> = {}
  for (const d of nvasaDivisions) {
    const row = await prisma.division.upsert({
      where: { seasonId_name: { seasonId: currentSeason.id, name: d.name } },
      update: { registrationFee: d.fee },
      create: { seasonId: currentSeason.id, name: d.name, registrationFee: d.fee, displayOrder: d.order },
    })
    divIds[d.code] = row.id
  }

  const nvasaTeams: [string, string, string][] = [
    ['ffx', 'Fairfax United', 'wp'], ['alx', 'Alexandria FC', 'wp'], ['pot', 'Potomac Valkyries', 'wp'], ['brk', 'Burke Athletic', 'wp'],
    ['nvs', 'Nova Strikers', 'md1'], ['arl', 'Arlington SC', 'md1'], ['rst', 'Reston Rovers', 'md1'], ['spr', 'Springfield Athletic', 'md1'],
    ['bld', 'Bloodline', 'd3'], ['hrn', 'Herndon Hustle', 'd3'], ['vie', 'Vienna Athletic', 'cc'], ['shi', 'Shirlington Social', 'cc'],
    ['mvm', 'Mount Vernon Masters', 'mc'],
  ]
  const teamIds: Record<string, string> = {}
  for (const [code, name, div] of nvasaTeams) {
    const row = await prisma.team.upsert({
      where: { seasonId_divisionId_name: { seasonId: currentSeason.id, divisionId: divIds[div], name } },
      update: {},
      create: { seasonId: currentSeason.id, divisionId: divIds[div], name, maxPlayers: 22 },
    })
    teamIds[code] = row.id
  }
  console.log(`✅ NVASA divisions (${nvasaDivisions.length}) and teams (${nvasaTeams.length})`)

  // Matches (no game-number column yet; the field name carries the venue)
  const nvasaMatches: { home: string; away: string; at: string; field: string; div: string; score?: [number, number] }[] = [
    { home: 'ffx', away: 'alx', at: '2026-05-17T13:00:00Z', field: 'Wakefield Park 3', div: 'wp' },
    { home: 'vie', away: 'shi', at: '2026-05-17T17:00:00Z', field: 'Lee District 4', div: 'cc' },
    { home: 'bld', away: 'hrn', at: '2026-05-17T19:00:00Z', field: 'Wakefield Park 3', div: 'd3' },
    { home: 'ffx', away: 'pot', at: '2026-05-24T13:00:00Z', field: 'Lee District 2', div: 'wp' },
    { home: 'nvs', away: 'arl', at: '2026-05-10T15:00:00Z', field: 'Mason District 1', div: 'md1', score: [3, 1] },
    { home: 'brk', away: 'ffx', at: '2026-05-10T13:00:00Z', field: 'Burke Lake 1', div: 'wp', score: [0, 2] },
  ]
  const matchIds: string[] = []
  for (const m of nvasaMatches) {
    const existing = await prisma.match.findFirst({ where: { homeTeamId: teamIds[m.home], awayTeamId: teamIds[m.away], scheduledAt: new Date(m.at) } })
    const row =
      existing ??
      (await prisma.match.create({
        data: {
          seasonId: currentSeason.id,
          divisionId: divIds[m.div],
          homeTeamId: teamIds[m.home],
          awayTeamId: teamIds[m.away],
          scheduledAt: new Date(m.at),
          field: m.field,
          status: m.score ? 'COMPLETED' : 'SCHEDULED',
          homeScore: m.score?.[0],
          awayScore: m.score?.[1],
        },
      }))
    matchIds.push(row.id)
  }
  console.log(`✅ NVASA matches (${nvasaMatches.length})`)

  // Demo player: Maya Johnson — captain of Fairfax United, player on Bloodline,
  // one active and one expired game pass.
  const mayaPassword = await hashPassword('MayaJohnson26')
  const maya = await prisma.user.upsert({
    where: { email: 'maya.johnson@example.com' },
    update: {},
    create: {
      email: 'maya.johnson@example.com',
      password: mayaPassword,
      player: {
        create: {
          firstName: 'Maya', lastName: 'Johnson', gender: 'FEMALE', dob: new Date('1994-03-12'), phone: '(703) 555-0117',
          address: '2810 Gallows Rd', city: 'Vienna', state: 'VA', zip: '22180', fairfaxCounty: true,
          position: 'FWD', tshirtSize: 'Adult M', finalApproval: 'APPROVED', status: 'ACTIVE', contactMe: true, tournaments: true,
        },
      },
    },
    include: { player: true },
  })
  const mayaPlayerId = maya.player!.id
  const hasRoster = await prisma.teamRoster.count({ where: { playerId: mayaPlayerId } })
  if (!hasRoster) {
    await prisma.teamRoster.create({ data: { playerId: mayaPlayerId, teamId: teamIds.ffx, divisionId: divIds.wp, isCaptain: true, captainRequest: true } })
    await prisma.teamRoster.create({ data: { playerId: mayaPlayerId, teamId: teamIds.bld, divisionId: divIds.d3 } })
    await prisma.registration.create({
      data: { playerId: mayaPlayerId, seasonId: currentSeason.id, registrationType: 'RETURNING_PLAYER', selectedTeams: JSON.stringify(['Fairfax United']), totalAmount: 95, status: 'APPROVED', paymentStatus: 'PAID', approvedAt: new Date('2026-03-02') },
    })
    // Game passes need a payment each
    const passes: [number, 'ACTIVE' | 'EXPIRED', string, string][] = [
      [1, 'ACTIVE', '2026-05-17T04:00:00Z', '2026-05-18T03:59:00Z'],
      [4, 'EXPIRED', '2026-05-10T04:00:00Z', '2026-05-11T03:59:00Z'],
    ]
    for (const [idx, status, from, until] of passes) {
      const payment = await prisma.payment.create({
        data: { userId: mayaPlayerId, amount: 15, status: 'PAID', paymentType: 'GAME_PASS', relatedEntityType: 'game_pass', paidAt: new Date(from) },
      })
      await prisma.gamePass.create({
        data: { playerId: mayaPlayerId, matchId: matchIds[idx], paymentId: payment.id, status, validFrom: new Date(from), validUntil: new Date(until) },
      })
    }
  }
  console.log('✅ Demo player: maya.johnson@example.com (password: MayaJohnson26)')

  console.log('✅ Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })