import { sampleRidge, buildDecorations } from "./terrain.js";
import { ENEMY_TYPES } from "./data.js";
import { spawnEnemy, spawnCustomEnemy, BOSS_VARIANTS } from "./enemies.js";
import { normalizeEnemyDef, buildRuntimeEnemyType } from "./customEnemies.js";

export const SEGMENT_TYPES = {
  open: { label: "Öppen tunnel", topBase: 0.14, botBase: 0.86, amp: 12, freq: 0.0035 },
  narrow: { label: "Trång passage", topBase: 0.32, botBase: 0.68, amp: 10, freq: 0.006 },
  wide: { label: "Stor grotta", topBase: 0.07, botBase: 0.93, amp: 20, freq: 0.003 },
  zigzag: { label: "Sicksack", topBase: 0.20, botBase: 0.80, amp: 60, freq: 0.011 },
  chasm: { label: "Klyfta (lågt golv)", topBase: 0.12, botBase: 0.58, amp: 22, freq: 0.004 },
  lowceil: { label: "Lågt tak", topBase: 0.46, botBase: 0.92, amp: 14, freq: 0.005 },
  weave: { label: "Vävd passage", topBase: 0.26, botBase: 0.74, amp: 42, freq: 0.015 },
};

export const BIOMES = {
  volcanic: { label: "Vulkanisk" },
  graveyard: { label: "Gravplats" },
  crystal: { label: "Kristallgrotta" },
  moai: { label: "Moai-ruiner" },
};

export const ENEMY_PALETTE = Object.keys(ENEMY_TYPES).map((id) => ({
  id,
  label: ENEMY_TYPES[id].name,
  color: ENEMY_TYPES[id].color,
}));

export const OBSTACLE_KINDS = Object.keys(BIOMES);

export const BOSS_PALETTE = [
  { id: "random", label: "Slumpad" },
  ...Object.entries(BOSS_VARIANTS).map(([id, v]) => ({ id, label: v.label })),
];

export const MIN_SEGMENT_LENGTH = 300;
export const MIN_LEVEL_LENGTH = 1500;
export const MAX_LEVEL_LENGTH = 20000;
const BLEND = 150;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function createSegment(type = "open", length = 800, biome = "volcanic") {
  return { type, length, biome };
}

export function createEmptyLevel() {
  return {
    version: 1,
    name: "Ny bana",
    length: 4000,
    biome: "volcanic",
    segments: [createSegment("open", 4000, "volcanic")],
    terrainOverrides: [],
    obstacles: [],
    groundCannons: [],
    enemies: [],
    customEnemies: {},
    boss: { variant: "random", hp: 900, timer: 1.1, score: 5000, name: "" },
  };
}

function segTotalLength(segments) {
  return segments.reduce((sum, s) => sum + s.length, 0);
}

export function normalizeLevel(raw) {
  const base = createEmptyLevel();
  const merged = { ...base, ...(raw || {}) };
  const biome = BIOMES[merged.biome] ? merged.biome : "volcanic";
  const segSource = Array.isArray(raw?.segments) && raw.segments.length ? raw.segments : base.segments;
  const segments = segSource.map((s) => ({
    type: SEGMENT_TYPES[s.type] ? s.type : "open",
    length: Math.max(MIN_SEGMENT_LENGTH, Math.round(s.length) || 800),
    biome: BIOMES[s.biome] ? s.biome : biome,
  }));
  const length = clamp(Math.round(merged.length) || segTotalLength(segments), MIN_LEVEL_LENGTH, MAX_LEVEL_LENGTH);
  const customEnemies = {};
  if (raw?.customEnemies && typeof raw.customEnemies === "object") {
    for (const [id, def] of Object.entries(raw.customEnemies)) {
      customEnemies[id] = normalizeEnemyDef({ ...def, id });
    }
  }
  const bossRaw = raw?.boss || {};
  const boss = {
    variant: bossRaw.variant === "random" || BOSS_VARIANTS[bossRaw.variant] ? bossRaw.variant : "random",
    hp: clamp(Math.round(bossRaw.hp) || base.boss.hp, 50, 30000),
    timer: clamp(Number(bossRaw.timer) || base.boss.timer, 0.25, 5),
    score: clamp(Math.round(bossRaw.score) || base.boss.score, 0, 100000),
    name: (bossRaw.name || "").toString().slice(0, 30),
  };
  return {
    version: 1,
    name: (merged.name || "Namnlös bana").toString().slice(0, 60),
    length,
    biome,
    segments,
    terrainOverrides: Array.isArray(raw?.terrainOverrides) ? raw.terrainOverrides : [],
    obstacles: Array.isArray(raw?.obstacles) ? raw.obstacles : [],
    groundCannons: Array.isArray(raw?.groundCannons) ? raw.groundCannons : [],
    enemies: Array.isArray(raw?.enemies) ? raw.enemies : [],
    customEnemies,
    boss,
  };
}

/** Placerar segmenten i sekvens och skalar dem så summan matchar levelns längd. */
export function layoutSegments(level) {
  const total = segTotalLength(level.segments) || level.length;
  const scale = level.length / total;
  let x = 0;
  return level.segments.map((s) => {
    const length = Math.max(MIN_SEGMENT_LENGTH * 0.5, s.length * scale);
    const seg = { ...s, start: x, length };
    x += length;
    return seg;
  });
}

function shapeAt(type, x, vh) {
  const def = SEGMENT_TYPES[type] || SEGMENT_TYPES.open;
  const topY = vh * def.topBase
    + Math.sin(x * def.freq) * def.amp
    + Math.sin(x * def.freq * 2.3 + 1.3) * def.amp * 0.4;
  const botY = vh * def.botBase
    - Math.sin(x * def.freq * 0.85 + 0.6) * def.amp
    - Math.sin(x * def.freq * 2.1 + 0.4) * def.amp * 0.35;
  return {
    topY: clamp(topY, 14, vh * 0.46),
    botY: clamp(botY, vh * 0.54, vh - 14),
  };
}

function findSegmentIndex(segs, x) {
  for (let i = 0; i < segs.length; i++) {
    if (x >= segs[i].start && x < segs[i].start + segs[i].length) return i;
  }
  return segs.length - 1;
}

function sampleShape(segs, x, vh) {
  const idx = findSegmentIndex(segs, x);
  const seg = segs[idx];
  let cur = shapeAt(seg.type, x, vh);

  const next = segs[idx + 1];
  if (next) {
    const distToEnd = seg.start + seg.length - x;
    if (distToEnd < BLEND) {
      const t = 1 - distToEnd / BLEND;
      const n = shapeAt(next.type, x, vh);
      cur = { topY: cur.topY + (n.topY - cur.topY) * t, botY: cur.botY + (n.botY - cur.botY) * t };
    }
  }
  const prev = segs[idx - 1];
  if (prev) {
    const distToStart = x - seg.start;
    if (distToStart < BLEND) {
      const t = 1 - distToStart / BLEND;
      const p = shapeAt(prev.type, x, vh);
      cur = { topY: cur.topY + (p.topY - cur.topY) * t, botY: cur.botY + (p.botY - cur.botY) * t };
    }
  }
  return cur;
}

export function biomeAtX(segs, x, fallback = "volcanic") {
  const idx = findSegmentIndex(segs, x);
  return segs[idx]?.biome || fallback;
}

export function buildRidges(level, vh, step = 20) {
  const segs = layoutSegments(level);
  const topRidge = [];
  const bottomRidge = [];
  for (let x = 0; x <= level.length; x += step) {
    const { topY, botY } = sampleShape(segs, x, vh);
    topRidge.push({ x, y: topY });
    bottomRidge.push({ x, y: botY });
  }
  applyOverrides(topRidge, level.terrainOverrides, "top", vh);
  applyOverrides(bottomRidge, level.terrainOverrides, "bottom", vh);
  return { topRidge, bottomRidge, segs };
}

function applyOverrides(ridge, overrides, edge, vh) {
  const radius = 260;
  for (const o of overrides) {
    if (o.edge !== edge) continue;
    const targetY = clamp(o.yFrac * vh, 10, vh - 10);
    for (const p of ridge) {
      const d = Math.abs(p.x - o.x);
      if (d > radius) continue;
      const w = (1 - d / radius) ** 2;
      p.y = p.y * (1 - w) + targetY * w;
    }
  }
}

export function generateCustomStage(rawLevel, viewHeight, seed = (Math.random() * 99999) | 0) {
  const level = normalizeLevel(rawLevel);
  const { topRidge, bottomRidge, segs } = buildRidges(level, viewHeight);
  const width = level.length;
  const bossZoneX = Math.max(800, width - 500);
  const biomeAt = (x) => biomeAtX(segs, x, level.biome);

  const obstacles = level.obstacles.map((o) => {
    const ox = clamp(o.x, 0, width);
    const top = sampleRidge(topRidge, ox) + 36;
    const bottom = sampleRidge(bottomRidge, ox) - 36;
    const t = clamp(o.t ?? 0.5, 0, 1);
    return {
      x: ox - 22, y: top + (bottom - top) * t, w: 44, h: 38,
      hp: 34, maxHp: 34, kind: o.kind || biomeAt(ox),
    };
  });

  const groundCannons = level.groundCannons.map((c) => {
    const cx = clamp(c.x, 0, width);
    const top = sampleRidge(topRidge, cx);
    const bottom = sampleRidge(bottomRidge, cx);
    const onTop = c.side !== "bottom";
    return {
      x: cx - 18,
      y: onTop ? top + 4 : bottom - 32,
      w: 36, h: 28,
      side: onTop ? "top" : "bottom",
      hp: 90, maxHp: 90,
      fireCooldown: 1.5 + (Math.round(cx) % 100) * 0.01,
      animPhase: Math.random() * Math.PI * 2,
    };
  });

  const decorations = buildDecorations(width, seed, biomeAt, 1);

  const encounterScript = level.enemies
    .map((e) => {
      const spawnX = clamp(e.x, 40, width - 40);
      const tFrac = clamp(e.t ?? 0.5, 0, 1);
      const customId = typeof e.type === "string" && e.type.startsWith("custom:") ? e.type.slice(7) : null;
      const customDef = customId ? level.customEnemies[customId] : null;
      const runtimeCustom = customDef ? buildRuntimeEnemyType(customDef) : null;
      const type = ENEMY_TYPES[e.type] ? e.type : "scout";
      return {
        x: spawnX,
        spawn: (stage, triggerX, viewWidth) => {
          // Fiender ska komma in från höger, precis utanför synligt område —
          // precis som i de procedurala banorna.
          const sx = clamp(spawnX + viewWidth + 30, 0, width - 4);
          const top = sampleRidge(stage.topRidge, sx) + 24;
          const bottom = sampleRidge(stage.bottomRidge, sx) - 24;
          const y = top + (bottom - top) * tFrac;
          return [runtimeCustom ? spawnCustomEnemy(runtimeCustom, sx, y) : spawnEnemy(type, sx, y)];
        },
      };
    })
    .sort((a, b) => a.x - b.x);

  return {
    width, viewHeight, bossZoneX, topRidge, bottomRidge,
    obstacles, decorations, secretGaps: [], groundCannons,
    level: 1, seed, biomeOffset: 0, phase: 0,
    encounterScript, isCustom: true, customName: level.name,
    biomeAt, bossConfig: level.boss,
  };
}

export function exportLevelToFile(rawLevel) {
  const level = normalizeLevel(rawLevel);
  const blob = new Blob([JSON.stringify(level, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (level.name || "bana").replace(/[^a-z0-9_\-åäöÅÄÖ ]/gi, "").trim() || "bana";
  a.href = url;
  a.download = `${safeName}.starforge.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function importLevelFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        resolve(normalizeLevel(data));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
