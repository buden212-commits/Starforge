export const RARITY = {
  common: { name: "Vanlig", color: "#b8c5d6", mult: 1 },
  uncommon: { name: "Ovanlig", color: "#39ff88", mult: 1.25 },
  epic: { name: "Episk", color: "#a855f7", mult: 1.5 },
};

export const CHASSIS = {
  interceptor: {
    id: "interceptor",
    name: "Interceptor",
    hp: 80,
    speed: 1.25,
    energy: 100,
    damage: 1,
    fireRate: 1.1,
    color: "#00e5ff",
  },
  fighter: {
    id: "fighter",
    name: "Fighter",
    hp: 100,
    speed: 1,
    energy: 110,
    damage: 1.1,
    fireRate: 1,
    color: "#ffb020",
  },
  cruiser: {
    id: "cruiser",
    name: "Cruiser",
    hp: 140,
    speed: 0.82,
    energy: 130,
    damage: 1.05,
    fireRate: 0.95,
    color: "#ff2d95",
  },
};

export const ENGINES = {
  standard: { id: "standard", name: "Standard Motor", speed: 1, dash: 1, slot: "engine" },
  turbo: { id: "turbo", name: "Turbo Motor", speed: 1.2, dash: 0.9, slot: "engine" },
  ion: { id: "ion", name: "Ion Motor", speed: 1.05, dash: 1.3, slot: "engine" },
};

export const WINGS = {
  light: { id: "light", name: "Lätta Vingar", maneuver: 1.15, regen: 0.9, slot: "wing" },
  balanced: { id: "balanced", name: "Balanserade Vingar", maneuver: 1, regen: 1, slot: "wing" },
  heavy: { id: "heavy", name: "Tunga Vingar", maneuver: 0.88, regen: 1.15, slot: "wing" },
};

export const PRIMARY_WEAPONS = {
  machinegun: {
    id: "machinegun",
    name: "Konami Beam",
    slot: "primary",
    damage: 8,
    fireRate: 0.09,
    energyCost: 0,
    projectileSpeed: 720,
    color: "#ffaa00",
    spread: 0.04,
  },
  laser: {
    id: "laser",
    name: "Laser",
    slot: "primary",
    damage: 20,
    fireRate: 0.2,
    energyCost: 3,
    projectileSpeed: 900,
    color: "#88ddff",
    spread: 0,
  },
  railgun: {
    id: "railgun",
    name: "Ripple",
    slot: "primary",
    damage: 50,
    fireRate: 0.7,
    energyCost: 10,
    projectileSpeed: 650,
    color: "#ff8800",
    spread: 0.12,
  },
};

export const SECONDARY_WEAPONS = {
  missiles: {
    id: "missiles",
    name: "Missiler",
    slot: "secondary",
    damage: 35,
    fireRate: 1.2,
    energyCost: 8,
    projectileSpeed: 500,
    homing: true,
    color: "#ff2d95",
  },
  emp: {
    id: "emp",
    name: "EMP",
    slot: "secondary",
    damage: 15,
    fireRate: 2.5,
    energyCost: 20,
    radius: 120,
    stun: 1.5,
    color: "#39ff88",
  },
};

export const LOOT_AFFIXES = [
  { stat: "damage", label: "Skada", values: [0.08, 0.15, 0.25] },
  { stat: "energy", label: "Energi", values: [10, 20, 35] },
  { stat: "speed", label: "Hastighet", values: [0.05, 0.1, 0.15] },
  { stat: "fireRate", label: "Eldhastighet", values: [0.08, 0.12, 0.18] },
  { stat: "hp", label: "Liv", values: [10, 20, 35] },
];

export const ENEMY_TYPES = {
  scout: { name: "Scout", hp: 22, speed: 165, damage: 7, radius: 13, color: "#aa66ff", score: 100, sprite: "dart", shoots: true },
  red_fighter: { name: "Red Fighter", hp: 28, speed: 150, damage: 9, radius: 15, color: "#ff4444", score: 120, sprite: "fighter", shoots: true },
  blue_interceptor: { name: "Blue Interceptor", hp: 20, speed: 200, damage: 6, radius: 12, color: "#4488ff", score: 90, sprite: "interceptor", shoots: true },
  purple_destroyer: { name: "Destroyer", hp: 45, speed: 110, damage: 12, radius: 18, color: "#8844cc", score: 200, sprite: "destroyer", shoots: true },
  swarm: { name: "Swarm", hp: 10, speed: 210, damage: 4, radius: 9, color: "#ff8844", score: 50, swarm: true, sprite: "pod", shoots: false },
  beetle: { name: "Armored", hp: 75, speed: 85, damage: 14, radius: 21, color: "#666688", score: 280, sprite: "beetle", shoots: true },
  kamikaze: { name: "Kamikaze", hp: 16, speed: 270, damage: 28, radius: 11, color: "#ff4488", score: 140, kamikaze: true, sprite: "kamikaze", shoots: false },
  turret: { name: "Gun Core", hp: 55, speed: 0, damage: 11, radius: 19, color: "#664488", score: 180, turret: true, sprite: "turret", shoots: true },
  sniper: { name: "Sniper", hp: 30, speed: 130, damage: 16, radius: 14, color: "#44ccaa", score: 160, sprite: "sniper", sniper: true, shoots: true },
  carrier: { name: "Carrier", hp: 90, speed: 70, damage: 8, radius: 24, color: "#886644", score: 350, sprite: "carrier", carrier: true, shoots: false },
  spinner: { name: "Spinner", hp: 18, speed: 240, damage: 6, radius: 10, color: "#ffcc44", score: 80, sprite: "spinner", spinner: true, shoots: false },
  rin: { name: "Rin Mk-II", hp: 35, speed: 175, damage: 10, radius: 14, color: "#cc88ff", score: 150, sprite: "rin", shoots: true },
};

export const DEFAULT_BUILD = {
  chassis: "fighter",
  engine: "standard",
  leftWing: "balanced",
  rightWing: "balanced",
  primary: "machinegun",
  secondary: "missiles",
};

export const DEFAULT_INVENTORY = {
  chassis: ["interceptor", "fighter", "cruiser"],
  engine: ["standard", "turbo", "ion"],
  leftWing: ["light", "balanced", "heavy"],
  rightWing: ["light", "balanced", "heavy"],
  primary: ["machinegun", "laser", "railgun"],
  secondary: ["missiles", "emp"],
};

export const SLOT_LABELS = {
  chassis: "Chassi",
  engine: "Motor",
  leftWing: "Vänster vinge",
  rightWing: "Höger vinge",
  primary: "Primärvapen",
  secondary: "Sekundärvapen",
};

export function getModuleCatalog() {
  return { ...CHASSIS, ...ENGINES, ...WINGS, ...PRIMARY_WEAPONS, ...SECONDARY_WEAPONS };
}

export function computeStats(build, affixes = {}) {
  const chassis = CHASSIS[build.chassis] || CHASSIS.fighter;
  const engine = ENGINES[build.engine] || ENGINES.standard;
  const leftWing = WINGS[build.leftWing] || WINGS.balanced;
  const rightWing = WINGS[build.rightWing] || WINGS.balanced;
  const primary = PRIMARY_WEAPONS[build.primary] || PRIMARY_WEAPONS.machinegun;

  const wingAvg = (leftWing.maneuver + rightWing.maneuver) / 2;
  const regenAvg = (leftWing.regen + rightWing.regen) / 2;

  return {
    maxHp: Math.round(chassis.hp + (affixes.hp || 0)),
    speed: chassis.speed * engine.speed * wingAvg * (1 + (affixes.speed || 0)),
    maxEnergy: Math.round(chassis.energy + (affixes.energy || 0)),
    damageMult: chassis.damage * (1 + (affixes.damage || 0)),
    fireRateMult: chassis.fireRate * (1 + (affixes.fireRate || 0)),
    dashCooldown: 1.8 / engine.dash,
    energyRegen: 18 * regenAvg,
    primary,
    secondary: SECONDARY_WEAPONS[build.secondary] || SECONDARY_WEAPONS.missiles,
    chassisColor: chassis.color,
    chassisName: chassis.name,
  };
}

export function rollLoot(rng = Math.random) {
  const roll = rng();
  const rarity = roll < 0.55 ? "common" : roll < 0.85 ? "uncommon" : "epic";
  const affix = LOOT_AFFIXES[Math.floor(rng() * LOOT_AFFIXES.length)];
  const idx = rarity === "common" ? 0 : rarity === "uncommon" ? 1 : 2;
  const value = affix.values[idx];

  return {
    id: `${affix.stat}_${rarity}_${Date.now()}_${Math.floor(rng() * 9999)}`,
    name: `${RARITY[rarity].name} ${affix.label}`,
    rarity,
    stat: affix.stat,
    value,
    description: `+${affix.stat === "hp" || affix.stat === "energy" ? value : Math.round(value * 100) + "%"} ${affix.label.toLowerCase()}`,
  };
}

export function applyAffixes(baseAffixes, loot) {
  const next = { ...baseAffixes };
  next[loot.stat] = (next[loot.stat] || 0) + loot.value;
  return next;
}
