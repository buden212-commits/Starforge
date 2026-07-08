import {
  CHASSIS, ENGINES, WINGS, PRIMARY_WEAPONS, SECONDARY_WEAPONS,
  SLOT_LABELS, computeStats, RARITY, getModuleCatalog,
} from "./data.js";

export class UI {
  constructor(root) {
    this.root = root;
    this.onAction = null;
    this.selectedSlot = null;
  }

  setHandler(fn) {
    this.onAction = fn;
  }

  clear() {
    this.root.innerHTML = "";
  }

  showMenu() {
    this.clear();
    const screen = this._screen("menu");
    screen.innerHTML = `
      <div class="panel menu-panel">
        <h1 class="title-font">Starforge</h1>
        <p class="subtitle">Orbiter × TwinBee × Hive Overmind</p>
        <button class="btn primary" data-action="hangar">Hangar</button>
        <button class="btn" data-action="mission">Starta uppdrag</button>
        <button class="btn" data-action="editor">Baneditor</button>
        <button class="btn" data-action="play-custom">Spela egen bana</button>
        <button class="btn" data-action="enemy-designer">Fiendedesign</button>
        <button class="btn" data-action="multiplayer">Multiplayer (co-op)</button>
        <p style="margin-top:24px;color:var(--muted);font-size:0.85rem;">
          WASD · Z skjut · X missil (efter M) · Kapslar ger power direkt · Enter = Speed
        </p>
        <p style="margin-top:8px;color:var(--muted);font-size:0.75rem;">
          Klicka var som helst eller tryck en tangent för pop-vinjett
        </p>
      </div>
    `;
    this._bind(screen);
  }

  showHangar(save) {
    this.clear();
    const stats = computeStats(save.build, save.affixes);
    const screen = this._screen("hangar");

    const slots = ["chassis", "engine", "leftWing", "rightWing", "primary", "secondary"];
    const slotHtml = slots.map((slot) => {
      const id = save.build[slot];
      const mod = this._getModule(slot, id);
      const rarity = mod.rarity || "common";
      return `
        <div class="slot ${this.selectedSlot === slot ? "selected" : ""}" data-slot="${slot}">
          <div class="slot-label">${SLOT_LABELS[slot]}</div>
          <div class="slot-name slot-rarity-${rarity}">${mod.name}</div>
        </div>
      `;
    }).join("");

    screen.innerHTML = `
      <div class="hangar-layout">
        <div class="panel hangar-ship">
          <h2 class="title-font">Skeppsbyggare</h2>
          <div class="ship-preview-wrap">
            <canvas id="ship-preview-canvas" width="420" height="260"></canvas>
          </div>
          <div class="module-slots">${slotHtml}</div>
        </div>
        <div class="panel hangar-stats">
          <h2 class="title-font">Statistik</h2>
          <div class="stat-row"><span>Liv</span><span>${stats.maxHp}</span></div>
          <div class="stat-row"><span>Hastighet</span><span>${stats.speed.toFixed(2)}</span></div>
          <div class="stat-row"><span>Energi</span><span>${stats.maxEnergy}</span></div>
          <div class="stat-row"><span>Skada</span><span>${stats.damageMult.toFixed(2)}x</span></div>
          <div class="stat-row"><span>Eldhastighet</span><span>${stats.fireRateMult.toFixed(2)}x</span></div>
          <div class="stat-row"><span>Chassi</span><span>${stats.chassisName}</span></div>
          <div class="stat-row"><span>Runs</span><span>${save.runs}</span></div>
          <div class="stat-row"><span>Bossar</span><span>${save.bosses}</span></div>
          <div class="hangar-actions">
            <button class="btn ${save.twinBeeMode ? "primary" : ""}" data-action="toggle-twinbee">
              ${save.twinBeeMode ? "TwinBee-läge: PÅ" : "TwinBee-läge: AV"}
            </button>
            <p style="font-size:0.8rem;color:var(--muted);margin:4px 0">
              MSX-hemlighet: flyg genom alla 3 GAP i vulkanzonen för TwinBee i uppdraget.
            </p>
            <button class="btn primary" data-action="mission">Starta uppdrag</button>
            <button class="btn" data-action="menu">Tillbaka</button>
          </div>
        </div>
      </div>
    `;

    screen.querySelectorAll(".slot").forEach((el) => {
      el.addEventListener("click", () => {
        this.selectedSlot = el.dataset.slot;
        this.showModulePicker(save);
      });
    });

    this._bind(screen);
    return stats.chassisColor;
  }

  showModulePicker(save) {
    const slot = this.selectedSlot;
    if (!slot) return;

    const overlay = document.createElement("div");
    overlay.className = "picker-overlay";
    const owned = save.inventory[slot] || [];
    const items = owned.map((id) => {
      const mod = this._getModule(slot, id);
      const equipped = save.build[slot] === id;
      return `
        <div class="picker-item ${equipped ? "equipped" : ""}" data-id="${id}">
          <strong>${mod.name}</strong>
          ${equipped ? " <span style='color:var(--green)'>✓ Utrustad</span>" : ""}
        </div>
      `;
    }).join("");

    overlay.innerHTML = `
      <div class="panel picker-panel">
        <h3>Välj ${SLOT_LABELS[slot]}</h3>
        ${items}
        <button class="btn" style="margin-top:12px;width:100%" data-action="close-picker">Stäng</button>
      </div>
    `;

    overlay.querySelectorAll(".picker-item").forEach((el) => {
      el.addEventListener("click", () => {
        save.build[slot] = el.dataset.id;
        this.onAction?.("save", save);
        overlay.remove();
        this.showHangar(save);
      });
    });

    overlay.querySelector("[data-action=close-picker]").addEventListener("click", () => {
      overlay.remove();
      this.selectedSlot = null;
      this.showHangar(save);
    });

    this.root.appendChild(overlay);
  }

  showHUD(customTest = false) {
    this.clear();
    if (customTest) {
      const btn = document.createElement("button");
      btn.className = "btn small editor-exit-hud-btn";
      btn.textContent = "⏹ Avbryt (ESC)";
      btn.addEventListener("click", () => this.onAction?.("exit-to-editor"));
      this.root.appendChild(btn);
    }
  }

  updateHUD() {
    // Gradius HUD ritas på canvas
  }

  showLoot(options, level = 1) {
    this.clear();
    const screen = this._screen("loot");
    const cards = options.map((loot, i) => `
      <div class="loot-card rarity-${loot.rarity}" data-index="${i}">
        <h3>${loot.name}</h3>
        <p>${loot.description}</p>
      </div>
    `).join("");

    screen.innerHTML = `
      <div class="panel loot-panel">
        <h2 class="title-font">Sektor ${level} klar!</h2>
        <p style="color:var(--muted)">Alla bossar besegrade — välj en belöning.</p>
        <div class="loot-cards">${cards}</div>
        <button class="btn" data-action="hangar">Till hangar</button>
      </div>
    `;

    screen.querySelectorAll(".loot-card").forEach((el) => {
      el.addEventListener("click", () => {
        this.onAction?.("pick-loot", options[parseInt(el.dataset.index, 10)]);
      });
    });

    this._bind(screen);
  }

  showGameOver(won, isCustomLevel = false) {
    this.clear();
    const screen = this._screen("gameover");
    const retryBtn = isCustomLevel
      ? `<button class="btn" data-action="retry-custom">Försök igen</button>`
      : `<button class="btn" data-action="mission">Försök igen</button>`;
    screen.innerHTML = `
      <div class="panel menu-panel">
        <h1 class="title-font" style="color:${won ? "var(--green)" : "var(--magenta)"}">
          ${won ? "Seger!" : "Skepp förstört"}
        </h1>
        <p class="subtitle">${won ? "Det organiska hotet är neutraliserat." : "All power förlorad — precis som i Gradius."}</p>
        <button class="btn primary" data-action="hangar">Hangar</button>
        ${retryBtn}
      </div>
    `;
    this._bind(screen);
  }

  hideHUD() {}

  showMultiplayerMenu(defaultServerUrl = "") {
    this.clear();
    const screen = this._screen("mp-menu");
    screen.innerHTML = `
      <div class="panel menu-panel">
        <h1 class="title-font">Multiplayer</h1>
        <p class="subtitle">Spela standarduppdraget tillsammans med en vän över nätet.</p>
        <div style="text-align:left;max-width:360px;margin:0 auto;">
          <label style="display:block;margin:12px 0 4px;color:var(--muted);font-size:0.85rem;">Server-adress</label>
          <input id="mp-server-url" type="text" placeholder="t.ex. mitt-spel.onrender.com" value="${defaultServerUrl}"
            style="width:100%;padding:8px;border-radius:6px;border:1px solid #345;background:#0c1420;color:#eef2f6;box-sizing:border-box;">
        </div>
        <div style="margin-top:18px;">
          <button class="btn primary" id="mp-host-btn">Skapa spel (värd)</button>
        </div>
        <div style="margin-top:18px;display:flex;gap:8px;justify-content:center;align-items:center;">
          <input id="mp-join-code" type="text" maxlength="4" placeholder="RUMSKOD"
            style="width:120px;padding:8px;border-radius:6px;border:1px solid #345;background:#0c1420;color:#eef2f6;text-transform:uppercase;text-align:center;letter-spacing:2px;">
          <button class="btn" id="mp-join-btn">Gå med</button>
        </div>
        <p style="margin-top:20px;color:var(--muted);font-size:0.75rem;">
          Värden driftar servern (se README/DEPLOY) och delar server-adressen + rumskoden med sin medspelare.
        </p>
        <button class="btn" style="margin-top:16px" data-action="menu">Tillbaka</button>
      </div>
    `;
    screen.querySelector("#mp-host-btn").addEventListener("click", () => {
      const url = screen.querySelector("#mp-server-url").value.trim();
      if (!url) { alert("Ange en server-adress."); return; }
      this.onAction?.("mp-host", url);
    });
    screen.querySelector("#mp-join-btn").addEventListener("click", () => {
      const url = screen.querySelector("#mp-server-url").value.trim();
      const code = screen.querySelector("#mp-join-code").value.trim().toUpperCase();
      if (!url || !code) { alert("Ange server-adress och rumskod."); return; }
      this.onAction?.("mp-join", { serverUrl: url, code });
    });
    this._bind(screen);
  }

  showHostLobby(code, peerConnected) {
    this.clear();
    const screen = this._screen("mp-lobby");
    screen.innerHTML = `
      <div class="panel menu-panel">
        <h1 class="title-font">Väntrum</h1>
        <p class="subtitle">Dela den här koden med din medspelare:</p>
        <div style="font-size:2.4rem;letter-spacing:0.4rem;font-family:Orbitron,sans-serif;color:#39ff88;margin:20px 0;">${code}</div>
        <p style="color:${peerConnected ? "#39ff88" : "var(--muted)"};">
          ${peerConnected ? "✓ Medspelare ansluten!" : "Väntar på att medspelaren ansluter…"}
        </p>
        <button class="btn primary" data-action="mp-start-mission" ${peerConnected ? "" : "disabled"}>Starta uppdrag tillsammans</button>
        <button class="btn" data-action="mp-leave">Avbryt</button>
      </div>
    `;
    this._bind(screen);
  }

  showGuestLobby() {
    this.clear();
    const screen = this._screen("mp-lobby");
    screen.innerHTML = `
      <div class="panel menu-panel">
        <h1 class="title-font">Ansluten!</h1>
        <p class="subtitle">Väntar på att värden startar uppdraget…</p>
        <button class="btn" data-action="mp-leave">Avbryt</button>
      </div>
    `;
    this._bind(screen);
  }

  showWaitingForHost(stateLabel = "") {
    this.clear();
    const screen = this._screen("mp-wait");
    const labels = {
      loot: "Värden väljer belöning…",
      gameover: "Skepp förstört — väntar på värden…",
      hangar: "Värden är i hangaren…",
      menu: "Värden är i menyn…",
    };
    screen.innerHTML = `
      <div class="panel menu-panel">
        <h1 class="title-font">Väntar…</h1>
        <p class="subtitle">${labels[stateLabel] || "Väntar på värden…"}</p>
        <button class="btn" data-action="mp-leave">Lämna spelet</button>
      </div>
    `;
    this._bind(screen);
  }

  _screen(id) {
    const el = document.createElement("div");
    el.className = "screen";
    el.id = `screen-${id}`;
    this.root.appendChild(el);
    return el;
  }

  _bind(container) {
    container.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.onAction?.(btn.dataset.action);
      });
    });
  }

  _getModule(slot, id) {
    if (slot === "chassis") return CHASSIS[id];
    if (slot === "engine") return ENGINES[id];
    if (slot === "leftWing" || slot === "rightWing") return WINGS[id];
    if (slot === "primary") return PRIMARY_WEAPONS[id];
    if (slot === "secondary") return SECONDARY_WEAPONS[id];
    return { name: id };
  }
}
