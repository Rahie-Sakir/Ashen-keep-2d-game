/** Three-act level data for SoulsFan Games. */

import type { Rect } from "./types";

export interface LevelSpec {
  id: string;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  palette: Record<string, string>;
  platforms: Rect[];
  hazards: Rect[];
  shrines: [number, number][];
  exit: [number, number];
  bossId: string;
  spawns: [string, string, number, number][];
}

const WORLD_WIDTH = 3800;
const WORLD_HEIGHT = 900;

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

/** Solid floor split by the given (start,end) gaps. */
function groundSegments(gaps: [number, number][]): Rect[] {
  const segments: Rect[] = [];
  let cursor = 0;
  for (const [start, end] of gaps) {
    if (start > cursor) segments.push(rect(cursor, 780, start - cursor, 120));
    cursor = end;
  }
  if (cursor < WORLD_WIDTH) {
    segments.push(rect(cursor, 780, WORLD_WIDTH - cursor, 120));
  }
  return segments;
}

const walls = [rect(0, 0, 35, 900), rect(3765, 0, 35, 900)];

const moonroot: LevelSpec = {
  id: "moonroot",
  name: "I. MOONROOT HOLLOW",
  subtitle: "A drowned orchard dreaming beneath a broken moon",
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  palette: {
    sky: "#111526", skyLow: "#243044", mist: "#7d9a9a", ink: "#090b12",
    stone: "#202936", edge: "#91aa9d", accent: "#e8a65b", enemy: "#6f3850",
  },
  platforms: [
    ...groundSegments([[710, 815], [1710, 1825], [2680, 2805]]),
    rect(360, 650, 220, 30), rect(865, 665, 240, 30), rect(1160, 570, 190, 28),
    rect(1440, 690, 180, 28), rect(1875, 650, 260, 30), rect(2200, 550, 190, 28),
    rect(2440, 665, 170, 28), rect(2850, 630, 190, 30), rect(3080, 530, 180, 28),
    rect(3330, 690, 420, 90), ...walls,
  ],
  hazards: [rect(710, 770, 105, 130), rect(1710, 770, 115, 130), rect(2680, 770, 125, 130)],
  shrines: [[150, 720], [1940, 590]],
  exit: [3690, 700],
  bossId: "root_warden",
  spawns: [
    ["m1", "shardling", 470, 610], ["m2", "duelist", 1040, 720], ["m3", "moth", 1280, 430],
    ["m4", "shardling", 1540, 650], ["m5", "duelist", 2040, 590], ["m6", "moth", 2320, 420],
    ["m7", "shardling", 2930, 590], ["root_warden", "root_warden", 3460, 650],
  ],
};

const foundry: LevelSpec = {
  id: "foundry",
  name: "II. THE BELLFOUNDRY",
  subtitle: "Iron prayers ring where the furnace learned to breathe",
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  palette: {
    sky: "#1c141b", skyLow: "#4a2c29", mist: "#bd7650", ink: "#0d090c",
    stone: "#32282d", edge: "#bd7955", accent: "#ffca6b", enemy: "#714334",
  },
  platforms: [
    ...groundSegments([[550, 660], [1410, 1530], [2310, 2440]]),
    rect(230, 640, 190, 30), rect(705, 675, 230, 28), rect(990, 570, 170, 28),
    rect(1190, 470, 150, 28), rect(1570, 650, 230, 30), rect(1850, 545, 200, 28),
    rect(2080, 680, 150, 28), rect(2480, 625, 200, 30), rect(2730, 520, 180, 28),
    rect(2960, 650, 170, 28), rect(3210, 700, 550, 80), ...walls,
  ],
  hazards: [rect(550, 770, 110, 130), rect(1410, 770, 120, 130), rect(2310, 770, 130, 130)],
  shrines: [[150, 720], [1600, 590], [2750, 460]],
  exit: [3690, 700],
  bossId: "bell_keeper",
  spawns: [
    ["f1", "mauler", 350, 590], ["f2", "lancer", 820, 620], ["f3", "oracle", 1100, 520],
    ["f4", "mauler", 1660, 600], ["f5", "lancer", 1960, 490], ["f6", "oracle", 2600, 570],
    ["f7", "lancer", 3020, 600], ["bell_keeper", "bell_keeper", 3460, 635],
  ],
};

const basilica: LevelSpec = {
  id: "basilica",
  name: "III. GLASS BASILICA",
  subtitle: "A saintless cathedral at the edge of morning",
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  palette: {
    sky: "#181527", skyLow: "#473d5b", mist: "#c7b4cd", ink: "#0a0811",
    stone: "#29243a", edge: "#bcb0d4", accent: "#ffb45f", enemy: "#5e3b68",
  },
  platforms: [
    ...groundSegments([[790, 905], [1780, 1905], [2550, 2685]]),
    rect(300, 620, 220, 28), rect(560, 520, 150, 28), rect(940, 670, 230, 30),
    rect(1210, 555, 170, 28), rect(1420, 455, 170, 28), rect(1960, 650, 210, 30),
    rect(2200, 535, 180, 28), rect(2740, 650, 190, 30), rect(2980, 545, 170, 28),
    rect(3220, 700, 540, 80), ...walls,
  ],
  hazards: [rect(790, 770, 115, 130), rect(1780, 770, 125, 130), rect(2550, 770, 135, 130)],
  shrines: [[150, 720], [2000, 590]],
  exit: [3690, 700],
  bossId: "pale_regent",
  spawns: [
    ["b1", "duelist", 420, 570], ["b2", "moth", 650, 390], ["b3", "lancer", 1030, 620],
    ["b4", "oracle", 1330, 500], ["b5", "mauler", 2050, 600], ["b6", "moth", 2310, 410],
    ["b7", "duelist", 2810, 600], ["b8", "oracle", 3070, 500],
    ["pale_regent", "pale_regent", 3460, 625],
  ],
};

export const LEVELS: LevelSpec[] = [moonroot, foundry, basilica];
