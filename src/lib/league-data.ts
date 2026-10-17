/**
 * Spring 2026 sample league data.
 * Used by screens whose tables don't exist in the database yet (captain tools, standings,
 * placement, settings). Replace each export with a Prisma query as the backend catches up.
 */

export const TODAY_LABEL = "Sat, May 16";
export const ACTIVE_SEASON = "Spring 2026";
export const SEASONS = ["Spring 2026", "Fall 2025", "Spring 2025"] as const;
export const GAME_PASS_FEE = 15;
export const OPENING_DAY = "2026-03-29";

export type DivisionId = "wp" | "md1" | "d3" | "mc" | "cc";
export type Division = { id: DivisionId; name: string; fee: number; age: string; rule: string; level: string };

export const DIVISIONS: Division[] = [
  { id: "wp", name: "Women Premier", fee: 95, age: "18+", rule: "Women, 18 or older on opening day (Mar 29, 2026)", level: "Competitive" },
  { id: "md1", name: "Men D1", fee: 105, age: "18+", rule: "Men, 18 or older on opening day (Mar 29, 2026)", level: "Competitive" },
  { id: "d3", name: "D3 Coed", fee: 55, age: "Born on or before 12/31/2008", rule: "Born on or before Dec 31, 2008", level: "Recreational" },
  {
    id: "mc",
    name: "Masters Coed",
    fee: 45,
    age: "Men born ≤ 12/31/1991 · Women ≤ 12/31/1996",
    rule: "Men born on or before Dec 31, 1991; women on or before Dec 31, 1996",
    level: "Recreational",
  },
  { id: "cc", name: "Combination Coed", fee: 60, age: "18+", rule: "18 or older on opening day", level: "Social to intermediate" },
];
export const division = (id: string) => DIVISIONS.find((d) => d.id === id)!;

export type Team = {
  id: string;
  name: string;
  div: DivisionId;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  size: number;
  caps: string[];
  color: string;
  ab: string;
  home: string;
};

export const TEAMS: Team[] = [
  { id: "ffx", name: "Fairfax United", div: "wp", w: 5, d: 1, l: 1, gf: 17, ga: 7, size: 18, caps: ["Maya Johnson"], color: "#0F3D2E", ab: "FU", home: "Wakefield Park" },
  { id: "alx", name: "Alexandria FC", div: "wp", w: 4, d: 2, l: 1, gf: 14, ga: 8, size: 17, caps: ["Renee Carter"], color: "#7A1F2B", ab: "AFC", home: "Chinquapin Park" },
  { id: "pot", name: "Potomac Valkyries", div: "wp", w: 4, d: 0, l: 3, gf: 11, ga: 10, size: 16, caps: ["Gabi Ortiz"], color: "#27407A", ab: "PV", home: "Lee District" },
  { id: "brk", name: "Burke Athletic", div: "wp", w: 2, d: 1, l: 4, gf: 6, ga: 13, size: 15, caps: ["Sarah Lin"], color: "#8A5A12", ab: "BA", home: "Burke Lake" },
  { id: "nvs", name: "Nova Strikers", div: "md1", w: 4, d: 2, l: 0, gf: 15, ga: 6, size: 19, caps: ["Chris Alvarez", "Diego Ruiz"], color: "#1E5E8C", ab: "NS", home: "Mason District" },
  { id: "arl", name: "Arlington SC", div: "md1", w: 3, d: 1, l: 2, gf: 10, ga: 9, size: 18, caps: ["Marcus Hill"], color: "#6B2E86", ab: "ASC", home: "Long Bridge Park" },
  { id: "rst", name: "Reston Rovers", div: "md1", w: 2, d: 1, l: 3, gf: 8, ga: 11, size: 17, caps: ["Tom Becker"], color: "#9A3412", ab: "RR", home: "Baron Cameron" },
  { id: "spr", name: "Springfield Athletic", div: "md1", w: 1, d: 0, l: 5, gf: 5, ga: 12, size: 16, caps: ["Ahmed Saleh"], color: "#3F5A1A", ab: "SA", home: "Lake Accotink" },
  { id: "bld", name: "Bloodline", div: "d3", w: 3, d: 2, l: 1, gf: 12, ga: 8, size: 16, caps: ["Kevin Osei"], color: "#A3121F", ab: "BL", home: "Wakefield Park" },
  { id: "hrn", name: "Herndon Hustle", div: "d3", w: 3, d: 1, l: 2, gf: 11, ga: 9, size: 15, caps: ["Paula Reyes"], color: "#0E6E6E", ab: "HH", home: "Bready Park" },
  { id: "vie", name: "Vienna Athletic", div: "cc", w: 2, d: 2, l: 2, gf: 9, ga: 9, size: 16, caps: ["Jess Moore"], color: "#4B4B9A", ab: "VA", home: "Lee District" },
  { id: "shi", name: "Shirlington Social", div: "cc", w: 1, d: 3, l: 2, gf: 7, ga: 10, size: 14, caps: ["Andre Wu"], color: "#7A5C1E", ab: "SS", home: "Lee District" },
  { id: "mvm", name: "Mount Vernon Masters", div: "mc", w: 3, d: 1, l: 1, gf: 9, ga: 5, size: 15, caps: ["Grace Mensah"], color: "#2F4F4F", ab: "MV", home: "Grist Mill Park" },
];
export const team = (id: string) => TEAMS.find((t) => t.id === id)!;
export const points = (t: Team) => t.w * 3 + t.d;
export const standings = (div: DivisionId) =>
  TEAMS.filter((t) => t.div === div).sort((a, b) => points(b) - points(a) || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);

export type ReportStatus = "Not started" | "Draft" | "Submitted" | "Overdue";
export type Match = {
  id: number;
  date: string;
  time: string;
  home: string;
  away: string;
  field: string;
  div: DivisionId;
  status: "Scheduled" | "Completed";
  score?: [number, number];
  refs: [string, string, string];
  report: ReportStatus;
};

export const MATCHES: Match[] = [
  { id: 204, date: "Sun, May 17", time: "9:00 AM", home: "ffx", away: "alx", field: "Wakefield Park 3", div: "wp", status: "Scheduled", refs: ["Daniel Kim", "Lucia Fernandes", "Omar Haddad"], report: "Not started" },
  { id: 206, date: "Sun, May 17", time: "11:00 AM", home: "pot", away: "brk", field: "Wakefield Park 2", div: "wp", status: "Scheduled", refs: ["Sam Okoye", "Irene Park", "Luis Mejía"], report: "Not started" },
  { id: 207, date: "Sun, May 17", time: "1:00 PM", home: "vie", away: "shi", field: "Lee District 4", div: "cc", status: "Scheduled", refs: ["Paul Grant", "Ana Silva", ""], report: "Not started" },
  { id: 208, date: "Sun, May 17", time: "3:00 PM", home: "bld", away: "hrn", field: "Wakefield Park 3", div: "d3", status: "Scheduled", refs: ["Daniel Kim", "Tara Boone", ""], report: "Not started" },
  { id: 209, date: "Sun, May 24", time: "9:00 AM", home: "ffx", away: "pot", field: "Lee District 2", div: "wp", status: "Scheduled", refs: ["", "", ""], report: "Not started" },
  { id: 210, date: "Sun, May 24", time: "11:00 AM", home: "nvs", away: "rst", field: "Mason District 1", div: "md1", status: "Scheduled", refs: ["", "", ""], report: "Not started" },
  { id: 205, date: "Sun, May 10", time: "11:00 AM", home: "nvs", away: "arl", field: "Mason District 1", div: "md1", status: "Completed", score: [3, 1], refs: ["Hugo Bell", "Lucia Fernandes", "Omar Haddad"], report: "Submitted" },
  { id: 203, date: "Sun, May 10", time: "9:00 AM", home: "brk", away: "ffx", field: "Burke Lake 1", div: "wp", status: "Completed", score: [0, 2], refs: ["Daniel Kim", "Irene Park", "Sam Okoye"], report: "Draft" },
  { id: 202, date: "Sun, May 10", time: "3:00 PM", home: "bld", away: "vie", field: "Wakefield Park 3", div: "d3", status: "Completed", score: [2, 2], refs: ["Tara Boone", "", ""], report: "Overdue" },
];
export const match = (id: number | string) => MATCHES.find((m) => m.id === Number(id));
export const refsAssigned = (m: Match) => m.refs.filter(Boolean).length;

export type Position = "GK" | "DEF" | "MID" | "FWD";
export type Availability = "yes" | "no" | "maybe";
export type RosterPlayer = {
  name: string;
  jersey: number;
  pos: Position;
  avail: Availability;
  note?: string;
  captain?: boolean;
  suspended?: boolean;
  gamePass?: boolean;
};

/** Fairfax United season roster, Spring 2026 */
export const FFX_ROSTER: RosterPlayer[] = [
  { name: "Priya Raman", jersey: 1, pos: "GK", avail: "yes" },
  { name: "Hannah Cole", jersey: 2, pos: "DEF", avail: "yes" },
  { name: "Lauren Fitch", jersey: 3, pos: "DEF", avail: "no", note: "Out of town" },
  { name: "Ana Morales", jersey: 4, pos: "DEF", avail: "yes" },
  { name: "Keisha Brooks", jersey: 5, pos: "DEF", avail: "yes" },
  { name: "Sofia Russo", jersey: 6, pos: "MID", avail: "yes" },
  { name: "Jen Park", jersey: 7, pos: "MID", avail: "yes" },
  { name: "Emma Kowalski", jersey: 8, pos: "MID", avail: "yes" },
  { name: "Maya Johnson", jersey: 9, pos: "FWD", avail: "yes", captain: true },
  { name: "Tasha Greene", jersey: 10, pos: "MID", avail: "yes" },
  { name: "Rachel Stein", jersey: 11, pos: "FWD", avail: "yes" },
  { name: "Claire Dubois", jersey: 12, pos: "DEF", avail: "yes" },
  { name: "Olivia Grant", jersey: 15, pos: "DEF", avail: "maybe", note: "No reply yet" },
  { name: "Bri Okafor", jersey: 16, pos: "MID", avail: "yes" },
  { name: "Nadia Haddad", jersey: 17, pos: "FWD", avail: "yes" },
  { name: "Lily Tran", jersey: 19, pos: "FWD", avail: "no", note: "Ankle injury" },
  { name: "Carmen Vega", jersey: 21, pos: "MID", avail: "yes", suspended: true },
  { name: "Megan Shaw", jersey: 23, pos: "GK", avail: "yes" },
];

/** Game-pass players attached to Game #204 only. They never join the season roster. */
export const GAME_PASS_PLAYERS: (RosterPlayer & { matchId: number; state: "Active" | "Expired" })[] = [
  { name: "Jordan Lee", jersey: 14, pos: "FWD", avail: "yes", gamePass: true, matchId: 204, state: "Active" },
  { name: "Sam Ortiz", jersey: 20, pos: "MID", avail: "yes", gamePass: true, matchId: 203, state: "Expired" },
];

/** Match-roster pool for a match: season roster + active game-pass players for that match only. */
export const matchPool = (matchId: number): RosterPlayer[] => [
  ...FFX_ROSTER,
  ...GAME_PASS_PLAYERS.filter((p) => p.matchId === matchId && p.state === "Active"),
];

export const ALX_ROSTER = [
  "Renee Carter", "Kara Whitfield", "Joy Adeyemi", "Mia Sorensen", "Hope Daniels", "Bea Kaplan", "Nina Petrova", "Zoe Hart",
  "Ivy Chen", "Rosa Lima", "Kendra Moss", "Elle Brandt", "Faith Ochoa", "Dani Roth", "Tara Quinn", "Uma Patel",
].map((name, i) => ({
  name,
  jersey: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22][i],
  pos: (["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD", "DEF", "MID", "FWD", "GK", "MID"] as Position[])[i],
}));

export const BLD_ROSTER: Pick<RosterPlayer, "name" | "jersey" | "pos" | "captain">[] = [
  { name: "Kevin Osei", jersey: 4, pos: "DEF", captain: true },
  { name: "Maya Johnson", jersey: 9, pos: "FWD" },
  { name: "Ravi Menon", jersey: 7, pos: "MID" },
  { name: "Tess Alvarado", jersey: 1, pos: "GK" },
  { name: "Marco Bellini", jersey: 10, pos: "MID" },
  { name: "Dee Washington", jersey: 11, pos: "FWD" },
];

/* ---------------- Lineup ---------------- */
export const FORMATIONS: Record<string, [string, number, number][]> = {
  "4-4-2": [["GK", 50, 90], ["LB", 16, 70], ["LCB", 38, 74], ["RCB", 62, 74], ["RB", 84, 70], ["LM", 16, 46], ["LCM", 38, 50], ["RCM", 62, 50], ["RM", 84, 46], ["LS", 36, 20], ["RS", 64, 20]],
  "4-3-3": [["GK", 50, 90], ["LB", 16, 70], ["LCB", 38, 74], ["RCB", 62, 74], ["RB", 84, 70], ["LCM", 28, 50], ["CM", 50, 54], ["RCM", 72, 50], ["LW", 18, 22], ["ST", 50, 16], ["RW", 82, 22]],
  "3-5-2": [["GK", 50, 90], ["LCB", 26, 73], ["CB", 50, 76], ["RCB", 74, 73], ["LWB", 12, 48], ["LCM", 33, 52], ["CM", 50, 44], ["RCM", 67, 52], ["RWB", 88, 48], ["LS", 36, 18], ["RS", 64, 18]],
};
export const DEFAULT_LINEUP: Record<string, number> = { GK: 1, LB: 4, LCB: 2, RCB: 5, RB: 12, LM: 7, LCM: 6, RCM: 10, RM: 8, LS: 9, RS: 17 };
export const DEFAULT_MATCH_SELECTION = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 23, 14, 19];
export const MAX_MATCH_ROSTER = 18;

/* ---------------- Admin queues ---------------- */
export type RegStatus = "Submitted" | "Pending Review" | "Approved" | "Denied";
export type PayStatus = "Paid" | "Pending" | "Unpaid";
export type RegistrationRow = {
  id: string;
  name: string;
  email: string;
  div: DivisionId;
  pref: string;
  backup: string;
  reg: RegStatus;
  pay: PayStatus;
  date: string;
  captainRequest: boolean;
  isNew: boolean;
  dob: string;
  city: string;
  zip: string;
  level: string;
  amount: number;
  captainNote?: string;
  denyNote?: string;
};

export const REGISTRATIONS: RegistrationRow[] = [
  { id: "R-2041", name: "Aisha Bello", email: "aisha.bello@example.com", div: "wp", pref: "Fairfax United", backup: "Alexandria FC", reg: "Pending Review", pay: "Paid", date: "May 14", captainRequest: false, isNew: false, dob: "1997-08-02", city: "Annandale", zip: "22003", level: "Competitive", amount: 95 },
  { id: "R-2040", name: "Devon Price", email: "devon.price@example.com", div: "md1", pref: "Reston Rovers", backup: "—", reg: "Pending Review", pay: "Paid", date: "May 14", captainRequest: true, isNew: false, dob: "1990-01-19", city: "Reston", zip: "20190", level: "Competitive", amount: 105, captainNote: "Ran the team’s group chat and subs list last fall. Tom Becker asked me to co-captain." },
  { id: "R-2039", name: "Lena Fischer", email: "lena.f@example.com", div: "d3", pref: "—", backup: "—", reg: "Pending Review", pay: "Paid", date: "May 13", captainRequest: false, isNew: true, dob: "1999-11-30", city: "Arlington", zip: "22204", level: "Beginner / social", amount: 55 },
  { id: "R-2038", name: "Tyler Nguyen", email: "tnguyen@example.com", div: "md1", pref: "Nova Strikers", backup: "Arlington SC", reg: "Submitted", pay: "Pending", date: "May 13", captainRequest: false, isNew: false, dob: "1995-04-07", city: "Falls Church", zip: "22042", level: "Competitive", amount: 105 },
  { id: "R-2037", name: "Grace Mensah", email: "gmensah@example.com", div: "mc", pref: "Mount Vernon Masters", backup: "—", reg: "Approved", pay: "Paid", date: "May 12", captainRequest: false, isNew: false, dob: "1984-06-15", city: "Alexandria", zip: "22309", level: "Intermediate", amount: 45 },
  { id: "R-2036", name: "Ben Carter", email: "bcarter@example.com", div: "cc", pref: "—", backup: "—", reg: "Pending Review", pay: "Unpaid", date: "May 12", captainRequest: false, isNew: true, dob: "1993-02-11", city: "Springfield", zip: "22150", level: "Not sure", amount: 60 },
  { id: "R-2035", name: "Sophie Allen", email: "sallen@example.com", div: "wp", pref: "Alexandria FC", backup: "—", reg: "Denied", pay: "Unpaid", date: "May 11", captainRequest: false, isNew: false, dob: "1998-09-09", city: "Gaithersburg", zip: "20878", level: "Competitive", amount: 95, denyNote: "Address outside the league’s eligible area." },
  { id: "R-2034", name: "Ravi Menon", email: "ravi.m@example.com", div: "d3", pref: "Bloodline", backup: "—", reg: "Approved", pay: "Paid", date: "May 10", captainRequest: false, isNew: false, dob: "2001-03-03", city: "Fairfax", zip: "22030", level: "Intermediate", amount: 55 },
  { id: "R-2033", name: "Hector Ramos", email: "hramos@example.com", div: "md1", pref: "—", backup: "—", reg: "Pending Review", pay: "Paid", date: "May 10", captainRequest: false, isNew: true, dob: "1992-12-01", city: "Alexandria", zip: "22312", level: "Competitive", amount: 105 },
  { id: "R-2032", name: "Natalie Brooks", email: "nbrooks@example.com", div: "wp", pref: "Burke Athletic", backup: "Potomac Valkyries", reg: "Submitted", pay: "Pending", date: "May 9", captainRequest: true, isNew: false, dob: "1996-07-21", city: "Burke", zip: "22015", level: "Competitive", amount: 95, captainNote: "Happy to help Sarah run Burke; I coach youth on weekends." },
];

export type PlacementState = "New" | "Info requested" | "Waitlisted" | "Assigned";
export type Placement = {
  id: string;
  name: string;
  div: DivisionId;
  level: string;
  pos: Position;
  age: number;
  city: string;
  notes: string;
  state: PlacementState;
  rec: { div: DivisionId; team: string; why: string };
};
export const PLACEMENTS: Placement[] = [
  { id: "R-2039", name: "Lena Fischer", div: "d3", level: "Beginner / social", pos: "MID", age: 26, city: "Arlington", notes: "Just moved from Denver. Played intramurals in college, looking for a friendly Sunday game.", state: "New", rec: { div: "d3", team: "hrn", why: "Herndon Hustle has 15 players and asked for midfielders." } },
  { id: "R-2036", name: "Ben Carter", div: "cc", level: "Not sure", pos: "DEF", age: 33, city: "Springfield", notes: "Haven’t played in about 8 years. Fine anywhere in the back.", state: "New", rec: { div: "cc", team: "shi", why: "Shirlington Social has the smallest roster in Combination Coed (14)." } },
  { id: "R-2033", name: "Hector Ramos", div: "md1", level: "Competitive", pos: "MID", age: 33, city: "Alexandria", notes: "Played in a semi-pro league in Monterrey until 2023.", state: "New", rec: { div: "md1", team: "spr", why: "Springfield Athletic is short in midfield (16 players)." } },
  { id: "R-2029", name: "Jess Whitaker", div: "wp", level: "Intermediate", pos: "FWD", age: 28, city: "Vienna", notes: "Played club in high school. Asked to be with a friend on Potomac.", state: "Info requested", rec: { div: "wp", team: "pot", why: "Friend request matches Potomac Valkyries (16)." } },
  { id: "R-2024", name: "Owen Brady", div: "mc", level: "Intermediate", pos: "GK", age: 41, city: "Lorton", notes: "Keeper. Available most Sundays except June.", state: "Waitlisted", rec: { div: "mc", team: "mvm", why: "Mount Vernon Masters already has two keepers." } },
];

export type PlayerRow = {
  slug: string;
  name: string;
  email: string;
  status: "Active" | "Pending Approval" | "Suspended";
  teams: [string, "Captain" | "Player"][];
  div: DivisionId | null;
  reg: string;
  pay: PayStatus;
  since: number;
  note?: string;
};
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");
export const PLAYERS: PlayerRow[] = (
  [
    { name: "Maya Johnson", email: "maya.johnson@example.com", status: "Active", teams: [["ffx", "Captain"], ["bld", "Player"]], div: "wp", reg: "Approved", pay: "Paid", since: 2019 },
    { name: "Carmen Vega", email: "cvega@example.com", status: "Suspended", teams: [["ffx", "Player"]], div: "wp", reg: "Approved", pay: "Paid", since: 2021, note: "Two-match suspension (red card, Game #203). Eligible again May 31." },
    { name: "Jordan Lee", email: "jordan.lee@example.com", status: "Active", teams: [], div: null, reg: "Game pass only", pay: "Paid", since: 2026, note: "Game pass for Game #204 only." },
    { name: "Aisha Bello", email: "aisha.bello@example.com", status: "Pending Approval", teams: [], div: "wp", reg: "Pending Review", pay: "Paid", since: 2026 },
    { name: "Chris Alvarez", email: "calvarez@example.com", status: "Active", teams: [["nvs", "Captain"]], div: "md1", reg: "Approved", pay: "Paid", since: 2017 },
    { name: "Diego Ruiz", email: "druiz@example.com", status: "Active", teams: [["nvs", "Captain"]], div: "md1", reg: "Approved", pay: "Paid", since: 2018 },
    { name: "Kevin Osei", email: "kosei@example.com", status: "Active", teams: [["bld", "Captain"]], div: "d3", reg: "Approved", pay: "Paid", since: 2020 },
    { name: "Ravi Menon", email: "ravi.m@example.com", status: "Active", teams: [["bld", "Player"]], div: "d3", reg: "Approved", pay: "Paid", since: 2024 },
    { name: "Lily Tran", email: "ltran@example.com", status: "Active", teams: [["ffx", "Player"]], div: "wp", reg: "Approved", pay: "Paid", since: 2022 },
    { name: "Tyler Nguyen", email: "tnguyen@example.com", status: "Pending Approval", teams: [], div: "md1", reg: "Submitted", pay: "Pending", since: 2023 },
    { name: "Marcus Hill", email: "mhill@example.com", status: "Active", teams: [["arl", "Captain"]], div: "md1", reg: "Approved", pay: "Paid", since: 2016 },
    { name: "Dee Washington", email: "dwash@example.com", status: "Suspended", teams: [["bld", "Player"]], div: "d3", reg: "Approved", pay: "Unpaid", since: 2023, note: "Payment failed. Limited until the fee is paid." },
  ] as Omit<PlayerRow, "slug">[]
).map((p) => ({ ...p, slug: slugify(p.name) }));

export const TOP_SCORERS: Partial<Record<DivisionId, [string, string, number, number][]>> = {
  wp: [["Maya Johnson", "ffx", 8, 4], ["Renee Carter", "alx", 6, 3], ["Nadia Haddad", "ffx", 5, 2], ["Gabi Ortiz", "pot", 5, 1], ["Kara Whitfield", "alx", 4, 5]],
};

export const DISCOUNT_CODES = [
  { code: "BOARD26", kind: "Board member", value: "100% off", uses: "4 / 12", active: true },
  { code: "SPRING10", kind: "Promo", value: "$10 off", uses: "61 / 200", active: true },
  { code: "TEAMPAID-FFX", kind: "Team paid in full", value: "100% off", uses: "15 / 18", active: true },
  { code: "FALL25", kind: "Promo", value: "15% off", uses: "88 / 100", active: false },
];
export const EXTRA_ZIPS = ["22201", "22202", "22203", "22204", "22205", "22206", "22207", "22209", "22301", "22302", "22304", "22305", "22314"];
export const BLOCKLIST = ["spamleague.biz", "j.doe.banned@example.com", "*@tempmail.dev"];

/* ---------------- Rules ---------------- */
export function ageOn(dob: string, on = OPENING_DAY) {
  if (!dob) return null;
  const a = new Date(dob), b = new Date(on);
  let y = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) y--;
  return Number.isNaN(y) ? null : y;
}

export type Gender = "Female" | "Male" | "Non-binary";
export function eligibleDivisions(dob: string, gender: Gender | "") {
  const age = ageOn(dob);
  if (age === null) return null;
  const by = dob.slice(0, 10);
  return DIVISIONS.map((d) => {
    let ok = age >= 18;
    let why = "";
    if (d.id === "wp") { ok = ok && gender === "Female"; if (gender !== "Female") why = "Women only"; }
    if (d.id === "md1") { ok = ok && gender === "Male"; if (gender !== "Male") why = "Men only"; }
    if (d.id === "d3") ok = by <= "2008-12-31";
    if (d.id === "mc") { const cut = gender === "Female" ? "1996-12-31" : "1991-12-31"; ok = by <= cut; if (!ok) why = "Born after cutoff"; }
    if (age < 18) { ok = false; why = "Must be 18+"; }
    return { ...d, ok, why };
  });
}

/** Northern Virginia ZIPs (Fairfax County plus eligible Arlington/Alexandria). Server checks AllowedZipCode table. */
export const looksEligibleZip = (zip: string) => /^22[0-3]\d{2}$/.test(zip.trim());

export function discountFor(code: string, fee: number): { ok: boolean; amount: number; message?: string } {
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false, amount: 0, message: "Enter a code first." };
  if (c === "SPRING10") return { ok: true, amount: Math.min(10, fee) };
  if (c === "BOARD26" || c.startsWith("TEAMPAID")) return { ok: true, amount: fee };
  return { ok: false, amount: 0, message: `“${c}” isn’t a valid code for Spring 2026.` };
}

export const money = (v: number) => `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
export const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("");
