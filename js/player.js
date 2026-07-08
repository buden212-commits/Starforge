import { resolveMovement, collidesCircleRect, sampleRidge } from "./terrain.js";
import { POWER_SLOTS, LASER_WEAPON } from "./power.js";

export class Player {
  constructor(stats, scrollX, screenX, y, viewWidth, twinBeeMode = false) {
    this.stats = stats;
    this.basePrimary = stats.primary;
    this.scrollX = scrollX;
    this.screenX = screenX;
    this.x = scrollX + screenX;
    this.y = y;
    this.viewWidth = viewWidth;
    this.radius = 14;
    this.hp = stats.maxHp;
    this.energy = stats.maxEnergy;
    this.alive = true;
    this.primaryCooldown = 0;
    this.secondaryCooldown = 0;
    this.invuln = 0;
    this.powerCursor = 0;
    this.speedLevel = 0;
    this.doubleShot = false;
    this.missileEnabled = false;
    this.laserEnabled = false;
    this.options = [];
    this.shields = 0;
    this.twinBeeMode = twinBeeMode;
    this.twinBeeSecret = false;
    this.powerFlash = 0;
    this.powerMessage = "";
    this.powerMessageTimer = 0;
    this.terrainHitCooldown = 0;
    this.activateCooldown = 0;
  }

  syncWorldX() {
    this.x = this.scrollX + this.screenX;
  }

  update(dt, input, obstacles, bounds) {
    if (!this.alive) return;

    this.invuln = Math.max(0, this.invuln - dt);
    this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);
    this.powerFlash = Math.max(0, this.powerFlash - dt);
    this.powerMessageTimer = Math.max(0, this.powerMessageTimer - dt);
    this.terrainHitCooldown = Math.max(0, this.terrainHitCooldown - dt);
    this.energy = Math.min(this.stats.maxEnergy, this.energy + this.stats.energyRegen * dt);

    let dx = 0;
    let dy = 0;
    const speed = this.stats.speed * (210 + this.speedLevel * 52);

    if (input.isDown("KeyW", "ArrowUp")) dy -= 1;
    if (input.isDown("KeyS", "ArrowDown")) dy += 1;
    if (input.isDown("KeyA", "ArrowLeft")) dx -= 1;
    if (input.isDown("KeyD", "ArrowRight")) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx = (dx / len) * speed * dt;
      dy = (dy / len) * speed * dt;
    }

    bounds.minX = this.scrollX + 40;
    bounds.maxX = this.scrollX + this.viewWidth * 0.72;
    resolveMovement(this, dx, dy, obstacles, bounds, this.radius);
    this.screenX = this.x - this.scrollX;
  }

  /** Kapsel: markören flyttas ett steg och den nya sloten aktiveras direkt */
  collectPower() {
    if (this.powerCursor >= POWER_SLOTS.length - 1) {
      this.powerCursor = 0;
      this.powerFlash = 0.5;
      this._setPowerMessage("Power-bar nollställd!");
      return null;
    }
    this.powerCursor++;
    const slot = POWER_SLOTS[this.powerCursor];
    this._applyPower(slot.id);
    this.powerFlash = 0.85;
    return slot;
  }

  collectEnergy(fraction = 0.25) {
    const gain = this.stats.maxEnergy * fraction;
    this.energy = Math.min(this.stats.maxEnergy, this.energy + gain);
    this.powerFlash = 0.5;
    this._setPowerMessage(`+${Math.round(fraction * 100)}% MP`);
    return gain;
  }

  isLowEnergy() {
    return this.energy / this.stats.maxEnergy < 0.25;
  }

  /** Enter/E: aktivera markerad slot utan kapsel (t.ex. Speed vid start) */
  activatePower() {
    const slot = POWER_SLOTS[this.powerCursor];
    if (!slot) return null;

    this._applyPower(slot.id);
    this.powerCursor = 0;
    this.powerFlash = 0.6;
    return slot;
  }

  _setPowerMessage(text) {
    this.powerMessage = text;
    this.powerMessageTimer = 2.4;
  }

  _applyPower(id) {
    const slot = POWER_SLOTS.find((s) => s.id === id);
    if (id === "speed") this.speedLevel = Math.min(4, this.speedLevel + 1);
    if (id === "missile") this.missileEnabled = true;
    if (id === "double") this.doubleShot = true;
    if (id === "laser") {
      this.laserEnabled = true;
      this.stats.primary = { ...LASER_WEAPON };
    }
    if (id === "option" && this.options.length < 2) {
      this.options.push({ offset: this.options.length === 0 ? -20 : 20 });
    }
    if (slot) this._setPowerMessage(`${slot.label} — ${slot.name}!`);
  }

  resetAllPower() {
    this.powerCursor = 0;
    this.speedLevel = 0;
    this.doubleShot = false;
    this.missileEnabled = false;
    this.laserEnabled = false;
    this.options = [];
    this.shields = 0;
    this.stats.primary = this.basePrimary;
  }

  takeDamage(amount) {
    if (this.invuln > 0 || !this.alive) return false;
    if (this.shields > 0) {
      this.shields--;
      this.invuln = 0.8;
      return true;
    }
    this.hp -= amount;
    this.invuln = 1.4;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.resetAllPower();
    }
    return true;
  }

  enableTwinBeeSecret() {
    this.twinBeeSecret = true;
    this.twinBeeMode = true;
  }

  getActivePrimary() {
    return this.stats.primary;
  }

  canFirePrimary() {
    const w = this.getActivePrimary();
    return this.primaryCooldown <= 0 && this.energy >= w.energyCost;
  }

  canFireSecondary() {
    const w = this.stats.secondary;
    return this.missileEnabled && this.secondaryCooldown <= 0 && this.energy >= w.energyCost;
  }

  firePrimary() {
    const w = this.getActivePrimary();
    this.primaryCooldown = w.fireRate / this.stats.fireRateMult;
    this.energy -= w.energyCost;
    return w;
  }

  fireSecondary() {
    const w = this.stats.secondary;
    this.secondaryCooldown = w.fireRate * 0.85;
    this.energy -= w.energyCost;
    return w;
  }
}

export function createProjectile(owner, x, y, angle, weapon, spread = 0) {
  const a = angle + (Math.random() - 0.5) * spread;
  const speed = weapon.projectileSpeed || 800;
  const isPlayer = typeof owner === "object" && owner.stats;
  const damage = isPlayer ? weapon.damage * owner.stats.damageMult : weapon.damage;

  return {
    x, y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    damage,
    color: weapon.color,
    owner: isPlayer ? "player" : "enemy",
    life: weapon.robot ? 5 : 2.5,
    homing: weapon.homing || false,
    robot: weapon.robot || false,
    radius: weapon.big ? 6 : weapon.robot ? 8 : 4,
  };
}

export function createEmpPulse(x, y, weapon, damageMult) {
  return {
    x, y, radius: 0, maxRadius: weapon.radius,
    damage: weapon.damage * damageMult, stun: weapon.stun,
    color: weapon.color, life: 0.35, owner: "player",
  };
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

export function updateProjectiles(projectiles, dt, obstacles, enemies, players, onHit, renderer, groundCannons = [], stage = null) {
  const playerList = Array.isArray(players) ? players.filter(Boolean) : [players].filter(Boolean);
  const remaining = [];

  // Målsökande robotar kan skjutas ner av spelarens skott innan de träffar.
  const shotDown = new Set();
  for (const p of projectiles) {
    if (p.owner !== "player") continue;
    for (const r of projectiles) {
      if (r.owner !== "enemy" || !r.robot || shotDown.has(r) || shotDown.has(p)) continue;
      if (Math.hypot(p.x - r.x, p.y - r.y) < p.radius + r.radius) {
        shotDown.add(p);
        shotDown.add(r);
        renderer.addExplosion(r.x, r.y, r.color || "#88ccff", 16);
        break;
      }
    }
  }

  for (const p of projectiles) {
    if (shotDown.has(p)) continue;
    if (p.maxRadius !== undefined) {
      p.radius += p.maxRadius * dt * 3;
      p.life -= dt;
      if (p.life > 0) {
        remaining.push(p);
        if (p.owner === "player") {
          for (const e of enemies) {
            if (e.hp <= 0 || e.stun > 0) continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) < p.radius + e.radius) {
              e.stun = p.stun;
              e.hp -= p.damage;
              onHit(e, p);
            }
          }
        }
      }
      continue;
    }

    if (p.homing && p.owner === "player") {
      let target = null;
      let best = Infinity;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < best && d < 420 && e.x > p.x - 40) { best = d; target = e; }
      }
      if (target) {
        const desired = Math.atan2(target.y - p.y, target.x - p.x);
        const current = Math.atan2(p.vy, p.vx);
        let diff = desired - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.sign(diff) * Math.min(Math.abs(diff), 5 * dt);
        const speed = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(current + turn) * speed;
        p.vy = Math.sin(current + turn) * speed;
      }
    } else if (p.homing && p.owner === "enemy" && playerList.some((pl) => pl.alive)) {
      const target = nearestPlayer(playerList, p.x, p.y);
      const desired = Math.atan2(target.y - p.y, target.x - p.x);
      const current = Math.atan2(p.vy, p.vx);
      let diff = desired - current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = p.robot ? 3 : 4;
      const turn = Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt);
      const speed = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(current + turn) * speed;
      p.vy = Math.sin(current + turn) * speed;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    let blocked = false;
    if (stage) {
      const top = sampleRidge(stage.topRidge, p.x);
      const bottom = sampleRidge(stage.bottomRidge, p.x);
      if (p.y - p.radius <= top || p.y + p.radius >= bottom) {
        blocked = true;
        renderer.addExplosion(p.x, p.y, p.color, 5);
      }
    }
    for (const obs of !blocked ? obstacles : []) {
      if (obs.hp <= 0) continue;
      if (Math.hypot(Math.max(obs.x, Math.min(p.x, obs.x + obs.w)) - p.x,
          Math.max(obs.y, Math.min(p.y, obs.y + obs.h)) - p.y) < p.radius + 4) {
        if (obs.hp !== undefined) obs.hp -= p.damage;
        blocked = true;
        renderer.addExplosion(p.x, p.y, p.color, 5);
        break;
      }
    }

    if (blocked || p.life <= 0) continue;

    if (p.owner === "player") {
      let hit = false;
      for (const c of groundCannons) {
        if (c.hp <= 0) continue;
        if (collidesCircleRect(p.x, p.y, p.radius, c)) {
          c.hp -= p.damage;
          hit = true;
          renderer.addExplosion(p.x, p.y, "#66eeff", 10);
          if (c.hp <= 0) {
            renderer.addExplosion(c.x + c.w / 2, c.y + c.h / 2, "#66eeff", 22);
          }
          break;
        }
      }
      if (!hit) {
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
            e.hp -= p.damage;
            onHit(e, p);
            hit = true;
            break;
          }
        }
      }
      if (hit) { renderer.addExplosion(p.x, p.y, p.color, 8); continue; }
    } else {
      let hitPlayer = false;
      for (const pl of playerList) {
        if (!pl.alive) continue;
        if (Math.hypot(pl.x - p.x, pl.y - p.y) < pl.radius + p.radius) {
          pl.takeDamage(p.damage);
          renderer.addExplosion(p.x, p.y, p.color, 8);
          hitPlayer = true;
          break;
        }
      }
      if (hitPlayer) continue;
    }
    remaining.push(p);
  }
  return remaining;
}

export function firePlayerShots(player, weapon, projectiles) {
  const ox = player.x + 22;
  const shots = [{ x: ox, y: player.y }];
  if (player.doubleShot) {
    shots.push({ x: ox, y: player.y - 9 }, { x: ox, y: player.y + 9 });
  }
  for (const opt of player.options) {
    shots.push({ x: player.x - 6, y: player.y + opt.offset });
  }
  for (const s of shots) {
    projectiles.push(createProjectile(player, s.x, s.y, 0, weapon, weapon.spread || 0));
  }
}
