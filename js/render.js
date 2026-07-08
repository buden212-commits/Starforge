import { getBiome } from "./terrain.js";
import { POWER_SLOTS } from "./power.js";

const IRIDESCENT_COLORS = {
  volcanic: ["rgba(255,110,40,0.5)", "rgba(255,20,130,0.4)", "rgba(255,210,70,0.35)"],
  graveyard: ["rgba(130,80,210,0.4)", "rgba(60,210,190,0.32)", "rgba(190,60,200,0.3)"],
  crystal: ["rgba(60,200,255,0.45)", "rgba(190,90,255,0.35)", "rgba(90,255,210,0.32)"],
  moai: ["rgba(255,180,90,0.35)", "rgba(150,110,255,0.3)", "rgba(255,120,180,0.3)"],
};

export class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    Object.assign(this, { x, y, vx, vy, life, maxLife: life, color, size });
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    return this.life > 0;
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.shake = 0;
    this.scrollX = 0;
    this.viewH = 600;
    this.starsFar = this._stars(90, 0.12);
    this.starsNear = this._stars(55, 0.4);
    this.twinBeeBanner = 0;
    this.levelBanner = 0;
    this.levelBannerText = "";
    this.bossSprites = {};
    this._loadBossSprites();
  }

  _loadBossSprites() {
    const paths = {
      yellow_shock: { path: "assets/bosses/boss_yellow_shock.png", photo: false },
      space_slug: { path: "assets/bosses/boss_space_slug.png", photo: false },
      orange_fuzzy: { path: "assets/bosses/boss_orange_fuzzy.png", photo: false },
      three_eyed: { path: "assets/bosses/boss_three_eyed.png", photo: false },
      fire_scare: { path: "assets/bosses/boss_fire_scare.png", photo: true },
    };
    for (const [id, cfg] of Object.entries(paths)) {
      const img = new Image();
      img.onload = () => {
        this.bossSprites[id] = cfg.photo
          ? this._removePhotoBackground(img)
          : this._keyOutBackground(img);
      };
      img.onerror = () => {
        this.bossSprites[id] = null;
      };
      img.src = cfg.path;
    }
  }

  _removePhotoBackground(img) {
    try {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const w = c.width;
      const h = c.height;
      const { data } = ctx.getImageData(0, 0, w, h);
      const bg = new Uint8Array(w * h);
      const tol = 32;
      const queue = [];

      const push = (x, y, r, g, b) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (bg[idx]) return;
        const i = idx * 4;
        const dr = data[i] - r;
        const dg = data[i + 1] - g;
        const db = data[i + 2] - b;
        if (dr * dr + dg * dg + db * db > tol * tol) return;
        bg[idx] = 1;
        queue.push([x, y, data[i], data[i + 1], data[i + 2]]);
      };

      for (let x = 0; x < w; x++) {
        const t = x * 4;
        queue.push([x, 0, data[t], data[t + 1], data[t + 2]]);
        queue.push([x, h - 1, data[(h - 1) * w * 4 + t], data[(h - 1) * w * 4 + t + 1], data[(h - 1) * w * 4 + t + 2]]);
      }
      for (let y = 0; y < h; y++) {
        const i = y * w * 4;
        queue.push([0, y, data[i], data[i + 1], data[i + 2]]);
        queue.push([w - 1, y, data[i + w * 4 - 4], data[i + w * 4 - 3], data[i + w * 4 - 2]]);
      }

      while (queue.length) {
        const [x, y, r, g, b] = queue.pop();
        const idx = y * w + x;
        if (bg[idx] === 2) continue;
        bg[idx] = 2;
        push(x - 1, y, r, g, b);
        push(x + 1, y, r, g, b);
        push(x, y - 1, r, g, b);
        push(x, y + 1, r, g, b);
      }

      const cx = w * 0.48;
      const cy = h * 0.4;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const i = idx * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const bright = (r + g + b) / 3;
          const isGreen = g > r + 15 && g > b + 8 && g > 85;
          const isBrick = r > 90 && r > g * 1.12 && r > b * 1.15 && g < 125;
          const isCouch = r > 195 && g > 185 && b > 170 && bright > 195;
          const isWindow = b > r + 5 && g > r && bright > 120 && bright < 200;
          const inCore = ((x - cx) ** 2) / (w * 0.16) ** 2 + ((y - cy) ** 2) / (h * 0.24) ** 2 < 1;
          const inSubject = ((x - cx) ** 2) / (w * 0.2) ** 2 + ((y - cy) ** 2) / (h * 0.3) ** 2 < 1;
          const rightStrip = x > w * 0.68 && !inCore;

          if (rightStrip || isGreen || isBrick || isCouch || isWindow) {
            data[i + 3] = 0;
          } else if (bg[idx] && !inSubject) {
            data[i + 3] = 0;
          } else if (bright > 250) {
            data[i + 3] = 0;
          } else if (bg[idx] && bright > 195) {
            data[i + 3] = Math.round(data[i + 3] * 0.08);
          }
        }
      }

      ctx.putImageData(new ImageData(data, w, h), 0, 0);
      return this._trimTransparentCanvas(c);
    } catch {
      return this._keyOutBackground(img);
    }
  }

  _trimTransparentCanvas(src) {
    const w = src.width;
    const h = src.height;
    const ctx = src.getContext("2d");
    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 20) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX <= minX) return src;
    const pad = 4;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const tw = maxX - minX + 1;
    const th = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = tw;
    out.height = th;
    out.getContext("2d").drawImage(src, minX, minY, tw, th, 0, 0, tw, th);
    return out;
  }

  _keyOutBackground(img) {
    try {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const bright = (r + g + b) / 3;
        if (bright > 248 || (r > 230 && g > 230 && b > 230)) {
          data[i + 3] = 0;
        } else if (bright > 210 && r > 200 && g > 200 && b > 200) {
          data[i + 3] = Math.round(data[i + 3] * (1 - (bright - 210) / 38));
        }
      }
      ctx.putImageData(new ImageData(data, c.width, c.height), 0, 0);
      return c;
    } catch {
      return img;
    }
  }

  resize(w, h) { this.canvas.width = w; this.canvas.height = h; this.viewH = h; }
  _stars(n, sp) {
    return Array.from({ length: n }, () => ({
      x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5,
      sp: sp + Math.random() * 0.15, b: Math.random() * 0.5 + 0.3,
    }));
  }

  addExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random();
      const sp = 60 + Math.random() * 140;
      this.particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.35 + Math.random() * 0.2, color, 2 + Math.random() * 2));
    }
    this.shake = Math.min(this.shake + 3, 8);
  }

  showTwinBeeBanner() { this.twinBeeBanner = 3; }

  showLevelBanner(level) {
    this.levelBanner = 3.5;
    this.levelBannerText = `NIVÅ ${level} — NY SEKTOR`;
  }

  update(dt) {
    this.particles = this.particles.filter((p) => p.update(dt));
    this.shake *= 0.85;
    this.twinBeeBanner = Math.max(0, this.twinBeeBanner - dt);
    this.levelBanner = Math.max(0, this.levelBanner - dt);
  }

  beginSideScroll(scrollX, viewH, biomeOffset = 0, biomeAt = null) {
    this.scrollX = scrollX;
    this.viewH = viewH;
    this.biomeOffset = biomeOffset;
    this.biomeAt = biomeAt;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate((Math.random() - 0.5) * this.shake, 0);
    this._drawSky(ctx, scrollX, this.biomeOffset || 0);
    this._drawStars(ctx, scrollX, this.starsFar, 0.35);
    this._drawStars(ctx, scrollX, this.starsNear, 0.75);
  }

  _biome(x) {
    return this.biomeAt ? this.biomeAt(x) : getBiome(x, this.biomeOffset || 0);
  }

  endSideScroll() {
    this.ctx.restore();
    this._scanlines();
    if (this.twinBeeBanner > 0) this._drawTwinBeeBanner();
    if (this.levelBanner > 0) this._drawLevelBanner();
  }

  _drawSky(ctx, scrollX, biomeOffset = 0) {
    const w = this.canvas.width;
    const h = this.viewH;
    const biome = this._biome(scrollX + w * 0.5);
    const palettes = {
      volcanic: ["#080818", "#1a0820", "#280818"],
      graveyard: ["#060610", "#0a0a18", "#120818"],
      crystal: ["#060818", "#081028", "#0a1830"],
      moai: ["#080818", "#101028", "#181018"],
    };
    const p = palettes[biome] || palettes.volcanic;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p[0]);
    g.addColorStop(0.5, p[1]);
    g.addColorStop(1, p[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  _drawStars(ctx, scrollX, stars, alpha) {
    const w = this.canvas.width;
    const h = this.viewH;
    ctx.globalAlpha = alpha;
    for (const s of stars) {
      const px = ((s.x * 2500 - scrollX * s.sp) % (w + 200)) - 20;
      ctx.fillStyle = s.b > 0.5 ? "#aaccff" : "#fff";
      ctx.fillRect(px, s.y * h * 0.7 + 15, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  drawStageMountains(stage) {
    this.biomeOffset = stage.biomeOffset || 0;
    this.biomeAt = stage.biomeAt || this.biomeAt;
    this._drawCaveDepth(stage);
    this._drawBiomeAmbient();
    this._drawRidge(stage.topRidge, true);
    this._drawRidge(stage.bottomRidge, false);
    this.drawDecorations(stage.decorations, stage);
    this._drawGapMarkers(stage.secretGaps);
  }

  _caveHash(x, y = 0) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  _drawCaveDepth(stage) {
    const ctx = this.ctx;
    const scrollX = this.scrollX;
    const w = this.canvas.width;
    const h = this.viewH;
    const biome = getBiome(scrollX + w * 0.5, stage.biomeOffset || 0);

    // Djup tunnel — mörka lager i bakgrunden
    ctx.fillStyle = "#040608";
    ctx.fillRect(0, 0, w, h);

    const layers = [
      { sp: 0.28, alpha: 0.35, col: "#0a0c10", yOff: 0.18 },
      { sp: 0.42, alpha: 0.45, col: "#101318", yOff: 0.12 },
      { sp: 0.58, alpha: 0.55, col: "#161a22", yOff: 0.08 },
    ];
    for (const layer of layers) {
      ctx.globalAlpha = layer.alpha;
      ctx.fillStyle = layer.col;
      ctx.beginPath();
      ctx.moveTo(0, h * (layer.yOff + 0.02));
      for (let sx = 0; sx <= w + 30; sx += 14) {
        const wx = scrollX * layer.sp + sx;
        const y = h * layer.yOff + Math.sin(wx * 0.004) * 28 + Math.sin(wx * 0.011) * 14;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(w, h * 0.52);
      ctx.lineTo(0, h * 0.52);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, h * (1 - layer.yOff - 0.02));
      for (let sx = 0; sx <= w + 30; sx += 14) {
        const wx = scrollX * layer.sp + sx + 120;
        const y = h * (1 - layer.yOff) + Math.sin(wx * 0.0045 + 1) * 26 + Math.sin(wx * 0.012) * 12;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Biom-tint i fjärran
    const tint = {
      volcanic: "rgba(255, 70, 20, 0.06)",
      graveyard: "rgba(40, 35, 55, 0.08)",
      crystal: "rgba(30, 120, 180, 0.07)",
      moai: "rgba(90, 75, 55, 0.05)",
    }[biome] || "rgba(20,20,30,0.05)";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
  }

  _drawBiomeAmbient() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.viewH;
    const biome = this._biome(this.scrollX + w * 0.5);
    const t = Date.now() * 0.001;

    // Grottmörker — vignette mot kanter
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.15, w * 0.5, h * 0.5, h * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.7, "rgba(0,0,0,0.15)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Svag tunnellampa / reflektion i spelområdet
    ctx.globalAlpha = 0.07;
    const spot = ctx.createRadialGradient(w * 0.35, h * 0.5, 0, w * 0.35, h * 0.5, h * 0.55);
    spot.addColorStop(0, "#c8b898");
    spot.addColorStop(1, "transparent");
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, w, h);

    if (biome === "volcanic") {
      ctx.globalAlpha = 0.1 + Math.sin(t * 2) * 0.03;
      const g = ctx.createRadialGradient(w * 0.65, h * 0.82, 0, w * 0.65, h * 0.82, h * 0.45);
      g.addColorStop(0, "#ff3300");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (biome === "crystal") {
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 3; i++) {
        const px = ((this.scrollX * 0.15 + i * 320) % (w + 200)) - 60;
        const g = ctx.createRadialGradient(px, h * 0.4 + i * 35, 0, px, h * 0.4 + i * 35, 100);
        g.addColorStop(0, `rgba(60, 180, 220, ${0.12 + Math.sin(t + i) * 0.06})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(px - 100, 0, 200, h);
      }
    } else if (biome === "graveyard") {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "rgba(30, 28, 45, 0.5)";
      ctx.fillRect(0, h * 0.25, w, h * 0.5);
    } else if (biome === "moai") {
      ctx.globalAlpha = 0.09 + Math.sin(t * 1.5) * 0.02;
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, h * 0.6);
      g.addColorStop(0, "#ffbb66");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;

    this._drawSpiritMotes(ctx, w, h, biome, t);
  }

  _drawSpiritMotes(ctx, w, h, biome, t) {
    if (!this._motes) {
      this._motes = Array.from({ length: 22 }, () => ({
        seed: Math.random() * 1000,
        px: Math.random(),
        py: Math.random(),
        sp: 0.3 + Math.random() * 0.7,
        sz: 0.8 + Math.random() * 1.8,
      }));
    }
    const glow = {
      volcanic: "#ffaa55", graveyard: "#99ddbb", crystal: "#88ddff", moai: "#ffe0a0",
    }[biome] || "#cceeff";
    ctx.save();
    for (const m of this._motes) {
      const x = ((m.px * w + Math.sin(t * 0.3 * m.sp + m.seed) * 40) % (w + 40)) - 20;
      const y = ((m.py * h + t * 6 * m.sp + Math.cos(t * 0.4 + m.seed) * 20) % (h + 40)) - 20;
      const flick = 0.25 + Math.sin(t * 2.2 + m.seed) * 0.2;
      if (flick <= 0.05) continue;
      ctx.globalAlpha = flick;
      ctx.fillStyle = glow;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(x, y, m.sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _sample(ridge, x) {
    const step = 20;
    const i = Math.floor(x / step);
    const t = (x % step) / step;
    const a = ridge[Math.min(i, ridge.length - 1)];
    const b = ridge[Math.min(i + 1, ridge.length - 1)];
    return a.y + (b.y - a.y) * t;
  }

  _drawRidge(ridge, top) {
    const ctx = this.ctx;
    const scrollX = this.scrollX;
    const w = this.canvas.width;
    const h = this.viewH;
    const midX = scrollX + w * 0.5;
    const biome = this._biome(midX);

    const palettes = {
      volcanic: { base: ["#1a1008", "#3a2218", "#5a3828"], face: ["#6a4830", "#8a6040", "#4a3020"], accent: "#ff5522", wet: "#aa8866" },
      graveyard: { base: ["#0c0a10", "#1a1820", "#2a2830"], face: ["#3a3840", "#4a4850", "#2a2830"], accent: "#665577", wet: "#888899" },
      crystal: { base: ["#060c14", "#0e1824", "#162830"], face: ["#284048", "#386070", "#1a2830"], accent: "#44aacc", wet: "#88ccee" },
      moai: { base: ["#100c08", "#201810", "#302820"], face: ["#504838", "#685848", "#383028"], accent: "#887766", wet: "#a89880" },
    };
    const pal = palettes[biome] || palettes.moai;
    const t = Date.now() * 0.001;

    // Huvudmassa — stenfyllning
    ctx.beginPath();
    ctx.moveTo(0, top ? 0 : h);
    for (let sx = 0; sx <= w + 20; sx += 8) {
      ctx.lineTo(sx, this._sample(ridge, scrollX + sx));
    }
    ctx.lineTo(w, top ? 0 : h);
    ctx.closePath();

    const edgeY = top ? this._sample(ridge, scrollX + w * 0.5) : this._sample(ridge, scrollX + w * 0.5);
    const g = ctx.createLinearGradient(0, top ? 0 : edgeY, 0, top ? edgeY + 80 : h);
    g.addColorStop(0, pal.base[0]);
    g.addColorStop(0.35, pal.base[1]);
    g.addColorStop(0.7, pal.base[2]);
    g.addColorStop(1, pal.base[0]);
    ctx.fillStyle = g;
    ctx.fill();

    this._drawWallIridescence(ctx, ridge, top, scrollX, w, h, pal, biome, t);

    // Bergartslager / sprickor längs ytan
    for (let sx = 0; sx <= w; sx += 6) {
      const wx = scrollX + sx;
      const y = this._sample(ridge, wx);
      const n = this._caveHash(wx * 0.07, top ? 1 : 2);
      if (n > 0.62) {
        ctx.strokeStyle = `rgba(0,0,0,${0.15 + n * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, y + (top ? 4 : -4));
        ctx.lineTo(sx + 3 + n * 8, y + (top ? 12 + n * 10 : -(12 + n * 10)));
        ctx.stroke();
      }
      if (n > 0.78 && n < 0.88) {
        ctx.fillStyle = `rgba(255,255,255,${0.03 + n * 0.04})`;
        ctx.fillRect(sx, y + (top ? 2 : -3), 2, 2);
      }
    }

    // Stenstruktur — prickar och fläckar
    for (let sx = 0; sx <= w; sx += 4) {
      const wx = scrollX + sx;
      const y = this._sample(ridge, wx);
      const n = this._caveHash(wx * 0.13, top ? 3 : 4);
      if (n > 0.55) {
        const shade = pal.face[n > 0.8 ? 1 : 2];
        ctx.fillStyle = shade + (n > 0.75 ? "cc" : "66");
        const dy = top ? 3 + n * 18 : -(3 + n * 18);
        ctx.fillRect(sx, y + dy, 2 + (n * 3) | 0, 2 + (n * 2) | 0);
      }
    }

    this._drawWallVeins(ctx, ridge, top, scrollX, w, pal, t);
    this._drawWallGlints(ctx, ridge, top, scrollX, w, t);

    // Kant — ojämn stenprofil med våt highlight
    ctx.beginPath();
    for (let sx = 0; sx <= w + 20; sx += 6) {
      const y = this._sample(ridge, scrollX + sx);
      if (sx === 0) ctx.moveTo(sx, y);
      else ctx.lineTo(sx, y);
    }
    ctx.strokeStyle = pal.face[0];
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    for (let sx = 0; sx <= w + 20; sx += 6) {
      const y = this._sample(ridge, scrollX + sx);
      if (sx === 0) ctx.moveTo(sx, y + (top ? 1 : -1));
      else ctx.lineTo(sx, y + (top ? 1 : -1));
    }
    ctx.strokeStyle = pal.wet;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Inre skugga mot speltunneln
    const shadowDepth = 28;
    ctx.beginPath();
    for (let sx = 0; sx <= w + 20; sx += 10) {
      const y = this._sample(ridge, scrollX + sx);
      if (sx === 0) ctx.moveTo(sx, y);
      else ctx.lineTo(sx, y);
    }
    const edgeEnd = this._sample(ridge, scrollX + w);
    if (top) {
      ctx.lineTo(w, edgeEnd);
      ctx.lineTo(w, edgeEnd + shadowDepth);
      for (let sx = w; sx >= 0; sx -= 10) {
        ctx.lineTo(sx, this._sample(ridge, scrollX + sx) + shadowDepth);
      }
    } else {
      ctx.lineTo(w, edgeEnd);
      ctx.lineTo(w, edgeEnd - shadowDepth);
      for (let sx = w; sx >= 0; sx -= 10) {
        ctx.lineTo(sx, this._sample(ridge, scrollX + sx) - shadowDepth);
      }
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
  }

  _drawWallIridescence(ctx, ridge, top, scrollX, w, h, pal, biome, t) {
    const colors = IRIDESCENT_COLORS[biome] || IRIDESCENT_COLORS.moai;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, top ? 0 : h);
    for (let sx = 0; sx <= w + 20; sx += 12) {
      ctx.lineTo(sx, this._sample(ridge, scrollX + sx));
    }
    ctx.lineTo(w, top ? 0 : h);
    ctx.closePath();
    ctx.clip();

    // Långsamt skiftande, opalliknande färgvåg — ger väggarna en drömlik, surrealistisk lyster.
    const drift = (Math.sin(t * 0.12) + 1) * 0.5;
    const ang = t * 0.05;
    const cx = w * 0.5 + Math.cos(ang) * w * 0.4;
    const cy = h * 0.5 + Math.sin(ang * 0.7) * h * 0.4;
    const grad = ctx.createLinearGradient(cx - w, cy - h * 0.3, cx + w, cy + h * 0.3);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.35 + drift * 0.2, colors[1]);
    grad.addColorStop(1, colors[2]);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.4 + drift * 0.15;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawWallVeins(ctx, ridge, top, scrollX, w, pal, t) {
    ctx.save();
    ctx.lineWidth = 1.3;
    ctx.shadowColor = pal.accent;
    for (let sx = 0; sx <= w; sx += 22) {
      const wx = scrollX + sx;
      const n = this._caveHash(wx * 0.023, top ? 11 : 12);
      if (n < 0.72) continue;
      const glow = 0.22 + Math.sin(t * 1.6 + wx * 0.01) * 0.2;
      if (glow <= 0.08) continue;
      const y0 = this._sample(ridge, wx);
      ctx.shadowBlur = 9 * glow;
      ctx.strokeStyle = pal.accent;
      ctx.globalAlpha = glow;
      ctx.beginPath();
      ctx.moveTo(sx, y0 + (top ? 4 : -4));
      const segs = 4;
      for (let i = 1; i <= segs; i++) {
        const sxx = sx + i * 5;
        const depth = (top ? 1 : -1) * (10 + this._caveHash(wx + i, 20) * 22) * (i / segs);
        ctx.lineTo(sxx, y0 + depth);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawWallGlints(ctx, ridge, top, scrollX, w, t) {
    ctx.save();
    for (let sx = 0; sx <= w; sx += 17) {
      const wx = scrollX + sx;
      const n = this._caveHash(wx * 0.09, top ? 31 : 32);
      if (n < 0.86) continue;
      const twinkle = 0.4 + Math.sin(t * 3 + wx * 0.2) * 0.4;
      if (twinkle <= 0.1) continue;
      const y = this._sample(ridge, wx) + (top ? 1 : -1) * (4 + n * 20);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx, y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _ceilingY(stage, worldX) {
    return stage ? this._sample(stage.topRidge, worldX) : 0;
  }

  _floorY(stage, worldX) {
    return stage ? this._sample(stage.bottomRidge, worldX) : this.viewH;
  }

  _tunnelY(stage, worldX, frac = 0.5) {
    const top = this._ceilingY(stage, worldX);
    const bottom = this._floorY(stage, worldX);
    return top + (bottom - top) * frac;
  }

  drawDecorations(decs, stage) {
    const ctx = this.ctx;
    const t = Date.now() * 0.001;
    for (const d of decs) {
      const sx = d.x - this.scrollX;
      if (sx < -120 || sx > this.canvas.width + 120) continue;
      switch (d.kind) {
        case "lava": {
          const floorY = this._floorY(stage, d.x);
          ctx.fillStyle = "#ff4400";
          ctx.globalAlpha = 0.7 + Math.sin(d.x * 0.05 + t * 3) * 0.25;
          ctx.fillRect(sx, floorY - 18, d.w, d.h);
          ctx.fillStyle = "#ffaa00";
          ctx.globalAlpha = 0.4 + Math.sin(t * 4 + d.x) * 0.2;
          ctx.fillRect(sx + 4, floorY - 20, d.w - 8, 4);
          ctx.globalAlpha = 1;
          break;
        }
        case "vent":
        case "steam_vent": {
          const ceilingY = this._ceilingY(stage, d.x);
          ctx.fillStyle = "#3a3028";
          ctx.fillRect(sx, ceilingY + 2, d.w, d.h);
          ctx.fillStyle = `rgba(200, 210, 220, ${0.25 + Math.sin(t * 5 + d.x) * 0.15})`;
          ctx.fillRect(sx - 8, ceilingY - 16 - Math.sin(t * 6) * 5, d.w + 16, 20);
          break;
        }
        case "stalactite":
          this._drawStalactite(sx, this._ceilingY(stage, d.x), d.len || 24, d.crystal, d.wet);
          break;
        case "stalagmite":
          this._drawStalagmite(sx, this._floorY(stage, d.x), d.len || 20);
          break;
        case "dripstone": {
          const ceilingY = this._ceilingY(stage, d.x);
          const len = d.len || d.h || 40;
          this._drawDripstone(sx, ceilingY, len, t, d.seed || d.x);
          break;
        }
        case "moss_patch": {
          const floorY = this._floorY(stage, d.x);
          ctx.fillStyle = "#2a4a28";
          ctx.beginPath();
          ctx.ellipse(sx, floorY - 6, d.w / 2, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#3a6838";
          for (let i = 0; i < 5; i++) {
            ctx.fillRect(sx - d.w / 2 + i * 7, floorY - 9 - (i % 2) * 2, 5, 4);
          }
          break;
        }
        case "rock_column": {
          const floorY = this._floorY(stage, d.x);
          ctx.fillStyle = "#3a3428";
          ctx.fillRect(sx - 8, floorY - d.h, 16, d.h);
          ctx.fillStyle = "#5a5040";
          ctx.fillRect(sx - 10, floorY - d.h, 20, 6);
          ctx.strokeStyle = "#2a2418";
          ctx.lineWidth = 1;
          for (let ly = floorY - d.h + 10; ly < floorY; ly += 12) {
            ctx.beginPath();
            ctx.moveTo(sx - 7, ly);
            ctx.lineTo(sx + 7, ly);
            ctx.stroke();
          }
          break;
        }
        case "cave_fog":
        case "fog": {
          const fogY = this._tunnelY(stage, d.x, d.tunnelFrac ?? 0.45);
          ctx.globalAlpha = 0.14 + Math.sin(t + d.seed) * 0.05;
          ctx.fillStyle = "#889098";
          ctx.fillRect(sx, fogY - 20, d.w, 50);
          ctx.globalAlpha = 1;
          break;
        }
        case "bone_pile": {
          const floorY = this._floorY(stage, d.x);
          this._drawSkull(sx, floorY - 10, d.scale || 0.7);
          ctx.fillStyle = "#776655";
          ctx.fillRect(sx - 12, floorY - 2, 24, 6);
          break;
        }
        case "underground_pool": {
          const floorY = this._floorY(stage, d.x);
          ctx.fillStyle = "rgba(30, 80, 120, 0.55)";
          ctx.beginPath();
          ctx.ellipse(sx + d.w / 2, floorY - 6, d.w / 2, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(120, 200, 255, ${0.15 + Math.sin(t * 2 + d.seed) * 0.08})`;
          ctx.fillRect(sx + 8, floorY - 9, d.w - 16, 3);
          break;
        }
        case "ember": {
          const emberY = this._tunnelY(stage, d.x, d.tunnelFrac ?? 0.5);
          for (let i = 0; i < 4; i++) {
            const ey = emberY - ((t * 40 + d.seed + i * 20) % 50);
            ctx.globalAlpha = 0.5 - (ey - emberY + 50) * 0.01;
            ctx.fillStyle = i % 2 ? "#ffaa44" : "#ff6622";
            ctx.fillRect(sx + i * 5, ey, 3, 3);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case "skull":
          this._drawSkull(sx, d.y, d.scale || 1);
          break;
        case "ribcage":
          ctx.strokeStyle = "#665566";
          ctx.lineWidth = 2;
          for (let i = 0; i < 5; i++) ctx.strokeRect(sx + i * 14, d.y + i * 3, 12, 28 - i * 4);
          break;
        case "crystal": {
          const cy = this._tunnelY(stage, d.x, d.tunnelFrac ?? 0.45);
          ctx.fillStyle = `hsl(${d.hue || 200}, 70%, 55%)`;
          ctx.beginPath();
          ctx.moveTo(sx, cy - 20);
          ctx.lineTo(sx + 12, cy);
          ctx.lineTo(sx, cy + 22);
          ctx.lineTo(sx - 12, cy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.sin(t * 3 + d.x) * 0.15})`;
          ctx.fillRect(sx - 2, cy - 10, 4, 14);
          break;
        }
        case "crystal_spire": {
          const floorY = this._floorY(stage, d.x);
          ctx.fillStyle = `hsl(${d.hue || 200}, 80%, 60%)`;
          ctx.beginPath();
          ctx.moveTo(sx, floorY - 55);
          ctx.lineTo(sx + 10, floorY);
          ctx.lineTo(sx - 10, floorY);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = `rgba(180, 255, 255, ${0.4 + Math.sin(t * 4 + d.x) * 0.3})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        }
        case "aurora":
          ctx.globalAlpha = 0.2 + Math.sin(t * 1.5 + d.seed) * 0.1;
          const ag = ctx.createLinearGradient(sx, d.y, sx + d.w, d.y + 80);
          ag.addColorStop(0, "transparent");
          ag.addColorStop(0.5, "#44ffcc88");
          ag.addColorStop(1, "transparent");
          ctx.fillStyle = ag;
          ctx.fillRect(sx, d.y, d.w, 80);
          ctx.globalAlpha = 1;
          break;
        case "moai_statue":
          this._drawMoaiStatue(sx, d.y, d.scale || 0.7);
          break;
        case "ruin_pillar":
          ctx.fillStyle = "#504838";
          ctx.fillRect(sx, d.y, 14, d.h);
          ctx.fillStyle = "#706050";
          ctx.fillRect(sx - 4, d.y, 22, 8);
          break;
      }
    }
  }

  _drawStalactite(sx, y, len, crystal, wet) {
    const ctx = this.ctx;
    const col = crystal ? "#286878" : wet ? "#6a5848" : "#5a5040";
    const hi = crystal ? "#88ddff" : "#a89880";
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(sx - 5, y);
    ctx.lineTo(sx + 5, y);
    ctx.lineTo(sx, y + len);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(sx - 1, y + 2, 2, len * 0.35);
    ctx.globalAlpha = 1;
    if (wet || crystal) {
      ctx.fillStyle = crystal ? "rgba(100,200,255,0.6)" : "rgba(180,200,220,0.5)";
      ctx.beginPath();
      ctx.arc(sx, y + len, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawStalagmite(sx, y, len) {
    const ctx = this.ctx;
    ctx.fillStyle = "#4a4438";
    ctx.beginPath();
    ctx.moveTo(sx - 6, y);
    ctx.lineTo(sx + 6, y);
    ctx.lineTo(sx, y - len);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6a6050";
    ctx.fillRect(sx - 2, y - len * 0.6, 4, len * 0.35);
  }

  _drawDripstone(sx, ceilingY, len, t, seed) {
    const ctx = this.ctx;
    const tipY = ceilingY + len;

    ctx.fillStyle = "#5a5448";
    ctx.beginPath();
    ctx.moveTo(sx - 7, ceilingY);
    ctx.lineTo(sx + 7, ceilingY);
    ctx.lineTo(sx + 3, ceilingY + len * 0.65);
    ctx.lineTo(sx, tipY);
    ctx.lineTo(sx - 3, ceilingY + len * 0.65);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#7a7468";
    ctx.globalAlpha = 0.55;
    ctx.fillRect(sx - 1, ceilingY + 3, 2, len * 0.45);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#3a3428";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 5, ceilingY + 2);
    ctx.lineTo(sx, tipY - 2);
    ctx.stroke();

    // Litet dropp faller från spetsen — rör inte själva stenen
    const cycle = ((t * 0.8 + seed * 0.002) % 2.4) / 2.4;
    if (cycle > 0.75) {
      const fall = (cycle - 0.75) / 0.25;
      const dropY = tipY + 2 + fall * 14;
      ctx.fillStyle = `rgba(160, 190, 210, ${0.55 * (1 - fall)})`;
      ctx.beginPath();
      ctx.arc(sx, dropY, 2 - fall * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(180, 200, 220, 0.35)";
    ctx.beginPath();
    ctx.arc(sx, tipY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawGapMarkers(gaps) {
    const ctx = this.ctx;
    let passed = 0;
    for (const g of gaps) {
      const sx = g.x - this.scrollX;
      if (sx < -100 || sx > this.canvas.width + 100) continue;
      if (!g.passed) {
        ctx.strokeStyle = "#ffff0066";
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(sx, g.y, g.w, g.h);
        ctx.setLineDash([]);
      }
      if (g.passed) passed++;
      ctx.fillStyle = g.passed ? "#44ff88" : "#ffaa0044";
      ctx.fillRect(sx + g.w / 2 - 4, g.y - 16, 8, 8);
    }
    if (gaps.length) {
      ctx.fillStyle = "#ffcc44";
      ctx.font = "10px monospace";
      ctx.fillText(`GAP ${passed}/${gaps.length}`, 12, 32);
    }
  }

  _drawSkull(sx, y, sc) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(sc, sc);
    ctx.fillStyle = "#887788";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#221122";
    ctx.fillRect(-10, -4, 7, 8);
    ctx.fillRect(3, -4, 7, 8);
    ctx.fillRect(-6, 10, 4, 6);
    ctx.fillRect(2, 10, 4, 6);
    ctx.restore();
  }

  _drawMoaiStatue(sx, y, sc) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(sc, sc);
    ctx.fillStyle = "#605040";
    ctx.fillRect(-12, -35, 24, 35);
    ctx.fillRect(-18, -30, 36, 18);
    ctx.fillStyle = "#403828";
    ctx.fillRect(-8, -22, 5, 5);
    ctx.fillRect(3, -22, 5, 5);
    ctx.restore();
  }

  drawFloatingRock(obs) {
    const sx = obs.x - this.scrollX;
    if (sx < -60 || sx > this.canvas.width + 60) return;
    const ctx = this.ctx;
    const biome = obs.kind || "moai";
    const cols = {
      volcanic: { fill: "#4a3020", edge: "#6a4830", hi: "#8a6040" },
      graveyard: { fill: "#3a3840", edge: "#4a4850", hi: "#5a5860" },
      crystal: { fill: "#284858", edge: "#386878", hi: "#58a8c8" },
      moai: { fill: "#484038", edge: "#605848", hi: "#807868" },
    };
    const c = cols[biome] || cols.moai;
    const cx = sx + obs.w / 2;
    const cy = obs.y + obs.h / 2;
    ctx.fillStyle = c.fill;
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 4, cy - obs.h * 0.4);
    ctx.lineTo(sx + obs.w - 6, cy - obs.h * 0.25);
    ctx.lineTo(sx + obs.w - 2, cy + obs.h * 0.35);
    ctx.lineTo(sx + obs.w * 0.3, cy + obs.h * 0.42);
    ctx.lineTo(sx + 2, cy + obs.h * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.hi + "88";
    ctx.fillRect(sx + obs.w * 0.25, cy - obs.h * 0.15, obs.w * 0.35, 4);
  }

  drawShip(player) {
    if (player.twinBeeMode || player.twinBeeSecret) {
      this.drawTwinBee(player.x, player.y, player.invuln > 0, player.options);
    } else {
      this.drawOrbiter(player.x, player.y, player.invuln > 0, player.options);
    }
  }

  drawOrbiter(x, y, blink, options = []) {
    const sx = x - this.scrollX;
    if (sx < -100 || sx > this.canvas.width + 100) return;
    if (blink && Math.floor(Date.now() / 80) % 2 === 0) return;
    for (const opt of options) {
      this._drawOrbiterBody(sx - 16, y + opt.offset, 0.72, true);
    }
    this._drawOrbiterBody(sx, y, 1, false);
    this._drawEngineGlow(sx - 24, y);
  }

  _drawOrbiterBody(sx, y, scale, isOption) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(scale, scale);

    const white = isOption ? "#99aabb" : "#eef2f6";
    const black = isOption ? "#222830" : "#141820";
    const orange = "#c85a1a";

    // Yttre tank (orange, under buken)
    ctx.fillStyle = isOption ? "#8a4020" : orange;
    ctx.beginPath();
    ctx.ellipse(-4, 5, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff8833";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Svart undersida ( värmeskydd )
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.moveTo(-22, 2);
    ctx.lineTo(18, 8);
    ctx.lineTo(18, 14);
    ctx.lineTo(-22, 10);
    ctx.closePath();
    ctx.fill();

    // Vit flygkropp
    ctx.fillStyle = white;
    ctx.strokeStyle = "#8899aa";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, -2);
    ctx.lineTo(8, -4);
    ctx.lineTo(-10, -6);
    ctx.lineTo(-20, -2);
    ctx.lineTo(-22, 0);
    ctx.lineTo(-20, 2);
    ctx.lineTo(-10, 6);
    ctx.lineTo(8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Delta-vinge
    ctx.fillStyle = isOption ? "#778899" : "#dde4ec";
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(-14, 14);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -4);
    ctx.lineTo(-14, -14);
    ctx.lineTo(-8, -6);
    ctx.closePath();
    ctx.fill();

    // Stabilator
    ctx.fillStyle = white;
    ctx.fillRect(-18, -12, 10, 4);
    ctx.strokeRect(-18, -12, 10, 4);

    // Cockpit
    ctx.fillStyle = "#1a2840";
    ctx.fillRect(10, -3, 8, 6);
    ctx.fillStyle = "#4488cc";
    ctx.globalAlpha = 0.6;
    ctx.fillRect(11, -2, 3, 4);
    ctx.globalAlpha = 1;

    // Booster (vit cylinder sidovis)
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(-20, -5, 6, 10);
    ctx.strokeStyle = "#aaa";
    ctx.strokeRect(-20, -5, 6, 10);

    // Motorblock
    ctx.fillStyle = "#333";
    ctx.fillRect(-24, -4, 4, 3);
    ctx.fillRect(-24, 1, 4, 3);
    ctx.fillRect(-26, -1, 3, 2);

    // Markering
    if (!isOption) {
      ctx.fillStyle = "#224488";
      ctx.font = "bold 5px monospace";
      ctx.fillText("SF", -8, -8);
    }

    ctx.restore();
  }

  _drawEngineGlow(sx, y) {
    const ctx = this.ctx;
    const flicker = 0.7 + Math.random() * 0.3;
    const grad = ctx.createRadialGradient(sx, y, 0, sx, y, 14 * flicker);
    grad.addColorStop(0, "rgba(255,200,80,0.9)");
    grad.addColorStop(0.4, "rgba(255,120,40,0.5)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(sx - 16, y - 10, 20, 20);
    ctx.fillStyle = "#ffaa44";
    ctx.fillRect(sx - 2, y - 2, 4, 4);
  }

  drawTwinBee(x, y, blink, options = []) {
    const sx = x - this.scrollX;
    if (sx < -80 || sx > this.canvas.width + 80) return;
    if (blink && Math.floor(Date.now() / 80) % 2 === 0) return;
    for (const opt of options) this._drawTwinBeeBody(sx - 14, y + opt.offset, 0.72);
    this._drawTwinBeeBody(sx, y, 1);
    const ctx = this.ctx;
    ctx.fillStyle = "#88ccff";
    ctx.globalAlpha = 0.45;
    ctx.fillRect(sx - 20, y - 2, 10, 4);
    ctx.globalAlpha = 1;
  }

  _drawTwinBeeBody(sx, y, scale) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "#3388dd";
    ctx.strokeStyle = "#1155aa";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(2, 0, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ff5588";
    ctx.beginPath();
    ctx.arc(12, -7, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(13, -8, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffcc22";
    ctx.fillRect(-18, -4, 6, 8);
    ctx.fillStyle = "#ff8800";
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-22, -2, 5, 4);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#2266aa";
    ctx.fillRect(-6, -9, 8, 4);
    ctx.fillRect(-6, 5, 8, 4);
    ctx.restore();
  }

  drawGradiusEnemy(e) {
    const sx = e.x - this.scrollX;
    if (sx < -50 || sx > this.canvas.width + 50) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(sx, e.y);
    if (e.customSprite) {
      this._drawCustomEnemySprite(ctx, e);
      ctx.restore();
      return;
    }
    if (e.kamikaze && e.facingAngle !== undefined) ctx.rotate(e.facingAngle);
    const s = e.sprite || e.type;
    const draw = {
      dart: () => this._shipDart(ctx, e),
      fighter: () => this._shipFighter(ctx, e),
      interceptor: () => this._shipInterceptor(ctx, e),
      destroyer: () => this._shipDestroyer(ctx, e),
      pod: () => this._shipPod(ctx, e),
      beetle: () => this._shipBeetle(ctx, e),
      kamikaze: () => this._shipKamikaze(ctx, e),
      turret: () => this._shipTurret(ctx, e),
      sniper: () => this._shipSniper(ctx, e),
      carrier: () => this._shipCarrier(ctx, e),
      spinner: () => this._shipSpinner(ctx, e),
      rin: () => this._shipRin(ctx, e),
    };
    (draw[s] || draw.dart)();
    ctx.restore();
  }

  _drawCustomEnemySprite(ctx, e) {
    const size = e.radius * 2.3;
    if (e.spinner) ctx.rotate(e.spinAngle || 0);
    const wasSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(e.customSprite, -size / 2, -size / 2, size, size);
    ctx.imageSmoothingEnabled = wasSmooth;
  }
  _shipDart(ctx, e) {
    this._drawSmallCraft(ctx, e, { hull: "#aab4c0", accent: "#6688aa", wing: "#8899aa" });
  }
  _shipFighter(ctx, e) {
    this._drawSmallCraft(ctx, e, { hull: "#cc3333", accent: "#ff5555", wing: "#992222", hostile: true });
  }
  _shipInterceptor(ctx, e) {
    this._drawSmallCraft(ctx, e, { hull: "#2266bb", accent: "#44aaee", wing: "#114488", hostile: true });
  }
  _shipDestroyer(ctx, e) {
    this._drawFreighter(ctx, e, 0.75, false);
  }
  _shipPod(ctx, e) {
    ctx.fillStyle = "#998866";
    ctx.strokeStyle = "#665544";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffaa44";
    ctx.fillRect(-6, -2, 4, 4);
  }
  _shipBeetle(ctx, e) {
    this._drawFreighter(ctx, e, 0.9, true);
  }
  _shipKamikaze(ctx, e) {
    ctx.fillStyle = "#882244";
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(8, -5);
    ctx.lineTo(14, 0);
    ctx.lineTo(8, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff4488";
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-6, -3);
    ctx.lineTo(-6, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffaa00";
    ctx.fillRect(-16, -2, 4, 4);
  }
  _shipTurret(ctx, e) {
    this._drawFreighterModule(ctx, 16);
    ctx.fillStyle = "#553366";
    ctx.beginPath();
    ctx.arc(0, -10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff66aa";
    ctx.fillRect(-18, -11, 16, 4);
  }
  _shipSniper(ctx, e) {
    this._drawSmallCraft(ctx, e, { hull: "#335555", accent: "#44ccaa", wing: "#224444", hostile: true });
    ctx.fillStyle = "#44ffcc";
    ctx.fillRect(-18, -2, 22, 4);
    ctx.fillStyle = "#226655";
    ctx.fillRect(-20, -3, 6, 6);
  }
  _shipCarrier(ctx, e) {
    this._drawFreighter(ctx, e, 1.15, false);
    ctx.fillStyle = "#556677";
    ctx.beginPath();
    ctx.ellipse(4, -14, 6, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8899aa";
    ctx.stroke();
  }
  _shipSpinner(ctx, e) {
    ctx.save();
    ctx.rotate(e.spinAngle || 0);
    ctx.fillStyle = "#aa8833";
    ctx.strokeStyle = "#ffcc44";
    ctx.lineWidth = 1;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.fillStyle = "#ff8800";
    ctx.fillRect(-2, -10, 4, 20);
    ctx.fillRect(-10, -2, 20, 4);
    ctx.restore();
  }
  _shipRin(ctx, e) {
    this._drawSmallCraft(ctx, e, { hull: "#6633aa", accent: "#aa66ff", wing: "#442266", hostile: true });
    ctx.strokeStyle = "#ccaaff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-10, 0);
    ctx.stroke();
  }

  /** Liten jaktplan — sidovy, nos åt vänster (fiende) */
  _drawSmallCraft(ctx, e, pal) {
    const s = e.radius / 14;
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = pal.hull;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(6, -7);
    ctx.lineTo(10, 0);
    ctx.lineTo(6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.wing;
    ctx.fillRect(-2, -10, 8, 4);
    ctx.fillRect(-2, 6, 8, 4);
    if (pal.hostile) {
      ctx.fillStyle = "#ff2244";
      ctx.fillRect(-10, -1, 5, 2);
    }
    ctx.fillStyle = "#111";
    ctx.fillRect(4, -2, 4, 4);
    ctx.restore();
  }

  /** Industriell fraktfartyg — inspirerad av Corellian corvette */
  _drawFreighter(ctx, e, scaleMult, armored) {
    const s = (e.radius / 22) * scaleMult;
    ctx.save();
    ctx.scale(s, s);

    const hull = armored ? "#555566" : "#707880";
    const panel = armored ? "#444455" : "#5a626a";
    const dark = "#333840";

    // Motorstrutsar + naceller
    ctx.fillStyle = dark;
    ctx.fillRect(12, -16, 8, 6);
    ctx.fillRect(12, 10, 8, 6);
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.ellipse(20, -13, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(20, 13, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff6633";
    ctx.globalAlpha = 0.6;
    ctx.fillRect(22, -14, 3, 2);
    ctx.fillRect(22, 12, 3, 2);
    ctx.globalAlpha = 1;

    // Huvudskrov
    ctx.fillStyle = hull;
    ctx.strokeStyle = "#99a3ad";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-20, -8);
    ctx.lineTo(10, -10);
    ctx.lineTo(14, -6);
    ctx.lineTo(14, 6);
    ctx.lineTo(10, 10);
    ctx.lineTo(-20, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Greeble-paneler
    ctx.fillStyle = panel;
    ctx.fillRect(-14, -5, 10, 4);
    ctx.fillRect(-14, 1, 10, 4);
    ctx.fillRect(-4, -3, 8, 6);
    ctx.strokeStyle = "#667080";
    ctx.strokeRect(-14, -5, 10, 4);
    ctx.strokeRect(-4, -3, 8, 6);

    // Cockpit / brygga
    ctx.fillStyle = "#1a2030";
    ctx.fillRect(-18, -3, 5, 6);
    ctx.fillStyle = "#4488cc";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-17, -2, 3, 4);
    ctx.globalAlpha = 1;

    // Sidovapen
    ctx.fillStyle = "#444";
    ctx.fillRect(-8, -12, 10, 3);
    ctx.fillRect(-8, 9, 10, 3);

    // Rör på rygg
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(6, -8);
    ctx.stroke();

    if (armored) {
      ctx.fillStyle = "#666677";
      ctx.fillRect(-6, -14, 14, 3);
      ctx.fillRect(-6, 11, 14, 3);
    }

    ctx.restore();
  }

  _drawFreighterModule(ctx, r) {
    ctx.fillStyle = "#606870";
    ctx.fillRect(-r, -6, r * 2, 12);
    ctx.strokeStyle = "#889098";
    ctx.strokeRect(-r, -6, r * 2, 12);
    ctx.fillStyle = "#404850";
    ctx.fillRect(-r + 3, -3, r - 4, 6);
  }

  drawBoss(boss) {
    if (boss.variant === "hive" || boss.type === "hive_entity") {
      this.drawHiveBoss(boss);
      return;
    }
    this.drawSpriteBoss(boss);
  }

  drawSpriteBoss(boss) {
    const ctx = this.ctx;
    const sx = boss.x - this.scrollX;
    const e = boss.emerge || 0;
    if (e < 0.02 || sx < -220 || sx > this.canvas.width + 220) return;

    const img = this.bossSprites[boss.variant];
    const isPhoto = boss.variant === "fire_scare";
    const baseScale = (0.42 + e * 0.48) * (boss.radius / (isPhoto ? 46 : 52));
    const drawW = (isPhoto ? 130 : 150) * baseScale;
    const drawH = (isPhoto ? 175 : 150) * baseScale;
    const cy = boss.y;

    ctx.save();
    if (isPhoto && boss.tilt) {
      ctx.translate(sx, cy);
      ctx.rotate(boss.tilt);
      ctx.translate(-sx, -cy);
    }
    const aura = ctx.createRadialGradient(sx, cy - 10, 0, sx, cy - 10, drawW * 0.75);
    aura.addColorStop(0, `${boss.color}44`);
    aura.addColorStop(1, "transparent");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(sx, cy - 10, drawW * 0.7, 0, Math.PI * 2);
    ctx.fill();

    if (boss.attackFlash > 0) {
      ctx.globalAlpha = boss.attackFlash * 0.35;
      ctx.strokeStyle = boss.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(sx, cy, drawW * 0.42, drawH * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const ready = img && (img.complete || img.width > 0) && (img.naturalWidth > 0 || img.width > 0);
    if (ready) {
      ctx.drawImage(img, sx - drawW / 2, cy - drawH * 0.58, drawW, drawH);
      if (isPhoto) {
        this._drawScareFingers(ctx, sx, cy, drawW, drawH, boss.handPhase || boss.animPhase || 0, boss.attackFlash || 0);
      }
    } else {
      ctx.fillStyle = boss.color;
      ctx.strokeStyle = "#aaccff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, cy, drawW * 0.35, drawH * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    if (e > 0.45) {
      const pct = boss.hp / boss.maxHp;
      const barY = cy - drawH * 0.62 - 18;
      ctx.fillStyle = "#1a0810";
      ctx.fillRect(sx - 60, barY, 120, 8);
      ctx.fillStyle = boss.phase >= 3 ? "#ff2244" : boss.phase >= 2 ? "#ff6688" : boss.color;
      ctx.fillRect(sx - 60, barY, 120 * pct, 8);
      ctx.fillStyle = "#ffddaa";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(boss.name.toUpperCase(), sx, barY - 6);
    }
  }

  _drawScareFingers(ctx, sx, cy, w, h, t, attackFlash) {
    const flapL = Math.sin(t * 1.2) * 0.18;
    const flapR = Math.sin(t * 1.2 + 1.4) * 0.18;
    const hands = [
      { x: sx - w * 0.33, y: cy - h * 0.26, dir: -1, flap: flapL },
      { x: sx + w * 0.33, y: cy - h * 0.26, dir: 1, flap: flapR },
    ];
    ctx.lineCap = "round";
    for (const hand of hands) {
      for (let i = 0; i < 5; i++) {
        const spread = (i - 2) * 0.13 + hand.flap * (i % 2 === 0 ? 1 : -1);
        const len = h * 0.1 + Math.sin(t + i) * 3;
        const fx = hand.x + Math.sin(spread) * len * hand.dir * 0.6;
        const fy = hand.y - Math.cos(spread) * len;
        ctx.strokeStyle = attackFlash > 0 ? "#ffaa44" : "rgba(255,210,170,0.9)";
        ctx.lineWidth = attackFlash > 0 ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(hand.x, hand.y);
        ctx.lineTo(fx, fy);
        ctx.stroke();
        if (attackFlash > 0 && i === 2) {
          ctx.fillStyle = "#ff6600";
          ctx.beginPath();
          ctx.arc(fx, fy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawGroundCannon(c) {
    const sx = c.x - this.scrollX;
    if (sx < -80 || sx > this.canvas.width + 80) return;
    const ctx = this.ctx;
    const t = c.animPhase || 0;
    const pct = c.hp / c.maxHp;
    const maxCd = c.fireCooldownMax || 2.5;
    const charge = c.fireCooldown > 0 ? 1 - c.fireCooldown / maxCd : 1;
    const firing = charge > 0.92;
    const cx = sx + c.w / 2;
    const baseY = c.side === "top" ? c.y + c.h : c.y;
    const mountDir = c.side === "top" ? 1 : -1;

    ctx.save();
    ctx.translate(cx, baseY);

    // Skugga på terrängen
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, mountDir * 2, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Betongplatta / fundament
    const platGrad = ctx.createLinearGradient(-24, 0, 24, mountDir * 14);
    platGrad.addColorStop(0, "#3a4555");
    platGrad.addColorStop(0.5, "#556677");
    platGrad.addColorStop(1, "#2a3340");
    ctx.fillStyle = platGrad;
    ctx.fillRect(-26, mountDir > 0 ? 0 : -12, 52, 12);
    ctx.strokeStyle = "#8899aa";
    ctx.lineWidth = 1;
    ctx.strokeRect(-26, mountDir > 0 ? 0 : -12, 52, 12);

    // Varningsränder
    ctx.fillStyle = "#ccaa22";
    for (let i = -20; i <= 16; i += 8) {
      ctx.fillRect(i, mountDir > 0 ? 2 : -10, 4, 4);
    }

    // Bultar på plattan
    ctx.fillStyle = "#778899";
    [[-20, 4], [20, 4], [-20, -8], [20, -8]].forEach(([bx, by]) => {
      const py = mountDir > 0 ? by : by - 4;
      ctx.beginPath();
      ctx.arc(bx, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#445566";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // Turrett-kropp (roterande plattform)
    const bodyY = mountDir > 0 ? -18 : 6;
    ctx.translate(0, bodyY);

    const bodyGrad = ctx.createRadialGradient(-4, -6, 2, 0, 0, 22);
    bodyGrad.addColorStop(0, "#8899bb");
    bodyGrad.addColorStop(0.6, "#445566");
    bodyGrad.addColorStop(1, "#2a3344");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-18, 4);
    ctx.lineTo(-14, -14);
    ctx.lineTo(14, -14);
    ctx.lineTo(18, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#aabbcc";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sidopaneler
    ctx.fillStyle = "#334455";
    ctx.fillRect(-16, -10, 6, 12);
    ctx.fillRect(10, -10, 6, 12);
    ctx.strokeStyle = "#556677";
    ctx.strokeRect(-16, -10, 6, 12);
    ctx.strokeRect(10, -10, 6, 12);

    // Energiring (pulserande)
    const ringPulse = 0.5 + Math.sin(t * 4) * 0.3 + charge * 0.4;
    ctx.strokeStyle = firing ? `rgba(102,238,255,${ringPulse})` : `rgba(80,180,220,${ringPulse * 0.5})`;
    ctx.lineWidth = firing ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, -4, 10 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // Laserkanon — två lopp
    const barrelAngle = c.side === "top" ? -0.65 : 0.65;
    const recoil = firing ? -3 : Math.sin(t * 8) * 0.5;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(barrelAngle + side * 0.08);
      const barrelGrad = ctx.createLinearGradient(0, -3, 26 + recoil, 3);
      barrelGrad.addColorStop(0, "#667788");
      barrelGrad.addColorStop(0.5, "#99aabb");
      barrelGrad.addColorStop(1, "#445566");
      ctx.fillStyle = barrelGrad;
      ctx.fillRect(4, -3 + side, 22 + recoil, 6);
      ctx.strokeStyle = "#ccddee";
      ctx.lineWidth = 1;
      ctx.strokeRect(4, -3 + side, 22 + recoil, 6);

      // Kylflänsar
      ctx.strokeStyle = "#556677";
      for (let f = 8; f < 22; f += 4) {
        ctx.beginPath();
        ctx.moveTo(f, -3 + side);
        ctx.lineTo(f, 3 + side);
        ctx.stroke();
      }

      // Mynning
      const mx = 26 + recoil;
      const my = side;
      ctx.fillStyle = "#223344";
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();

      const glow = firing ? 1 : charge * 0.6;
      ctx.fillStyle = `rgba(102,238,255,${0.3 + glow * 0.7})`;
      ctx.shadowColor = "#66eeff";
      ctx.shadowBlur = firing ? 14 : 6 + charge * 6;
      ctx.beginPath();
      ctx.arc(mx, my, 2 + glow * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Antenn / sensor
    ctx.strokeStyle = "#8899aa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -22);
    ctx.stroke();
    ctx.fillStyle = firing ? "#ff4444" : "#44ff88";
    ctx.beginPath();
    ctx.arc(0, -23, 2.5 + Math.sin(t * 10) * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Skador vid låg HP
    if (pct < 0.5) {
      ctx.strokeStyle = `rgba(255,100,40,${0.4 + Math.sin(t * 12) * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(-2, 0);
      ctx.moveTo(6, -8);
      ctx.lineTo(10, -2);
      ctx.stroke();
    }

    ctx.restore();

    // HP-bar ovanför
    const barY = c.side === "top" ? c.y - 14 : c.y + c.h + 6;
    ctx.fillStyle = "rgba(10,20,30,0.85)";
    ctx.fillRect(sx, barY, c.w, 5);
    ctx.fillStyle = pct > 0.4 ? "#44ffaa" : "#ff6644";
    ctx.fillRect(sx + 1, barY + 1, (c.w - 2) * pct, 3);
    ctx.strokeStyle = "#668899";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, barY, c.w, 5);
  }

  drawHiveBoss(boss) {
    const ctx = this.ctx;
    const sx = boss.x - this.scrollX;
    const e = boss.emerge || 0;
    if (e < 0.02 || sx < -220 || sx > this.canvas.width + 220) return;

    const scale = 0.42 + e * 0.58;
    const tPhase = boss.tentaclePhase || 0;

    ctx.save();
    ctx.translate(sx, boss.y);
    ctx.scale(scale, scale);

    // Atmosfär / bio-glow
    const aura = ctx.createRadialGradient(0, -10, 0, 0, -10, 95);
    aura.addColorStop(0, "rgba(80, 20, 40, 0.45)");
    aura.addColorStop(0.5, "rgba(40, 10, 30, 0.2)");
    aura.addColorStop(1, "transparent");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -10, 95, 0, Math.PI * 2);
    ctx.fill();

    // Tentaklar (8 st, segmenterade)
    const tentacleDefs = [
      { a: Math.PI - 1.3, len: 78, w: 12 },
      { a: Math.PI - 0.85, len: 70, w: 11 },
      { a: Math.PI - 0.45, len: 62, w: 10 },
      { a: Math.PI - 0.1, len: 55, w: 9 },
      { a: Math.PI + 0.1, len: 55, w: 9 },
      { a: Math.PI + 0.45, len: 62, w: 10 },
      { a: Math.PI + 0.85, len: 70, w: 11 },
      { a: Math.PI + 1.3, len: 78, w: 12 },
    ];

    for (let i = 0; i < tentacleDefs.length; i++) {
      const td = tentacleDefs[i];
      const wave = Math.sin(tPhase + i * 0.7) * 0.1;
      const angle = td.a + wave;
      this._drawTentacle(ctx, angle, td.len, td.w, i, tPhase);
    }

    // Huvud — köttig massa
    const headGrad = ctx.createRadialGradient(-5, -20, 5, 0, -15, 50);
    headGrad.addColorStop(0, "#c87868");
    headGrad.addColorStop(0.45, "#8a4038");
    headGrad.addColorStop(1, "#4a2018");
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, -18, 38, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hudveck
    ctx.strokeStyle = "rgba(60, 20, 15, 0.5)";
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-20, -28 + i * 8);
      ctx.quadraticCurveTo(0, -22 + i * 8, 20, -28 + i * 8);
      ctx.stroke();
    }

    // Horn
    ctx.fillStyle = "#5a3028";
    ctx.beginPath();
    ctx.moveTo(-28, -48);
    ctx.lineTo(-22, -62);
    ctx.lineTo(-16, -48);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, -48);
    ctx.lineTo(22, -62);
    ctx.lineTo(28, -48);
    ctx.closePath();
    ctx.fill();

    // Ögon — neonblå glöd
    const eyePulse = 0.85 + Math.sin((boss.animPhase || 0) * 8) * 0.2;
    const eyeOffset = Math.sin((boss.animPhase || 0) * 3) * 2;
    for (const ex of [-14, 10]) {
      ctx.shadowColor = "#44ccff";
      ctx.shadowBlur = 18 * eyePulse;
      ctx.fillStyle = "#66ddff";
      ctx.beginPath();
      ctx.ellipse(ex + eyeOffset, -28, 10 * eyePulse, 14 * eyePulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#aaeeff";
      ctx.beginPath();
      ctx.ellipse(ex + eyeOffset, -28, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mun
    ctx.fillStyle = "#2a0810";
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6a2830";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tänder / nitade kanter
    ctx.fillStyle = "#888890";
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(i * 4 - 1, -6, 3, 4);
      ctx.fillRect(i * 4 - 1, 8, 3, 4);
    }

    // Inner mouth glow (fas 3)
    if (boss.phase >= 3) {
      ctx.fillStyle = "rgba(255, 40, 60, 0.35)";
      ctx.beginPath();
      ctx.ellipse(0, 2, 10, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // HP-bar
    if (e > 0.45) {
      const pct = boss.hp / boss.maxHp;
      const barY = boss.y - (55 + 40 * e) * scale;
      ctx.fillStyle = "#1a0810";
      ctx.fillRect(sx - 60, barY, 120, 8);
      ctx.fillStyle = boss.phase >= 3 ? "#ff2244" : boss.phase >= 2 ? "#ff6688" : "#44ccff";
      ctx.fillRect(sx - 60, barY, 120 * pct, 8);
      ctx.fillStyle = "#cc8888";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("HIVE OVERMIND", sx, barY - 6);
    }
  }

  _drawTentacle(ctx, angle, length, width, index, tPhase) {
    const segments = 6;
    ctx.strokeStyle = index % 2 === 0 ? "#3a4a38" : "#4a5a42";
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const wobble = Math.sin(tPhase + s + index) * 5;
      const px = Math.cos(angle) * length * t + wobble * Math.cos(angle + Math.PI * 0.5);
      const py = -8 + Math.sin(angle) * length * t + wobble * Math.sin(angle + Math.PI * 0.5);
      ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(90, 110, 75, 0.35)";
    ctx.lineWidth = 2;
    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      const px = Math.cos(angle) * length * t;
      const py = -8 + Math.sin(angle) * length * t;
      ctx.beginPath();
      ctx.moveTo(px - 5, py);
      ctx.lineTo(px + 5, py);
      ctx.stroke();
    }
  }

  drawGradiusBullet(p) {
    const sx = p.x - this.scrollX;
    if (sx < -20 || sx > this.canvas.width + 20) return;
    const ctx = this.ctx;
    if (p.owner === "player") {
      const isLaser = p.color === "#66eeff";
      if (isLaser) {
        ctx.fillStyle = p.color || "#66eeff";
        ctx.shadowColor = "#66eeff";
        ctx.shadowBlur = 8;
        ctx.fillRect(sx - 6, p.y - 3, 22, 6);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.fillRect(sx + 12, p.y - 1, 6, 2);
      } else {
        ctx.fillStyle = p.color || "#ffaa00";
        ctx.fillRect(sx - 4, p.y - 2, 12, 4);
        ctx.fillStyle = "#fff";
        ctx.fillRect(sx + 6, p.y - 1, 4, 2);
      }
    } else if (p.robot) {
      this._drawHomingRobot(ctx, sx, p);
    } else {
      const isFire = p.color === "#ff4400" || p.color === "#ff8800" || p.color === "#ffcc00";
      if (isFire) {
        ctx.fillStyle = p.color;
        ctx.shadowColor = "#ff6600";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sx, p.y, p.radius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffff88";
        ctx.beginPath();
        ctx.arc(sx, p.y, Math.max(2, p.radius - 1), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color || "#ff66cc";
        ctx.beginPath();
        ctx.arc(sx, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawHomingRobot(ctx, sx, p) {
    const t = Date.now() * 0.001;
    const angle = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(sx, p.y);
    ctx.rotate(angle);

    // Rökslinga/thruster bakom roboten
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ff8844";
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-6 - 8 - Math.sin(t * 30) * 2, -3);
    ctx.lineTo(-6 - 8 - Math.sin(t * 30) * 2, 3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Metallisk kropp
    ctx.fillStyle = "#8899aa";
    ctx.strokeStyle = "#334455";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(2, -5);
    ctx.lineTo(-6, -4);
    ctx.lineTo(-6, 4);
    ctx.lineTo(2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Blinkande målsökarljus
    const blink = 0.5 + Math.sin(t * 10) * 0.5;
    ctx.fillStyle = `rgba(255,60,60,${0.5 + blink * 0.5})`;
    ctx.shadowColor = "#ff3333";
    ctx.shadowBlur = 6 * blink;
    ctx.beginPath();
    ctx.arc(3, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawEmpRing(p) {
    const sx = p.x - this.scrollX;
    const ctx = this.ctx;
    ctx.globalAlpha = 0.4 * (p.life / 0.35);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, p.y, p.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawPowerCapsule(c) {
    const sx = c.x - this.scrollX;
    const y = c.y + Math.sin(c.bob) * 4;
    const ctx = this.ctx;
    const isEnergy = c.kind === "energy";

    if (isEnergy) {
      const pulse = 0.65 + Math.sin(c.bob * 2) * 0.35;
      ctx.fillStyle = "#003366";
      ctx.strokeStyle = "#66eeff";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#66eeff";
      ctx.shadowBlur = 8 * pulse;
      ctx.beginPath();
      ctx.arc(sx, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#aaffff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("MP", sx, y + 3);
      return;
    }

    ctx.fillStyle = "#ff2200";
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffff00";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", sx, y + 4);
  }

  drawBell(c) {
    const sx = c.x - this.scrollX;
    const y = c.y + Math.sin(c.bob) * 5;
    const ctx = this.ctx;
    ctx.fillStyle = c.color || "#4488ff";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffcc44";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("B", sx, y + 4);
  }

  drawParticlesWorld() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - this.scrollX, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawGradiusHUD(player, score, scrollX, bossZoneX, boss = null, level = 1) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (player.powerMessageTimer > 0) {
      const alpha = Math.min(1, player.powerMessageTimer);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(0, 20, 40, 0.75)";
      ctx.fillRect(w / 2 - 180, 36, 360, 34);
      ctx.strokeStyle = "#00ffcc";
      ctx.lineWidth = 2;
      ctx.strokeRect(w / 2 - 180, 36, 360, 34);
      ctx.fillStyle = "#00ffcc";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(player.powerMessage, w / 2, 58);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, h - 40, w, 40);
    ctx.strokeStyle = "#ff8800";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, h - 40, w, 40);

    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#88ccff";
    ctx.textAlign = "left";
    ctx.fillText(`1UP ${String(score).padStart(7, "0")}`, 10, h - 16);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffcc44";
    ctx.font = "bold 12px monospace";
    ctx.fillText(`NIVÅ ${level}`, w * 0.5, 14);
    ctx.textAlign = "left";

    const hpPct = player.hp / player.stats.maxHp;
    ctx.fillStyle = "#331111";
    ctx.fillRect(155, h - 28, 70, 10);
    ctx.fillStyle = hpPct > 0.3 ? "#ff4400" : "#ff0044";
    ctx.fillRect(155, h - 28, 70 * hpPct, 10);

    const barW = POWER_SLOTS.length * 36 + 8;
    const px = w / 2 - barW / 2;
    for (let i = 0; i < POWER_SLOTS.length; i++) {
      const slot = POWER_SLOTS[i];
      const isCursor = i === player.powerCursor;
      const activated = this._isSlotActive(player, slot.id);

      ctx.fillStyle = isCursor ? "#ff8800" : activated ? "#224422" : "#221100";
      ctx.strokeStyle = isCursor ? "#ffff00" : activated ? "#44ff44" : "#ff6600";
      ctx.lineWidth = isCursor ? 3 : activated ? 2 : 1;
      ctx.fillRect(px + i * 36, h - 32, 32, 22);
      ctx.strokeRect(px + i * 36, h - 32, 32, 22);

      ctx.fillStyle = isCursor ? "#ffffff" : activated ? "#aaffaa" : "#664422";
      ctx.textAlign = "center";
      ctx.font = "bold 12px monospace";
      ctx.fillText(slot.label, px + i * 36 + 16, h - 16);

      if (activated) {
        ctx.fillStyle = "#44ff44";
        ctx.font = "bold 10px monospace";
        ctx.fillText("✓", px + i * 36 + 26, h - 24);
      }
    }

    if (player.powerFlash > 0) {
      ctx.globalAlpha = player.powerFlash * 0.5;
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(px + player.powerCursor * 36, h - 32, 32, 22);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffaa44";
    const dist = Math.max(0, bossZoneX - scrollX);
    ctx.font = "bold 14px monospace";
    const bossLabel = boss && boss.hp > 0 ? `!! ${boss.name.toUpperCase()} !!` : dist > 350 ? `BOSS ${Math.floor(dist / 100)}` : "!! BOSS !!";
    ctx.fillText(bossLabel, w - 10, h - 16);

    ctx.textAlign = "left";
    ctx.fillStyle = "#8899aa";
    ctx.font = "10px monospace";
    ctx.fillText("Z SKJUT | X MISSIL (efter M) | Kapsel = power direkt | ENTER = Speed", 10, 14);
  }

  /** Liten statusrad för lagkompisens skepp i co-op. */
  drawTeammateStatus(mate) {
    const ctx = this.ctx;
    const w = 130;
    const x = 10;
    const y = 22;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y, w, 16);
    ctx.strokeStyle = mate.alive ? "#66eeff" : "#ff4444";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, 16);
    ctx.fillStyle = "#88ccff";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText("MEDSPELARE", x + 4, y + 11);
    if (mate.alive) {
      const pct = Math.max(0, mate.hp / mate.stats.maxHp);
      ctx.fillStyle = "#221111";
      ctx.fillRect(x + 78, y + 3, 48, 10);
      ctx.fillStyle = pct > 0.3 ? "#44ff88" : "#ff4444";
      ctx.fillRect(x + 78, y + 3, 48 * pct, 10);
    } else {
      ctx.fillStyle = "#ff4444";
      ctx.fillText("NERE", x + 88, y + 11);
    }
    ctx.restore();
  }

  _isSlotActive(player, id) {
    if (id === "speed") return player.speedLevel > 0;
    if (id === "missile") return player.missileEnabled;
    if (id === "double") return player.doubleShot;
    if (id === "laser") return player.laserEnabled;
    if (id === "option") return player.options.length > 0;
    return false;
  }

  _drawLevelBanner() {
    const ctx = this.ctx;
    const alpha = Math.min(1, this.levelBanner);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0, 30, 60, 0.85)";
    ctx.fillRect(0, this.canvas.height * 0.38, this.canvas.width, 64);
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, this.canvas.height * 0.38, this.canvas.width, 64);
    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText(this.levelBannerText, this.canvas.width / 2, this.canvas.height * 0.38 + 40);
    ctx.restore();
  }

  _drawTwinBeeBanner() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,40,80,0.7)";
    ctx.fillRect(0, 50, this.canvas.width, 36);
    ctx.fillStyle = "#ff6688";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("TWINBEE MODE — Klockor istället för kapslar!", this.canvas.width / 2, 72);
  }

  _scanlines() {
    const ctx = this.ctx;
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = "#000";
    for (let y = 0; y < this.canvas.height; y += 3) ctx.fillRect(0, y, this.canvas.width, 1);
    ctx.globalAlpha = 1;
  }
}

export function drawHangarPreview(canvas, twinBee) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#080818");
  g.addColorStop(1, "#101828");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1.4, 1.4);

  if (twinBee) {
    ctx.fillStyle = "#3388dd";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff5588";
    ctx.beginPath();
    ctx.arc(10, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffcc22";
    ctx.fillRect(-14, -3, 5, 6);
  } else {
    ctx.fillStyle = "#c85a1a";
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#141820";
    ctx.beginPath();
    ctx.moveTo(-16, 2);
    ctx.lineTo(14, 6);
    ctx.lineTo(14, 10);
    ctx.lineTo(-16, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#eef2f6";
    ctx.beginPath();
    ctx.moveTo(16, -1);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a2840";
    ctx.fillRect(8, -2, 6, 4);
    ctx.fillStyle = "#ff8833";
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-18, -1, 4, 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.fillStyle = "#8899aa";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(twinBee ? "TWINBEE CLASS" : "ORBITER CLASS", w / 2, h - 16);
}
