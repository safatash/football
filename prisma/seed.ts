/**
 * NVASA seed: reference data plus the Spring 2026 league (divisions, teams, rosters, schedule,
 * reports, registrations queue, placements, suspensions, discount codes and settings).
 *
 * Idempotent: reference data is upserted; match-day records (availability, match rosters,
 * reports, game passes, registrations) are only created when missing, so re-running the seed
 * never duplicates rows or overwrites changes made in the app.
 */
import { Prisma, PrismaClient, type Gender } from '@prisma/client'
import { hashPassword } from '../src/lib/password'

const prisma = new PrismaClient()

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Deterministic PRNG so every run produces the same schedule and scores. */
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(2026)
const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]

/** Eastern time (all Spring 2026 dates fall in daylight time, UTC−4). */
const et = (date: string, time = '00:00') => new Date(`${date}T${time.padStart(5, '0')}:00-04:00`)
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
const emailFor = (name: string) => `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@example.com`

// ------------------------------------------------------------------
// League data
// ------------------------------------------------------------------

const OPENING_DAY = '2026-03-29'
const EIGHTEEN_ON_OPENING_DAY = '2008-03-29'

type DivisionSeed = {
  code: string
  name: string
  fee: number
  level: string
  genderRule: 'WOMEN' | 'MEN' | 'COED'
  male: string | null
  female: string | null
  description: string
  order: number
}
const DIVISIONS: DivisionSeed[] = [
  { code: 'wp', name: 'Women Premier', fee: 95, level: 'Competitive', genderRule: 'WOMEN', male: null, female: EIGHTEEN_ON_OPENING_DAY, description: 'Women, 18 or older on opening day (Mar 29, 2026)', order: 10 },
  { code: 'md1', name: 'Men D1', fee: 105, level: 'Competitive', genderRule: 'MEN', male: EIGHTEEN_ON_OPENING_DAY, female: null, description: 'Men, 18 or older on opening day (Mar 29, 2026)', order: 11 },
  { code: 'd3', name: 'D3 Coed', fee: 55, level: 'Recreational', genderRule: 'COED', male: '2008-12-31', female: '2008-12-31', description: 'Born on or before Dec 31, 2008', order: 12 },
  { code: 'mc', name: 'Masters Coed', fee: 45, level: 'Recreational', genderRule: 'COED', male: '1991-12-31', female: '1996-12-31', description: 'Men born on or before Dec 31, 1991; women on or before Dec 31, 1996', order: 13 },
  { code: 'cc', name: 'Combination Coed', fee: 60, level: 'Social to intermediate', genderRule: 'COED', male: EIGHTEEN_ON_OPENING_DAY, female: EIGHTEEN_ON_OPENING_DAY, description: '18 or older on opening day', order: 14 },
]
const PLACEHOLDER_DIVISIONS = ["Men's Open", "Women's Open", 'Coed Recreational', "Men's Over 30"]

type TeamSeed = { code: string; name: string; div: string; color: string; short: string; home: string; captains: string[]; strength: number }
const TEAMS: TeamSeed[] = [
  { code: 'ffx', name: 'Fairfax United', div: 'wp', color: '#0F3D2E', short: 'FU', home: 'Wakefield Park', captains: ['Maya Johnson'], strength: 2.3 },
  { code: 'alx', name: 'Alexandria FC', div: 'wp', color: '#7A1F2B', short: 'AFC', home: 'Chinquapin Park', captains: ['Renee Carter'], strength: 2.0 },
  { code: 'pot', name: 'Potomac Valkyries', div: 'wp', color: '#27407A', short: 'PV', home: 'Lee District', captains: ['Gabi Ortiz'], strength: 1.7 },
  { code: 'brk', name: 'Burke Athletic', div: 'wp', color: '#8A5A12', short: 'BA', home: 'Burke Lake', captains: ['Sarah Lin'], strength: 1.0 },
  { code: 'nvs', name: 'Nova Strikers', div: 'md1', color: '#1E5E8C', short: 'NS', home: 'Mason District', captains: ['Chris Alvarez', 'Diego Ruiz'], strength: 2.3 },
  { code: 'arl', name: 'Arlington SC', div: 'md1', color: '#6B2E86', short: 'ASC', home: 'Long Bridge Park', captains: ['Marcus Hill'], strength: 1.7 },
  { code: 'rst', name: 'Reston Rovers', div: 'md1', color: '#9A3412', short: 'RR', home: 'Baron Cameron', captains: ['Tom Becker'], strength: 1.3 },
  { code: 'spr', name: 'Springfield Athletic', div: 'md1', color: '#3F5A1A', short: 'SA', home: 'Lake Accotink', captains: ['Ahmed Saleh'], strength: 0.9 },
  { code: 'bld', name: 'Bloodline', div: 'd3', color: '#A3121F', short: 'BL', home: 'Wakefield Park', captains: ['Kevin Osei'], strength: 1.8 },
  { code: 'hrn', name: 'Herndon Hustle', div: 'd3', color: '#0E6E6E', short: 'HH', home: 'Bready Park', captains: ['Paula Reyes'], strength: 1.7 },
  { code: 'vie', name: 'Vienna Athletic', div: 'cc', color: '#4B4B9A', short: 'VA', home: 'Lee District', captains: ['Jess Moore'], strength: 1.4 },
  { code: 'shi', name: 'Shirlington Social', div: 'cc', color: '#7A5C1E', short: 'SS', home: 'Lee District', captains: ['Andre Wu'], strength: 1.2 },
  { code: 'mvm', name: 'Mount Vernon Masters', div: 'mc', color: '#2F4F4F', short: 'MV', home: 'Grist Mill Park', captains: ['Grace Mensah'], strength: 1.6 },
]

type Pos = 'GK' | 'DEF' | 'MID' | 'FWD'
type RosterSeed = { name: string; jersey: number; pos: Pos; avail?: 'yes' | 'no' | 'maybe'; note?: string; captain?: boolean }

const FFX_ROSTER: RosterSeed[] = [
  { name: 'Priya Raman', jersey: 1, pos: 'GK', avail: 'yes' },
  { name: 'Hannah Cole', jersey: 2, pos: 'DEF', avail: 'yes' },
  { name: 'Lauren Fitch', jersey: 3, pos: 'DEF', avail: 'no', note: 'Out of town' },
  { name: 'Ana Morales', jersey: 4, pos: 'DEF', avail: 'yes' },
  { name: 'Keisha Brooks', jersey: 5, pos: 'DEF', avail: 'yes' },
  { name: 'Sofia Russo', jersey: 6, pos: 'MID', avail: 'yes' },
  { name: 'Jen Park', jersey: 7, pos: 'MID', avail: 'yes' },
  { name: 'Emma Kowalski', jersey: 8, pos: 'MID', avail: 'yes' },
  { name: 'Maya Johnson', jersey: 9, pos: 'FWD', avail: 'yes', captain: true },
  { name: 'Tasha Greene', jersey: 10, pos: 'MID', avail: 'yes' },
  { name: 'Rachel Stein', jersey: 11, pos: 'FWD', avail: 'yes' },
  { name: 'Claire Dubois', jersey: 12, pos: 'DEF', avail: 'yes' },
  { name: 'Olivia Grant', jersey: 15, pos: 'DEF', avail: 'maybe', note: 'No reply yet' },
  { name: 'Bri Okafor', jersey: 16, pos: 'MID', avail: 'yes' },
  { name: 'Nadia Haddad', jersey: 17, pos: 'FWD', avail: 'yes' },
  { name: 'Lily Tran', jersey: 19, pos: 'FWD', avail: 'no', note: 'Ankle injury' },
  { name: 'Carmen Vega', jersey: 21, pos: 'MID', avail: 'yes' },
  { name: 'Megan Shaw', jersey: 23, pos: 'GK', avail: 'yes' },
]
const ALX_ROSTER: RosterSeed[] = [
  'Renee Carter', 'Kara Whitfield', 'Joy Adeyemi', 'Mia Sorensen', 'Hope Daniels', 'Bea Kaplan', 'Nina Petrova', 'Zoe Hart',
  'Ivy Chen', 'Rosa Lima', 'Kendra Moss', 'Elle Brandt', 'Faith Ochoa', 'Dani Roth', 'Tara Quinn', 'Uma Patel',
].map((name, i) => ({
  name,
  jersey: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22][i],
  pos: (['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'DEF', 'MID', 'FWD', 'GK', 'MID'] as Pos[])[i],
  captain: i === 0,
}))
const BLD_ROSTER: RosterSeed[] = [
  { name: 'Kevin Osei', jersey: 4, pos: 'DEF', captain: true },
  { name: 'Maya Johnson', jersey: 9, pos: 'FWD' },
  { name: 'Ravi Menon', jersey: 7, pos: 'MID' },
  { name: 'Tess Alvarado', jersey: 1, pos: 'GK' },
  { name: 'Marco Bellini', jersey: 10, pos: 'MID' },
  { name: 'Dee Washington', jersey: 11, pos: 'FWD' },
]

/** Facts we know about specific people; everyone else gets plausible, deterministic details. */
type PersonSeed = { email?: string; gender?: Gender; dob?: string; city?: string; zip?: string; since?: number; pos?: Pos }
const PEOPLE: Record<string, PersonSeed> = {
  'Maya Johnson': { email: 'maya.johnson@example.com', gender: 'FEMALE', dob: '1994-03-12', city: 'Vienna', zip: '22180', since: 2019, pos: 'FWD' },
  'Carmen Vega': { email: 'cvega@example.com', since: 2021 },
  'Jordan Lee': { email: 'jordan.lee@example.com', gender: 'FEMALE', since: 2026, pos: 'FWD' },
  'Sam Ortiz': { gender: 'FEMALE', since: 2026, pos: 'MID' },
  'Aisha Bello': { email: 'aisha.bello@example.com', gender: 'FEMALE', dob: '1997-08-02', city: 'Annandale', zip: '22003', since: 2026, pos: 'MID' },
  'Devon Price': { email: 'devon.price@example.com', gender: 'MALE', dob: '1990-01-19', city: 'Reston', zip: '20190', since: 2022, pos: 'MID' },
  'Lena Fischer': { email: 'lena.f@example.com', gender: 'FEMALE', dob: '1999-11-30', city: 'Arlington', zip: '22204', since: 2026, pos: 'MID' },
  'Tyler Nguyen': { email: 'tnguyen@example.com', gender: 'MALE', dob: '1995-04-07', city: 'Falls Church', zip: '22042', since: 2023, pos: 'FWD' },
  'Grace Mensah': { email: 'gmensah@example.com', gender: 'FEMALE', dob: '1984-06-15', city: 'Alexandria', zip: '22309', since: 2018, pos: 'DEF' },
  'Ben Carter': { email: 'bcarter@example.com', gender: 'MALE', dob: '1993-02-11', city: 'Springfield', zip: '22150', since: 2026, pos: 'DEF' },
  'Sophie Allen': { email: 'sallen@example.com', gender: 'FEMALE', dob: '1998-09-09', city: 'Gaithersburg', zip: '20878', since: 2026, pos: 'MID' },
  'Ravi Menon': { email: 'ravi.m@example.com', gender: 'MALE', dob: '2001-03-03', city: 'Fairfax', zip: '22030', since: 2024 },
  'Hector Ramos': { email: 'hramos@example.com', gender: 'MALE', dob: '1992-12-01', city: 'Alexandria', zip: '22312', since: 2026, pos: 'MID' },
  'Natalie Brooks': { email: 'nbrooks@example.com', gender: 'FEMALE', dob: '1996-07-21', city: 'Burke', zip: '22015', since: 2024, pos: 'DEF' },
  'Jess Whitaker': { email: 'jwhitaker@example.com', gender: 'FEMALE', dob: '1997-10-04', city: 'Vienna', zip: '22180', since: 2026, pos: 'FWD' },
  'Owen Brady': { email: 'obrady@example.com', gender: 'MALE', dob: '1984-08-20', city: 'Lorton', zip: '22079', since: 2026, pos: 'GK' },
  'Chris Alvarez': { email: 'calvarez@example.com', gender: 'MALE', since: 2017 },
  'Diego Ruiz': { email: 'druiz@example.com', gender: 'MALE', since: 2018 },
  'Kevin Osei': { email: 'kosei@example.com', gender: 'MALE', since: 2020 },
  'Lily Tran': { email: 'ltran@example.com', since: 2022 },
  'Marcus Hill': { email: 'mhill@example.com', gender: 'MALE', since: 2016 },
  'Dee Washington': { email: 'dwash@example.com', gender: 'FEMALE', since: 2023 },
  'Tom Becker': { gender: 'MALE' },
  'Ahmed Saleh': { gender: 'MALE' },
  'Paula Reyes': { gender: 'FEMALE' },
  'Jess Moore': { gender: 'FEMALE' },
  'Andre Wu': { gender: 'MALE' },
  'Gabi Ortiz': { gender: 'FEMALE' },
  'Sarah Lin': { gender: 'FEMALE' },
  'Renee Carter': { gender: 'FEMALE' },
  'Tess Alvarado': { gender: 'FEMALE' },
  'Marco Bellini': { gender: 'MALE' },
}
const PLACES: [string, string][] = [['Fairfax', '22030'], ['Annandale', '22003'], ['Burke', '22015'], ['Falls Church', '22042'], ['Vienna', '22180'], ['Springfield', '22151'], ['Reston', '20190'], ['Arlington', '22204'], ['Alexandria', '22314'], ['McLean', '22101']]
const STREETS = ['Gallows Rd', 'Lee Hwy', 'Main St', 'Braddock Rd', 'Little River Tpke', 'Chain Bridge Rd', 'Columbia Pike', 'Backlick Rd']

/** Weights for spreading goals across a roster in generated results. */
const SCORING: Record<string, number> = {
  'Maya Johnson': 6, 'Nadia Haddad': 4, 'Rachel Stein': 3, 'Renee Carter': 5, 'Kara Whitfield': 3, 'Gabi Ortiz': 5,
  'Chris Alvarez': 4, 'Diego Ruiz': 3, 'Kevin Osei': 1, 'Dee Washington': 3, 'Marco Bellini': 2,
}

/** Towns for the parks we play at (used for directions). */
const FIELD_CITIES: Record<string, string> = {
  'Wakefield Park': 'Annandale', 'Chinquapin Park': 'Alexandria', 'Lee District': 'Alexandria', 'Burke Lake': 'Fairfax Station',
  'Mason District': 'Annandale', 'Long Bridge Park': 'Arlington', 'Baron Cameron': 'Reston', 'Lake Accotink': 'Springfield',
  'Bready Park': 'Herndon', 'Grist Mill Park': 'Alexandria',
}

const REFS = ['Daniel Kim', 'Lucia Fernandes', 'Omar Haddad', 'Sam Okoye', 'Irene Park', 'Luis Mejía', 'Paul Grant', 'Ana Silva', 'Tara Boone', 'Hugo Bell']

type FixedMatch = { game: number; date: string; time: string; home: string; away: string; field: string; refs: [string, string, string]; score?: [number, number] }
const FIXED_MATCHES: FixedMatch[] = [
  { game: 204, date: '2026-05-17', time: '09:00', home: 'ffx', away: 'alx', field: 'Wakefield Park 3', refs: ['Daniel Kim', 'Lucia Fernandes', 'Omar Haddad'] },
  { game: 206, date: '2026-05-17', time: '11:00', home: 'pot', away: 'brk', field: 'Wakefield Park 2', refs: ['Sam Okoye', 'Irene Park', 'Luis Mejía'] },
  { game: 207, date: '2026-05-17', time: '13:00', home: 'vie', away: 'shi', field: 'Lee District 4', refs: ['Paul Grant', 'Ana Silva', ''] },
  { game: 208, date: '2026-05-17', time: '15:00', home: 'bld', away: 'hrn', field: 'Wakefield Park 3', refs: ['Daniel Kim', 'Tara Boone', ''] },
  { game: 209, date: '2026-05-24', time: '09:00', home: 'ffx', away: 'pot', field: 'Lee District 2', refs: ['', '', ''] },
  { game: 210, date: '2026-05-24', time: '11:00', home: 'nvs', away: 'rst', field: 'Mason District 1', refs: ['', '', ''] },
  { game: 205, date: '2026-05-10', time: '11:00', home: 'nvs', away: 'arl', field: 'Mason District 1', refs: ['Hugo Bell', 'Lucia Fernandes', 'Omar Haddad'], score: [3, 1] },
  { game: 203, date: '2026-05-10', time: '09:00', home: 'brk', away: 'ffx', field: 'Burke Lake 1', refs: ['Daniel Kim', 'Irene Park', 'Sam Okoye'], score: [0, 2] },
  { game: 202, date: '2026-05-10', time: '15:00', home: 'bld', away: 'vie', field: 'Wakefield Park 3', refs: ['Tara Boone', '', ''], score: [2, 2] },
  { game: 201, date: '2026-05-10', time: '13:00', home: 'alx', away: 'pot', field: 'Chinquapin Park 1', refs: ['Paul Grant', 'Ana Silva', 'Hugo Bell'] },
  { game: 200, date: '2026-05-10', time: '13:00', home: 'rst', away: 'spr', field: 'Baron Cameron 2', refs: ['Luis Mejía', 'Tara Boone', 'Sam Okoye'] },
]

/** Registrations queue (admin) — numbers match the R-#### shown in the office. */
type RegSeed = {
  number: number
  name: string
  div: string
  pref?: string
  backup?: string
  status: 'SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  pay: 'PAID' | 'UNPAID'
  date: string
  isNew: boolean
  level: string
  captainNote?: string
  deniedReason?: string
  deniedMessage?: string
  placement?: 'NEW' | 'INFO_REQUESTED' | 'WAITLISTED'
  playerNote?: string
}
const REGISTRATIONS: RegSeed[] = [
  { number: 2041, name: 'Aisha Bello', div: 'wp', pref: 'ffx', backup: 'alx', status: 'PENDING', pay: 'PAID', date: '2026-05-14', isNew: false, level: 'Competitive' },
  { number: 2040, name: 'Devon Price', div: 'md1', pref: 'rst', status: 'PENDING', pay: 'PAID', date: '2026-05-14', isNew: false, level: 'Competitive', captainNote: 'Ran the team’s group chat and subs list last fall. Tom Becker asked me to co-captain.' },
  { number: 2039, name: 'Lena Fischer', div: 'd3', status: 'PENDING', pay: 'PAID', date: '2026-05-13', isNew: true, level: 'Beginner / social', placement: 'NEW', playerNote: 'Just moved from Denver. Played intramurals in college, looking for a friendly Sunday game.' },
  { number: 2038, name: 'Tyler Nguyen', div: 'md1', pref: 'nvs', backup: 'arl', status: 'SUBMITTED', pay: 'UNPAID', date: '2026-05-13', isNew: false, level: 'Competitive' },
  { number: 2037, name: 'Grace Mensah', div: 'mc', pref: 'mvm', status: 'APPROVED', pay: 'PAID', date: '2026-05-12', isNew: false, level: 'Intermediate' },
  { number: 2036, name: 'Ben Carter', div: 'cc', status: 'PENDING', pay: 'UNPAID', date: '2026-05-12', isNew: true, level: 'Not sure', placement: 'NEW', playerNote: 'Haven’t played in about 8 years. Fine anywhere in the back.' },
  { number: 2035, name: 'Sophie Allen', div: 'wp', pref: 'alx', status: 'REJECTED', pay: 'UNPAID', date: '2026-05-11', isNew: false, level: 'Competitive', deniedReason: 'Outside eligible area', deniedMessage: 'Address outside the league’s eligible area.' },
  { number: 2034, name: 'Ravi Menon', div: 'd3', pref: 'bld', status: 'APPROVED', pay: 'PAID', date: '2026-05-10', isNew: false, level: 'Intermediate' },
  { number: 2033, name: 'Hector Ramos', div: 'md1', status: 'PENDING', pay: 'PAID', date: '2026-05-10', isNew: true, level: 'Competitive', placement: 'NEW', playerNote: 'Played in a semi-pro league in Monterrey until 2023.' },
  { number: 2032, name: 'Natalie Brooks', div: 'wp', pref: 'brk', backup: 'pot', status: 'SUBMITTED', pay: 'UNPAID', date: '2026-05-09', isNew: false, level: 'Competitive', captainNote: 'Happy to help Sarah run Burke; I coach youth on weekends.' },
  { number: 2029, name: 'Jess Whitaker', div: 'wp', status: 'PENDING', pay: 'PAID', date: '2026-05-06', isNew: true, level: 'Intermediate', placement: 'INFO_REQUESTED', playerNote: 'Played club in high school. Asked to be with a friend on Potomac.' },
  { number: 2024, name: 'Owen Brady', div: 'mc', status: 'PENDING', pay: 'PAID', date: '2026-04-28', isNew: true, level: 'Intermediate', placement: 'WAITLISTED', playerNote: 'Keeper. Available most Sundays except June.' },
]
const LEVEL_LABEL: Record<string, string> = { 'Beginner / social': 'Beginner' }

const DISCOUNT_CODES = [
  { code: 'BOARD26', kind: 'BOARD', type: 'PERCENT', value: 100, maxUses: 12, uses: 4, active: true },
  { code: 'SPRING10', kind: 'PROMO', type: 'AMOUNT', value: 10, maxUses: 200, uses: 61, active: true },
  { code: 'TEAMPAID-FFX', kind: 'TEAM_PAID', type: 'PERCENT', value: 100, maxUses: 18, uses: 15, active: true, team: 'ffx' },
  { code: 'FALL25', kind: 'PROMO', type: 'PERCENT', value: 15, maxUses: 100, uses: 88, active: false },
] as const

const EXTRA_ZIPS: [string, string][] = [
  ['22201', 'Arlington'], ['22202', 'Arlington'], ['22203', 'Arlington'], ['22204', 'Arlington'], ['22205', 'Arlington'], ['22206', 'Arlington'],
  ['22207', 'Arlington'], ['22209', 'Arlington'], ['22301', 'Alexandria'], ['22302', 'Alexandria'], ['22304', 'Alexandria'], ['22305', 'Alexandria'], ['22314', 'Alexandria'],
]
const BLOCKLIST = [
  { email: 'spamleague.biz', reason: 'Spam sign-ups' },
  { email: 'j.doe.banned@example.com', reason: 'Banned by the board' },
  { email: '*@tempmail.dev', reason: 'Disposable email domain' },
]

// ------------------------------------------------------------------
// Seed
// ------------------------------------------------------------------

async function main() {
  console.log('🌱 Starting database seed...')

  // Reference data ----------------------------------------------------
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
  for (const position of positions) await prisma.position.upsert({ where: { name: position.name }, update: {}, create: position })

  const sizes = ['Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult 2XL', 'Adult 3XL']
  for (const [i, size] of sizes.entries()) await prisma.tshirtSize.upsert({ where: { size }, update: {}, create: { size, displayOrder: i + 1 } })

  const fairfaxZips: [string, string][] = [
    ['22003', 'Annandale'], ['22015', 'Burke'], ['22030', 'Fairfax'], ['22031', 'Fairfax'], ['22032', 'Fairfax'], ['22033', 'Fairfax'],
    ['22039', 'Fairfax Station'], ['22041', 'Falls Church'], ['22042', 'Falls Church'], ['22043', 'Falls Church'], ['22044', 'Falls Church'],
    ['22046', 'Falls Church'], ['22060', 'Fort Belvoir'], ['22079', 'Lorton'], ['22081', 'Dunn Loring'], ['22096', 'Reston'], ['20190', 'Reston'],
    ['22101', 'McLean'], ['22102', 'McLean'], ['22124', 'Oakton'], ['22150', 'Springfield'], ['22151', 'Springfield'], ['22152', 'Springfield'],
    ['22153', 'Springfield'], ['22180', 'Vienna'], ['22181', 'Vienna'], ['22182', 'Vienna'], ['22309', 'Alexandria'], ['22312', 'Alexandria'],
  ]
  for (const [zipCode, city] of fairfaxZips) {
    await prisma.allowedZipCode.upsert({ where: { zipCode }, update: { fairfaxCounty: true }, create: { zipCode, city, state: 'VA', fairfaxCounty: true } })
  }
  for (const [zipCode, city] of EXTRA_ZIPS) {
    await prisma.allowedZipCode.upsert({ where: { zipCode }, update: {}, create: { zipCode, city, state: 'VA', fairfaxCounty: false } })
  }
  for (const b of BLOCKLIST) await prisma.blocklist.upsert({ where: { email: b.email }, update: {}, create: { ...b, blockedBy: 'safatash@gmail.com' } })
  console.log('✅ Positions, shirt sizes, ZIP codes, blocklist')

  // Admin (league office; no player profile needed) --------------------
  const adminPassword = await hashPassword('Admin123!')
  await prisma.user.upsert({
    where: { email: 'safatash@gmail.com' },
    update: { role: 'ADMIN' },
    create: { email: 'safatash@gmail.com', password: adminPassword, role: 'ADMIN' },
  })
  console.log('✅ Admin: safatash@gmail.com (password: Admin123! — change it after first login)')

  // Seasons --------------------------------------------------------------
  const seasonKeys = (name: string) => ({ slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), legacyDatasource: name.toLowerCase().replace(/[^a-z0-9]/g, '') })
  const season = await prisma.season.upsert({
    where: { name: 'Spring 2026' },
    update: { startDate: day(OPENING_DAY), endDate: day('2026-06-28'), isActive: true, ...seasonKeys('Spring 2026') },
    create: { name: 'Spring 2026', startDate: day(OPENING_DAY), endDate: day('2026-06-28'), isActive: true, ...seasonKeys('Spring 2026') },
  })
  for (const [name, start, end] of [['Fall 2025', '2025-08-31', '2025-11-23'], ['Spring 2025', '2025-03-30', '2025-06-29']]) {
    await prisma.season.upsert({ where: { name }, update: seasonKeys(name), create: { name, startDate: day(start), endDate: day(end), isActive: false, ...seasonKeys(name) } })
  }
  await prisma.season.updateMany({ where: { isActive: true, id: { not: season.id } }, data: { isActive: false } })
  await prisma.leagueSettings.upsert({
    where: { seasonId: season.id },
    update: {},
    create: { seasonId: season.id, gamePassFee: 15, maxMatchRoster: 18, fairfaxCountyAllowed: true },
  })

  // Divisions --------------------------------------------------------------
  const divIds: Record<string, string> = {}
  for (const d of DIVISIONS) {
    const data = {
      code: d.code,
      name: d.name,
      description: d.description,
      level: d.level,
      registrationFee: d.fee,
      genderRule: d.genderRule,
      maleBornOnOrBefore: d.male ? day(d.male) : null,
      femaleBornOnOrBefore: d.female ? day(d.female) : null,
      minAge: 18,
      displayOrder: d.order,
    }
    const row = await prisma.division.upsert({
      where: { seasonId_name: { seasonId: season.id, name: d.name } },
      update: data,
      create: { ...data, seasonId: season.id },
    })
    divIds[d.code] = row.id
  }
  // Old placeholder divisions go once nothing points at them
  const removed = await prisma.division.deleteMany({
    where: { seasonId: season.id, name: { in: PLACEHOLDER_DIVISIONS }, teams: { none: {} }, teamRosters: { none: {} } },
  })
  console.log(`✅ Divisions (${DIVISIONS.length})${removed.count ? `, removed ${removed.count} placeholder` : ''}`)

  // Teams --------------------------------------------------------------
  const teamIds: Record<string, string> = {}
  for (const t of TEAMS) {
    const data = {
      code: t.code,
      name: t.name,
      divisionId: divIds[t.div],
      shortName: t.short,
      color: t.color,
      homeField: t.home,
      maxPlayers: 22,
      // Kits: club color at home, white away
      homeShirt: t.color,
      homeShorts: '#FFFFFF',
      awayShirt: '#FFFFFF',
      awayShorts: t.color,
      formation: t.code === 'ffx' ? '4-4-2' : t.code === 'alx' ? '4-3-3' : null,
      isDemo: true, // sample data, see Settings › Demo data
    }
    const existing = await prisma.team.findFirst({ where: { seasonId: season.id, OR: [{ code: t.code }, { name: t.name }] } })
    const row = existing
      ? await prisma.team.update({ where: { id: existing.id }, data })
      : await prisma.team.create({ data: { ...data, seasonId: season.id } })
    teamIds[t.code] = row.id
  }
  const teamByCode = Object.fromEntries(TEAMS.map((t) => [t.code, t]))
  console.log(`✅ Teams (${TEAMS.length})`)

  // Players --------------------------------------------------------------
  const playerPassword = await hashPassword('NvasaPlayer26')
  const mayaPassword = await hashPassword('MayaJohnson26')
  const playerIds: Record<string, string> = {}

  async function ensurePlayer(name: string, opts: { gender: Gender; pos?: Pos }) {
    if (playerIds[name]) return playerIds[name]
    const info = PEOPLE[name] ?? {}
    const email = info.email ?? emailFor(name)
    const [firstName, ...rest] = name.split(' ')
    const [city, zip] = info.city && info.zip ? [info.city, info.zip] : pick(PLACES)
    const year = 1986 + Math.floor(rand() * 16)
    const dob = info.dob ?? `${year}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`
    const since = info.since ?? 2019 + Math.floor(rand() * 7)
    const fairfaxCounty = Boolean(await prisma.allowedZipCode.findFirst({ where: { zipCode: zip, fairfaxCounty: true } }))
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: email === 'maya.johnson@example.com' ? mayaPassword : playerPassword,
        player: {
          create: {
            firstName,
            lastName: rest.join(' '),
            gender: info.gender ?? opts.gender,
            dob: day(dob),
            phone: `(703) 555-${String(1000 + Math.floor(rand() * 8999))}`,
            address: `${100 + Math.floor(rand() * 9800)} ${pick(STREETS)}`,
            city,
            state: 'VA',
            zip,
            fairfaxCounty,
            position: info.pos ?? opts.pos ?? 'MID',
            tshirtSize: pick(['Adult S', 'Adult M', 'Adult L', 'Adult XL']),
            finalApproval: 'APPROVED',
            status: 'ACTIVE',
            contactMe: rand() > 0.4,
            registrationDate: day(`${since}-03-01`),
          },
        },
      },
      include: { player: true },
    })
    if (!user.player) throw new Error(`${email} exists without a player profile`)
    playerIds[name] = user.player.id
    return user.player.id
  }

  // Season rosters
  const rosterIds: Record<string, Record<string, string>> = {} // team code → player name → TeamRoster id
  async function ensureRoster(teamCode: string, r: RosterSeed) {
    const t = teamByCode[teamCode]
    const gender: Gender = t.div === 'wp' ? 'FEMALE' : t.div === 'md1' ? 'MALE' : rand() > 0.5 ? 'FEMALE' : 'MALE'
    const playerId = await ensurePlayer(r.name, { gender, pos: r.pos })
    const data = { jerseyNumber: r.jersey, isCaptain: Boolean(r.captain), captainRequest: Boolean(r.captain) }
    const existing = await prisma.teamRoster.findFirst({ where: { playerId, teamId: teamIds[teamCode], membershipType: 'SEASONAL', matchId: null } })
    const row = existing
      ? await prisma.teamRoster.update({ where: { id: existing.id }, data })
      : await prisma.teamRoster.create({ data: { ...data, playerId, teamId: teamIds[teamCode], divisionId: divIds[t.div], joinedAt: et('2026-03-15') } })
    ;(rosterIds[teamCode] ??= {})[r.name] = row.id
  }
  for (const r of FFX_ROSTER) await ensureRoster('ffx', r)
  for (const r of ALX_ROSTER) await ensureRoster('alx', r)
  for (const r of BLD_ROSTER) await ensureRoster('bld', r)
  for (const t of TEAMS) {
    for (const [i, cap] of t.captains.entries()) {
      if (rosterIds[t.code]?.[cap]) continue
      await ensureRoster(t.code, { name: cap, jersey: [10, 8][i] ?? 7, pos: 'MID', captain: true })
    }
  }
  const seasonal = Object.entries(rosterIds).reduce((n, [, m]) => n + Object.keys(m).length, 0)
  console.log(`✅ Season rosters (${seasonal} memberships)`)

  const registrationPayment = async (playerId: string, amount: number, paidAt: Date) =>
    (await prisma.payment.create({ data: { userId: playerId, amount, status: 'PAID', paymentType: 'REGISTRATION_FEE', relatedEntityType: 'registration', paidAt } })).id
  const regNumberTaken = async (number: number) => Boolean(await prisma.registration.findUnique({ where: { number } }))

  // Registrations queue + placements
  for (const r of REGISTRATIONS) {
    const t = r.pref ? teamByCode[r.pref] : null
    const playerId = await ensurePlayer(r.name, { gender: r.div === 'md1' ? 'MALE' : 'FEMALE' })
    if (r.status !== 'APPROVED') {
      await prisma.player.update({ where: { id: playerId }, data: { finalApproval: r.status === 'REJECTED' ? 'REJECTED' : 'NEEDS_REVIEW' } })
    }
    const fee = DIVISIONS.find((d) => d.code === r.div)!.fee
    const existing =
      (await prisma.registration.findFirst({ where: { playerId, seasonId: season.id, divisionId: divIds[r.div], status: { not: 'APPROVED' } } })) ??
      (r.status === 'APPROVED' ? await prisma.registration.findFirst({ where: { playerId, seasonId: season.id, divisionId: divIds[r.div] } }) : null)
    const data = {
      divisionId: divIds[r.div],
      preferredTeamId: r.pref ? teamIds[r.pref] : null,
      backupTeamId: r.backup ? teamIds[r.backup] : null,
      background: r.isNew ? ('NEW' as const) : ('RETURNING' as const),
      registrationType: r.isNew ? ('NEW_PLAYER' as const) : ('RETURNING_PLAYER' as const),
      level: LEVEL_LABEL[r.level] ?? r.level,
      captainNote: r.captainNote ?? null,
      playerNote: r.playerNote ?? null,
      selectedTeams: JSON.stringify([r.pref, r.backup].filter(Boolean).map((c) => teamByCode[c!].name)),
      captainRequests: r.captainNote && t ? JSON.stringify([t.name]) : null,
      status: r.status,
      deniedReason: r.deniedReason ?? null,
      deniedMessage: r.deniedMessage ?? null,
      placementState: r.placement ?? (r.pref ? ('NONE' as const) : ('NEW' as const)),
      amountBeforeDiscount: fee,
      totalAmount: fee,
    }
    let regId: string
    if (existing) {
      regId = (await prisma.registration.update({ where: { id: existing.id }, data })).id
    } else {
      const submittedAt = et(r.date, '10:00')
      const reg = await prisma.registration.create({
        data: {
          ...data,
          ...(await regNumberTaken(r.number) ? {} : { number: r.number }),
          playerId,
          seasonId: season.id,
          paymentStatus: r.pay,
          submittedAt,
          approvedAt: r.status === 'APPROVED' ? et(r.date, '16:00') : null,
          rejectedAt: r.status === 'REJECTED' ? et(r.date, '16:00') : null,
          paymentId: r.pay === 'PAID' ? await registrationPayment(playerId, fee, submittedAt) : null,
        },
      })
      regId = reg.id
    }
    if (r.captainNote && t) {
      const has = await prisma.captainRequest.findFirst({ where: { playerId, teamId: teamIds[t.code] } })
      if (!has) await prisma.captainRequest.create({ data: { playerId, teamId: teamIds[t.code], registrationId: regId, note: r.captainNote, createdAt: et(r.date, '10:00') } })
    }
  }
  // Approved registrations for everyone on a season roster
  let rosterRegNumber = 1001
  for (const t of TEAMS) {
    for (const name of Object.keys(rosterIds[t.code] ?? {})) {
      const playerId = playerIds[name]
      const already = await prisma.registration.findFirst({
        where: { playerId, seasonId: season.id, OR: [{ preferredTeamId: teamIds[t.code] }, { selectedTeams: { contains: t.name } }, { divisionId: divIds[t.div] }] },
      })
      const number = rosterRegNumber++
      const failed = name === 'Dee Washington'
      const fee = DIVISIONS.find((d) => d.code === t.div)!.fee
      const data = {
        divisionId: divIds[t.div],
        preferredTeamId: teamIds[t.code],
        background: 'RETURNING' as const,
        registrationType: name === 'Maya Johnson' && t.code === 'bld' ? ('ADDITIONAL_TEAM' as const) : ('RETURNING_PLAYER' as const),
        level: t.div === 'wp' || t.div === 'md1' ? 'Competitive' : 'Intermediate',
        selectedTeams: JSON.stringify([t.name]),
        status: 'APPROVED' as const,
        amountBeforeDiscount: fee,
        totalAmount: fee,
      }
      if (already) {
        await prisma.registration.update({ where: { id: already.id }, data })
        continue
      }
      const submittedAt = et('2026-03-05', '12:00')
      await prisma.registration.create({
        data: {
          ...data,
          ...(await regNumberTaken(number) ? {} : { number }),
          playerId,
          seasonId: season.id,
          paymentStatus: failed ? 'FAILED' : 'PAID',
          submittedAt,
          approvedAt: et('2026-03-08', '10:00'),
          paymentId: failed ? null : await registrationPayment(playerId, fee, submittedAt),
        },
      })
    }
  }

  // Keep the registration number sequence ahead of every explicit number
  await prisma.$executeRawUnsafe(`SELECT setval('"registrations_number_seq"', GREATEST((SELECT max("number") FROM "registrations"), 2000))`)
  console.log(`✅ Registrations (${REGISTRATIONS.length} in the queue) and captain requests`)

  // Schedule --------------------------------------------------------------
  type Planned = { game: number; date: string; time: string; home: string; away: string; field: string; refs: [string, string, string]; score?: [number, number]; div: string }
  const planned: Planned[] = []
  const rounds = [['2026-03-29'], ['2026-04-05'], ['2026-04-12'], ['2026-04-19'], ['2026-04-26'], ['2026-05-03']].map(([d]) => d)
  const fourTeam = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]], [[1, 0], [3, 2]], [[2, 0], [3, 1]], [[3, 0], [2, 1]]]
  const times = ['09:00', '11:00', '13:00', '15:00']
  for (const [ri, date] of rounds.entries()) {
    const fixtures: [string, string][] = []
    for (const div of ['wp', 'md1']) {
      const codes = TEAMS.filter((t) => t.div === div).map((t) => t.code)
      for (const [h, a] of fourTeam[ri]) fixtures.push([codes[h], codes[a]])
    }
    if (ri % 2 === 1) fixtures.push(ri === 3 ? ['hrn', 'bld'] : ['bld', 'hrn'])
    if (ri % 2 === 0) fixtures.push(ri === 2 ? ['shi', 'vie'] : ['vie', 'shi'])
    for (const [fi, [home, away]] of fixtures.entries()) {
      const h = teamByCode[home]
      const goals = (s: number, o: number) => Math.max(0, Math.round(rand() * (1 + s) + rand() * 1.4 - o * 0.35))
      planned.push({
        game: 0,
        date,
        time: times[fi % times.length],
        home,
        away,
        field: `${h.home} ${1 + (fi % 3)}`,
        refs: [REFS[(ri + fi) % REFS.length], REFS[(ri + fi + 3) % REFS.length], fi % 4 === 3 ? '' : REFS[(ri + fi + 6) % REFS.length]],
        score: [goals(h.strength, teamByCode[away].strength), goals(teamByCode[away].strength, h.strength)],
        div: h.div,
      })
    }
  }
  planned.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  planned.forEach((p, i) => (p.game = 101 + i))
  for (const m of FIXED_MATCHES) {
    const score = m.score ?? (m.game <= 201 ? ([1 + Math.floor(rand() * 3), Math.floor(rand() * 3)] as [number, number]) : undefined)
    planned.push({ ...m, score, div: teamByCode[m.home].div })
  }

  // Fields: "Wakefield Park 3" → park "Wakefield Park", field "3". These parks are sample data
  // (not NVASA's real fields), so they're marked demo and Settings › Demo data removes them.
  const fieldIds: Record<string, string> = {}
  for (const label of [...new Set(planned.map((m) => m.field))]) {
    const [, complex, name] = label.match(/^(.*?)\s+(\S+)$/) ?? [label, label, '1']
    const city = FIELD_CITIES[complex] ?? null
    const park = await prisma.park.upsert({
      where: { name: complex },
      update: { city, state: 'VA', isDemo: true },
      create: { name: complex, city, state: 'VA', isDemo: true },
    })
    const row = await prisma.field.upsert({
      where: { parkId_name: { parkId: park.id, name } },
      update: {},
      create: { parkId: park.id, name },
    })
    fieldIds[label] = row.id
  }

  const matchIds: Record<number, string> = {}
  const ffxRoster = Object.keys(rosterIds.ffx)
  for (const m of planned) {
    const scheduledAt = et(m.date, m.time)
    const confirmed = m.game < 202 // games before May 10's late kickoffs are fully reported
    const data = {
      divisionId: divIds[m.div],
      homeTeamId: teamIds[m.home],
      awayTeamId: teamIds[m.away],
      scheduledAt,
      startTime: scheduledAt,
      endTime: new Date(scheduledAt.getTime() + 105 * 60_000),
      field: m.field,
      location: m.field.replace(/ \d+$/, ''),
      fieldId: fieldIds[m.field],
      status: m.score ? ('COMPLETED' as const) : ('SCHEDULED' as const),
      homeScore: m.score?.[0] ?? null,
      awayScore: m.score?.[1] ?? null,
      reportStatus: confirmed ? ('CONFIRMED' as const) : m.game === 205 ? ('SUBMITTED' as const) : m.game === 203 ? ('DRAFT' as const) : m.game === 202 ? ('OVERDUE' as const) : ('NOT_STARTED' as const),
    }
    // Earlier seeds created some of these matches without game numbers; adopt them.
    const existing =
      (await prisma.match.findUnique({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: m.game } } })) ??
      (await prisma.match.findFirst({ where: { seasonId: season.id, homeTeamId: teamIds[m.home], awayTeamId: teamIds[m.away], scheduledAt, gameNumber: { lt: 100 } } }))
    const row = existing
      ? await prisma.match.update({ where: { id: existing.id }, data: { ...data, gameNumber: m.game } })
      : await prisma.match.create({ data: { ...data, gameNumber: m.game, seasonId: season.id } })
    matchIds[m.game] = row.id

    // Officials: the seed's referees are sample data (demo), center / AR1 / AR2
    for (const [i, name] of m.refs.entries()) {
      const role = (['CENTER', 'AR1', 'AR2'] as const)[i]
      if (!name) {
        await prisma.matchOfficial.deleteMany({ where: { matchId: row.id, role } })
        continue
      }
      const ref = (await prisma.referee.findFirst({ where: { name } })) ?? (await prisma.referee.create({ data: { name, isDemo: true, certLevel: 'USSF Grade 8' } }))
      await prisma.matchOfficial.upsert({
        where: { matchId_role: { matchId: row.id, role } },
        update: { refereeId: ref.id },
        create: { matchId: row.id, role, refereeId: ref.id, status: m.score ? 'CONFIRMED' : 'ASSIGNED' },
      })
    }

    // Reports
    const reportFor = async (teamCode: string, status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED', extra: { redCardNote?: string; stats?: Record<string, Partial<Record<'goals' | 'assists' | 'yellow' | 'red', number>>> } = {}) => {
      const has = await prisma.matchReport.findUnique({ where: { matchId_teamId: { matchId: row.id, teamId: teamIds[teamCode] } } })
      if (has || !m.score) return
      const ours = teamCode === m.home ? m.score[0] : m.score[1]
      let stats = extra.stats
      if (!stats) {
        // Spread the team's goals across its roster, weighted toward the regular scorers
        stats = {}
        const names = Object.keys(rosterIds[teamCode] ?? {})
        const weights = names.map((n) => SCORING[n] ?? 1)
        const total = weights.reduce((a, b) => a + b, 0)
        const draw = () => {
          let x = rand() * total
          for (const [i, w] of weights.entries()) if ((x -= w) <= 0) return names[i]
          return names[names.length - 1]
        }
        for (let g = 0; g < ours; g++) {
          const scorer = draw()
          ;(stats[scorer] ??= {}).goals = (stats[scorer].goals ?? 0) + 1
          if (names.length > 1 && rand() > 0.4) {
            const assister = draw()
            if (assister !== scorer) (stats[assister] ??= {}).assists = (stats[assister].assists ?? 0) + 1
          }
        }
        if (names.length > 2 && rand() > 0.65) (stats[pick(names)] ??= {}).yellow = 1
      }
      const at = new Date(scheduledAt.getTime() + 4 * 3600_000)
      await prisma.matchReport.create({
        data: {
          matchId: row.id,
          teamId: teamIds[teamCode],
          homeScore: m.score[0],
          awayScore: m.score[1],
          redCardNote: extra.redCardNote ?? null,
          status,
          submittedAt: status === 'DRAFT' ? null : at,
          confirmedAt: status === 'CONFIRMED' ? new Date(at.getTime() + 20 * 3600_000) : null,
          confirmedById: status === 'CONFIRMED' ? 'seed' : null,
          stats: {
            create: Object.entries(stats).map(([name, s]) => ({ playerId: playerIds[name], goals: s.goals ?? 0, assists: s.assists ?? 0, yellow: s.yellow ?? 0, red: s.red ?? 0 })),
          },
        },
      })
    }
    if (confirmed) {
      await reportFor(m.home, 'CONFIRMED')
      await reportFor(m.away, 'CONFIRMED')
    } else if (m.game === 205) {
      await reportFor('nvs', 'SUBMITTED', { stats: { 'Chris Alvarez': { goals: 2, assists: 1 }, 'Diego Ruiz': { goals: 1, assists: 1 } } })
    } else if (m.game === 203) {
      await reportFor('ffx', 'DRAFT', {
        redCardNote: 'Carmen Vega (#21): straight red, 71st minute, serious foul play.',
        stats: { 'Maya Johnson': { goals: 1 }, 'Nadia Haddad': { goals: 1, assists: 0 }, 'Tasha Greene': { assists: 1 }, 'Carmen Vega': { red: 1 } },
      })
    }

    // Final match rosters for completed FFX games
    if (m.score && (m.home === 'ffx' || m.away === 'ffx')) {
      const has = await prisma.matchRoster.findUnique({ where: { matchId_teamId: { matchId: row.id, teamId: teamIds.ffx } } })
      if (!has) {
        await prisma.matchRoster.create({
          data: {
            matchId: row.id,
            teamId: teamIds.ffx,
            status: 'FINALIZED',
            formation: '4-4-2',
            finalizedAt: new Date(scheduledAt.getTime() - 15 * 3600_000),
            entries: { create: ffxRoster.filter((n) => n !== 'Lauren Fitch').slice(0, 17).map((n) => ({ teamRosterId: rosterIds.ffx[n] })) },
          },
        })
      }
    }
  }
  console.log(`✅ Matches (${planned.length}) with officials and reports`)

  // Suspensions --------------------------------------------------------------
  const suspensions = [
    { name: 'Carmen Vega', reason: 'Two-match suspension (red card, Game #203). Eligible again May 31.', startsAt: et('2026-05-11'), endsAt: et('2026-05-31') },
    { name: 'Dee Washington', reason: 'Payment failed. Limited until the fee is paid.', startsAt: et('2026-04-02'), endsAt: null },
  ]
  for (const s of suspensions) {
    const playerId = playerIds[s.name]
    const has = await prisma.suspension.findFirst({ where: { playerId, reason: s.reason } })
    if (!has) await prisma.suspension.create({ data: { playerId, reason: s.reason, startsAt: s.startsAt, endsAt: s.endsAt, createdById: 'seed' } })
    await prisma.player.update({ where: { id: playerId }, data: { status: 'SUSPENDED' } })
  }
  console.log('✅ Suspensions')

  // Game #204: availability, draft match roster and lineup --------------------
  const g204 = matchIds[204]
  for (const r of FFX_ROSTER) {
    const teamRosterId = rosterIds.ffx[r.name]
    const status = r.avail === 'no' ? 'UNAVAILABLE' : r.avail === 'maybe' ? 'MAYBE' : 'AVAILABLE'
    await prisma.matchAvailability.upsert({
      where: { matchId_teamRosterId: { matchId: g204, teamRosterId } },
      update: {},
      create: { matchId: g204, teamRosterId, status, note: r.note ?? null },
    })
  }

  // Game passes (Jordan Lee for #204; Sam Ortiz's expired pass for #203; Maya's two passes)
  async function ensurePass(name: string, game: number, teamCode: string | null, jersey: number | null, pos: Pos) {
    const playerId = await ensurePlayer(name, { gender: 'FEMALE', pos })
    const m = planned.find((p) => p.game === game)!
    const matchId = matchIds[game]
    const validFrom = et(m.date, '00:00')
    const validUntil = et(m.date, '23:59')
    const expired = validUntil < et('2026-05-16', '12:00')
    let pass = await prisma.gamePass.findUnique({ where: { playerId_matchId: { playerId, matchId } } })
    if (!pass) {
      const payment = await prisma.payment.create({
        data: { userId: playerId, amount: 15, status: 'PAID', paymentType: 'GAME_PASS', relatedEntityType: 'game_pass', paidAt: et(m.date, '08:00') },
      })
      pass = await prisma.gamePass.create({
        data: { playerId, matchId, teamId: teamCode ? teamIds[teamCode] : null, paymentId: payment.id, status: expired ? 'EXPIRED' : 'ACTIVE', validFrom, validUntil },
      })
      await prisma.payment.update({ where: { id: payment.id }, data: { relatedEntityId: pass.id } })
    }
    if (teamCode) {
      const has = await prisma.teamRoster.findUnique({ where: { gamePassId: pass.id } })
      if (!has) {
        const row = await prisma.teamRoster.create({
          data: {
            playerId,
            teamId: teamIds[teamCode],
            divisionId: divIds[teamByCode[teamCode].div],
            membershipType: 'GAME_PASS',
            gamePassId: pass.id,
            matchId,
            jerseyNumber: jersey,
            joinedAt: validFrom,
            leftAt: expired ? validUntil : null,
          },
        })
        ;(rosterIds[teamCode] ??= {})[name] = row.id
      } else {
        ;(rosterIds[teamCode] ??= {})[name] = has.id
      }
    }
    return pass
  }
  await ensurePass('Jordan Lee', 204, 'ffx', 14, 'FWD')
  await ensurePass('Sam Ortiz', 203, 'ffx', 20, 'MID')
  // Maya's own passes predate the team-assignment step (no roster row)
  const mayaPasses = await prisma.gamePass.count({ where: { playerId: playerIds['Maya Johnson'] } })
  if (!mayaPasses) {
    await ensurePass('Maya Johnson', 207, null, null, 'FWD')
    await ensurePass('Maya Johnson', 205, null, null, 'FWD')
  }
  await prisma.matchAvailability.upsert({
    where: { matchId_teamRosterId: { matchId: g204, teamRosterId: rosterIds.ffx['Jordan Lee'] } },
    update: {},
    create: { matchId: g204, teamRosterId: rosterIds.ffx['Jordan Lee'], status: 'AVAILABLE' },
  })

  const draft204 = await prisma.matchRoster.findUnique({ where: { matchId_teamId: { matchId: g204, teamId: teamIds.ffx } } })
  if (!draft204) {
    const byJersey = Object.fromEntries([...FFX_ROSTER, { name: 'Jordan Lee', jersey: 14 }].map((r) => [r.jersey, r.name]))
    const selection = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 23, 14, 19]
    const lineup: Record<string, number> = { GK: 1, LB: 4, LCB: 2, RCB: 5, RB: 12, LM: 7, LCM: 6, RCM: 10, RM: 8, LS: 9, RS: 17 }
    const slotOf = Object.fromEntries(Object.entries(lineup).map(([slot, j]) => [j, slot]))
    await prisma.matchRoster.create({
      data: {
        matchId: g204,
        teamId: teamIds.ffx,
        status: 'DRAFT',
        formation: '4-4-2',
        entries: { create: selection.map((j) => ({ teamRosterId: rosterIds.ffx[byJersey[j]], lineupSlot: slotOf[j] ?? null })) },
      },
    })
  }
  console.log('✅ Game #204: availability, game passes, draft match roster')

  // Discount codes --------------------------------------------------------------
  for (const c of DISCOUNT_CODES) {
    const data = {
      kind: c.kind,
      type: c.type,
      value: new Prisma.Decimal(c.value),
      maxUses: c.maxUses,
      active: c.active,
      seasonId: season.id,
      teamId: 'team' in c ? teamIds[c.team] : null,
    }
    await prisma.discountCode.upsert({ where: { code: c.code }, update: data, create: { ...data, code: c.code, uses: c.uses } })
  }
  console.log(`✅ Discount codes (${DISCOUNT_CODES.length})`)

  console.log('✅ Database seeding completed!')
  console.log('   Admin:  safatash@gmail.com / Admin123!')
  console.log('   Player: maya.johnson@example.com / MayaJohnson26 (captain of Fairfax United)')
  console.log('   Everyone else seeded: <email> / NvasaPlayer26')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
