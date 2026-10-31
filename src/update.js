/* 游戏循环的数据更新，不包含 Canvas 绘制。 */
(function (Game) {
  "use strict";
  var C = Game.config, S = Game.state, U = Game.utils;
  Game.spawnWaveEnemy = function () {
    var session = S.session, plan = session.waves[session.wave - 1];
    if (!plan || session.spawnCount >= plan.total) return;
    var type;
    if (!session.eliteSpawned && session.spawnCount >= Math.floor(plan.total / 2)) {
      var eliteType = plan.elite || (plan.elitePool && plan.elitePool.length ? U.choose(plan.elitePool) : null);
      if (eliteType) { type = eliteType; session.eliteSpawned = true; }
      else type = U.choose(plan.mix);
    } else type = U.choose(plan.mix);
    Game.spawnEnemy(type);
    session.spawnCount++;
    session.spawnTimer = plan.interval * U.rand(.7, 1.15);
  };
  Game.update = function (dt) {
    if (S.screen !== "playing" && S.screen !== "testArena") return;
    var session = S.session, p = S.player, wall = S.wall; session.elapsed += dt; if (session.messageTimer > 0) session.messageTimer -= dt;
    var plan = session.testArena ? null : session.waves[session.wave - 1];
    if (plan) {
      session.spawnTimer -= dt;
      if (session.spawnTimer <= 0) Game.spawnWaveEnemy();
      if (plan.boss && !session.bossSpawned && session.spawnCount >= Math.floor(plan.total / 2)) {
        Game.spawnEnemy("boss");
        session.bossSpawned = true;
        session.message = "尸潮领主出现！";
        session.messageTimer = 2.6;
      }
    }
    Game.updateAim(dt);
    Game.updateSkills(dt);
    if (p.reloadTimer > 0) {
      p.reloadTimer = Math.max(0, p.reloadTimer - dt);
      if (p.reloadTimer === 0) { p.ammo = p.magazineSize; p.fireTimer = 0; }
    } else if (p.rifleEnabled !== false) {
      p.fireTimer -= dt;
      if (p.burstShotsRemaining > 0) { p.burstTimer -= dt; if (p.burstTimer <= 0) Game.fireBurstShot(); }
      else if (p.fireTimer <= 0) Game.fire();
    }
    for (var i = S.bullets.length - 1; i >= 0; i--) {
      var bullet = S.bullets[i];
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
      var removed = bullet.y < -20 || bullet.x < -20 || bullet.x > C.width + 20;
      for (var j = S.enemies.length - 1; j >= 0 && !removed; j--) {
        var enemy = S.enemies[j], radius = C.enemies[enemy.type].radius + bullet.radius;
        if (bullet.hitEnemies.indexOf(enemy) >= 0 || Math.pow(bullet.x - enemy.x, 2) + Math.pow(bullet.y - enemy.y, 2) >= radius * radius) continue;
        bullet.hitEnemies.push(enemy);
        Game.damageEnemy(enemy, bullet.damage, bullet);
        if (enemy.hp <= 0) Game.killEnemy(j);
        if (Game.blocksProjectile(enemy)) removed = true;
        else {
          bullet.pierce--;
          if (bullet.pierce < 0) removed = true;
        }
      }
      if (removed) S.bullets.splice(i, 1);
    }
    Game.updateSkillProjectiles(dt);
    Game.updateBombardment(dt);
    Game.updateElectromagneticZones(dt);
    Game.updateWhirlwinds(dt);
    Game.updateDrones(dt);
    for (var k = S.enemies.length - 1; k >= 0; k--) {
      var current = S.enemies[k], info = C.enemies[current.type];
      var wasRaging = Game.isRaging(current);
      current.hitFlash = Math.max(0, current.hitFlash - dt);
      current.attackTimer -= dt;
      if (wasRaging) {
        current.rageTimer = Math.max(0, current.rageTimer - dt);
        if (current.rageTimer === 0) current.rageRecoveryTimer = info.rageRecoveryDuration || 0;
      }
      if (!Game.isRaging(current) && current.burn > 0) {
        current.burn = Math.max(0, current.burn - dt);
        current.hp -= (current.burnDps || 10 + p.burn * 3) * dt * (current.damageTakenTimer > 0 ? current.damageTakenMultiplier || 1 : 1);
        if (current.hp <= 0) { Game.killEnemy(k); continue; }
        Game.tryStartRage(current);
      }
      var frostDps = Game.isRaging(current) ? 0 : Game.getFrostbiteDps(current);
      if (frostDps > 0) {
        current.hp -= frostDps * dt * (current.damageTakenTimer > 0 ? current.damageTakenMultiplier || 1 : 1);
        if (current.hp <= 0) { Game.killEnemy(k); continue; }
        Game.tryStartRage(current);
      }
      Game.tickFrostbite(current, dt);
      if (!Game.isRaging(current)) Game.tryStartRage(current);
      if (info.summonHpRatios && current.hp > 0) {
        var summons = current.summons || 0, summonInfo = C.enemies[info.summonType];
        while (summons < info.summonHpRatios.length && current.hp > 0 && current.hp <= current.maxHp * info.summonHpRatios[summons]) {
          var side = summons % 2 === 0 ? 1 : -1;
          S.pendingSpawns.push({ type: info.summonType, x: U.clamp(current.x + side * (info.radius + summonInfo.radius + 6), summonInfo.radius, C.width - summonInfo.radius), y: current.y });
          summons++;
          Game.addText(current.x, current.y - info.radius - 10, "傀儡脱离", C.colors.purple);
          Game.burst(current.x, current.y, 8, C.colors.purple);
        }
        current.summons = summons;
      }
      if (current.regenPerSecond > 0) {
        var regenLimit = info.regenBelowHpRatio ? current.maxHp * info.regenBelowHpRatio : current.maxHp;
        if (current.hp < regenLimit) current.hp = Math.min(regenLimit, current.hp + current.regenPerSecond * dt * Game.getHealScale(current));
      }
      if (info.freezeHealPerSecond > 0 && current.control > 0 && current.controlType === "freeze" && current.hp > 0) current.hp = Math.min(current.maxHp, current.hp + info.freezeHealPerSecond * dt * Game.getHealScale(current));
      current.slow = Math.max(0, current.slow - dt);
      if (current.slow === 0) current.slowFactor = .58;
      current.damageTakenTimer = Math.max(0, (current.damageTakenTimer || 0) - dt);
      if (current.damageTakenTimer === 0) current.damageTakenMultiplier = 1;
      current.wound = Math.max(0, (current.wound || 0) - dt);
      current.woundExtra = Math.max(0, (current.woundExtra || 0) - dt);
      current.control = Math.max(0, (current.control || 0) - dt);
      if (current.control === 0) current.controlType = "";
      if (current.control > 0) continue;
      if (wasRaging && current.rageTimer === 0) continue;
      if (current.rageRecoveryTimer > 0) {
        current.rageRecoveryTimer = Math.max(0, current.rageRecoveryTimer - dt);
        if (current.rageRecoveryTimer > 0) continue;
      }
      var charging = Game.isRaging(current), speed = Game.getEnemyMoveSpeed(current);
      var ranged = info.ranged, holdY = Game.getEnemyHoldY(info);
      if (current.y >= holdY) {
        current.y = holdY;
        if (!charging && info.wallExplosionDamage > 0 && !current.wallExplosionTriggered) {
          var blastY = wall.y - wall.height / 2 - 8;
          current.wallExplosionTriggered = true;
          wall.hp -= info.wallExplosionDamage;
          S.explosions.push({ type: "bomberBlast", x: current.x, y: blastY, radius: info.wallExplosionRadius || 42, life: .55, duration: .55 });
          Game.burst(current.x, blastY, 20, "#ff8a3d");
          Game.addText(current.x, blastY - 18, "-" + info.wallExplosionDamage, C.colors.red);
          current.attackTimer = info.attackInterval || 1;
          if (wall.hp <= 0) {
            wall.hp = 0;
            Game.loseLevel("城墙失守");
            continue;
          }
        }
        if (!charging && current.attackTimer <= 0) {
          if (ranged) { Game.throwEnemyShot(current); current.attackTimer = ranged.interval * U.rand(.9, 1.1); }
          else {
            wall.hp -= info.damage; current.attackTimer = Game.isBossEnemy(current) ? .65 : (info.attackInterval || 1);
            Game.burst(current.x, wall.y, 4, C.colors.red); Game.addText(current.x, wall.y - 19, "-" + info.damage, C.colors.red);
            if (wall.hp <= 0) { wall.hp = 0; Game.loseLevel("城墙失守"); }
          }
        }
      } else {
        current.y += speed * dt;
        if (current.y > C.height + info.radius + 24) S.enemies.splice(k, 1);
      }
    }
    Game.updateArmoredCars(dt);
    Game.updateEnemyShots(dt);
    Game.updateHailStorms(dt);
    Game.updateFuelBombs(dt);
    Game.flushPendingSpawns();
    Game.updateEffects(dt);
    var waveSpawned = !!plan && session.spawnCount >= plan.total && (!plan.boss || session.bossSpawned);
    if (S.screen !== "playing" || !waveSpawned) return;
    if (session.wave < session.waves.length) {
      session.wave++;
      session.spawnCount = 0;
      session.spawnTimer = 1.4;
      session.eliteSpawned = false;
      session.bossSpawned = false;
      session.message = "第 " + session.wave + " 波";
      session.messageTimer = 1.8;
      return;
    }
    if (S.enemies.length > 0 || S.pendingSpawns.length > 0) return;
    if (p.level < C.maxLevel) Game.grantMaxLevel();
    Game.winLevel();
  };
  Game.updateArmoredCars = function (dt) {
    for (var i = S.armoredCars.length - 1; i >= 0; i--) {
      var car = S.armoredCars[i];
      car.y -= car.speed * dt;
      car.impactFlash = Math.max(0, car.impactFlash - dt);
      if (car.rankedPulse) {
        car.pulseTimer = Math.max(0, (car.pulseTimer === undefined ? 1 : car.pulseTimer) - dt);
        if (car.pulseTimer === 0) {
          car.pulseTimer = 1;
          Game.damageSkillArea({ x: car.x, y: car.y, radius: 42, damage: car.damage * 2.5, element: car.element, damageSource: "armoredCar", progressSkillId: "armoredCar", sourceObject: car });
          Game.burst(car.x, car.y, 6, C.colors.yellow);
        }
      }
      car.contacts.forEach(function (contact) { contact.hitTimer = Math.max(0, contact.hitTimer - dt); });
      for (var j = S.enemies.length - 1; j >= 0; j--) {
        var enemy = S.enemies[j], radius = C.enemies[enemy.type].radius;
        if (!Game.canHitEnemy(car, enemy)) continue;
        var nearestX = U.clamp(enemy.x, car.x - car.width / 2, car.x + car.width / 2);
        var nearestY = U.clamp(enemy.y, car.y - car.length / 2, car.y + car.length / 2);
        var dx = enemy.x - nearestX, dy = enemy.y - nearestY;
        if (dx * dx + dy * dy > radius * radius) continue;
        var contact = null;
        for (var k = 0; k < car.contacts.length; k++) if (car.contacts[k].enemy === enemy) { contact = car.contacts[k]; break; }
        if (!contact) { contact = { enemy: enemy, hitTimer: 0, stunChecked: false }; car.contacts.push(contact); }
        if (contact.hitTimer > 0) continue;
        Game.damageEnemy(enemy, car.damage, { critical: false, noWeaponEffects: true, silentText: true, element: car.element, damageSource: "armoredCar", progressSkillId: "armoredCar" });
        Game.applySlow(enemy, car.slowDuration, car.slowFactor);
        if (!contact.stunChecked) {
          contact.stunChecked = true;
          if (Math.random() < car.stunChance) Game.applyStun(enemy, car.stunDuration);
        }
        contact.hitTimer = car.hitInterval;
        car.impactFlash = .1;
        Game.burst(enemy.x, enemy.y, 2, C.colors.yellow);
        if (enemy.hp <= 0) { Game.killEnemy(j); continue; }
      }
      if (car.y + car.length / 2 < 0) S.armoredCars.splice(i, 1);
    }
  };
  Game.burst = function (x, y, count, color) { for (var i = 0; i < count; i++) { var angle = U.rand(0, Math.PI * 2), speed = U.rand(25, 105); S.particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: U.rand(.25, .65), maxLife: .65, color: color, size: U.rand(1.5, 4) }); } };
  Game.addText = function (x, y, text, color) { S.texts.push({ x: x, y: y, text: text, color: color, life: 1 }); };
  Game.updateEffects = function (dt) { S.particles.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 35 * dt; p.life -= dt; }); S.particles = S.particles.filter(function (p) { return p.life > 0; }); S.texts.forEach(function (t) { t.y -= 24 * dt; t.life -= dt; }); S.texts = S.texts.filter(function (t) { return t.life > 0; }); S.explosions.forEach(function (explosion) { explosion.life -= dt; }); S.explosions = S.explosions.filter(function (explosion) { return explosion.life > 0; }); };
})(window.Game = window.Game || {});
