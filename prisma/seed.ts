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
    where: { email: 'admin@nvasa.org' },
    update: {},
    create: {
      email: 'admin@nvasa.org',
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
  console.log(`✅ Created admin user: ${adminUser.email} (password: Admin123!)`)

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