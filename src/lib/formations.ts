/** Lineup formations: slot name and pitch position (x%, y%) for each of the 11 spots. */
export const FORMATIONS: Record<string, [string, number, number][]> = {
  "4-4-2": [["GK", 50, 90], ["LB", 16, 70], ["LCB", 38, 74], ["RCB", 62, 74], ["RB", 84, 70], ["LM", 16, 46], ["LCM", 38, 50], ["RCM", 62, 50], ["RM", 84, 46], ["LS", 36, 20], ["RS", 64, 20]],
  "4-3-3": [["GK", 50, 90], ["LB", 16, 70], ["LCB", 38, 74], ["RCB", 62, 74], ["RB", 84, 70], ["LCM", 28, 50], ["CM", 50, 54], ["RCM", 72, 50], ["LW", 18, 22], ["ST", 50, 16], ["RW", 82, 22]],
  "3-5-2": [["GK", 50, 90], ["LCB", 26, 73], ["CB", 50, 76], ["RCB", 74, 73], ["LWB", 12, 48], ["LCM", 33, 52], ["CM", 50, 44], ["RCM", 67, 52], ["RWB", 88, 48], ["LS", 36, 18], ["RS", 64, 18]],
};
