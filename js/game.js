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
import { UI } from "./ui.js";
import { AudioEngine } from "./audio.js";
import { Editor } from "./editor.js";
import { generateCustomStage, importLevelFromFile } from "./customLevels.js";
import { EnemyDesigner } from "./enemyDesigner.js";

const SCROLL_SPEED = 110;
const MAX_LEVEL = 3;

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
    this.powerActivateCooldown = 0;
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

  handleAction(action, data) {
    this.audio.startIntroIfNeeded();
    switch (action) {
      case "menu":
        this.state = "menu";
        this.ui.showMenu();
        this.audio.startIntroIfNeeded();
        break;
      case "hangar":
        this.state = "hangar";
        this.ui.showHangar(this.save);
        this._startHangarPreview();
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
        if (this.customLevel) this.startCustomMission(this.customLevel);
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
    this.director = new EnemyDirector(this.stage, this.canvas.width);
    this.director.setTwinBeeMode(twinBee);

    this.projectiles = [];
    this.runKills = 0;
    this.score = 0;
    this.bossDefeated = false;
    this.bossDefeatLock = false;
    this.levelTransition = 0;
    this.powerActivateCooldown = 0;

    this.save.runs++;
    writeSave(this.save);
    this.ui.showHUD(true);
  }

  startMission() {
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
    this.director = new EnemyDirector(this.stage, this.canvas.width);
    this.director.setTwinBeeMode(twinBee);

    this.projectiles = [];
    this.runKills = 0;
    this.score = 0;
    this.bossDefeated = false;
    this.bossDefeatLock = false;
    this.levelTransition = 0;
    this.powerActivateCooldown = 0;

    this.save.runs++;
    writeSave(this.save);
    this.ui.showHUD();
  }

  loop(now) {
    const dt = Math.min(0.033, (now - this.lastTime) / 1000 || 0.016);
    this.lastTime = now;
    if (this.state === "mission") {
      this.updateMission(dt);
      this.drawMission();
    } else if (this.state === "editor") {
      this.editor.update(dt);
      this.editor.draw();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  updateMission(dt) {
    const { player, stage, director, input, renderer } = this;

    if (this.customLevel && input.wasPressed("Escape")) {
      this._exitCustomTest();
      input.endFrame();
      return;
    }

    if (this.levelTransition > 0) {
      this.levelTransition -= dt;
      renderer.update(dt);
      input.endFrame();
      return;
    }

    const scrollDelta = SCROLL_SPEED * dt * (0.85 + player.speedLevel * 0.04);
    const bossActive = director.boss && director.boss.hp > 0;
    if (!bossActive) this.scrollX += scrollDelta;
    player.scrollX = this.scrollX;
    player.syncWorldX();

    const bounds = getPlayBounds(stage, player.x);
    this.playBounds = { ...bounds, minX: 0, maxX: 0 };
    player.update(dt, input, stage.obstacles, this.playBounds);

    if (checkTerrainCrash(player, stage)) {
      renderer.shake = 12;
      renderer.addExplosion(player.x, player.y, "#ff4400", 28);
    }

    if (checkSecretGaps(stage, player)) {
      player.enableTwinBeeSecret();
      director.setTwinBeeMode(true);
      renderer.showTwinBeeBanner();
    }

    this.powerActivateCooldown = Math.max(0, this.powerActivateCooldown - dt);
    if (input.wasPressed("Enter", "KeyE") && this.powerActivateCooldown <= 0) {
      const slot = player.activatePower();
      if (slot) renderer.shake = Math.min(renderer.shake + 2, 6);
      this.powerActivateCooldown = 0.25;
    }

    const firing = input.isDown("Space", "KeyZ") || input.mouse.down;
    if (firing && player.canFirePrimary()) {
      firePlayerShots(player, player.firePrimary(), this.projectiles);
    }

    if (input.isDown("KeyX", "ShiftLeft") && player.canFireSecondary()) {
      const w = player.fireSecondary();
      if (w.id === "emp") {
        this.projectiles.push(createEmpPulse(player.x, player.y, w, player.stats.damageMult));
        renderer.addExplosion(player.x, player.y, w.color, 16);
      } else {
        this.projectiles.push(createProjectile(player, player.x + 10, player.y - 10, -0.35, w));
        this.projectiles.push(createProjectile(player, player.x + 10, player.y + 10, 0.35, w));
      }
    }

    director.update(dt, this.scrollX, player, this.projectiles, (enemy) => {
      if (enemy.id === "boss") return;
      renderer.addExplosion(enemy.x, enemy.y, enemy.color, 16);
      renderer.addExplosion(player.x, player.y, "#ff4400", 10);
      renderer.shake = Math.min(renderer.shake + 4, 10);
      this.runKills++;
      this.score += enemy.score || 100;
      director.onEnemyKilled(enemy, player);
    });

    const onHit = (enemy) => {
      if (enemy.id === "boss") return;
      if (enemy.hp <= 0) {
        renderer.addExplosion(enemy.x, enemy.y, enemy.color, 12);
        this.runKills++;
        this.score += enemy.score || 100;
        director.onEnemyKilled(enemy, player);
      }
    };

    this.projectiles = updateProjectiles(
      this.projectiles, dt, stage.obstacles,
      director.allTargets, player, onHit, renderer,
      stage.groundCannons || []
    );

    const boss = director.boss;
    if (boss && boss.hp <= 0 && !this.bossDefeatLock) {
      renderer.addExplosion(boss.x, boss.y, boss.color || "#884422", 45);
      this._onBossDefeated(boss);
    }

    this.projectiles = this.projectiles.filter((p) => p.life > 0);
    renderer.update(dt);

    if (!player.alive) {
      this.state = "gameover";
      this.ui.showGameOver(false, !!this.customLevel);
    }

    input.endFrame();
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
  }

  _startNextLevel() {
    const { player, renderer, director } = this;
    const vh = this.canvas.height;

    this.currentLevel++;
    this.levelSeed = (Math.random() * 99999) | 0;
    this.stage = createStage(vh, this.currentLevel, this.levelSeed);
    if (player.twinBeeSecret || player.twinBeeMode) {
      this.stage.twinBeeUnlocked = true;
    }

    this.scrollX = 0;
    player.scrollX = 0;
    player.screenX = 100;
    player.x = 100;
    player.y = vh * 0.5;
    player.hp = Math.min(player.stats.maxHp, player.hp + player.stats.maxHp * 0.3);
    player.energy = player.stats.maxEnergy;

    director.resetForLevel(this.stage);
    director.setTwinBeeMode(player.twinBeeMode || player.twinBeeSecret);
    director.boss = null;

    this.projectiles = [];
    this.bossDefeatLock = false;
    this.levelTransition = 2.8;

    renderer.shake = 14;
    renderer.showLevelBanner(this.currentLevel);
    renderer.addExplosion(player.x, player.y, "#00ffcc", 35);
  }

  drawMission() {
    const { renderer, stage, player, director, projectiles, scrollX } = this;

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

    if (player.alive) renderer.drawShip(player);

    renderer.drawParticlesWorld();
    renderer.endSideScroll();
    renderer.drawGradiusHUD(player, this.score, scrollX, stage.bossZoneX, director.boss, this.currentLevel);
  }
}
