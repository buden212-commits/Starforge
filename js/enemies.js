import { ENEMY_TYPES } from "./data.js";
import { createProjectile } from "./player.js";
import { sampleRidge, getPlayBounds, clampToTunnel } from "./terrain.js";

let nextId = 1;

function buildEnemyFromDef(def, type, x, y) {
  return {
    id: nextId++,
    type,
    sprite: def.sprite || type,
    customSprite: def.customSprite || null,
    name: def.name,
    x, y,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    damage: def.damage,
    radius: def.radius,
    color: def.color,
    score: def.score,
    angle: Math.PI,
    fireCooldown: 1.4 + Math.random() * 1.2,
    stun: 0,
    kamikaze: def.kamikaze || false,
    turret: def.turret || false,
    sniper: def.sniper || false,
    carrier: def.carrier || false,
    spinner: def.spinner || false,
    sine: def.sine || false,
    shoots: def.shoots !== false,
    weaponPattern: def.weaponPattern || "single",
    spinAngle: Math.random() * Math.PI * 2,
    dropsPower: rollPowerDrop(type),
  };
}

export function spawnEnemy(type, x, y) {
  const def = ENEMY_TYPES[type] || ENEMY_TYPES.scout;
  return buildEnemyFromDef(def, type, x, y);
}

export function spawnCustomEnemy(runtimeDef, x, y) {
  return buildEnemyFromDef(runtimeDef, "custom", x, y);
}

/** Väljer den levande spelare som ligger närmast punkten (x, y). Stödjer både en enda Player och en array. */
function nearestPlayer(players, x, y) {
  const list = Array.isArray(players) ? players : [players];
  let best = null;
  let bestDist = Infinity;
  for (const p of list) {
    if (!p || !p.alive) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best || list[0];
}

function fireEnemyShot(e, player, projectiles, { speed = 360, color, aim } = {}) {
  const shotAim = aim ?? Math.atan2(player.y - e.y, player.x - e.x);
  const shotColor = color || e.color;
  if (e.weaponPattern === "spread") {
    for (const off of [-0.22, 0, 0.22]) {
      projectiles.push(createProjectile("enemy", e.x, e.y, shotAim + off, {
        damage: e.damage, projectileSpeed: speed, color: shotColor,
      }));
    }
  } else if (e.weaponPattern === "homing") {
    projectiles.push(createProjectile("enemy", e.x, e.y, shotAim, {
      damage: Math.max(6, Math.round(e.damage * 0.8)),
      projectileSpeed: Math.max(130, speed * 0.45),
      color: shotColor,
      homing: true,
      robot: true,
    }));
  } else {
    projectiles.push(createProjectile("enemy", e.x, e.y, shotAim, {
      damage: e.damage, projectileSpeed: speed, color: shotColor,
    }));
  }
}

function rollPowerDrop(type) {
  if (["swarm", "kamikaze", "spinner"].includes(type)) return false;
  if (["scout", "blue_interceptor", "red_fighter"].includes(type)) return Math.random() < 0.06;
  if (["rin", "sniper", "beetle", "purple_destroyer"].includes(type)) return Math.random() < 0.10;
  return Math.random() < 0.14;
}

function buildEncounterScript(stage) {
  const encounters = [];
  const start = 350;
  const end = stage.bossZoneX - 700;
  const level = stage.level || 1;
  const count = 28 + (level - 1) * 6;
  const step = (end - start) / count;

  const pool = [
    formationV, formationLine, formationSine, formationPincer,
    formationTurret, formationMixed, formationKamikaze, formationElite,
    formationCarrier, formationSpinnerRing,
  ];

  for (let i = 0; i < count; i++) {
    const x = start + i * step + (i % 4) * 35;
    encounters.push({ x, spawn: pool[i % pool.length] });
  }
  return encounters;
}

function formationV(stage, x, viewW) {
  const sx = x + viewW + 30;
  const cy = stage.viewHeight * 0.5;
  return [
    spawnEnemy("scout", sx, cy - 80),
    spawnEnemy("red_fighter", sx + 40, cy - 40),
    spawnEnemy("blue_interceptor", sx + 40, cy + 40),
    spawnEnemy("scout", sx, cy + 80),
  ];
}

function formationLine(stage, x, viewW) {
  const sx = x + viewW + 20;
  const out = [];
  for (let i = 0; i < 6; i++) {
    out.push(spawnEnemy(i % 2 ? "rin" : "scout", sx + i * 45, 100 + i * (stage.viewHeight - 200) / 5));
  }
  return out;
}

function formationSine(stage, x, viewW) {
  const sx = x + viewW;
  return Array.from({ length: 5 }, (_, i) =>
    spawnEnemy("swarm", sx + i * 35, stage.viewHeight * 0.3 + i * 45)
  );
}

function formationPincer(stage, x, viewW) {
  const sx = x + viewW + 50;
  return [
    spawnEnemy("purple_destroyer", sx, stage.viewHeight * 0.28),
    spawnEnemy("purple_destroyer", sx, stage.viewHeight * 0.72),
    spawnEnemy("sniper", sx + 80, stage.viewHeight * 0.5),
  ];
}

function formationTurret(stage, x, viewW) {
  const sx = x + viewW + 10;
  const mid = stage.viewHeight * 0.5;
  return [
    spawnEnemy("turret", sx, mid - 60),
    spawnEnemy("turret", sx, mid + 60),
    spawnEnemy("blue_interceptor", sx + 100, mid),
  ];
}

function formationMixed(stage, x, viewW) {
  const sx = x + viewW + 40;
  return [
    spawnEnemy("beetle", sx, stage.viewHeight * 0.5),
    spawnEnemy("swarm", sx + 60, stage.viewHeight * 0.35),
    spawnEnemy("swarm", sx + 60, stage.viewHeight * 0.65),
    spawnEnemy("red_fighter", sx + 20, stage.viewHeight * 0.5),
  ];
}

function formationKamikaze(stage, x, viewW) {
  const sx = x + viewW;
  return [
    spawnEnemy("kamikaze", sx, stage.viewHeight * 0.2),
    spawnEnemy("kamikaze", sx + 20, stage.viewHeight * 0.8),
    spawnEnemy("spinner", sx + 50, stage.viewHeight * 0.5),
  ];
}

function formationElite(stage, x, viewW) {
  const sx = x + viewW + 60;
  return [
    spawnEnemy("rin", sx, stage.viewHeight * 0.4),
    spawnEnemy("rin", sx, stage.viewHeight * 0.6),
    spawnEnemy("sniper", sx + 40, stage.viewHeight * 0.5),
  ];
}

function formationCarrier(stage, x, viewW) {
  const sx = x + viewW + 20;
  const c = spawnEnemy("carrier", sx, stage.viewHeight * 0.5);
  return [c,
    spawnEnemy("swarm", sx + 30, stage.viewHeight * 0.4),
    spawnEnemy("swarm", sx + 30, stage.viewHeight * 0.6),
  ];
}

function formationSpinnerRing(stage, x, viewW) {
  const sx = x + viewW + 40;
  const cy = stage.viewHeight * 0.5;
  return Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 8;
    return spawnEnemy("spinner", sx + Math.cos(a) * 50, cy + Math.sin(a) * 50);
  });
}

export class EnemyDirector {
  constructor(stage, viewWidth) {
    this.stage = stage;
    this.viewWidth = viewWidth;
    this.enemies = [];
    this.capsules = [];
    this.bells = [];
    this.encounters = stage.encounterScript || buildEncounterScript(stage);
    this.spawnedIds = new Set();
    this.bossSpawned = false;
    this.boss = null;
    this.scrollX = 0;
    this.twinBeeMode = false;
    this.level = stage.level || 1;
    this.rearTimer = 4;
    this.isCustom = !!stage.isCustom;
  }

  setTwinBeeMode(on) {
    this.twinBeeMode = on;
  }

  resetForLevel(stage) {
    this.stage = stage;
    this.enemies = [];
    this.capsules = [];
    this.bells = [];
    this.encounters = buildEncounterScript(stage);
    this.spawnedIds = new Set();
    this.bossSpawned = false;
    this.boss = null;
    this.level = stage.level || 1;
    this.rearTimer = 4;
    this.isCustom = !!stage.isCustom;
  }

  update(dt, scrollX, players, projectiles, onEnemyDestroyed = null) {
    this.scrollX = scrollX;
    const playerList = (Array.isArray(players) ? players : [players]).filter(Boolean);
    const anchor = playerList.find((p) => p.alive) || playerList[0];

    if (this.boss && this.boss.hp > 0) {
      this._updateBoss(dt, playerList, projectiles);
      if (this.level >= 3 || (this.isCustom && this.stage.groundCannons?.length)) {
        updateGroundCannons(this.stage.groundCannons, dt, playerList, projectiles, scrollX, this.viewWidth);
      }
      this._movePickups(dt, playerList);
      return;
    }

    this.encounters.forEach((enc, i) => {
      if (this.spawnedIds.has(i)) return;
      if (scrollX >= enc.x - this.viewWidth * 0.3) {
        this.spawnedIds.add(i);
        const group = enc.spawn(this.stage, enc.x, this.viewWidth);
        for (const e of group) e.y = clampToTunnel(e.x, e.y, e.radius, this.stage);
        this.enemies.push(...group);
      }
    });

    if (!this.bossSpawned && scrollX >= this.stage.bossZoneX - 200) {
      this.bossSpawned = true;
      this.enemies = this.enemies.filter((e) => e.hp > 0);
      const arenaX = scrollX + this.viewWidth * 0.52;
      const bounds = getPlayBounds(this.stage, arenaX);
      const midY = (bounds.top + bounds.bottom) * 0.5;
      this.boss = this.stage.bossConfig
        ? createBossFromConfig(this.stage.bossConfig, arenaX, midY, this.stage.viewHeight, bounds.bottom - 40)
        : createRandomBoss(arenaX, midY, this.stage.viewHeight, bounds.bottom - 40, this.stage.level || 1);
      this.boss.arenaX = arenaX;
    }

    this._updateEnemies(dt, playerList, projectiles, onEnemyDestroyed);
    const cullX = scrollX - 500;
    this.enemies = this.enemies.filter((e) => e.hp > 0 && (e.fromRear || e.x > cullX));

    if (this.level >= 2) {
      this.rearTimer -= dt;
      if (this.rearTimer <= 0) {
        this.rearTimer = 2.8 + Math.random() * 2.2;
        this._spawnFromRear(scrollX, anchor);
      }
    }

    if (this.level >= 3 || (this.isCustom && this.stage.groundCannons?.length)) {
      updateGroundCannons(this.stage.groundCannons, dt, playerList, projectiles, scrollX, this.viewWidth);
    }

    this._movePickups(dt, playerList);
  }

  _spawnFromRear(scrollX, player) {
    const bounds = getPlayBounds(this.stage, scrollX);
    const x = scrollX - 55;
    const y = Math.max(bounds.top + 30, Math.min(bounds.bottom - 30,
      player.y + (Math.random() - 0.5) * (bounds.bottom - bounds.top) * 0.7));
    const types = ["kamikaze", "scout", "red_fighter", "spinner"];
    const type = types[Math.floor(Math.random() * types.length)];
    const e = spawnEnemy(type, x, y);
    e.fromRear = true;
    e.rearSpeed = e.speed * (1.1 + Math.random() * 0.4);
    this.enemies.push(e);
  }

  _resolveShipCollision(e, players, onEnemyDestroyed) {
    if (e.hp <= 0) return;
    const list = Array.isArray(players) ? players : [players];
    for (const player of list) {
      if (!player || !player.alive) continue;
      if (Math.hypot(player.x - e.x, player.y - e.y) >= e.radius + player.radius) continue;
      const dmg = e.kamikaze ? e.damage : Math.max(10, Math.round(e.damage * 0.75));
      if (!player.takeDamage(dmg)) continue;
      e.hp = 0;
      onEnemyDestroyed?.(e, player);
      return;
    }
  }

  _updateEnemies(dt, players, projectiles, onEnemyDestroyed) {
    const playerList = Array.isArray(players) ? players : [players];
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.stun = Math.max(0, e.stun - dt);
      if (e.stun > 0) continue;

      const player = nearestPlayer(playerList, e.x, e.y);

      if (e.fromRear) {
        e.x += e.rearSpeed * dt;
        e.y += (player.y - e.y) * dt * 0.85;
        e.y = clampToTunnel(e.x, e.y, e.radius, this.stage);
        if (e.shoots && !e.kamikaze) {
          e.fireCooldown -= dt;
          if (e.fireCooldown <= 0 && e.x < player.x + 30 && e.x > player.x - 350) {
            e.fireCooldown = 2.5 + Math.random();
            const aim = Math.atan2(player.y - e.y, player.x - e.x);
            projectiles.push(createProjectile("enemy", e.x, e.y, aim, {
              damage: e.damage, projectileSpeed: 360, color: e.color,
            }));
          }
        }
        this._resolveShipCollision(e, playerList, onEnemyDestroyed);
        continue;
      }

      if (e.carrier) {
        e.x -= e.speed * dt * 0.7;
        e.y = clampToTunnel(e.x, e.y, e.radius, this.stage);
        e.spawnTimer = (e.spawnTimer || 2) - dt;
        e.spawnCount = e.spawnCount || 0;
        if (e.spawnTimer <= 0 && e.spawnCount < 5 && this.enemies.length < 60) {
          e.spawnTimer = 2.5;
          e.spawnCount++;
          this.enemies.push(spawnEnemy("swarm", e.x - 10, e.y + (Math.random() - 0.5) * 40));
        }
        this._resolveShipCollision(e, playerList, onEnemyDestroyed);
        continue;
      }

      if (e.turret) {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && e.x > player.x + 40 && e.x < player.x + 420) {
          e.fireCooldown = e.weaponPattern === "rapid" ? 1.7 : 3.2;
          fireEnemyShot(e, player, projectiles, { speed: 340, color: "#ff66cc", aim: Math.PI });
        }
        this._resolveShipCollision(e, playerList, onEnemyDestroyed);
        continue;
      }

      if (e.kamikaze) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
        e.facingAngle = Math.atan2(dy, dx) + Math.PI;
        e.y = clampToTunnel(e.x, e.y, e.radius, this.stage);
        this._resolveShipCollision(e, playerList, onEnemyDestroyed);
        continue;
      }

      if (e.spinner) {
        e.spinAngle += dt * 4;
        e.x -= e.speed * dt * 0.6;
        e.y += Math.sin(e.spinAngle) * 90 * dt;
        e.y = clampToTunnel(e.x, e.y, e.radius, this.stage);
      } else if (e.sniper) {
        e.x -= e.speed * dt * 0.5;
        e.y = clampToTunnel(e.x, e.y, e.radius, this.stage);
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && e.x > player.x + 80 && e.x < player.x + 520) {
          e.fireCooldown = e.weaponPattern === "rapid" ? 2.3 : 4.2;
          fireEnemyShot(e, player, projectiles, { speed: 480, color: "#44ffcc" });
        }
        this._resolveShipCollision(e, playerList, onEnemyDestroyed);
        continue;
      } else {
        e.x -= e.speed * dt * 0.82;
        if (e.type === "swarm" || e.sine) e.y += Math.sin(e.x * 0.03 + e.id) * 55 * dt;
        e.y = clampToTunnel(e.x, e.y, e.radius, this.stage);
      }

      if (!e.shoots) continue;

      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.x > player.x + 60 && e.x < player.x + 400) {
        const rapid = e.weaponPattern === "rapid";
        const cd = e.type === "beetle" ? 3.8 : e.type === "rin" ? 2.6 : e.type === "purple_destroyer" ? 3.2 : 2.4;
        e.fireCooldown = (rapid ? cd * 0.5 : cd) + Math.random() * 0.8;
        if (!rapid && Math.random() > 0.55) continue;
        fireEnemyShot(e, player, projectiles, { speed: e.type === "beetle" ? 260 : 360 });
      }

      this._resolveShipCollision(e, playerList, onEnemyDestroyed);
    }
  }

  spawnPickup(x, y, player) {
    if (this.twinBeeMode) {
      this.bells.push({ x, y, vx: -35, bob: Math.random() * 6.28, color: Math.random() > 0.5 ? "#4488ff" : "#ff4488" });
      return;
    }
    const kind = player?.isLowEnergy?.() ? "energy" : "power";
    this.capsules.push({ x, y, vx: -40, bob: Math.random() * 6.28, kind });
  }

  _movePickups(dt, players) {
    const playerList = (Array.isArray(players) ? players : [players]).filter(Boolean);
    const list = this.twinBeeMode ? this.bells : this.capsules;
    for (const c of list) {
      c.x += c.vx * dt;
      c.bob += dt * 4;
      const cy = c.y + Math.sin(c.bob) * 4;
      for (const player of playerList) {
        if (!player.alive) continue;
        if (Math.hypot(player.x - c.x, player.y - cy) >= player.radius + 14) continue;
        if (this.twinBeeMode) {
          player.collectPower();
        } else if (c.kind === "energy") {
          player.collectEnergy(0.25);
        } else {
          player.collectPower();
        }
        c.dead = true;
        break;
      }
    }
    if (this.twinBeeMode) {
      this.bells = this.bells.filter((c) => !c.dead && c.x > this.scrollX - 80);
    } else {
      this.capsules = this.capsules.filter((c) => !c.dead && c.x > this.scrollX - 80);
    }
  }

  onEnemyKilled(enemy, player) {
    if (!enemy.dropsPower) return;
    const list = this.twinBeeMode ? this.bells : this.capsules;
    if (list.length >= 3) return;
    this.spawnPickup(enemy.x, enemy.y, player);
  }

  _updateBoss(dt, players, projectiles) {
    const b = this.boss;
    if (!b || b.hp <= 0) return;
    const playerList = (Array.isArray(players) ? players : [players]).filter(Boolean);
    const player = nearestPlayer(playerList, b.x, b.y);

    b.timer -= dt;
    b.animPhase = (b.animPhase || 0) + dt;
    b.handPhase = (b.handPhase || 0) + dt * 10;
    b.tentaclePhase = (b.tentaclePhase || 0) + dt * 1.6;
    b.attackFlash = Math.max(0, (b.attackFlash || 0) - dt);

    const hpPct = b.hp / b.maxHp;
    if (hpPct < 0.35) b.phase = 3;
    else if (hpPct < 0.65) b.phase = 2;

    const glide = b.animPhase * (b.phase >= 3 ? 0.65 : b.phase >= 2 ? 0.52 : 0.42);
    const viewW = this.viewWidth;
    const anchorX = b.arenaX ?? (this.scrollX + viewW * 0.52);
    b.arenaX = anchorX;

    const bounds = getPlayBounds(this.stage, anchorX);
    const pad = b.radius + 24;
    const topY = bounds.top + pad;
    const botY = bounds.bottom - pad;
    const midY = (topY + botY) * 0.5;
    const vRange = Math.max(90, (botY - topY) * 0.46);
    const hRange = viewW * (b.variant === "fire_scare" ? 0.38 : 0.32);

    if (b.emerge < 1) {
      b.emerge = Math.min(1, b.emerge + dt * 0.35);
      const ease = 1 - (1 - b.emerge) ** 2;
      b.y = midY + (botY + 90 - midY) * (1 - ease);
      b.x = anchorX;
      if (b.emerge < 0.7) return;
    } else if (b.variant === "fire_scare") {
      const t = glide;
      b.x = anchorX + Math.sin(t * 0.85) * hRange + Math.cos(t * 0.55) * hRange * 0.5;
      b.y = midY + Math.sin(t * 0.72) * vRange + Math.cos(t * 0.48) * vRange * 0.55;
      b.tilt = Math.sin(t * 1.1) * 0.12;
      if (b.phase >= 3) {
        b.x += (player.x + 35 - b.x) * dt * 0.42;
        b.y += (player.y - b.y) * dt * 0.42;
        b.x = Math.max(anchorX - hRange, Math.min(anchorX + hRange, b.x));
        b.y = Math.max(topY, Math.min(botY, b.y));
      } else if (b.phase >= 2) {
        b.x += Math.sin(t * 1.4) * dt * 45;
      }
    } else {
      const phaseX = b.movePattern === "slug" ? 0.32 : 0.42;
      const phaseY = b.movePattern === "slug" ? 0.22 : 0.28;
      const xOff = b.movePattern === "orbit" ? Math.cos(glide * phaseX) : Math.sin(glide * phaseX);
      const yOff = b.movePattern === "zigzag"
        ? Math.sin(glide * phaseY * 1.1)
        : Math.cos(glide * phaseY);

      b.x = anchorX + xOff * hRange;
      b.y = midY + yOff * vRange;

      if (b.phase >= 3) {
        b.x += (player.x + 45 - b.x) * dt * 0.28;
        b.y += (player.y - b.y) * dt * 0.28;
        b.x = Math.max(anchorX - hRange, Math.min(anchorX + hRange, b.x));
        b.y = Math.max(topY, Math.min(botY, b.y));
      }
    }

    const mouthX = b.x - 10;
    const mouthY = b.y - (b.variant === "hive" ? 8 : b.variant === "fire_scare" ? 18 : 14);
    const eyeY = b.y - (b.variant === "hive" ? 30 : b.variant === "fire_scare" ? 42 : 38);

    if (b.fireBoss || b.variant === "fire_scare") {
      if (b.timer <= 0) {
        b.timer = b.phase >= 3 ? 0.5 : b.phase >= 2 ? 0.7 : 0.9;
        b.attackFlash = 0.5;
        const handT = b.handPhase || 0;
        const flapL = Math.sin(handT * 1.2) * 0.18;
        const flapR = Math.sin(handT * 1.2 + 1.4) * 0.18;
        const r = b.radius;
        const hands = [
          { x: b.x - r * 0.55, y: b.y - r * 0.35, dir: -1, flap: flapL },
          { x: b.x + r * 0.55, y: b.y - r * 0.35, dir: 1, flap: flapR },
        ];
        const spread = b.phase >= 3 ? 2 : b.phase >= 2 ? 1 : 0;
        for (const hand of hands) {
          for (let i = -spread; i <= spread; i++) {
            const fingerSpread = (i - 0) * 0.13 + hand.flap * (i % 2 === 0 ? 1 : -1);
            const len = r * 0.22 + Math.sin(handT + i) * 4;
            const fx = hand.x + Math.sin(fingerSpread) * len * hand.dir * 0.6;
            const fy = hand.y - Math.cos(fingerSpread) * len;
            const aim = Math.atan2(player.y - fy, player.x - fx);
            projectiles.push(createProjectile("enemy", fx, fy, aim, {
              damage: 9 + b.phase * 3,
              projectileSpeed: 260 + b.phase * 35,
              color: Math.abs(i) <= 1 ? "#ffcc00" : "#ff4400",
            }));
          }
        }
      }
    } else if (b.phase === 1) {
      if (b.timer <= 0) {
        b.timer = 1.2;
        b.attackFlash = 0.35;
        for (let i = 0; i < 5; i++) {
          const a = Math.PI + (i - 2) * 0.14;
          projectiles.push(createProjectile("enemy", mouthX, mouthY, a, {
            damage: 9, projectileSpeed: 270, color: "#cc4466",
          }));
        }
      }
    } else if (b.phase === 2) {
      if (b.timer <= 0) {
        b.timer = 0.9;
        b.attackFlash = 0.4;
        projectiles.push(createProjectile("enemy", b.x - 18, eyeY, Math.PI + 0.05, {
          damage: 11, projectileSpeed: 340, color: "#44ccff",
        }));
        projectiles.push(createProjectile("enemy", b.x + 10, eyeY, Math.PI - 0.05, {
          damage: 11, projectileSpeed: 340, color: "#44ccff",
        }));
        projectiles.push(createProjectile("enemy", mouthX, mouthY, Math.PI, {
          damage: 10, projectileSpeed: 320, color: "#ff6688",
        }));
      }
    } else if (b.timer <= 0) {
      b.timer = 0.6;
      b.attackFlash = 0.5;
      for (let i = -2; i <= 2; i++) {
        projectiles.push(createProjectile("enemy", mouthX, mouthY, Math.PI + i * 0.11, {
          damage: 13, projectileSpeed: 380, color: "#ff2244",
        }));
      }
    }

    for (const pl of playerList) {
      if (pl.alive && Math.hypot(pl.x - b.x, pl.y - b.y) < b.radius + pl.radius) {
        pl.takeDamage(20 * dt);
      }
    }
  }

  get allTargets() {
    const list = [...this.enemies];
    if (this.boss && this.boss.hp > 0) list.push(this.boss);
    return list;
  }

  get pickups() {
    return this.twinBeeMode ? this.bells : this.capsules;
  }
}

export const BOSS_VARIANTS = {
  hive: {
    label: "Hive Overmind", type: "hive_entity",
    hp: 900, radius: 58, timer: 1.4, color: "#884422", movePattern: "sweep", score: 5000,
  },
  yellow_shock: {
    label: "Gul Chock", type: "sprite_boss",
    hp: 780, radius: 50, timer: 1.1, color: "#ffcc22", movePattern: "zigzag", score: 5000,
  },
  space_slug: {
    label: "Rymd-snigel", type: "sprite_boss",
    hp: 820, radius: 54, timer: 1.3, color: "#cc8866", movePattern: "slug", score: 5000,
  },
  orange_fuzzy: {
    label: "Orange Fuzz", type: "sprite_boss",
    hp: 860, radius: 52, timer: 1.0, color: "#ff7722", movePattern: "orbit", score: 5000,
  },
  three_eyed: {
    label: "Treögon-demon", type: "sprite_boss",
    hp: 920, radius: 56, timer: 0.95, color: "#886644", movePattern: "chaos", score: 5000,
  },
  fire_scare: {
    label: "Eld-skriket", type: "sprite_boss", fireBoss: true,
    hp: 1050, radius: 46, timer: 0.85, color: "#ff6622", movePattern: "orbit", score: 6000,
  },
};

function buildBossObject(variant, x, startY, groundY, overrides = {}) {
  const def = BOSS_VARIANTS[variant] || BOSS_VARIANTS.hive;
  const hp = overrides.hp || def.hp;
  return {
    id: "boss",
    variant,
    type: def.type,
    name: overrides.name || def.label,
    x,
    y: startY,
    groundY,
    arenaX: null,
    emerge: 0,
    animPhase: Math.random() * Math.PI * 2,
    tentaclePhase: 0,
    movePattern: def.movePattern,
    fireBoss: !!def.fireBoss,
    tilt: 0,
    scaleAnim: 1,
    facing: 1,
    attackFlash: 0,
    hp,
    maxHp: hp,
    radius: def.radius,
    color: def.color,
    phase: 1,
    timer: overrides.timer || def.timer,
    score: overrides.score || def.score,
    stun: 0,
    handPhase: 0,
  };
}

function pickRandomVariant(level) {
  if (level >= 3) return "fire_scare";
  const roll = Math.random();
  if (roll < 0.18) return "hive";
  const pool = ["yellow_shock", "space_slug", "orange_fuzzy", "three_eyed"];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function createRandomBoss(x, startY, viewH, groundY, level = 1) {
  const hpMult = 1 + (level - 1) * 0.4;
  const variant = pickRandomVariant(level);
  return scaleBoss(buildBossObject(variant, x, startY, groundY), hpMult, level);
}

/** Bygger en boss enligt en anpassad banas inställningar (bankeditorn). */
export function createBossFromConfig(config, x, startY, viewH, groundY) {
  const variant = config?.variant && config.variant !== "random" && BOSS_VARIANTS[config.variant]
    ? config.variant
    : pickRandomVariant(1);
  return buildBossObject(variant, x, startY, groundY, {
    hp: config?.hp,
    timer: config?.timer,
    score: config?.score,
    name: config?.name,
  });
}

function scaleBoss(boss, hpMult, level) {
  boss.hp = Math.round(boss.hp * hpMult);
  boss.maxHp = boss.hp;
  boss.level = level;
  boss.timer *= level > 1 ? 0.88 : 1;
  return boss;
}

function updateGroundCannons(cannons, dt, players, projectiles, scrollX, viewWidth) {
  if (!cannons) return;
  const playerList = (Array.isArray(players) ? players : [players]).filter(Boolean);
  for (const c of cannons) {
    if (c.hp <= 0) continue;
    c.animPhase = (c.animPhase || 0) + dt;
    if (c.x < scrollX - 100 || c.x > scrollX + viewWidth + 100) continue;
    c.fireCooldown -= dt;
    if (c.fireCooldown > 0) continue;
    const cx = c.x + c.w / 2;
    const cy = c.y + (c.side === "top" ? c.h - 4 : 4);
    const player = nearestPlayer(playerList, cx, cy);
    if (!player || Math.hypot(player.x - cx, player.y - cy) > 550) continue;
    c.fireCooldownMax = 1.8 + Math.random() * 1.0;
    c.fireCooldown = c.fireCooldownMax;
    const aim = Math.atan2(player.y - cy, player.x - cx);
    projectiles.push(createProjectile("enemy", cx, cy, aim, {
      damage: 13, projectileSpeed: 450, color: "#66eeff",
    }));
  }
}

export function resolveEnemyMovement() {}
