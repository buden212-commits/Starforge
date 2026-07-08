import {
  computeStats, rollLoot, applyAffixes,
  DEFAULT_BUILD, DEFAULT_INVENTORY,
} from "./data.js";
import { getOrCreateSave, writeSave } from "./save.js";
import { Input } from "./input.js";
import { Renderer, drawHangarPreview } from "./render.js";
import { createStage, getPlayBounds, checkSecretGaps, checkTerrainCrash } from "./terrain.js";
import { Player, createProjectile, createEmpPulse, updateProjectiles, firePlayerShots } from "./player.js";
import { EnemyDirector } from "./enemies.js";
import { UI, isInAppBrowser } from "./ui.js";
import { AudioEngine } from "./audio.js";
import { Editor } from "./editor.js";
import { generateCustomStage, importLevelFromFile } from "./customLevels.js";
import { EnemyDesigner } from "./enemyDesigner.js";
import { NetClient, RemoteInput, readInputPacket } from "./net.js";

const SCROLL_SPEED = 110;
const MAX_LEVEL = 3;
const SNAPSHOT_HZ = 30;
const INPUT_HZ = 30;

// --- Serialisering av spelläge för nätverksöverföring (värd → gäst) --------
function serializePlayer(p) {
  return {
    x: p.x, y: p.y, radius: p.radius, hp: p.hp, energy: p.energy, alive: p.alive, invuln: p.invuln,
    twinBeeMode: p.twinBeeMode, twinBeeSecret: p.twinBeeSecret,
    options: p.options.map((o) => ({ offset: o.offset })),
    powerCursor: p.powerCursor, speedLevel: p.speedLevel, doubleShot: p.doubleShot,
    missileEnabled: p.missileEnabled, laserEnabled: p.laserEnabled,
    powerMessage: p.powerMessage, powerMessageTimer: p.powerMessageTimer, powerFlash: p.powerFlash,
    stats: { maxHp: p.stats.maxHp, maxEnergy: p.stats.maxEnergy },
  };
}

function serializeEnemy(e) {
  return {
    id: e.id, type: e.type, sprite: e.sprite, x: e.x, y: e.y, radius: e.radius, color: e.color,
    hp: e.hp, kamikaze: e.kamikaze, facingAngle: e.facingAngle, spinner: e.spinner, spinAngle: e.spinAngle,
  };
}

function serializeBoss(b) {
  return {
    variant: b.variant, type: b.type, name: b.name, x: b.x, y: b.y, emerge: b.emerge, tilt: b.tilt,
    attackFlash: b.attackFlash, hp: b.hp, maxHp: b.maxHp, phase: b.phase, radius: b.radius, color: b.color,
    handPhase: b.handPhase, animPhase: b.animPhase, tentaclePhase: b.tentaclePhase,
  };
}

function serializeProjectile(p) {
  return {
    x: p.x, y: p.y, color: p.color, owner: p.owner, radius: p.radius, vx: p.vx, vy: p.vy,
    robot: p.robot, maxRadius: p.maxRadius, life: p.life,
  };
}

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.ui = new UI(uiRoot);
    this.save = getOrCreateSave({ DEFAULT_BUILD, DEFAULT_INVENTORY });

    this.state = "menu";
    this.lastTime = 0;
    this.player = null;
    this.stage = null;
    this.director = null;
    this.projectiles = [];
    this.lootOptions = [];
    this.scrollX = 0;
    this.runKills = 0;
    this.score = 0;
    this.bossDefeated = false;
    this.playBounds = null;
    this.currentLevel = 1;
    this.levelSeed = 0;
    this.levelTransition = 0;
    this.bossDefeatLock = false;
    this.audio = new AudioEngine();
    this.customLevel = null;
    this.editor = new Editor(canvas, uiRoot);
    this.editor.setHandler((action, data) => this._handleEditorAction(action, data));
    this.enemyDesigner = new EnemyDesigner(uiRoot);
    this.enemyDesigner.setHandler((action, data) => this._handleEnemyDesignerAction(action, data));
    this._designerReturnToEditor = false;

    // --- Multiplayer ---
    this.net = new NetClient();
    this.mpRole = null; // "host" | "guest" | null (solo)
    this.mpServerUrl = localStorage.getItem("starforge_mp_server") || "https://starforge-c429.onrender.com";
    this.remoteInput = new RemoteInput();
    this.teammate = null; // värd: en Player-instans för gästens skepp
    this.remoteSnapshot = null; // gäst: senaste mottagna state från värden
    this._guestPlayer = null; // gäst: lokalt förutsagt (predicted) eget skepp, för responsiv styrning
    this._guestScrollX = 0; // gäst: lokalt förutsagd scroll, jämnas mot värdens värde
    this._netInputAccum = 0;
    this._netSnapshotAccum = 0;
    this._pendingFx = [];
    this.mpCustomLevel = null; // värd: vald egen bana att spela tillsammans, annars standarduppdrag
    this._mpRoomCode = null;
    this._mpPeerConnected = false;
    this._setupNetHandlers();

    this.ui.setHandler((action, data) => this.handleAction(action, data));
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._bindAudioUnlock(uiRoot);
    this.ui.showMenu();
    requestAnimationFrame((t) => this.loop(t));
  }

  _bindAudioUnlock(uiRoot) {
    const tryIntro = () => {
      if (["menu", "hangar"].includes(this.state)) {
        this.audio.startIntroIfNeeded();
      }
    };
    uiRoot.addEventListener("pointerdown", tryIntro);
    this.canvas.addEventListener("pointerdown", tryIntro);
    document.addEventListener("keydown", tryIntro, { once: false });
  }

  _resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
    if (this.stage) this.stage.viewHeight = this.canvas.height;
    if (this.editor?.active) this.editor._rebuildCache();
  }

  fx(x, y, color, count = 12) {
    this.renderer.addExplosion(x, y, color, count);
    if (this.mpRole === "host") this._pendingFx.push({ x, y, color, count });
  }

  // --- Multiplayer: nätverkshantering --------------------------------
  _setupNetHandlers() {
    this.net.on("peer-left", () => {
      if (!this.mpRole) return;
      if (this.state === "mission" || this.state === "mp-lobby" || this.state === "mp-wait") {
        alert("Din medspelare har kopplat från.");
      }
    });
    this.net.on("input", (packet) => {
      if (this.mpRole === "host") this.remoteInput.applyPacket(packet);
    });
    this.net.on("snapshot", (snap) => {
      if (this.mpRole === "guest") this.remoteSnapshot = snap;
    });
    this.net.on("mission-start", (d) => {
      if (this.mpRole === "guest") this._guestStartMission(d);
    });
    this.net.on("level-file", (d) => {
      if (this.mpRole === "guest") this.ui.showGuestLobby(d.name);
    });
    this.net.on("next-level", (d) => {
      if (this.mpRole !== "guest") return;
      this.currentLevel = d.level;
      this.levelSeed = d.seed;
      this.stage = createStage(this.canvas.height, d.level, d.seed);
      if (d.twinBeeUnlocked) this.stage.twinBeeUnlocked = true;
      this._guestScrollX = 0;
      if (this._guestPlayer) {
        this._guestPlayer.scrollX = 0;
        this._guestPlayer.screenX = 60;
        this._guestPlayer.x = 60;
        this._guestPlayer.y = this.canvas.height * 0.5 + 30;
      }
    });
    this.net.on("state-change", (d) => {
      if (this.mpRole !== "guest") return;
      if (d.state === "mission") return;
      this.state = d.state;
      this.ui.showWaitingForHost(d.state);
    });
  }

  async _hostCreateRoom(serverUrl) {
    try {
      localStorage.setItem("starforge_mp_server", serverUrl);
      this.mpServerUrl = serverUrl;
      this.ui.showMultiplayerConnecting();
      const code = await this.net.createRoom(serverUrl, (attempts) => {
        if (attempts >= 2) this.ui.showMultiplayerConnecting(true);
      });
      this.mpRole = "host";
      this.state = "mp-lobby";
      this._mpRoomCode = code;
      this._mpPeerConnected = false;
      this.ui.showHostLobby(code, false, this.mpCustomLevel?.name || null);
      this.net.on("peer-joined", () => {
        this._mpPeerConnected = true;
        this.ui.showHostLobby(code, true, this.mpCustomLevel?.name || null);
        if (this.mpCustomLevel) this.net.send("level-file", { name: this.mpCustomLevel.name });
      });
    } catch (err) {
      alert("Kunde inte skapa rum: " + err.message + this._inAppBrowserHint());
      this.ui.showMultiplayerMenu(this.mpServerUrl);
    }
  }

  _inAppBrowserHint() {
    return isInAppBrowser()
      ? "\n\nDu verkar vara i en app-inbyggd webbläsare (Facebook/Messenger/Instagram m.fl.), som ofta blockerar den här typen av anslutning. Öppna sidan i Chrome eller Safari istället (via \"…\"-menyn eller \"Öppna i webbläsare\")."
      : "";
  }

  async _guestJoinRoom({ serverUrl, code }) {
    try {
      localStorage.setItem("starforge_mp_server", serverUrl);
      this.mpServerUrl = serverUrl;
      this.ui.showMultiplayerConnecting();
      await this.net.joinRoom(serverUrl, code, (attempts) => {
        if (attempts >= 2) this.ui.showMultiplayerConnecting(true);
      });
      this.mpRole = "guest";
      this.state = "mp-lobby";
      this.ui.showGuestLobby();
    } catch (err) {
      alert("Kunde inte ansluta: " + err.message + this._inAppBrowserHint());
      this.ui.showMultiplayerMenu(this.mpServerUrl);
    }
  }

  _leaveMultiplayer() {
    this.net.close();
    this.mpRole = null;
    this.teammate = null;
    this.remoteSnapshot = null;
    this.mpCustomLevel = null;
    this._mpRoomCode = null;
    this._mpPeerConnected = false;
    this.state = "menu";
    this.ui.showMenu();
  }

  _mpUploadLevel(file) {
    importLevelFromFile(file).then((level) => {
      this.mpCustomLevel = level;
      this.ui.showHostLobby(this._mpRoomCode, this._mpPeerConnected, level.name);
      if (this._mpPeerConnected) this.net.send("level-file", { name: level.name });
    }).catch(() => {
      alert("Kunde inte läsa banfilen. Är det en giltig Starforge-banfil?");
    });
  }

  handleAction(action, data) {
    this.audio.startIntroIfNeeded();
    switch (action) {
      case "menu":
        this.state = "menu";
        this.ui.showMenu();
        this.audio.startIntroIfNeeded();
        if (this.mpRole === "host") this.net.send("state-change", { state: "menu" });
        break;
      case "hangar":
        this.state = "hangar";
        this.ui.showHangar(this.save);
        this._startHangarPreview();
        if (this.mpRole === "host") this.net.send("state-change", { state: "hangar" });
        break;
      case "mission":
        this.startMission();
        break;
      case "editor":
        this.state = "editor";
        this.ui.clear();
        this.editor.open(this._draftLevel);
        break;
      case "enemy-designer":
        this._designerReturnToEditor = false;
        this.state = "enemyDesigner";
        this.ui.clear();
        this.enemyDesigner.open();
        break;
      case "play-custom":
        this._promptImportAndPlay();
        break;
      case "retry-custom":
        if (this.customLevel) {
          if (this.mpRole === "host") this._startHostCustomMission(this.customLevel);
          else this.startCustomMission(this.customLevel);
        }
        break;
      case "exit-to-editor":
        this._exitCustomTest();
        break;
      case "save":
        this.save = data;
        writeSave(this.save);
        break;
      case "toggle-twinbee":
        this.save.twinBeeMode = !this.save.twinBeeMode;
        writeSave(this.save);
        this.ui.showHangar(this.save);
        this._startHangarPreview();
        break;
      case "pick-loot":
        this.save.affixes = applyAffixes(this.save.affixes, data);
        writeSave(this.save);
        this.state = "hangar";
        this.ui.showHangar(this.save);
        this._startHangarPreview();
        if (this.mpRole === "host") this.net.send("state-change", { state: "hangar" });
        break;
      case "multiplayer":
        this.mpCustomLevel = null;
        this.state = "mp-menu";
        this.ui.showMultiplayerMenu(this.mpServerUrl);
        break;
      case "mp-host":
        this._hostCreateRoom(data);
        break;
      case "mp-join":
        this._guestJoinRoom(data);
        break;
      case "mp-upload-level":
        this._mpUploadLevel(data);
        break;
      case "mp-clear-level":
        this.mpCustomLevel = null;
        this.ui.showHostLobby(this._mpRoomCode, this._mpPeerConnected, null);
        if (this._mpPeerConnected) this.net.send("level-file", { name: null });
        break;
      case "mp-start-mission":
        this.startMission();
        break;
      case "mp-leave":
        this._leaveMultiplayer();
        break;
    }
  }

  _startHangarPreview() {
    const tick = () => {
      if (this.state !== "hangar") return;
      drawHangarPreview(document.getElementById("ship-preview-canvas"), this.save.twinBeeMode);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _handleEditorAction(action, data) {
    if (action === "play") {
      this._draftLevel = data;
      this.editor.close();
      this.startCustomMission(data);
    } else if (action === "exit") {
      this._draftLevel = { ...this.editor.level, customEnemies: this.editor.customEnemyDefs };
      this.editor.close();
      this.state = "menu";
      this.ui.showMenu();
    } else if (action === "design-enemy") {
      this._draftLevel = { ...this.editor.level, customEnemies: this.editor.customEnemyDefs };
      this.editor.close();
      this._designerReturnToEditor = true;
      this.state = "enemyDesigner";
      this.ui.clear();
      this.enemyDesigner.open(null, { returnToEditor: true });
    }
  }

  _handleEnemyDesignerAction(action, data) {
    if (action === "use-in-level") {
      this.enemyDesigner.close();
      this._designerReturnToEditor = false;
      this.state = "editor";
      this.ui.clear();
      this.editor.open(this._draftLevel);
      this.editor.addCustomEnemy(data);
    } else if (action === "exit") {
      this.enemyDesigner.close();
      if (this._designerReturnToEditor) {
        this._designerReturnToEditor = false;
        this.state = "editor";
        this.ui.clear();
        this.editor.open(this._draftLevel);
      } else {
        this.state = "menu";
        this.ui.showMenu();
      }
    }
  }

  _exitCustomTest() {
    if (!this.customLevel) return;
    this.audio.stopIntro();
    const level = this.customLevel;
    this.customLevel = null;
    this.state = "editor";
    this.ui.clear();
    this.editor.open(level);
  }

  _promptImportAndPlay() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          const level = await importLevelFromFile(file);
          this.startCustomMission(level);
        } catch {
          alert("Kunde inte läsa banfilen. Är det en giltig Starforge-banfil?");
        }
      }
      input.remove();
    });
    input.click();
  }

  startCustomMission(levelDef) {
    this.audio.stopIntro();
    this.state = "mission";
    this.ui.clear();

    const stats = computeStats(this.save.build, this.save.affixes);
    const vh = this.canvas.height;
    this.customLevel = levelDef;
    this.levelSeed = (Math.random() * 99999) | 0;
    this.currentLevel = 1;
    this.stage = generateCustomStage(levelDef, vh, this.levelSeed);
    this.stage.twinBeeUnlocked = false;
    this.scrollX = 0;

    const twinBee = this.save.twinBeeMode;
    this.player = new Player(stats, 0, 100, vh * 0.5, this.canvas.width, twinBee);
    this.teammate = null; // Co-op stöds inte för egna banor/baneditor i denna version.
    this.director = new EnemyDirector(this.stage, this.canvas.width);
    this.director.setTwinBeeMode(twinBee);

    this.projectiles = [];
    this.runKills = 0;
    this.score = 0;
    this.bossDefeated = false;
    this.bossDefeatLock = false;
    this.levelTransition = 0;

    this.save.runs++;
    writeSave(this.save);
    this.ui.showHUD(true);
  }

  startMission() {
    if (this.mpRole === "host" && this.mpCustomLevel) {
      this._startHostCustomMission(this.mpCustomLevel);
      return;
    }

    this.audio.stopIntro();
    this.state = "mission";
    this.ui.clear();

    const stats = computeStats(this.save.build, this.save.affixes);
    const vh = this.canvas.height;
    this.customLevel = null;
    this.levelSeed = (Math.random() * 99999) | 0;
    this.currentLevel = 1;
    this.stage = createStage(vh, 1, this.levelSeed);
    this.stage.twinBeeUnlocked = false;
    this.scrollX = 0;

    const twinBee = this.save.twinBeeMode;
    this.player = new Player(stats, 0, 100, vh * 0.5, this.canvas.width, twinBee);
    this.teammate = this.mpRole === "host"
      ? new Player(stats, 0, 60, vh * 0.5 + 30, this.canvas.width, twinBee)
      : null;
    this.director = new EnemyDirector(this.stage, this.canvas.width, this.mpRole === "host");
    this.director.setTwinBeeMode(twinBee);

    this.projectiles = [];
    this.runKills = 0;
    this.score = 0;
    this.bossDefeated = false;
    this.bossDefeatLock = false;
    this.levelTransition = 0;
    this._pendingFx = [];

    this.save.runs++;
    writeSave(this.save);
    this.ui.showHUD();

    if (this.mpRole === "host") {
      this.net.send("mission-start", { type: "standard", level: 1, seed: this.levelSeed, twinBee });
    }
  }

  // --- Värd: starta en egen bana tillsammans med gästen ----------------
  _startHostCustomMission(levelDef) {
    this.audio.stopIntro();
    this.state = "mission";
    this.ui.clear();

    const stats = computeStats(this.save.build, this.save.affixes);
    const vh = this.canvas.height;
    this.customLevel = levelDef;
    this.levelSeed = (Math.random() * 99999) | 0;
    this.currentLevel = 1;
    this.stage = generateCustomStage(levelDef, vh, this.levelSeed);
    this.stage.twinBeeUnlocked = false;
    this.scrollX = 0;

    const twinBee = this.save.twinBeeMode;
    this.player = new Player(stats, 0, 100, vh * 0.5, this.canvas.width, twinBee);
    this.teammate = new Player(stats, 0, 60, vh * 0.5 + 30, this.canvas.width, twinBee);
    this.director = new EnemyDirector(this.stage, this.canvas.width, true);
    this.director.setTwinBeeMode(twinBee);

    this.projectiles = [];
    this.runKills = 0;
    this.score = 0;
    this.bossDefeated = false;
    this.bossDefeatLock = false;
    this.levelTransition = 0;
    this._pendingFx = [];

    this.save.runs++;
    writeSave(this.save);
    this.ui.showHUD();

    this.net.send("mission-start", { type: "custom", level: levelDef, seed: this.levelSeed, twinBee });
  }

  // --- Gäst: spegling av värdens uppdrag (ingen egen simulering) -----
  _guestStartMission(d) {
    this.audio.stopIntro();
    this.state = "mission";
    this.ui.clear();
    if (d.type === "custom") {
      this.customLevel = d.level;
      this.currentLevel = 1;
      this.levelSeed = d.seed;
      this.stage = generateCustomStage(d.level, this.canvas.height, d.seed);
    } else {
      this.customLevel = null;
      this.currentLevel = d.level;
      this.levelSeed = d.seed;
      this.stage = createStage(this.canvas.height, d.level, d.seed);
    }
    this.scrollX = 0;
    this.remoteSnapshot = null;

    // Gästen simulerar sitt eget skepp lokalt (klientsidig förutsägelse) så att styrningen
    // känns direkt trots nätverksfördröjningen mot värden — som sedan mjukt rättas mot
    // värdens auktoritativa läge varje ögonblicksbild (snapshot).
    const stats = computeStats(this.save.build, this.save.affixes);
    this._guestScrollX = 0;
    this._guestPlayer = new Player(stats, 0, 60, this.canvas.height * 0.5 + 30, this.canvas.width, d.twinBee);

    this.ui.showHUD();
  }

  loop(now) {
    const dt = Math.min(0.033, (now - this.lastTime) / 1000 || 0.016);
    this.lastTime = now;
    if (this.state === "mission" && this.mpRole === "guest") {
      this._updateGuestMission(dt);
    } else if (this.state === "mission") {
      this.updateMission(dt);
      this.drawMission();
    } else if (this.state === "editor") {
      this.editor.update(dt);
      this.editor.draw();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  updateMission(dt) {
    const { stage, director, input, renderer } = this;
    const isHost = this.mpRole === "host" && this.teammate;
    const players = isHost ? [this.player, this.teammate] : [this.player];
    const inputSources = isHost ? [input, this.remoteInput] : [input];

    if (this.customLevel && !this.mpRole && input.wasPressed("Escape")) {
      this._exitCustomTest();
      input.endFrame();
      return;
    }

    if (this.levelTransition > 0) {
      this.levelTransition -= dt;
      renderer.update(dt);
      input.endFrame();
      this._maybeSendSnapshot(dt);
      return;
    }

    const scrollDelta = SCROLL_SPEED * dt * (0.85 + this.player.speedLevel * 0.04);
    const bossActive = director.boss && director.boss.hp > 0;
    if (!bossActive) this.scrollX += scrollDelta;
    for (const p of players) {
      p.scrollX = this.scrollX;
      p.syncWorldX();
    }

    players.forEach((player, i) => {
      const src = inputSources[i];
      const bounds = getPlayBounds(stage, player.x);
      const playBounds = { ...bounds, minX: 0, maxX: 0 };
      player.update(dt, src, stage.obstacles, playBounds);
      if (i === 0) this.playBounds = playBounds;

      if (checkTerrainCrash(player, stage)) {
        renderer.shake = 12;
        this.fx(player.x, player.y, "#ff4400", 28);
      }

      if (checkSecretGaps(stage, player)) {
        player.enableTwinBeeSecret();
        director.setTwinBeeMode(true);
        renderer.showTwinBeeBanner();
      }

      player.activateCooldown = Math.max(0, player.activateCooldown - dt);
      if (src.wasPressed("Enter", "KeyE") && player.activateCooldown <= 0) {
        const slot = player.activatePower();
        if (slot) renderer.shake = Math.min(renderer.shake + 2, 6);
        player.activateCooldown = 0.25;
      }

      const firing = src.isDown("Space", "KeyZ") || src.mouse.down;
      if (firing && player.canFirePrimary()) {
        firePlayerShots(player, player.firePrimary(), this.projectiles);
      }

      if (src.isDown("KeyX", "ShiftLeft") && player.canFireSecondary()) {
        const w = player.fireSecondary();
        if (w.id === "emp") {
          this.projectiles.push(createEmpPulse(player.x, player.y, w, player.stats.damageMult));
          this.fx(player.x, player.y, w.color, 16);
        } else {
          this.projectiles.push(createProjectile(player, player.x + 10, player.y - 10, -0.35, w));
          this.projectiles.push(createProjectile(player, player.x + 10, player.y + 10, 0.35, w));
        }
      }
    });

    director.update(dt, this.scrollX, players, this.projectiles, (enemy, hitPlayer) => {
      if (enemy.id === "boss") return;
      this.fx(enemy.x, enemy.y, enemy.color, 16);
      if (hitPlayer) this.fx(hitPlayer.x, hitPlayer.y, "#ff4400", 10);
      renderer.shake = Math.min(renderer.shake + 4, 10);
      this.runKills++;
      this.score += enemy.score || 100;
      director.onEnemyKilled(enemy, hitPlayer || players[0]);
    });

    const onHit = (enemy) => {
      if (enemy.id === "boss") return;
      if (enemy.hp <= 0) {
        this.fx(enemy.x, enemy.y, enemy.color, 12);
        this.runKills++;
        this.score += enemy.score || 100;
        director.onEnemyKilled(enemy, players[0]);
      }
    };

    this.projectiles = updateProjectiles(
      this.projectiles, dt, stage.obstacles,
      director.allTargets, players, onHit, renderer,
      stage.groundCannons || [], stage
    );

    const boss = director.boss;
    if (boss && boss.hp <= 0 && !this.bossDefeatLock) {
      this.fx(boss.x, boss.y, boss.color || "#884422", 45);
      this._onBossDefeated(boss);
    }

    this.projectiles = this.projectiles.filter((p) => p.life > 0);
    renderer.update(dt);

    if (players.every((p) => !p.alive)) {
      this.state = "gameover";
      this.ui.showGameOver(false, !!this.customLevel);
      if (this.mpRole === "host") this.net.send("state-change", { state: "gameover" });
    }

    input.endFrame();
    this._maybeSendSnapshot(dt);
  }

  _maybeSendSnapshot(dt) {
    if (this.mpRole !== "host") return;
    this._netSnapshotAccum += dt;
    if (this._netSnapshotAccum < 1 / SNAPSHOT_HZ) return;
    this._netSnapshotAccum = 0;
    this.net.send("snapshot", this._buildSnapshot());
    this._pendingFx = [];
  }

  _buildSnapshot() {
    const { stage, director, renderer } = this;
    const players = [this.player, this.teammate];
    return {
      scrollX: this.scrollX,
      score: this.score,
      currentLevel: this.currentLevel,
      shake: renderer.shake,
      twinBeeBanner: renderer.twinBeeBanner,
      levelBanner: renderer.levelBanner,
      levelBannerText: renderer.levelBannerText,
      twinBeeMode: director.twinBeeMode,
      players: players.map((p) => (p ? serializePlayer(p) : null)),
      enemies: director.enemies.filter((e) => e.hp > 0).map(serializeEnemy),
      boss: director.boss && director.boss.hp > 0 ? serializeBoss(director.boss) : null,
      projectiles: this.projectiles.map(serializeProjectile),
      pickups: director.pickups.map((c) => ({ x: c.x, y: c.y, bob: c.bob, kind: c.kind, color: c.color })),
      obstacles: stage.obstacles.map((o) => ({ hp: o.hp })),
      groundCannons: (stage.groundCannons || []).map((c) => ({
        hp: c.hp, fireCooldown: c.fireCooldown, fireCooldownMax: c.fireCooldownMax, animPhase: c.animPhase,
      })),
      secretGapsPassed: stage.secretGaps.map((g) => g.passed),
      fx: this._pendingFx,
    };
  }

  // --- Gäst: nätverksdriven loop (ingen lokal simulering) -------------
  _updateGuestMission(dt) {
    // "wasPressed" är en engångsflagga per lokal frame — samla den tills vi faktiskt
    // skickar ett input-paket, annars kan korta knapptryck (t.ex. Enter) tappas bort
    // mellan de nätverkspaket vi skickar (INPUT_HZ < skärmens uppdateringsfrekvens).
    if (this.input.wasPressed("Enter", "KeyE")) this._pendingActivate = true;

    this._netInputAccum += dt;
    if (this._netInputAccum >= 1 / INPUT_HZ) {
      this._netInputAccum = 0;
      const packet = readInputPacket(this.input);
      packet.activate = packet.activate || this._pendingActivate;
      this._pendingActivate = false;
      this.net.send("input", packet);
    }

    this._predictGuestPlayer(dt);

    this.input.endFrame();
    this.renderer.update(dt);
    this._drawGuestMission();
  }

  // --- Gäst: förutsäg eget skepp lokalt varje bildruta (istället för att vänta på värdens
  // ögonblicksbild) för att styrningen ska kännas responsiv trots nätverksfördröjningen.
  // Rättas därefter mjukt mot värdens auktoritativa position/tillstånd så de aldrig glider isär. ---
  _predictGuestPlayer(dt) {
    const gp = this._guestPlayer;
    if (!gp || !this.stage) return;
    const snap = this.remoteSnapshot;
    const bossActive = !!(snap?.boss && snap.boss.hp > 0);
    const transitioning = (snap?.levelBanner || 0) > 0;

    if (!bossActive && !transitioning) {
      this._guestScrollX += SCROLL_SPEED * dt * (0.85 + gp.speedLevel * 0.04);
    }
    if (snap) {
      const diff = snap.scrollX - this._guestScrollX;
      // Stora hopp (t.ex. nivåbyte) rättas direkt, mindre glidningar jämnas ut mjukt.
      this._guestScrollX += Math.abs(diff) > 300 ? diff : diff * Math.min(1, dt * 3);
    }

    gp.scrollX = this._guestScrollX;
    gp.syncWorldX();
    const bounds = getPlayBounds(this.stage, gp.x);
    const playBounds = { ...bounds, minX: 0, maxX: 0 };
    gp.update(dt, this.input, this.stage.obstacles, playBounds);

    const authoritative = snap?.players?.[1];
    if (!authoritative) return;

    gp.hp = authoritative.hp;
    gp.energy = authoritative.energy;
    gp.alive = authoritative.alive;
    gp.invuln = authoritative.invuln;
    gp.twinBeeMode = authoritative.twinBeeMode;
    gp.twinBeeSecret = authoritative.twinBeeSecret;
    gp.options = authoritative.options;
    gp.powerCursor = authoritative.powerCursor;
    gp.speedLevel = authoritative.speedLevel;
    gp.doubleShot = authoritative.doubleShot;
    gp.missileEnabled = authoritative.missileEnabled;
    gp.laserEnabled = authoritative.laserEnabled;
    gp.powerMessage = authoritative.powerMessage;
    gp.powerMessageTimer = authoritative.powerMessageTimer;
    gp.powerFlash = authoritative.powerFlash;

    if (!authoritative.alive) return;
    const worldX = this._guestScrollX + gp.screenX;
    const dx = authoritative.x - worldX;
    const dy = authoritative.y - gp.y;
    const dist = Math.hypot(dx, dy);
    // Nudga positionen mot värdens svar; hoppa direkt vid stora avvikelser (t.ex. respawn).
    const correction = dist > 220 ? 1 : Math.min(1, dt * 6);
    gp.screenX += dx * correction;
    gp.y += dy * correction;
    gp.x = this._guestScrollX + gp.screenX;
  }

  _drawGuestMission() {
    const snap = this.remoteSnapshot;
    const { renderer, stage } = this;
    if (!snap || !stage) return;
    const scrollX = this._guestScrollX;

    renderer.shake = Math.max(renderer.shake, snap.shake || 0);
    if (snap.twinBeeBanner > renderer.twinBeeBanner) renderer.twinBeeBanner = snap.twinBeeBanner;
    if (snap.levelBanner > renderer.levelBanner) {
      renderer.levelBanner = snap.levelBanner;
      renderer.levelBannerText = snap.levelBannerText;
    }
    for (const f of snap.fx || []) renderer.addExplosion(f.x, f.y, f.color, f.count);

    (snap.obstacles || []).forEach((o, i) => { if (stage.obstacles[i]) stage.obstacles[i].hp = o.hp; });
    (snap.groundCannons || []).forEach((c, i) => {
      if (stage.groundCannons?.[i]) Object.assign(stage.groundCannons[i], c);
    });
    (snap.secretGapsPassed || []).forEach((passed, i) => {
      if (stage.secretGaps[i]) stage.secretGaps[i].passed = passed;
    });

    renderer.beginSideScroll(scrollX, stage.viewHeight, stage.biomeOffset || 0, stage.biomeAt || null);
    renderer.drawStageMountains(stage);

    for (const p of snap.projectiles || []) {
      if (p.maxRadius !== undefined) renderer.drawEmpRing(p);
      else renderer.drawGradiusBullet(p);
    }

    for (const c of snap.pickups || []) {
      if (snap.twinBeeMode) renderer.drawBell(c);
      else renderer.drawPowerCapsule(c);
    }

    for (const obs of stage.obstacles) {
      if (obs.hp > 0) renderer.drawFloatingRock(obs);
    }

    if (stage.groundCannons) {
      for (const c of stage.groundCannons) {
        if (c.hp > 0) renderer.drawGroundCannon(c);
      }
    }

    for (const e of snap.enemies || []) renderer.drawGradiusEnemy(e);

    if (snap.boss) renderer.drawBoss(snap.boss);

    const host = snap.players?.[0];
    if (host && host.alive) renderer.drawShip(host);
    // Eget skepp ritas från den lokalt förutsagda (predicted) positionen, inte den (äldre)
    // ögonblicksbilden från värden, för att kännas responsivt.
    if (this._guestPlayer && this._guestPlayer.alive) renderer.drawShip(this._guestPlayer);

    renderer.drawParticlesWorld();
    renderer.endSideScroll();

    const own = this._guestPlayer || snap.players?.[1]; // gästen är alltid index 1 i players-arrayen
    if (own) {
      renderer.drawGradiusHUD(own, snap.score, scrollX, stage.bossZoneX, snap.boss, snap.currentLevel);
    }
  }

  _onBossDefeated(boss) {
    if (this.bossDefeatLock) return;
    this.bossDefeatLock = true;

    this.audio.playBossDefeat();
    this.score += boss?.score || 5000;
    this.save.bosses++;
    writeSave(this.save);

    if (!this.customLevel && this.currentLevel < MAX_LEVEL) {
      this._startNextLevel();
      return;
    }

    this.bossDefeated = true;
    this.save.kills += this.runKills;
    writeSave(this.save);
    this.lootOptions = [rollLoot(), rollLoot(), rollLoot()];
    this.state = "loot";
    this.ui.showLoot(this.lootOptions, this.currentLevel);
    if (this.mpRole === "host") this.net.send("state-change", { state: "loot" });
  }

  _startNextLevel() {
    const { renderer, director } = this;
    const players = this.teammate ? [this.player, this.teammate] : [this.player];
    const vh = this.canvas.height;

    this.currentLevel++;
    this.levelSeed = (Math.random() * 99999) | 0;
    this.stage = createStage(vh, this.currentLevel, this.levelSeed);
    const twinBeeUnlocked = players.some((p) => p.twinBeeSecret || p.twinBeeMode);
    if (twinBeeUnlocked) this.stage.twinBeeUnlocked = true;

    this.scrollX = 0;
    players.forEach((p, i) => {
      p.scrollX = 0;
      p.screenX = i === 0 ? 100 : 60;
      p.x = p.screenX;
      p.y = vh * 0.5 + (i === 0 ? 0 : 30);
      p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.3);
      p.energy = p.stats.maxEnergy;
    });

    director.resetForLevel(this.stage);
    director.setTwinBeeMode(twinBeeUnlocked);
    director.boss = null;

    this.projectiles = [];
    this.bossDefeatLock = false;
    this.levelTransition = 2.8;

    renderer.shake = 14;
    renderer.showLevelBanner(this.currentLevel);
    this.fx(this.player.x, this.player.y, "#00ffcc", 35);

    if (this.mpRole === "host") {
      this.net.send("next-level", { level: this.currentLevel, seed: this.levelSeed, twinBeeUnlocked });
    }
  }

  drawMission() {
    const { renderer, stage, director, projectiles, scrollX } = this;
    const players = this.teammate ? [this.player, this.teammate] : [this.player];

    renderer.beginSideScroll(scrollX, stage.viewHeight, stage.biomeOffset || 0, stage.biomeAt || null);
    renderer.drawStageMountains(stage);

    for (const p of projectiles) {
      if (p.maxRadius !== undefined) renderer.drawEmpRing(p);
      else renderer.drawGradiusBullet(p);
    }

    for (const c of director.pickups) {
      if (director.twinBeeMode) renderer.drawBell(c);
      else renderer.drawPowerCapsule(c);
    }

    for (const obs of stage.obstacles) {
      if (obs.hp > 0) renderer.drawFloatingRock(obs);
    }

    if (stage.groundCannons) {
      for (const c of stage.groundCannons) {
        if (c.hp > 0) renderer.drawGroundCannon(c);
      }
    }

    for (const e of director.enemies) {
      if (e.hp > 0) renderer.drawGradiusEnemy(e);
    }

    if (director.boss && director.boss.hp > 0) {
      renderer.drawBoss(director.boss);
    }

    for (const p of players) {
      if (p.alive) renderer.drawShip(p);
    }

    renderer.drawParticlesWorld();
    renderer.endSideScroll();
    renderer.drawGradiusHUD(this.player, this.score, scrollX, stage.bossZoneX, director.boss, this.currentLevel);
    if (this.teammate) renderer.drawTeammateStatus(this.teammate);
  }
}
