import {
  GRID_SIZE, PALETTE_COLORS, BEHAVIORS, WEAPONS, TEMPLATES,
  createEmptyEnemyDef, normalizeEnemyDef, applyTemplate,
  rasterizeToCanvas, exportEnemyToFile, importEnemyFromFile,
} from "./customEnemies.js";

const CELL = 15;
const CANVAS_PX = GRID_SIZE * CELL;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export class EnemyDesigner {
  constructor(uiRoot) {
    this.uiRoot = uiRoot;
    this.active = false;
    this.onAction = null;
    this.def = createEmptyEnemyDef();
    this.tool = "pencil";
    this.mirror = true;
    this.currentColor = PALETTE_COLORS[4];
    this.bgImage = null;
    this.bgOpacity = 0.35;
    this.painting = false;
    this.returnToEditor = false;
    this._previewPhase = 0;
  }

  setHandler(fn) { this.onAction = fn; }

  open(existingDef = null, opts = {}) {
    this.def = normalizeEnemyDef(existingDef || createEmptyEnemyDef());
    this.tool = "pencil";
    this.mirror = true;
    this.currentColor = PALETTE_COLORS[4];
    this.bgImage = null;
    this.bgOpacity = 0.35;
    this.returnToEditor = !!opts.returnToEditor;
    this.active = true;
    this._buildDOM();
    this._startPreviewLoop();
  }

  close() {
    this.active = false;
    this._stopPreviewLoop();
    this._teardownDOM();
  }

  // ---------- pixel grid helpers ----------

  _idx(x, y) { return y * GRID_SIZE + x; }

  _paintCell(x, y, color) {
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;
    this.def.pixels[this._idx(x, y)] = color;
    if (this.mirror) {
      const mx = GRID_SIZE - 1 - x;
      this.def.pixels[this._idx(mx, y)] = color;
    }
  }

  _floodFill(x, y, color) {
    const target = this.def.pixels[this._idx(x, y)];
    if (target === color) return;
    const stack = [[x, y]];
    const seen = new Set();
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= GRID_SIZE || cy >= GRID_SIZE) continue;
      const key = cx + "," + cy;
      if (seen.has(key)) continue;
      seen.add(key);
      if (this.def.pixels[this._idx(cx, cy)] !== target) continue;
      this._paintCell(cx, cy, color);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  _cellFromEvent(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const x = Math.floor(px / CELL);
    const y = Math.floor(py / CELL);
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return null;
    return { x, y };
  }

  _applyToolAt(x, y) {
    if (this.tool === "pencil") this._paintCell(x, y, this.currentColor);
    else if (this.tool === "eraser") this._paintCell(x, y, null);
    else if (this.tool === "fill") this._floodFill(x, y, this.currentColor);
  }

  // ---------- drawing ----------

  _drawPaintCanvas() {
    const canvas = this.dom.querySelector(".ed2-paint-canvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    ctx.fillStyle = "#14161e";
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

    if (this.bgImage) {
      ctx.globalAlpha = this.bgOpacity;
      const iw = this.bgImage.naturalWidth || this.bgImage.width;
      const ih = this.bgImage.naturalHeight || this.bgImage.height;
      const scale = Math.min(CANVAS_PX / iw, CANVAS_PX / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(this.bgImage, (CANVAS_PX - dw) / 2, (CANVAS_PX - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
    }

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const color = this.def.pixels[this._idx(x, y)];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, CANVAS_PX);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(CANVAS_PX, i * CELL + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(120,200,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(CANVAS_PX / 2, 0);
    ctx.lineTo(CANVAS_PX / 2, CANVAS_PX);
    ctx.stroke();
  }

  _startPreviewLoop() {
    const tick = () => {
      if (!this.active) return;
      this._previewPhase += 0.03;
      this._drawPreview();
      this._previewRaf = requestAnimationFrame(tick);
    };
    this._previewRaf = requestAnimationFrame(tick);
  }

  _stopPreviewLoop() {
    if (this._previewRaf) cancelAnimationFrame(this._previewRaf);
    this._previewRaf = null;
  }

  _drawPreview() {
    const canvas = this.dom?.querySelector(".ed2-preview-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#080818");
    g.addColorStop(1, "#101828");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const sprite = rasterizeToCanvas(this.def, 4);
    const radius = this.def.stats.radius;
    const bob = Math.sin(this._previewPhase * 2) * 6;
    const cx = w / 2 - 10;
    const cy = h / 2 + bob;
    const size = radius * 2.4;

    ctx.save();
    ctx.translate(cx, cy);
    if (this.def.behavior === "spinner") ctx.rotate(this._previewPhase * 4);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#88ccff";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`r=${radius}px`, w / 2, h - 8);
  }

  // ---------- DOM ----------

  _buildDOM() {
    this._teardownDOM();
    const root = document.createElement("div");
    root.className = "hud enemy-designer-hud";
    root.innerHTML = `
      <div class="ed2-topbar panel">
        <div class="ed-row">
          <input class="ed-input ed2-name" type="text" maxlength="40" value="${escapeHtml(this.def.name)}" placeholder="Fiendens namn">
          <button class="btn small" data-action="ed2-new">Ny fiende</button>
          <button class="btn small" data-action="ed2-import">Öppna fil</button>
          <button class="btn small" data-action="ed2-export">Spara som fil</button>
          ${this.returnToEditor ? '<button class="btn small primary" data-action="ed2-use">✓ Använd i banan</button>' : ""}
          <button class="btn small" data-action="ed2-exit">${this.returnToEditor ? "Tillbaka till editorn" : "Till meny"}</button>
        </div>
      </div>

      <div class="ed2-canvas-wrap panel">
        <canvas class="ed2-paint-canvas" width="${CANVAS_PX}" height="${CANVAS_PX}"></canvas>
        <div class="ed2-tools">
          <div class="ed-palette">
            <button class="ed-tool-btn active" data-drawtool="pencil">✏️ Pensel</button>
            <button class="ed-tool-btn" data-drawtool="eraser">🧹 Sudd</button>
            <button class="ed-tool-btn" data-drawtool="fill">🪣 Fyll</button>
            <button class="ed-tool-btn ed2-mirror-btn active" data-action="ed2-toggle-mirror">⇔ Spegling PÅ</button>
            <button class="ed-tool-btn" data-action="ed2-clear">🗑 Rensa</button>
          </div>
          <div class="ed2-swatches">
            ${PALETTE_COLORS.map((c) => `<button class="ed2-swatch" data-color="${c}" style="background:${c}"></button>`).join("")}
            <label class="ed2-custom-color" title="Egen färg">
              🎨<input type="color" class="ed2-color-picker" value="${this.currentColor}">
            </label>
          </div>
          <div class="ed-row ed2-bg-row">
            <button class="btn small" data-action="ed2-bg-import">Importera bakgrundsbild</button>
            <button class="btn small" data-action="ed2-bg-clear">Ta bort bild</button>
            <label class="ed-label">Genomskinlighet
              <input type="range" class="ed2-bg-opacity" min="0.05" max="0.9" step="0.05" value="${this.bgOpacity}">
            </label>
          </div>
          <p class="ed-help">Rita fienden med nosen åt vänster (dit den flyger). Importera en bild för att kalkera av den.</p>
          <input type="file" class="ed2-bg-file-input" accept="image/*" style="display:none">
          <input type="file" class="ed2-file-input" accept="application/json,.json" style="display:none">
        </div>
      </div>

      <div class="ed2-sidebar panel">
        <div class="ed-tool-group">
          <h4>Mallar</h4>
          <div class="ed-palette">
            ${Object.keys(TEMPLATES).map((k) => `<button class="ed-tool-btn" data-template="${k}">${TEMPLATES[k].label}</button>`).join("")}
          </div>
        </div>
        <div class="ed-tool-group">
          <h4>Mallfärger</h4>
          <div class="ed2-color-row">
            <label>Kropp <input type="color" class="ed-input ed2-col-primary" value="${this.def.colors.primary}"></label>
            <label>Accent <input type="color" class="ed-input ed2-col-accent" value="${this.def.colors.accent}"></label>
            <label>Skugga <input type="color" class="ed-input ed2-col-dark" value="${this.def.colors.dark}"></label>
          </div>
        </div>
        <div class="ed-tool-group">
          <h4>Förhandsgranskning</h4>
          <canvas class="ed2-preview-canvas" width="140" height="120"></canvas>
        </div>
        <div class="ed-tool-group">
          <h4>Egenskaper</h4>
          <label class="ed-label ed2-stat">Liv (HP)
            <input type="number" class="ed-input ed2-stat-hp" min="4" max="2000" value="${this.def.stats.hp}">
          </label>
          <label class="ed-label ed2-stat">Fart
            <input type="number" class="ed-input ed2-stat-speed" min="0" max="500" value="${this.def.stats.speed}">
          </label>
          <label class="ed-label ed2-stat">Kollisionsskada
            <input type="number" class="ed-input ed2-stat-damage" min="1" max="200" value="${this.def.stats.damage}">
          </label>
          <label class="ed-label ed2-stat">Storlek (radie)
            <input type="number" class="ed-input ed2-stat-radius" min="6" max="60" value="${this.def.stats.radius}">
          </label>
          <label class="ed-label ed2-stat">Poäng
            <input type="number" class="ed-input ed2-stat-score" min="0" max="20000" value="${this.def.stats.score}">
          </label>
        </div>
        <div class="ed-tool-group">
          <h4>Rörelsemönster</h4>
          <select class="ed-input ed2-behavior">${optionList(BEHAVIORS, this.def.behavior)}</select>
        </div>
        <div class="ed-tool-group">
          <h4>Bestyckning</h4>
          <select class="ed-input ed2-weapon">${optionList(WEAPONS, this.def.weapon)}</select>
        </div>
      </div>
    `;
    this.uiRoot.appendChild(root);
    this.dom = root;
    this._bindDOM();
    this._drawPaintCanvas();
  }

  _teardownDOM() {
    this.dom?.remove();
    this.dom = null;
  }

  _bindDOM() {
    const root = this.dom;
    const canvas = root.querySelector(".ed2-paint-canvas");

    const paintAt = (e) => {
      const cell = this._cellFromEvent(canvas, e);
      if (!cell) return;
      this._applyToolAt(cell.x, cell.y);
      this._drawPaintCanvas();
    };
    canvas.addEventListener("mousedown", (e) => { this.painting = true; paintAt(e); });
    canvas.addEventListener("mousemove", (e) => { if (this.painting) paintAt(e); });
    window.addEventListener("mouseup", () => { this.painting = false; });
    canvas.addEventListener("mouseleave", () => {});

    root.querySelectorAll("[data-drawtool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.tool = btn.dataset.drawtool;
        root.querySelectorAll("[data-drawtool]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    root.querySelectorAll(".ed2-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentColor = btn.dataset.color;
        root.querySelector(".ed2-color-picker").value = this.currentColor;
      });
    });
    root.querySelector(".ed2-color-picker").addEventListener("input", (e) => {
      this.currentColor = e.target.value;
    });

    root.querySelector("[data-action='ed2-toggle-mirror']").addEventListener("click", (e) => {
      this.mirror = !this.mirror;
      e.currentTarget.classList.toggle("active", this.mirror);
      e.currentTarget.textContent = this.mirror ? "⇔ Spegling PÅ" : "⇔ Spegling AV";
    });
    root.querySelector("[data-action='ed2-clear']").addEventListener("click", () => {
      if (confirm("Rensa hela rityta?")) {
        this.def.pixels = this.def.pixels.map(() => null);
        this._drawPaintCanvas();
      }
    });

    root.querySelectorAll("[data-template]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyTemplate(this.def, btn.dataset.template);
        this._drawPaintCanvas();
      });
    });

    root.querySelector(".ed2-col-primary").addEventListener("input", (e) => { this.def.colors.primary = e.target.value; });
    root.querySelector(".ed2-col-accent").addEventListener("input", (e) => { this.def.colors.accent = e.target.value; });
    root.querySelector(".ed2-col-dark").addEventListener("input", (e) => { this.def.colors.dark = e.target.value; });

    root.querySelector(".ed2-name").addEventListener("input", (e) => { this.def.name = e.target.value; });
    root.querySelector(".ed2-stat-hp").addEventListener("change", (e) => { this.def.stats.hp = parseInt(e.target.value, 10) || this.def.stats.hp; });
    root.querySelector(".ed2-stat-speed").addEventListener("change", (e) => { this.def.stats.speed = parseInt(e.target.value, 10) || 0; });
    root.querySelector(".ed2-stat-damage").addEventListener("change", (e) => { this.def.stats.damage = parseInt(e.target.value, 10) || this.def.stats.damage; });
    root.querySelector(".ed2-stat-radius").addEventListener("change", (e) => { this.def.stats.radius = parseInt(e.target.value, 10) || this.def.stats.radius; });
    root.querySelector(".ed2-stat-score").addEventListener("change", (e) => { this.def.stats.score = parseInt(e.target.value, 10) || 0; });
    root.querySelector(".ed2-behavior").addEventListener("change", (e) => { this.def.behavior = e.target.value; });
    root.querySelector(".ed2-weapon").addEventListener("change", (e) => { this.def.weapon = e.target.value; });

    root.querySelector("[data-action='ed2-bg-import']").addEventListener("click", () => {
      root.querySelector(".ed2-bg-file-input").click();
    });
    root.querySelector(".ed2-bg-file-input").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => { this.bgImage = img; this._drawPaintCanvas(); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    });
    root.querySelector("[data-action='ed2-bg-clear']").addEventListener("click", () => {
      this.bgImage = null;
      this._drawPaintCanvas();
    });
    root.querySelector(".ed2-bg-opacity").addEventListener("input", (e) => {
      this.bgOpacity = parseFloat(e.target.value) || 0.35;
      this._drawPaintCanvas();
    });

    root.querySelector("[data-action='ed2-new']").addEventListener("click", () => {
      if (confirm("Skapa en ny tom fiende? Osparade ändringar går förlorade.")) this.open(createEmptyEnemyDef(), { returnToEditor: this.returnToEditor });
    });
    root.querySelector("[data-action='ed2-export']").addEventListener("click", () => exportEnemyToFile(this.def));
    root.querySelector("[data-action='ed2-import']").addEventListener("click", () => {
      root.querySelector(".ed2-file-input").click();
    });
    root.querySelector(".ed2-file-input").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const def = await importEnemyFromFile(file);
        this.open(def, { returnToEditor: this.returnToEditor });
      } catch {
        alert("Kunde inte läsa fiendefilen. Är det en giltig Starforge-fiendefil?");
      }
      e.target.value = "";
    });

    const useBtn = root.querySelector("[data-action='ed2-use']");
    useBtn?.addEventListener("click", () => {
      this.onAction?.("use-in-level", normalizeEnemyDef(this.def));
    });
    root.querySelector("[data-action='ed2-exit']").addEventListener("click", () => {
      this.onAction?.("exit");
    });
  }
}

function optionList(dict, current) {
  return Object.keys(dict).map((k) => `<option value="${k}" ${k === current ? "selected" : ""}>${dict[k].label}</option>`).join("");
}
