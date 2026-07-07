export const GRID_SIZE = 22;

export const PALETTE_COLORS = [
  "#000000", "#ffffff", "#888899", "#cfd8e3",
  "#ff4444", "#aa2222", "#ff8844", "#ffcc44",
  "#44ff88", "#22aa44", "#44ccff", "#2266aa",
  "#8844ff", "#cc44ff", "#ff44aa", "#664422",
  "#333344", "#556677", "#ffee88", "#88ffee",
  "#ff6622", "#4488ff", "#aaffaa", "#ffaacc",
];

export const BEHAVIORS = {
  normal: { label: "Vanlig — flyger rakt fram" },
  sine: { label: "Vågrörelse" },
  kamikaze: { label: "Kamikaze — dyker mot spelaren" },
  turret: { label: "Stillastående kanon" },
  sniper: { label: "Prickskytt — långsam, skjuter långt" },
  spinner: { label: "Snurrande" },
  carrier: { label: "Moderskepp — skapar mindre fiender" },
};

export const WEAPONS = {
  none: { label: "Ingen bestyckning" },
  single: { label: "Enkelskott" },
  spread: { label: "Spridningsskott (3-vägs)" },
  rapid: { label: "Snabbeld" },
  homing: { label: "Målsökande robotar (kan skjutas ner)" },
};

const NON_SHOOTING_BEHAVIORS = ["kamikaze", "spinner", "carrier"];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function emptyPixels() { return new Array(GRID_SIZE * GRID_SIZE).fill(null); }

function rasterizeShape(n, drawFn) {
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, n, n);
  drawFn(ctx, n);
  const { data } = ctx.getImageData(0, 0, n, n);
  const grid = new Array(n * n).fill(null);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      if (data[i + 3] > 40) {
        grid[y * n + x] = `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      }
    }
  }
  return grid;
}

export const TEMPLATES = {
  dart: {
    label: "Jaktplan",
    build: (n, hull, accent, dark) => rasterizeShape(n, (ctx) => {
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(0, n * 0.5);
      ctx.lineTo(n * 0.55, n * 0.16);
      ctx.lineTo(n * 0.97, n * 0.32);
      ctx.lineTo(n * 0.78, n * 0.5);
      ctx.lineTo(n * 0.97, n * 0.68);
      ctx.lineTo(n * 0.55, n * 0.84);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(0, n * 0.5);
      ctx.lineTo(n * 0.32, n * 0.38);
      ctx.lineTo(n * 0.32, n * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(n * 0.55, n * 0.5, n * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }),
  },
  saucer: {
    label: "Flygande tefat",
    build: (n, hull, accent, dark) => rasterizeShape(n, (ctx) => {
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.ellipse(n * 0.5, n * 0.56, n * 0.46, n * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(n * 0.5, n * 0.38, n * 0.22, n * 0.2, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(n * 0.5, n * 0.56, n * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }),
  },
  beetle: {
    label: "Skalbagge",
    build: (n, hull, accent, dark) => rasterizeShape(n, (ctx) => {
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.ellipse(n * 0.5, n * 0.5, n * 0.42, n * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, n * 0.045);
      ctx.beginPath();
      ctx.moveTo(n * 0.5, n * 0.2);
      ctx.lineTo(n * 0.5, n * 0.8);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(n * 0.24, n * 0.5, n * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }),
  },
  orb: {
    label: "Klot / kärna",
    build: (n, hull, accent, dark) => rasterizeShape(n, (ctx) => {
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.arc(n * 0.5, n * 0.5, n * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(n * 0.5, n * 0.5, n * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(n * 0.5, n * 0.5, n * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }),
  },
  wasp: {
    label: "Geting",
    build: (n, hull, accent, dark) => rasterizeShape(n, (ctx) => {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(n * 0.42, n * 0.5);
      ctx.lineTo(n * 0.12, n * 0.08);
      ctx.lineTo(n * 0.58, n * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(n * 0.42, n * 0.5);
      ctx.lineTo(n * 0.12, n * 0.92);
      ctx.lineTo(n * 0.58, n * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.ellipse(n * 0.58, n * 0.5, n * 0.32, n * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(n * 0.88, n * 0.5, n * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }),
  },
  crystal: {
    label: "Kristall",
    build: (n, hull, accent, dark) => rasterizeShape(n, (ctx) => {
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(n * 0.5, n * 0.06);
      ctx.lineTo(n * 0.85, n * 0.5);
      ctx.lineTo(n * 0.5, n * 0.94);
      ctx.lineTo(n * 0.15, n * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(n * 0.5, n * 0.06);
      ctx.lineTo(n * 0.65, n * 0.5);
      ctx.lineTo(n * 0.5, n * 0.94);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(n * 0.5, n * 0.5, n * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }),
  },
};

export function createEmptyEnemyDef() {
  return {
    version: 1,
    name: "Ny fiende",
    pixels: emptyPixels(),
    colors: { primary: "#ff4444", accent: "#ffcc44", dark: "#331111" },
    stats: { hp: 30, speed: 150, damage: 8, radius: 16, score: 120 },
    behavior: "normal",
    weapon: "single",
  };
}

export function applyTemplate(def, templateId) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) return def;
  const { primary, accent, dark } = def.colors;
  def.pixels = tpl.build(GRID_SIZE, primary, accent, dark);
  return def;
}

export function normalizeEnemyDef(raw) {
  const base = createEmptyEnemyDef();
  const merged = { ...base, ...(raw || {}) };
  const pixels = Array.isArray(raw?.pixels) && raw.pixels.length === GRID_SIZE * GRID_SIZE
    ? raw.pixels.slice()
    : base.pixels.slice();
  const colors = { ...base.colors, ...(raw?.colors || {}) };
  const stats = { ...base.stats, ...(raw?.stats || {}) };
  stats.hp = clamp(Math.round(stats.hp) || 30, 4, 2000);
  stats.speed = clamp(Math.round(stats.speed) || 150, 0, 500);
  stats.damage = clamp(Math.round(stats.damage) || 8, 1, 200);
  stats.radius = clamp(Math.round(stats.radius) || 16, 6, 60);
  stats.score = clamp(Math.round(stats.score) || 100, 0, 20000);
  return {
    version: 1,
    id: raw?.id || `custom_${Math.random().toString(36).slice(2, 9)}`,
    name: (merged.name || "Namnlös fiende").toString().slice(0, 40),
    pixels,
    colors,
    stats,
    behavior: BEHAVIORS[merged.behavior] ? merged.behavior : "normal",
    weapon: WEAPONS[merged.weapon] ? merged.weapon : "single",
  };
}

export function rasterizeToCanvas(def, scale = 6) {
  const n = GRID_SIZE;
  const c = document.createElement("canvas");
  c.width = n * scale;
  c.height = n * scale;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const color = def.pixels[y * n + x];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

export function buildRuntimeEnemyType(def) {
  const behavior = def.behavior;
  const shoots = def.weapon !== "none" && !NON_SHOOTING_BEHAVIORS.includes(behavior);
  return {
    id: def.id,
    name: def.name,
    hp: def.stats.hp,
    speed: def.stats.speed,
    damage: def.stats.damage,
    radius: def.stats.radius,
    color: def.colors.primary,
    score: def.stats.score,
    kamikaze: behavior === "kamikaze",
    turret: behavior === "turret",
    sniper: behavior === "sniper",
    spinner: behavior === "spinner",
    carrier: behavior === "carrier",
    sine: behavior === "sine",
    shoots,
    weaponPattern: def.weapon,
    customSprite: rasterizeToCanvas(def, 6),
  };
}

export function exportEnemyToFile(rawDef) {
  const def = normalizeEnemyDef(rawDef);
  const { id, ...portable } = def;
  const blob = new Blob([JSON.stringify(portable, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (def.name || "fiende").replace(/[^a-z0-9_\-åäöÅÄÖ ]/gi, "").trim() || "fiende";
  a.href = url;
  a.download = `${safeName}.starforge-enemy.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function importEnemyFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(normalizeEnemyDef(JSON.parse(reader.result)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
