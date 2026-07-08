import {
  SEGMENT_TYPES, BIOMES, ENEMY_PALETTE, OBSTACLE_KINDS, BOSS_PALETTE,
  MIN_SEGMENT_LENGTH, MIN_LEVEL_LENGTH, MAX_LEVEL_LENGTH,
  createEmptyLevel, createSegment, normalizeLevel, layoutSegments,
  buildRidges, exportLevelToFile, importLevelFromFile, getBossX,
} from "./customLevels.js";
import { sampleRidge } from "./terrain.js";
import { normalizeEnemyDef, importEnemyFromFile as importEnemyDefFromFile } from "./customEnemies.js";
import { BOSS_VARIANTS } from "./enemies.js";

const SIDEBAR_W = 300;
const TOPBAR_H = 116;
const RULER_H = 26;
const SEG_LANE_H = 44;
const HIT_RADIUS = 11;

const SEGMENT_COLORS = {
  open: "#2f6a56", narrow: "#6a4a2f", wide: "#2f4f6a",
  zigzag: "#6a2f5a", chasm: "#6a2f2f", lowceil: "#6a662f", weave: "#2f6a66",
};
const BIOME_ROCK_COLORS = {
  volcanic: "#5a3828", graveyard: "#3a3840", crystal: "#284858", moai: "#484038",
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export class Editor {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.uiRoot = uiRoot;
    this.active = false;
    this.onAction = null;

    this.level = createEmptyLevel();
    this.customEnemyDefs = {};
    this.zoom = 0.18;
    this.panX = 0;
    this.tool = "select";
    this.newSegmentType = "open";
    this.newSegmentBiome = "volcanic";
    this.selection = null;
    this.drag = null;
    this.mouse = { x: 0, y: 0, worldX: 0, down: false };
    this.pan = null;

    this._rebuildCache();
    this._bindEvents();
  }

  setHandler(fn) { this.onAction = fn; }

  open(levelDef = null) {
    this.level = normalizeLevel(levelDef || createEmptyLevel());
    this.customEnemyDefs = { ...this.level.customEnemies };
    this.zoom = clamp(700 / this.level.length, 0.02, 0.4);
    this.panX = 0;
    this.tool = "select";
    this.selection = null;
    this._rebuildCache();
    this.active = true;
    this._buildDOM();
  }

  close() {
    this.active = false;
    this._teardownDOM();
  }

  addCustomEnemy(def) {
    const normalized = normalizeEnemyDef(def);
    this.customEnemyDefs[normalized.id] = normalized;
    this.tool = `enemy:custom:${normalized.id}`;
    if (this.dom) {
      this._buildDOM();
    }
  }

  _viewport() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    return {
      left: 20,
      right: Math.max(220, w - SIDEBAR_W - 20),
      top: TOPBAR_H + RULER_H + SEG_LANE_H + 10,
      bottom: Math.max(TOPBAR_H + 200, h - 30),
    };
  }

  _rebuildCache() {
    this.previewHeight = Math.max(200, this._viewport().bottom - this._viewport().top);
    const { topRidge, bottomRidge, segs } = buildRidges(this.level, this.previewHeight);
    this.cache = { topRidge, bottomRidge, segs };
  }

  worldToScreenX(x) {
    return this._viewport().left + (x - this.panX) * this.zoom;
  }

  screenToWorldX(sx) {
    return this.panX + (sx - this._viewport().left) / this.zoom;
  }

  // ---------- events ----------

  _bindEvents() {
    this.canvas.addEventListener("mousedown", (e) => this._onMouseDown(e));
    window.addEventListener("mousemove", (e) => this._onMouseMove(e));
    window.addEventListener("mouseup", () => this._onMouseUp());
    this.canvas.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });
    this.canvas.addEventListener("contextmenu", (e) => { if (this.active) e.preventDefault(); });
    window.addEventListener("keydown", (e) => this._onKeyDown(e));
  }

  _canvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _maxPanX() {
    const vp = this._viewport();
    const visibleWorldW = (vp.right - vp.left) / this.zoom;
    return Math.max(0, this.level.length - visibleWorldW * 0.4);
  }

  _panBy(worldDelta) {
    this.panX = clamp(this.panX + worldDelta, 0, this._maxPanX());
  }

  _onWheel(e) {
    if (!this.active) return;
    const pos = this._canvasPos(e);
    if (pos.x > this._viewport().right + 20) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const worldAtCursor = this.screenToWorldX(pos.x);
      const factor = e.deltaY > 0 ? 0.88 : 1.12;
      this.zoom = clamp(this.zoom * factor, 0.008, 1.2);
      this.panX = clamp(
        worldAtCursor - (pos.x - this._viewport().left) / this.zoom,
        0, this._maxPanX(),
      );
      return;
    }
    // Vanligt mushjul (och styrplatta-svep) panorerar sidled — det brukar man vilja göra oftast.
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    this._panBy((delta * 2.2) / this.zoom);
  }

  _onKeyDown(e) {
    if (!this.active) return;
    if (e.target && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.code === "Delete" || e.code === "Backspace") {
      e.preventDefault();
      this._deleteSelected();
    } else if (e.code === "ArrowLeft") {
      this._panBy(-260 / this.zoom * 0.5);
    } else if (e.code === "ArrowRight") {
      this._panBy(260 / this.zoom * 0.5);
    } else if (e.code === "Equal" || e.code === "NumpadAdd") {
      this.zoom = clamp(this.zoom * 1.2, 0.008, 1.2);
    } else if (e.code === "Minus" || e.code === "NumpadSubtract") {
      this.zoom = clamp(this.zoom * 0.83, 0.008, 1.2);
    }
  }

  _onMouseDown(e) {
    if (!this.active) return;
    const pos = this._canvasPos(e);
    const vp = this._viewport();

    // Höger- eller mittenklick: dra för att panorera, var som helst över editorytan.
    if (e.button === 2 || e.button === 1) {
      if (pos.x < vp.left || pos.x > vp.right) return;
      this.panDrag = { startX: pos.x, startPanX: this.panX };
      return;
    }
    if (e.button !== 0) return;
    if (pos.x < vp.left || pos.x > vp.right) return;

    if (pos.y >= TOPBAR_H && pos.y < TOPBAR_H + RULER_H) {
      this.rulerDrag = true;
      this._scrubToRuler(pos);
      return;
    }
    if (pos.y >= TOPBAR_H + RULER_H && pos.y < TOPBAR_H + RULER_H + SEG_LANE_H) {
      this._handleSegmentLaneClick(pos);
      return;
    }
    if (pos.y >= vp.top && pos.y <= vp.bottom) {
      this._handlePreviewClick(pos);
    }
  }

  _scrubToRuler(pos) {
    const vp = this._viewport();
    const worldAtClick = this.screenToWorldX(pos.x);
    this.panX = clamp(worldAtClick - (pos.x - vp.left) / this.zoom, 0, this._maxPanX());
  }

  _onMouseMove(e) {
    if (!this.active) return;
    const pos = this._canvasPos(e);
    this.mouse.x = pos.x;
    this.mouse.y = pos.y;
    this.mouse.worldX = this.screenToWorldX(pos.x);

    if (this.panDrag) {
      const dx = pos.x - this.panDrag.startX;
      this.panX = clamp(this.panDrag.startPanX - dx / this.zoom, 0, this._maxPanX());
      return;
    }
    if (this.rulerDrag) {
      this._scrubToRuler(pos);
      return;
    }

    if (this.drag) {
      const vp = this._viewport();
      if (this.drag.kind === "override") {
        const o = this.level.terrainOverrides[this.drag.index];
        o.x = clamp(this.screenToWorldX(pos.x), 0, this.level.length);
        o.yFrac = clamp((pos.y - vp.top) / this.previewHeight, 0, 1);
        this._rebuildCache();
      } else if (this.drag.kind === "boss") {
        this.level.boss.x = clamp(Math.round(this.screenToWorldX(pos.x)), 300, this.level.length - 150);
        const input = this.dom?.querySelector(".ed-boss-x");
        if (input) input.value = this.level.boss.x;
      }
    }
  }

  _onMouseUp() {
    this.drag = null;
    this.panDrag = null;
    this.rulerDrag = false;
  }

  zoomToFit() {
    const vp = this._viewport();
    this.zoom = clamp((vp.right - vp.left) / this.level.length, 0.008, 1.2);
    this.panX = 0;
  }

  _handleSegmentLaneClick(pos) {
    const segs = layoutSegments(this.level);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const sx0 = this.worldToScreenX(s.start);
      const sx1 = this.worldToScreenX(s.start + s.length);
      if (pos.x >= sx0 && pos.x <= sx1) {
        this.selection = { kind: "segment", index: i };
        this._refreshSidebar();
        return;
      }
    }
    this.selection = null;
    this._refreshSidebar();
  }

  _handlePreviewClick(pos) {
    const vp = this._viewport();
    const worldX = clamp(this.screenToWorldX(pos.x), 0, this.level.length);

    if (this.tool.startsWith("terrainpoint:")) {
      const edge = this.tool.split(":")[1];
      const yFrac = clamp((pos.y - vp.top) / this.previewHeight, 0, 1);
      this.level.terrainOverrides.push({ x: worldX, edge, yFrac });
      this.selection = { kind: "override", index: this.level.terrainOverrides.length - 1 };
      this.drag = { kind: "override", index: this.level.terrainOverrides.length - 1 };
      this._rebuildCache();
      return;
    }

    const top = sampleRidge(this.cache.topRidge, worldX);
    const bottom = sampleRidge(this.cache.bottomRidge, worldX);
    const t = clamp((pos.y - vp.top - top) / Math.max(1, bottom - top), 0, 1);

    if (this.tool.startsWith("enemy:")) {
      const type = this.tool.slice("enemy:".length);
      this.level.enemies.push({ x: worldX, t, type });
      this.selection = { kind: "enemy", index: this.level.enemies.length - 1 };
      return;
    }
    if (this.tool.startsWith("obstacle:")) {
      const kind = this.tool.split(":")[1];
      this.level.obstacles.push({ x: worldX, t, kind });
      this.selection = { kind: "obstacle", index: this.level.obstacles.length - 1 };
      return;
    }
    if (this.tool === "cannon") {
      const side = t < 0.5 ? "top" : "bottom";
      this.level.groundCannons.push({ x: worldX, side });
      this.selection = { kind: "cannon", index: this.level.groundCannons.length - 1 };
      return;
    }
    if (this.tool === "boss") {
      this.level.boss.x = clamp(Math.round(worldX), 300, this.level.length - 150);
      this.selection = { kind: "boss" };
      this.drag = { kind: "boss" };
      this._refreshSidebar();
      return;
    }

    // select tool: hit test icons and override handles
    const hit = this._hitTest(pos);
    this.selection = hit;
    this._refreshSidebar();
    if (hit && hit.kind === "override") {
      this.drag = { kind: "override", index: hit.index };
    } else if (hit && hit.kind === "boss") {
      this.drag = { kind: "boss" };
    }
  }

  _hitTest(pos) {
    const vp = this._viewport();
    const bossX = getBossX(this.level);
    const bsx = this.worldToScreenX(bossX);
    const btop = sampleRidge(this.cache.topRidge, bossX);
    const bbottom = sampleRidge(this.cache.bottomRidge, bossX);
    const bsy = vp.top + (btop + bbottom) / 2;
    if (Math.hypot(pos.x - bsx, pos.y - bsy) <= HIT_RADIUS + 4) return { kind: "boss" };

    const tryList = (list, kind, getX, getT) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        const x = getX(item);
        const sx = this.worldToScreenX(x);
        let sy;
        if (kind === "override") {
          sy = vp.top + item.yFrac * this.previewHeight;
        } else {
          const top = sampleRidge(this.cache.topRidge, x);
          const bottom = sampleRidge(this.cache.bottomRidge, x);
          sy = kind === "cannon"
            ? vp.top + (item.side === "top" ? top - 6 : bottom + 6)
            : vp.top + top + (bottom - top) * getT(item);
        }
        if (Math.hypot(pos.x - sx, pos.y - sy) <= HIT_RADIUS) return { kind, index: i };
      }
      return null;
    };
    return (
      tryList(this.level.terrainOverrides, "override", (o) => o.x, null) ||
      tryList(this.level.enemies, "enemy", (e) => e.x, (e) => e.t ?? 0.5) ||
      tryList(this.level.obstacles, "obstacle", (o) => o.x, (o) => o.t ?? 0.5) ||
      tryList(this.level.groundCannons, "cannon", (c) => c.x, null)
    );
  }

  _deleteSelected() {
    if (!this.selection) return;
    const { kind, index } = this.selection;
    if (kind === "boss") {
      this.level.boss.x = null;
      this.selection = null;
      const input = this.dom?.querySelector(".ed-boss-x");
      if (input) input.value = "";
      this._refreshSidebar();
      return;
    }
    const map = {
      segment: this.level.segments,
      enemy: this.level.enemies,
      obstacle: this.level.obstacles,
      cannon: this.level.groundCannons,
      override: this.level.terrainOverrides,
    };
    const list = map[kind];
    if (!list) return;
    if (kind === "segment" && list.length <= 1) return;
    list.splice(index, 1);
    this.selection = null;
    if (kind === "segment") this._recalcLength();
    this._rebuildCache();
    this._refreshSidebar();
  }

  _recalcLength() {
    this.level.length = clamp(
      this.level.segments.reduce((s, seg) => s + seg.length, 0),
      MIN_LEVEL_LENGTH, MAX_LEVEL_LENGTH,
    );
  }

  // ---------- update / draw ----------

  update() {}

  draw() {
    if (!this.active) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const vp = this._viewport();

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, w, h);

    this._drawRuler(ctx, vp);
    this._drawSegmentLane(ctx, vp);
    this._drawPreview(ctx, vp);
    this._drawStatus(ctx, vp);
  }

  _drawRuler(ctx, vp) {
    const y = TOPBAR_H;
    ctx.fillStyle = "#0a0e18";
    ctx.fillRect(vp.left, y, vp.right - vp.left, RULER_H);
    ctx.strokeStyle = "#223";
    ctx.font = "10px monospace";
    ctx.fillStyle = "#7799bb";
    ctx.textAlign = "center";
    const worldStep = this.zoom < 0.05 ? 2000 : this.zoom < 0.1 ? 1000 : this.zoom < 0.25 ? 500 : 200;
    const startX = Math.floor(this.panX / worldStep) * worldStep;
    for (let x = startX; x <= this.panX + (vp.right - vp.left) / this.zoom + worldStep; x += worldStep) {
      if (x < 0 || x > this.level.length) continue;
      const sx = this.worldToScreenX(x);
      if (sx < vp.left || sx > vp.right) continue;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, y + RULER_H);
      ctx.strokeStyle = "rgba(120,160,200,0.25)";
      ctx.stroke();
      ctx.fillText(`${x}m`, sx, y + 18);
    }
  }

  _drawSegmentLane(ctx, vp) {
    const y = TOPBAR_H + RULER_H;
    ctx.fillStyle = "#0c1018";
    ctx.fillRect(vp.left, y, vp.right - vp.left, SEG_LANE_H);
    const segs = layoutSegments(this.level);
    segs.forEach((s, i) => {
      const sx0 = clamp(this.worldToScreenX(s.start), vp.left, vp.right);
      const sx1 = clamp(this.worldToScreenX(s.start + s.length), vp.left, vp.right);
      if (sx1 <= vp.left || sx0 >= vp.right) return;
      const selected = this.selection?.kind === "segment" && this.selection.index === i;
      ctx.fillStyle = SEGMENT_COLORS[s.type] || "#334";
      ctx.fillRect(sx0, y + 2, Math.max(1, sx1 - sx0 - 2), SEG_LANE_H - 4);
      ctx.strokeStyle = selected ? "#ffee66" : "rgba(255,255,255,0.25)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(sx0, y + 2, Math.max(1, sx1 - sx0 - 2), SEG_LANE_H - 4);
      if (sx1 - sx0 > 40) {
        ctx.fillStyle = "#eef";
        ctx.font = "10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(SEGMENT_TYPES[s.type]?.label || s.type, sx0 + 4, y + SEG_LANE_H / 2 + 4);
      }
    });
  }

  _drawPreview(ctx, vp) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.left, vp.top, vp.right - vp.left, vp.bottom - vp.top);
    ctx.clip();

    ctx.fillStyle = "#0a0d16";
    ctx.fillRect(vp.left, vp.top, vp.right - vp.left, vp.bottom - vp.top);

    const step = 6;
    // rock mass
    ctx.beginPath();
    ctx.moveTo(vp.left, vp.top);
    for (let sx = vp.left; sx <= vp.right; sx += step) {
      const wx = this.screenToWorldX(sx);
      const y = vp.top + sampleRidge(this.cache.topRidge, clamp(wx, 0, this.level.length));
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(vp.right, vp.top);
    ctx.closePath();
    ctx.fillStyle = "rgba(70,60,50,0.7)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(vp.left, vp.bottom);
    for (let sx = vp.left; sx <= vp.right; sx += step) {
      const wx = this.screenToWorldX(sx);
      const y = vp.top + sampleRidge(this.cache.bottomRidge, clamp(wx, 0, this.level.length));
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(vp.right, vp.bottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#ffaa55";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let sx = vp.left; sx <= vp.right; sx += step) {
      const wx = this.screenToWorldX(sx);
      const y = vp.top + sampleRidge(this.cache.topRidge, clamp(wx, 0, this.level.length));
      sx === vp.left ? ctx.moveTo(sx, y) : ctx.lineTo(sx, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "#55ccff";
    ctx.beginPath();
    for (let sx = vp.left; sx <= vp.right; sx += step) {
      const wx = this.screenToWorldX(sx);
      const y = vp.top + sampleRidge(this.cache.bottomRidge, clamp(wx, 0, this.level.length));
      sx === vp.left ? ctx.moveTo(sx, y) : ctx.lineTo(sx, y);
    }
    ctx.stroke();

    this._drawObstacles(ctx, vp);
    this._drawCannons(ctx, vp);
    this._drawEnemies(ctx, vp);
    this._drawOverrides(ctx, vp);
    this._drawBossMarker(ctx, vp);

    ctx.restore();
  }

  _drawObstacles(ctx, vp) {
    this.level.obstacles.forEach((o, i) => {
      const sx = this.worldToScreenX(o.x);
      if (sx < vp.left - 20 || sx > vp.right + 20) return;
      const top = sampleRidge(this.cache.topRidge, o.x);
      const bottom = sampleRidge(this.cache.bottomRidge, o.x);
      const sy = vp.top + top + (bottom - top) * (o.t ?? 0.5);
      const selected = this.selection?.kind === "obstacle" && this.selection.index === i;
      ctx.fillStyle = BIOME_ROCK_COLORS[o.kind] || "#886644";
      ctx.strokeStyle = selected ? "#ffee66" : "#000";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  _drawCannons(ctx, vp) {
    this.level.groundCannons.forEach((c, i) => {
      const sx = this.worldToScreenX(c.x);
      if (sx < vp.left - 20 || sx > vp.right + 20) return;
      const top = sampleRidge(this.cache.topRidge, c.x);
      const bottom = sampleRidge(this.cache.bottomRidge, c.x);
      const sy = vp.top + (c.side === "top" ? top - 6 : bottom + 6);
      const selected = this.selection?.kind === "cannon" && this.selection.index === i;
      ctx.fillStyle = "#66eeff";
      ctx.strokeStyle = selected ? "#ffee66" : "#003344";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 8);
      ctx.lineTo(sx + 7, sy + 6);
      ctx.lineTo(sx - 7, sy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }

  _enemyLabel(type) {
    if (type.startsWith("custom:")) return this.customEnemyDefs[type.slice(7)]?.name || "Egen fiende";
    return ENEMY_PALETTE.find((p) => p.id === type)?.label || type;
  }

  _enemyColor(type) {
    if (type.startsWith("custom:")) return this.customEnemyDefs[type.slice(7)]?.colors?.primary || "#ff4444";
    return ENEMY_PALETTE.find((p) => p.id === type)?.color || "#ff4444";
  }

  _drawEnemies(ctx, vp) {
    this.level.enemies.forEach((e, i) => {
      const sx = this.worldToScreenX(e.x);
      if (sx < vp.left - 20 || sx > vp.right + 20) return;
      const top = sampleRidge(this.cache.topRidge, e.x);
      const bottom = sampleRidge(this.cache.bottomRidge, e.x);
      const sy = vp.top + top + (bottom - top) * (e.t ?? 0.5);
      const selected = this.selection?.kind === "enemy" && this.selection.index === i;
      ctx.fillStyle = this._enemyColor(e.type);
      ctx.strokeStyle = selected ? "#ffee66" : "#000";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (typeof e.type === "string" && e.type.startsWith("custom:")) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - 3, sy - 3);
        ctx.lineTo(sx + 3, sy + 3);
        ctx.moveTo(sx + 3, sy - 3);
        ctx.lineTo(sx - 3, sy + 3);
        ctx.stroke();
      }
    });
  }

  _drawBossMarker(ctx, vp) {
    const bossX = getBossX(this.level);
    const bsx = this.worldToScreenX(bossX);
    if (bsx < vp.left - 20 || bsx > vp.right + 20) return;
    const auto = !Number.isFinite(this.level.boss.x);
    const selected = this.selection?.kind === "boss";

    ctx.strokeStyle = auto ? "rgba(255,60,60,0.35)" : "rgba(255,60,60,0.7)";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(bsx, vp.top);
    ctx.lineTo(bsx, vp.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    const top = sampleRidge(this.cache.topRidge, bossX);
    const bottom = sampleRidge(this.cache.bottomRidge, bossX);
    const bsy = vp.top + (top + bottom) / 2;

    ctx.fillStyle = auto ? "#aa4444" : "#ff5555";
    ctx.strokeStyle = selected ? "#ffee66" : "#220000";
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(bsx, bsy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", bsx, bsy + 1);
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#ff8888";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(auto ? "BOSS (auto)" : "BOSS", bsx + 14, vp.top + 12);
  }

  _drawOverrides(ctx, vp) {
    this.level.terrainOverrides.forEach((o, i) => {
      const sx = this.worldToScreenX(o.x);
      if (sx < vp.left - 20 || sx > vp.right + 20) return;
      const sy = vp.top + o.yFrac * this.previewHeight;
      const selected = this.selection?.kind === "override" && this.selection.index === i;
      ctx.fillStyle = o.edge === "top" ? "#ffaa55" : "#55ccff";
      ctx.strokeStyle = selected ? "#ffee66" : "#fff";
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  _drawStatus(ctx, vp) {
    ctx.fillStyle = "#88aacc";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      `X: ${Math.round(this.mouse.worldX || 0)}m / ${this.level.length}m   Zoom: ${(this.zoom * 100).toFixed(0)}%   Verktyg: ${this._toolLabel()}`,
      vp.left, vp.bottom + 20,
    );
  }

  _toolLabel() {
    if (this.tool === "select") return "Markera / ta bort";
    if (this.tool === "cannon") return "Luftvärn";
    if (this.tool === "boss") return "Placera boss";
    if (this.tool.startsWith("terrainpoint:")) return `Terrängpunkt (${this.tool.endsWith("top") ? "tak" : "golv"})`;
    if (this.tool.startsWith("enemy:")) return `Fiende: ${this._enemyLabel(this.tool.slice("enemy:".length))}`;
    if (this.tool.startsWith("obstacle:")) return `Hinder: ${this.tool.split(":")[1]}`;
    return this.tool;
  }

  // ---------- DOM ----------

  _buildDOM() {
    this._teardownDOM();
    const root = document.createElement("div");
    root.className = "hud editor-hud";
    root.innerHTML = `
      <div class="editor-topbar panel">
        <div class="ed-row">
          <input class="ed-input ed-name" type="text" maxlength="60" value="${escapeHtml(this.level.name)}" placeholder="Banans namn">
          <label class="ed-label">Längd (m)
            <input class="ed-input ed-length" type="number" min="${MIN_LEVEL_LENGTH}" max="${MAX_LEVEL_LENGTH}" step="100" value="${this.level.length}">
          </label>
          <label class="ed-label">Standardbiom
            <select class="ed-input ed-biome">${optionList(BIOMES, this.level.biome)}</select>
          </label>
        </div>
        <div class="ed-row">
          <button class="btn small" data-action="editor-new">Ny bana</button>
          <button class="btn small" data-action="editor-import">Öppna fil</button>
          <button class="btn small" data-action="editor-export">Spara som fil</button>
          <button class="btn small primary" data-action="editor-play">Testspela</button>
          <button class="btn small" data-action="editor-exit">Till meny</button>
          <span class="ed-zoom-group">
            <button class="btn small" data-action="ed-pan-left" title="Panorera vänster">◀</button>
            <button class="btn small" data-action="ed-zoom-out" title="Zooma ut">−</button>
            <button class="btn small" data-action="ed-zoom-fit" title="Visa hela banan">Hela banan</button>
            <button class="btn small" data-action="ed-zoom-in" title="Zooma in">+</button>
            <button class="btn small" data-action="ed-pan-right" title="Panorera höger">▶</button>
          </span>
        </div>
      </div>
      <div class="editor-sidebar panel">
        <div class="ed-tool-group">
          <h4>Terrängsegment</h4>
          <div class="ed-palette ed-seg-palette">${paletteButtons(SEGMENT_TYPES, "seg", this.newSegmentType)}</div>
          <select class="ed-input ed-seg-biome">${optionList(BIOMES, this.newSegmentBiome)}</select>
          <button class="btn small" data-action="ed-add-segment">+ Lägg till segment i slutet</button>
        </div>
        <div class="ed-tool-group">
          <h4>Finjustera terräng</h4>
          <div class="ed-palette">
            <button class="ed-tool-btn" data-tool="terrainpoint:top">+ Tak-punkt</button>
            <button class="ed-tool-btn" data-tool="terrainpoint:bottom">+ Golv-punkt</button>
          </div>
        </div>
        <div class="ed-tool-group">
          <h4>Fiender</h4>
          <div class="ed-palette ed-enemy-palette">
            ${ENEMY_PALETTE.map((p) => `<button class="ed-tool-btn" data-tool="enemy:${p.id}" style="--dot:${p.color}">${p.label}</button>`).join("")}
            ${Object.values(this.customEnemyDefs).map((d) => `<button class="ed-tool-btn ed-tool-custom" data-tool="enemy:custom:${d.id}" style="--dot:${d.colors.primary}">🎨 ${escapeHtml(d.name)}</button>`).join("")}
          </div>
          <div class="ed-row">
            <button class="btn small" data-action="ed-design-enemy">🎨 Designa ny fiende</button>
            <button class="btn small" data-action="ed-import-enemy">Importera fiende</button>
          </div>
          <input type="file" class="ed-enemy-file-input" accept="application/json,.json" style="display:none">
        </div>
        <div class="ed-tool-group">
          <h4>Hinder &amp; luftvärn</h4>
          <div class="ed-palette">
            ${OBSTACLE_KINDS.map((k) => `<button class="ed-tool-btn" data-tool="obstacle:${k}" style="--dot:${BIOME_ROCK_COLORS[k]}">${BIOMES[k].label}</button>`).join("")}
            <button class="ed-tool-btn" data-tool="cannon" style="--dot:#66eeff">Luftvärn</button>
          </div>
        </div>
        <div class="ed-tool-group">
          <h4>Boss</h4>
          <div class="ed-palette">
            <button class="ed-tool-btn" data-tool="boss" style="--dot:#ff5555">🎯 Placera boss på kartan</button>
          </div>
          <label class="ed-label ed2-stat">Position (m)
            <input class="ed-input ed-boss-x" type="number" min="300" max="${this.level.length - 150}" step="50"
              value="${Number.isFinite(this.level.boss.x) ? this.level.boss.x : ""}" placeholder="Auto (nära slutet)">
          </label>
          <button class="btn small" data-action="ed-boss-x-auto">Återställ till auto-position</button>
          <label class="ed-label">Typ
            <select class="ed-input ed-boss-variant">${BOSS_PALETTE.map((b) => `<option value="${b.id}" ${b.id === this.level.boss.variant ? "selected" : ""}>${b.label}</option>`).join("")}</select>
          </label>
          <label class="ed-label ed2-stat">Namn (valfritt)
            <input class="ed-input ed-boss-name" type="text" maxlength="30" value="${escapeHtml(this.level.boss.name)}" placeholder="Standardnamn">
          </label>
          <label class="ed-label ed2-stat">Liv (HP)
            <input class="ed-input ed-boss-hp" type="number" min="50" max="30000" value="${this.level.boss.hp}">
          </label>
          <label class="ed-label ed2-stat">Attacktakt (sek)
            <input class="ed-input ed-boss-timer" type="number" min="0.25" max="5" step="0.05" value="${this.level.boss.timer}">
          </label>
          <label class="ed-label ed2-stat">Poäng
            <input class="ed-input ed-boss-score" type="number" min="0" max="100000" step="100" value="${this.level.boss.score}">
          </label>
          <p class="ed-help">Klicka på "Placera boss på kartan" och klicka sedan i banan för att välja var bossen ska möta spelaren. Dra markören för att flytta den, eller ange en exakt position i meter. Välj "Slumpad" för samma variation som vanliga uppdrag, eller en specifik boss och finjustera dess egenskaper.</p>
        </div>
        <div class="ed-tool-group">
          <button class="ed-tool-btn ${this.tool === "select" ? "active" : ""}" data-tool="select">Markera / ta bort</button>
          <button class="btn small danger" data-action="ed-delete-selected">Ta bort markerat (Delete)</button>
        </div>
        <div class="ed-selected-props"></div>
        <p class="ed-help">
          Vänsterklick: placera/välj.<br>
          Mushjul eller ←/→: panorera sidled.<br>
          Ctrl+mushjul eller +/−: zooma.<br>
          Höger-/mittenklick och dra: panorera.<br>
          Klicka/dra i linjalen högst upp: hoppa till en plats i banan.
        </p>
      </div>
      <input type="file" class="ed-file-input" accept="application/json,.json" style="display:none">
    `;
    this.uiRoot.appendChild(root);
    this.dom = root;
    this._bindDOM();
    this._refreshSidebar();
  }

  _teardownDOM() {
    this.dom?.remove();
    this.dom = null;
  }

  _bindDOM() {
    const root = this.dom;
    root.querySelector(".ed-name").addEventListener("input", (e) => { this.level.name = e.target.value; });
    root.querySelector(".ed-length").addEventListener("change", (e) => {
      const newLen = clamp(parseInt(e.target.value, 10) || this.level.length, MIN_LEVEL_LENGTH, MAX_LEVEL_LENGTH);
      const oldTotal = this.level.segments.reduce((s, seg) => s + seg.length, 0) || newLen;
      const ratio = newLen / oldTotal;
      this.level.segments.forEach((seg) => { seg.length = Math.max(MIN_SEGMENT_LENGTH * 0.5, seg.length * ratio); });
      this.level.length = newLen;
      this._rebuildCache();
    });
    root.querySelector(".ed-biome").addEventListener("change", (e) => { this.level.biome = e.target.value; });

    root.querySelector(".ed-boss-variant").addEventListener("change", (e) => {
      this.level.boss.variant = e.target.value;
      const def = BOSS_VARIANTS[e.target.value];
      if (def) {
        this.level.boss.hp = def.hp;
        this.level.boss.timer = def.timer;
        this.level.boss.score = def.score;
        root.querySelector(".ed-boss-hp").value = def.hp;
        root.querySelector(".ed-boss-timer").value = def.timer;
        root.querySelector(".ed-boss-score").value = def.score;
      }
    });
    root.querySelector(".ed-boss-name").addEventListener("input", (e) => { this.level.boss.name = e.target.value; });
    root.querySelector(".ed-boss-x").addEventListener("change", (e) => {
      const v = e.target.value.trim();
      if (v === "") { this.level.boss.x = null; return; }
      this.level.boss.x = clamp(parseInt(v, 10) || 0, 300, this.level.length - 150);
      e.target.value = this.level.boss.x;
    });
    root.querySelector("[data-action='ed-boss-x-auto']").addEventListener("click", () => {
      this.level.boss.x = null;
      root.querySelector(".ed-boss-x").value = "";
      if (this.selection?.kind === "boss") this.selection = null;
      this._refreshSidebar();
    });
    root.querySelector(".ed-boss-hp").addEventListener("change", (e) => {
      this.level.boss.hp = clamp(parseInt(e.target.value, 10) || this.level.boss.hp, 50, 30000);
    });
    root.querySelector(".ed-boss-timer").addEventListener("change", (e) => {
      this.level.boss.timer = clamp(parseFloat(e.target.value) || this.level.boss.timer, 0.25, 5);
    });
    root.querySelector(".ed-boss-score").addEventListener("change", (e) => {
      this.level.boss.score = clamp(parseInt(e.target.value, 10) || this.level.boss.score, 0, 100000);
    });
    root.querySelector(".ed-seg-biome").addEventListener("change", (e) => { this.newSegmentBiome = e.target.value; });

    root.querySelectorAll(".ed-seg-palette [data-seg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.newSegmentType = btn.dataset.seg;
        root.querySelectorAll(".ed-seg-palette [data-seg]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    root.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.tool = btn.dataset.tool;
        root.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    root.querySelector("[data-action='ed-add-segment']").addEventListener("click", () => {
      this.level.segments.push(createSegment(this.newSegmentType, 800, this.newSegmentBiome));
      this._recalcLength();
      this._rebuildCache();
      root.querySelector(".ed-length").value = this.level.length;
    });
    root.querySelector("[data-action='ed-delete-selected']").addEventListener("click", () => this._deleteSelected());

    root.querySelector("[data-action='editor-new']").addEventListener("click", () => {
      if (confirm("Skapa en ny tom bana? Osparade ändringar går förlorade.")) this.open(createEmptyLevel());
    });
    root.querySelector("[data-action='ed-design-enemy']").addEventListener("click", () => {
      this.onAction?.("design-enemy");
    });
    root.querySelector("[data-action='ed-import-enemy']").addEventListener("click", () => {
      root.querySelector(".ed-enemy-file-input").click();
    });
    root.querySelector(".ed-enemy-file-input").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const def = await importEnemyDefFromFile(file);
        this.addCustomEnemy(def);
      } catch {
        alert("Kunde inte läsa fiendefilen. Är det en giltig Starforge-fiendefil?");
      }
      e.target.value = "";
    });

    root.querySelector("[data-action='editor-export']").addEventListener("click", () => exportLevelToFile({ ...this.level, customEnemies: this.customEnemyDefs }));
    root.querySelector("[data-action='editor-import']").addEventListener("click", () => {
      root.querySelector(".ed-file-input").click();
    });
    root.querySelector(".ed-file-input").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const level = await importLevelFromFile(file);
        this.open(level);
      } catch {
        alert("Kunde inte läsa banfilen. Är det en giltig Starforge-banfil?");
      }
      e.target.value = "";
    });
    root.querySelector("[data-action='editor-play']").addEventListener("click", () => {
      this.onAction?.("play", normalizeLevel({ ...this.level, customEnemies: this.customEnemyDefs }));
    });
    root.querySelector("[data-action='editor-exit']").addEventListener("click", () => {
      this.onAction?.("exit");
    });

    root.querySelector("[data-action='ed-pan-left']").addEventListener("click", () => this._panBy(-400 / this.zoom));
    root.querySelector("[data-action='ed-pan-right']").addEventListener("click", () => this._panBy(400 / this.zoom));
    root.querySelector("[data-action='ed-zoom-in']").addEventListener("click", () => {
      this.zoom = clamp(this.zoom * 1.3, 0.008, 1.2);
      this.panX = clamp(this.panX, 0, this._maxPanX());
    });
    root.querySelector("[data-action='ed-zoom-out']").addEventListener("click", () => {
      this.zoom = clamp(this.zoom * 0.77, 0.008, 1.2);
      this.panX = clamp(this.panX, 0, this._maxPanX());
    });
    root.querySelector("[data-action='ed-zoom-fit']").addEventListener("click", () => this.zoomToFit());
  }

  _refreshSidebar() {
    if (!this.dom) return;
    const el = this.dom.querySelector(".ed-selected-props");
    if (!this.selection) { el.innerHTML = ""; return; }
    const { kind, index } = this.selection;
    if (kind === "segment") {
      const seg = this.level.segments[index];
      el.innerHTML = `
        <h4>Valt segment</h4>
        <label class="ed-label">Typ
          <select class="ed-input ed-prop-type">${optionList(SEGMENT_TYPES, seg.type)}</select>
        </label>
        <label class="ed-label">Längd (m)
          <input class="ed-input ed-prop-length" type="number" min="${MIN_SEGMENT_LENGTH}" step="50" value="${Math.round(seg.length)}">
        </label>
        <label class="ed-label">Biom
          <select class="ed-input ed-prop-biome">${optionList(BIOMES, seg.biome)}</select>
        </label>
      `;
      el.querySelector(".ed-prop-type").addEventListener("change", (e) => { seg.type = e.target.value; this._rebuildCache(); });
      el.querySelector(".ed-prop-biome").addEventListener("change", (e) => { seg.biome = e.target.value; this._rebuildCache(); });
      el.querySelector(".ed-prop-length").addEventListener("change", (e) => {
        seg.length = Math.max(MIN_SEGMENT_LENGTH, parseInt(e.target.value, 10) || seg.length);
        this._recalcLength();
        this._rebuildCache();
        this.dom.querySelector(".ed-length").value = this.level.length;
      });
    } else if (kind === "boss") {
      el.innerHTML = `<h4>Boss</h4><p class="ed-help">Dra markören för att flytta bossen. Tryck Delete för att återställa till standardplats (nära slutet).</p>`;
    } else {
      el.innerHTML = `<h4>Vald markör</h4><p class="ed-help">Tryck Delete eller "Ta bort markerat" för att ta bort.</p>`;
    }
  }
}

function optionList(dict, current) {
  return Object.keys(dict).map((k) => `<option value="${k}" ${k === current ? "selected" : ""}>${dict[k].label}</option>`).join("");
}

function paletteButtons(dict, prefix, current) {
  return Object.keys(dict).map((k) => `<button data-seg="${k}" class="${k === current ? "active" : ""}">${dict[k].label}</button>`).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
