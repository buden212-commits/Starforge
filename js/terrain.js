export function getBiome(x, offset = 0) {
  const sx = x + offset;
  if (sx < 2200) return "volcanic";
  if (sx < 4800) return "graveyard";
  if (sx < 7200) return "crystal";
  return "moai";
}

export function createStage(viewHeight, level = 1, seed = (Math.random() * 99999) | 0) {
  const width = 9000;
  const phase = seed * 0.37 + level * 1123;
  const biomeOffset = level * 1500 + (seed % 1100);
  const bossZoneX = 7600 + (seed % 500) + level * 120;
  const topRidge = [];
  const bottomRidge = [];

  for (let x = 0; x <= width; x += 20) {
    topRidge.push({ x, y: ridgeTop(x, viewHeight, phase, biomeOffset) });
    bottomRidge.push({ x, y: ridgeBottom(x, viewHeight, phase, biomeOffset) });
  }

  const obstacles = [];
  const secretGaps = [];

  const rockSpots = [
    [600, 0.4], [1100, 0.55], [1600, 0.35], [2000, 0.62],
    [2600, 0.45], [3100, 0.58], [3600, 0.4], [4100, 0.52],
    [4600, 0.38], [5200, 0.6], [5700, 0.42], [6200, 0.55],
    [6700, 0.48], [7200, 0.35], [7600, 0.5],
  ];
  for (let i = 0; i < rockSpots.length; i++) {
    const [bx, t] = rockSpots[i];
    const jitter = ((seed * (i + 3) * 47) % 260) - 130;
    const x = bx + jitter + (level - 1) * 80;
    const top = sampleRidge(topRidge, x) + 36;
    const bottom = sampleRidge(bottomRidge, x) - 36;
    obstacles.push({
      x: x - 22, y: top + (bottom - top) * t, w: 44, h: 38,
      hp: 30 + level * 8, maxHp: 30 + level * 8,
      kind: getBiome(x, biomeOffset),
    });
  }

  const decorations = buildDecorations(width, seed, (x) => getBiome(x, biomeOffset), level);

  if (level === 1) {
    [950, 1750, 2550].forEach((x, i) => {
      const gapY = viewHeight * (0.35 + i * 0.12);
      secretGaps.push({ x, y: gapY, w: 70, h: 90, id: i, passed: false });
    });
  }

  const groundCannons = [];
  if (level >= 3) {
    for (let cx = 700; cx < bossZoneX - 350; cx += 380 + ((seed + cx) % 180)) {
      const onTop = (cx + seed) % 760 < 380;
      const top = sampleRidge(topRidge, cx);
      const bottom = sampleRidge(bottomRidge, cx);
      groundCannons.push({
        x: cx - 18,
        y: onTop ? top + 4 : bottom - 32,
        w: 36,
        h: 28,
        side: onTop ? "top" : "bottom",
        hp: 90,
        maxHp: 90,
        fireCooldown: 1.5 + (cx % 100) * 0.01,
        animPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  return {
    width, viewHeight, bossZoneX, topRidge, bottomRidge,
    obstacles, decorations, secretGaps, groundCannons,
    level, seed, biomeOffset, phase,
  };
}

function ridgeTop(x, vh, phase = 0, biomeOffset = 0) {
  const px = x + phase;
  const b = getBiome(x, biomeOffset);
  let y = 32;
  // Stor skala — tunnelbredd varierar som i en naturlig grotta
  y += Math.sin(px * 0.0028) * 52 + Math.sin(px * 0.0075) * 28;
  y += Math.sin(px * 0.0016 + 1.2) * 18;
  // Medel — ojämna klippformationer
  y += Math.sin(px * 0.018) * 22 + Math.sin(px * 0.041) * 12;
  y += Math.abs(Math.sin(px * 0.029 + 0.8)) * 14;
  // Detalj — stalaktitliknande taggar
  const spike = Math.max(0, Math.sin(px * 0.073) * 20);
  y += spike * (Math.sin(px * 0.137) > 0.15 ? 1 : 0.35);
  if (b === "volcanic") y += Math.max(0, Math.sin(px * 0.011 + 2)) * 16;
  else if (b === "graveyard") y += Math.abs(Math.sin(px * 0.024)) * 10;
  else if (b === "crystal") y += Math.abs(Math.sin(px * 0.033)) * 12;
  return Math.max(14, Math.min(vh * 0.44, y));
}

function ridgeBottom(x, vh, phase = 0, biomeOffset = 0) {
  const px = x + phase;
  const b = getBiome(x, biomeOffset);
  let y = vh - 32;
  y -= Math.sin(px * 0.0031 + 0.6) * 50 + Math.sin(px * 0.0082) * 26;
  y -= Math.sin(px * 0.0019 + 2.1) * 16;
  y -= Math.sin(px * 0.019 + 1) * 20 + Math.sin(px * 0.044) * 11;
  y -= Math.abs(Math.cos(px * 0.031)) * 13;
  const spike = Math.max(0, Math.sin(px * 0.079 + 1.4) * 18);
  y -= spike * (Math.cos(px * 0.142) > 0.1 ? 1 : 0.4);
  if (b === "volcanic") y -= Math.max(0, Math.cos(px * 0.012)) * 14;
  else if (b === "graveyard") y -= Math.abs(Math.sin(px * 0.026 + 1)) * 9;
  else if (b === "crystal") y -= Math.abs(Math.cos(px * 0.036)) * 11;
  return Math.min(vh - 14, Math.max(vh * 0.56, y));
}

export function buildDecorations(width, seed, biomeAt, level = 1) {
  const decorations = [];
  const decoStep = 200 + (seed % 80) + level * 10;
  for (let x = 220 + (seed % 120); x < width - 400; x += decoStep) {
    const biome = biomeAt(x);

    if (biome === "volcanic") {
      decorations.push({ kind: "lava", x, w: 40, h: 12 });
      if (x % 380 < 160) decorations.push({ kind: "stalactite", x, len: 28 + (x % 40), wet: true });
      if (x % 520 < 140) decorations.push({ kind: "stalagmite", x: x + 35, len: 22 + (x % 30) });
      if (x % 680 < 120) decorations.push({ kind: "steam_vent", x, w: 24, h: 30 });
      if (x % 900 < 80) decorations.push({ kind: "ember", x: x + 15, tunnelFrac: 0.3 + (x % 4) * 0.12, seed: x + seed });
    } else if (biome === "graveyard") {
      if (x % 340 < 150) decorations.push({ kind: "stalactite", x, len: 35 + (x % 50) });
      if (x % 420 < 130) decorations.push({ kind: "stalagmite", x: x + 20, len: 30 + (x % 35) });
      if (x % 580 < 100) decorations.push({ kind: "dripstone", x: x + 10, len: 38 + (x % 42), seed: x });
      if (x % 480 < 100) decorations.push({ kind: "cave_fog", x, w: 140, tunnelFrac: 0.4 + (x % 3) * 0.08, seed: x * 0.01 + seed });
      if (x % 720 < 80) decorations.push({ kind: "bone_pile", x, scale: 0.7 + (x % 3) * 0.1 });
    } else if (biome === "crystal") {
      if (x % 300 < 130) decorations.push({ kind: "stalactite", x, len: 32 + (x % 45), crystal: true });
      decorations.push({ kind: "crystal", x, tunnelFrac: 0.25 + (x % 5) * 0.1, hue: (x + seed) % 120 });
      decorations.push({ kind: "crystal", x: x + 40, tunnelFrac: 0.35 + (x % 4) * 0.1, hue: 120 + (x % 2) * 30 });
      if (x % 500 < 160) decorations.push({ kind: "crystal_spire", x: x + 20, hue: 180 + (x % 4) * 20 });
      if (x % 640 < 90) decorations.push({ kind: "underground_pool", x, w: 70, seed: x + seed });
    } else {
      if (x % 280 < 140) decorations.push({ kind: "stalactite", x, len: 26 + (x % 38) });
      if (x % 360 < 120) decorations.push({ kind: "stalagmite", x: x + 25, len: 24 + (x % 32) });
      if (x % 440 < 100) decorations.push({ kind: "moss_patch", x, w: 36 + (x % 20) });
      if (x % 560 < 90) decorations.push({ kind: "dripstone", x: x + 15, len: 32 + (x % 36), seed: x + seed });
      if (x % 700 < 80) decorations.push({ kind: "rock_column", x, h: 48 + (x % 30) });
    }
  }
  return decorations;
}

export function sampleRidge(ridge, x) {
  const step = 20;
  const i = Math.floor(x / step);
  const t = (x % step) / step;
  const a = ridge[Math.min(i, ridge.length - 1)];
  const b = ridge[Math.min(i + 1, ridge.length - 1)];
  return a.y + (b.y - a.y) * t;
}

export function getPlayBounds(stage, worldX) {
  const top = sampleRidge(stage.topRidge, worldX) + 22;
  const bottom = sampleRidge(stage.bottomRidge, worldX) - 22;
  return { top, bottom };
}

export function collidesCircleRect(cx, cy, r, rect) {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

export function resolveMovement(entity, dx, dy, obstacles, bounds, radius) {
  let nx = entity.x + dx;
  let ny = entity.y + dy;
  nx = Math.max(bounds.minX, Math.min(bounds.maxX, nx));
  ny = Math.max(bounds.top + radius, Math.min(bounds.bottom - radius, ny));

  for (const obs of obstacles) {
    if (obs.hp <= 0) continue;
    if (collidesCircleRect(nx, ny, radius, obs)) {
      if (dy > 0) ny = obs.y - radius;
      else if (dy < 0) ny = obs.y + obs.h + radius;
      if (dx > 0) nx = obs.x - radius;
      else if (dx < 0) nx = obs.x + obs.w + radius;
    }
  }
  entity.x = nx;
  entity.y = ny;
}

/** Klämmer en y-position så att den stannar innanför tunnelns tak/golv vid ett givet x. */
export function clampToTunnel(x, y, radius, stage) {
  const top = sampleRidge(stage.topRidge, x) + radius;
  const bottom = sampleRidge(stage.bottomRidge, x) - radius;
  if (bottom < top) return (top + bottom) * 0.5;
  return Math.max(top, Math.min(bottom, y));
}

/** True om punkten ligger i berget (utanför den flygbara tunneln). */
export function isInsideTerrain(x, y, stage, margin = 0) {
  const top = sampleRidge(stage.topRidge, x) + margin;
  const bottom = sampleRidge(stage.bottomRidge, x) - margin;
  return y <= top || y >= bottom;
}

export function checkTerrainCrash(player, stage) {
  if (player.terrainHitCooldown > 0 || !player.alive) return false;
  const top = sampleRidge(stage.topRidge, player.x) + 22;
  const bottom = sampleRidge(stage.bottomRidge, player.x) - 22;
  const hitTop = player.y - player.radius <= top + 8;
  const hitBottom = player.y + player.radius >= bottom - 8;
  if (!hitTop && !hitBottom) return false;

  player.hp = Math.max(1, player.hp - player.stats.maxHp * 0.25);
  player.terrainHitCooldown = 2.5;
  player.invuln = 1.8;
  return true;
}

export function checkSecretGaps(stage, player) {
  let activated = false;
  for (const gap of stage.secretGaps) {
    if (gap.passed) continue;
    if (player.x > gap.x && player.x < gap.x + gap.w &&
        player.y > gap.y && player.y < gap.y + gap.h) {
      gap.passed = true;
    }
  }
  if (stage.secretGaps.length > 0 && stage.secretGaps.every((g) => g.passed) && !stage.twinBeeUnlocked) {
    stage.twinBeeUnlocked = true;
    activated = true;
  }
  return activated;
}
