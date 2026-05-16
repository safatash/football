export const seasons = [
  { id: "spring-2025", name: "Spring 2025", active: true },
  { id: "fall-2025", name: "Fall 2025", active: false },
  { id: "spring-2026", name: "Spring 2026", active: false },
];

export const registrations = [
  {
    id: "reg-1001",
    playerName: "Maya Johnson",
    email: "maya@example.com",
    season: "Spring 2025",
    teamPreference: "Fairfax United",
    paymentStatus: "Paid",
    status: "Pending Review",
  },
  {
    id: "reg-1002",
    playerName: "Chris Alvarez",
    email: "chris@example.com",
    season: "Spring 2025",
    teamPreference: "Nova Strikers",
    paymentStatus: "Pending",
    status: "Submitted",
  },
  {
    id: "reg-1003",
    playerName: "Lena Patel",
    email: "lena@example.com",
    season: "Spring 2025",
    teamPreference: "Alexandria FC",
    paymentStatus: "Paid",
    status: "Approved",
  },
];

export const placementQueue = [
  {
    id: "placement-1",
    playerName: "Jordan Lee",
    preferredLevel: "Competitive",
    desiredTeam: "Needs placement",
    season: "Spring 2025",
    status: "Awaiting placement",
    notes: "New to league, prefers winger or striker, looking for weekend team.",
  },
  {
    id: "placement-2",
    playerName: "Taylor Brooks",
    preferredLevel: "Intermediate",
    desiredTeam: "Waitlist review",
    season: "Spring 2025",
    status: "Reviewing fit",
    notes: "Open to either coed or women’s division depending on available roster space.",
  },
];

export const players = [
  {
    id: "player-1",
    name: "Maya Johnson",
    email: "maya@example.com",
    team: "Fairfax United",
    division: "Women Premier",
    status: "Pending Approval",
    phone: "703-555-0182",
    position: "Forward",
    registration: "Pending Review",
    teams: ["Fairfax United", "Bloodline"],
    teamMemberships: [
      {
        id: "tm-1",
        teamName: "Fairfax United",
        division: "Women Premier",
        accessLevel: "Captain",
        membershipType: "Primary team",
        season: "Spring 2025",
        notes: "Can manage team and print roster from this view.",
      },
      {
        id: "tm-2",
        teamName: "Bloodline",
        division: "Coed D3",
        accessLevel: "Player",
        membershipType: "Additional team",
        season: "Spring 2025",
        notes: "Appears as a separate account view, but does not inherit captain permissions.",
      },
    ],
    role: "captain",
    gamePasses: [
      {
        id: "gp-100",
        matchId: "match-1",
        label: "Game #204 · Fairfax United vs Alexandria FC",
        status: "Active for match day",
        rosterScope: "This match only",
      },
      {
        id: "gp-101",
        matchId: "match-2",
        label: "Game #205 · Nova Strikers vs Arlington SC",
        status: "Expired after match",
        rosterScope: "No longer on roster",
      },
    ],
  },
  {
    id: "player-2",
    name: "Chris Alvarez",
    email: "chris@example.com",
    team: "Nova Strikers",
    division: "Men D1",
    status: "Active",
    phone: "571-555-0144",
    position: "Midfielder",
    registration: "Approved",
    teams: ["Nova Strikers"],
    teamMemberships: [
      {
        id: "tm-3",
        teamName: "Nova Strikers",
        division: "Men D1",
        accessLevel: "Player",
        membershipType: "Primary team",
        season: "Spring 2025",
        notes: "Single-team player account.",
      },
    ],
    role: "player",
    gamePasses: [],
  },
  {
    id: "player-3",
    name: "Nina Brooks",
    email: "nina@example.com",
    team: "Alexandria FC",
    division: "Women Premier",
    status: "Suspended",
    phone: "703-555-0108",
    position: "Defender",
    registration: "Approved",
    teams: ["Alexandria FC"],
    teamMemberships: [
      {
        id: "tm-4",
        teamName: "Alexandria FC",
        division: "Women Premier",
        accessLevel: "Player",
        membershipType: "Primary team",
        season: "Spring 2025",
        notes: "Suspended players still keep a team record, but with limited status.",
      },
    ],
    role: "player",
    gamePasses: [],
  },
];

export const teams = [
  {
    id: "team-1",
    name: "Fairfax United",
    division: "Women Premier",
    captains: ["Maya Johnson"],
    record: "5-1-1",
    rosterSize: 18,
    status: "Playoff pace",
    nextMatch: "vs Alexandria FC",
  },
  {
    id: "team-2",
    name: "Nova Strikers",
    division: "Men D1",
    captains: ["Chris Alvarez", "Diego Ruiz"],
    record: "4-2-0",
    rosterSize: 19,
    status: "On track",
    nextMatch: "vs Arlington SC",
  },
];

export const matches = [
  {
    id: "match-1",
    gameNumber: 204,
    home: "Fairfax United",
    away: "Alexandria FC",
    startsAt: "Sun, May 18, 9:00 AM",
    field: "Wakefield Park 3",
    status: "Scheduled",
    score: "-",
    officials: ["Sam Rivera", "Jordan Park", "Luis Ramos"],
    division: "Women Premier",
  },
  {
    id: "match-2",
    gameNumber: 205,
    home: "Nova Strikers",
    away: "Arlington SC",
    startsAt: "Sun, May 18, 11:00 AM",
    field: "Mason District 1",
    status: "Completed",
    score: "3 - 1",
    officials: ["Chris Hall", "Derek Owens", "Priya Jain"],
    division: "Men D1",
  },
];

export const captainRoster = [
  { id: "r1", name: "Maya Johnson", jersey: 9, status: "Starter" },
  { id: "r2", name: "Sofia Kim", jersey: 7, status: "Starter" },
  { id: "r3", name: "Jordan Lee", jersey: 14, status: "Bench" },
  { id: "r4", name: "Nina Brooks", jersey: 22, status: "Unavailable" },
];

export const matchRosterPool = [
  {
    id: "mr1",
    name: "Maya Johnson",
    jersey: 9,
    availability: "Available",
    gamePass: false,
    rosterScope: "Season roster",
    matchId: "match-1",
    passStatus: "Season player",
  },
  {
    id: "mr2",
    name: "Sofia Kim",
    jersey: 7,
    availability: "Available",
    gamePass: false,
    rosterScope: "Season roster",
    matchId: "match-1",
    passStatus: "Season player",
  },
  {
    id: "mr3",
    name: "Jordan Lee",
    jersey: 14,
    availability: "Available",
    gamePass: true,
    rosterScope: "This match only",
    matchId: "match-1",
    passStatus: "Active for match day",
  },
  {
    id: "mr4",
    name: "Nina Brooks",
    jersey: 22,
    availability: "Unavailable",
    gamePass: false,
    rosterScope: "Season roster",
    matchId: "match-1",
    passStatus: "Season player",
  },
  {
    id: "mr5",
    name: "Lena Patel",
    jersey: 18,
    availability: "Available",
    gamePass: false,
    rosterScope: "Season roster",
    matchId: "match-1",
    passStatus: "Season player",
  },
  {
    id: "mr6",
    name: "Chris Alvarez",
    jersey: 11,
    availability: "Available",
    gamePass: false,
    rosterScope: "Season roster",
    matchId: "match-2",
    passStatus: "Season player",
  },
  {
    id: "mr7",
    name: "Taylor Brooks",
    jersey: 27,
    availability: "Expired",
    gamePass: true,
    rosterScope: "Expired after match",
    matchId: "match-2",
    passStatus: "Expired after match",
  },
];

export const registrationSteps = [
  { id: 1, slug: "account", title: "Account" },
  { id: 2, slug: "player-details", title: "Player Details" },
  { id: 3, slug: "contact", title: "Contact" },
  { id: 4, slug: "playing-background", title: "Playing Background" },
  { id: 5, slug: "team-preferences", title: "Team Preferences" },
  { id: 6, slug: "captain-request", title: "Captain Request" },
  { id: 7, slug: "fees-review", title: "Fees & Review" },
];

export const standings = [
  { id: "s1", rank: 1, team: "Fairfax United", pts: 16, gp: 7, w: 5, d: 1, l: 1, gf: 18, ga: 8, gd: 10 },
  { id: "s2", rank: 2, team: "Alexandria FC", pts: 14, gp: 7, w: 4, d: 2, l: 1, gf: 15, ga: 9, gd: 6 },
  { id: "s3", rank: 3, team: "Nova Strikers", pts: 12, gp: 6, w: 4, d: 0, l: 2, gf: 17, ga: 10, gd: 7 },
  { id: "s4", rank: 4, team: "Arlington SC", pts: 7, gp: 6, w: 2, d: 1, l: 3, gf: 11, ga: 14, gd: -3 },
];

export const divisions = [
  {
    id: "division-1",
    name: "Women Premier",
    season: "Spring 2025",
    teams: 4,
    registrationFee: "$95",
    ageRule: "18+",
    topScorers: ["Maya Johnson", "Nina Brooks", "Lena Patel"],
  },
  {
    id: "division-2",
    name: "Men D1",
    season: "Spring 2025",
    teams: 5,
    registrationFee: "$105",
    ageRule: "18+",
    topScorers: ["Chris Alvarez", "Marco Silva", "Evan Price"],
  },
];

export const registrationFeeTable = [
  { division: "Test (Coed)", ageRule: "Born on or before 12/31/1990 or 12/31/1995", fee: "$105" },
  { division: "Combination Spring 26 (Coed)", ageRule: "Born on or before 12/31/2008", fee: "$60" },
  { division: "D3 (Coed)", ageRule: "Born on or before 12/31/2008", fee: "$55" },
  { division: "Masters (Coed)", ageRule: "Born on or before 12/31/1991 or 12/31/1996", fee: "$45" },
  { division: "Game Pass (All Divisions)", ageRule: "Single-match only", fee: "$15" },
];
