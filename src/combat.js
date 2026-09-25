/* 战斗领域：敌人生成、瞄准、射击、伤害、经验和词条。 */
(function (Game) {
  "use strict";
  var C = Game.config, S = Game.state, U = Game.utils;
  Game.spawnEnemy = function (type) {
    var info = C.enemies[type], enemy = { type: type, x: U.rand(22, C.width - 22), y: -info.radius - 8, hp: info.hp, maxHp: info.hp, slow: 0, slowFactor: .58, burn: 0, burnDps: 0, hitFlash: 0, attackTimer: 0 };
    if (type === "boss") enemy.x = C.width / 2;
    S.enemies.push(enemy);
    if (info.codexCategory === "elite") {
      S.session.message = "精英来袭：" + info.name + "！";
      S.session.messageTimer = 2.5;
      Game.burst(enemy.x, enemy.y, 18, info.accent);
    }
  };
  Game.getWeaponMount = function (p) {
    var rifle = C.sprites && C.sprites.playerRifle;
    return {
      x: p.x + (rifle && rifle.mountX !== undefined ? rifle.mountX : 0),
      y: p.y + (rifle && rifle.mountY !== undefined ? rifle.mountY : 0)
    };
  };
  Game.getAimAngleForShot = function (targetAngle, p) {
    var lanes = 1 + p.spread, lockLane = Math.floor((lanes - 1) / 2);
    var lockOffset = (lockLane - (lanes - 1) / 2) * (C.spreadAngle || 0);
    return targetAngle - lockOffset;
  };
  Game.updateAim = function (dt) {
    var p = S.player;
    if (p.manualAimTimer > 0) {
      p.manualAimTimer = Math.max(0, p.manualAimTimer - dt);
      if (p.manualAimTimer > 0) return;
    }

    var mount = Game.getWeaponMount(p), target = null, targetX = 0, targetY = 0, bestTime = Infinity;
    S.enemies.forEach(function (enemy) {
      var info = C.enemies[enemy.type];
      var speed = info.speed * (enemy.slow > 0 ? .58 : 1);
      if (enemy.type === "boss" && enemy.hp < enemy.maxHp * .5) speed *= 1.5;
      var attackY = S.wall ? S.wall.y - S.wall.height / 2 - info.radius - 3 : C.height;
      var predictedX = enemy.x, predictedY = enemy.y, flightTime = 0;

      // Re-estimate the intercept point so moving enemies, including those near either edge, stay on the firing line.
      for (var i = 0; i < 3; i++) {
        var dx = predictedX - mount.x, dy = predictedY - mount.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        flightTime = Math.max(0, (distance - C.muzzleDistance) / 300);
        predictedX = enemy.x;
        predictedY = Math.min(attackY, enemy.y + speed * flightTime);
      }

      if (flightTime < bestTime) {
        bestTime = flightTime;
        target = enemy;
        targetX = predictedX;
        targetY = predictedY;
      }
    });

    p.aimAngle = target ? Game.getAimAngleForShot(Math.atan2(targetY - mount.y, targetX - mount.x), p) : -Math.PI / 2;
  };
  Game.setManualAim = function (x, y) { var p = S.player, mount = Game.getWeaponMount(p), dx = x - mount.x, dy = y - mount.y; if (dx * dx + dy * dy < 16) return; p.aimAngle = Game.getAimAngleForShot(Math.atan2(dy, dx), p); p.manualAimTimer = 2.5; S.session.message = "手动瞄准"; S.session.messageTimer = .7; };
  Game.getWeaponMuzzle = function (p, distance, angle) {
    var mount = Game.getWeaponMount(p), muzzleDistance = distance || C.muzzleDistance, shotAngle = angle === undefined ? p.aimAngle : angle;
    return { x: mount.x + Math.cos(shotAngle) * muzzleDistance, y: mount.y + Math.sin(shotAngle) * muzzleDistance };
  };
  Game.startReload = function (p) {
    if (p.reloadTimer > 0 || p.ammo > 0) return;
    p.reloadTimer = p.reloadDuration;
    p.burstShotsRemaining = 0;
    p.burstTimer = 0;
  };
  Game.fireShot = function (p, shotAngle) {
    var lanes = 1 + p.spread;
    var muzzle = Game.getWeaponMuzzle(p, C.muzzleDistance, shotAngle);
    var bulletColor = p.bulletType === "ice" ? C.colors.ice : p.bulletType === "fire" ? C.colors.fire : "#ffffff";
    // 齐射以等角度展开弹道；整轮弹药由 Game.fire 统一扣除。
    for (var lane = 0; lane < lanes; lane++) {
      var spreadOffset = lane - (lanes - 1) / 2, bulletAngle = shotAngle + spreadOffset * C.spreadAngle;
      var laneMuzzle = Game.getWeaponMuzzle(p, C.muzzleDistance, bulletAngle), critical = Math.random() < p.crit;
      S.bullets.push({ x: laneMuzzle.x, y: laneMuzzle.y, vx: Math.cos(bulletAngle) * 300, vy: Math.sin(bulletAngle) * 300, damage: p.damage * (critical ? p.critDamage : 1), critical: critical, radius: p.bulletRadius, pierce: p.pierce, color: bulletColor, hitEnemies: [] });
    }
    for (var i = 0; i < 3; i++) S.particles.push({ x: muzzle.x + U.rand(-3, 3), y: muzzle.y + U.rand(-3, 3), vx: U.rand(-20, 20), vy: U.rand(-65, -25), life: .18, maxLife: .18, color: bulletColor, size: U.rand(2, 4) });
    return lanes;
  };
  Game.fire = function () {
    var p = S.player;
    if (p.reloadTimer > 0) return;
    if (p.ammo <= 0) { Game.startReload(p); return; }
    p.burstAngle = p.aimAngle;
    p.ammo--;
    Game.fireShot(p, p.burstAngle);
    p.fireTimer = p.fireInterval;
    p.burstShotsRemaining = p.burst;
    p.burstTimer = p.burstShotsRemaining > 0 ? Math.max(.06, p.fireInterval * .2) : 0;
    if (p.ammo <= 0 && p.burstShotsRemaining <= 0) Game.startReload(p);
  };
  Game.fireBurstShot = function () {
    var p = S.player;
    if (p.burstShotsRemaining <= 0 || p.reloadTimer > 0) return;
    Game.fireShot(p, p.burstAngle);
    p.burstShotsRemaining--;
    if (p.burstShotsRemaining > 0) p.burstTimer = Math.max(.06, p.fireInterval * .2);
    else if (p.ammo <= 0) Game.startReload(p);
  };
  Game.getSkillMuzzle = function () {
    var ring = C.skillRing || {};
    return { x: C.width / 2 + (ring.offsetX || 86), y: C.height + (ring.offsetY || -102) };
  };
  Game.getSkillTargetAngle = function (type, origin) {
    var skill = S.player.skills[type], target = null, targetX = 0, targetY = 0, bestTime = Infinity;
    S.enemies.forEach(function (enemy) {
      var info = C.enemies[enemy.type], speed = info.speed * (enemy.slow > 0 ? enemy.slowFactor || .58 : 1);
      if (enemy.type === "boss" && enemy.hp < enemy.maxHp * .5) speed *= 1.5;
      var attackY = S.wall ? S.wall.y - S.wall.height / 2 - info.radius - 3 : C.height;
      var predictedX = enemy.x, predictedY = enemy.y, flightTime = 0;
      for (var i = 0; i < 3; i++) {
        var dx = predictedX - origin.x, dy = predictedY - origin.y;
        flightTime = Math.max(0, (Math.sqrt(dx * dx + dy * dy) - skill.projectileRadius) / skill.projectileSpeed);
        predictedY = Math.min(attackY, enemy.y + speed * flightTime);
      }
      if (flightTime < bestTime) { bestTime = flightTime; target = enemy; targetX = predictedX; targetY = predictedY; }
    });
    if (!target) return null;
    var targetAngle = Math.atan2(targetY - origin.y, targetX - origin.x);
    if (type === "dryIce" && skill.spread > 0) {
      var lanes = 1 + skill.spread, lockLane = Math.floor((lanes - 1) / 2);
      targetAngle -= (lockLane - (lanes - 1) / 2) * C.spreadAngle;
    }
    return targetAngle;
  };
  Game.launchSkillVolley = function (type, angle) {
    var skill = S.player.skills[type], origin = Game.getSkillMuzzle();
    if (type === "thermobaric") {
      S.skillProjectiles.push({ type: type, x: origin.x, y: origin.y, vx: Math.cos(angle) * skill.projectileSpeed, vy: Math.sin(angle) * skill.projectileSpeed, radius: skill.projectileRadius, impactDamage: skill.impactDamage, impactKnockback: skill.impactKnockback, explosionDamage: skill.explosionDamage, explosionRadius: skill.explosionRadius, explosionKnockback: skill.explosionKnockback, burnDps: skill.burnDps, burnDuration: skill.burnDuration, pierce: skill.pierce, hasImpacted: false, fuseTimer: 0, critical: false, hitEnemies: [] });
      return;
    }
    var lanes = 1 + skill.spread;
    for (var lane = 0; lane < lanes; lane++) {
      var bulletAngle = angle + (lane - (lanes - 1) / 2) * C.spreadAngle;
      S.skillProjectiles.push({ type: type, x: origin.x, y: origin.y, vx: Math.cos(bulletAngle) * skill.projectileSpeed, vy: Math.sin(bulletAngle) * skill.projectileSpeed, radius: skill.projectileRadius, damage: skill.damage, knockback: skill.knockback, pierce: skill.pierce, splitCount: skill.splitCount, freezeDuration: skill.freezeDuration, slowFactor: skill.slowFactor, critical: false, hitEnemies: [] });
    }
  };
  Game.updateSkills = function (dt) {
    var p = S.player;
    Object.keys(p.skills).forEach(function (type) {
      var skill = p.skills[type];
      if (!skill.unlocked) return;
      if (skill.burstShotsRemaining > 0) {
        skill.burstTimer -= dt;
        if (skill.burstTimer <= 0) {
          Game.launchSkillVolley(type, skill.burstAngle);
          skill.burstShotsRemaining--;
          if (skill.burstShotsRemaining > 0) skill.burstTimer = .18;
        }
        return;
      }
      skill.fireTimer = Math.max(0, skill.fireTimer - dt);
      if (skill.fireTimer > 0 || !S.enemies.length) return;
      var origin = Game.getSkillMuzzle(), angle = Game.getSkillTargetAngle(type, origin);
      if (angle === null) return;
      Game.launchSkillVolley(type, angle);
      skill.fireTimer = skill.fireInterval;
      skill.burstAngle = angle;
      skill.burstShotsRemaining = skill.burst;
      skill.burstTimer = skill.burst > 0 ? .18 : 0;
    });
  };
  Game.applyKnockback = function (enemy, sourceX, sourceY, distance) {
    var dx = enemy.x - sourceX, dy = enemy.y - sourceY, length = Math.sqrt(dx * dx + dy * dy) || 1;
    var radius = C.enemies[enemy.type].radius;
    enemy.x = U.clamp(enemy.x + dx / length * distance, radius, C.width - radius);
    enemy.y = Math.max(-radius, enemy.y + dy / length * distance);
  };
  Game.applyBurn = function (enemy, dps, duration) {
    enemy.burn = Math.max(enemy.burn || 0, duration);
    enemy.burnDps = Math.max(enemy.burnDps || 0, dps);
  };
  Game.explodeThermobaric = function (projectile) {
    S.explosions.push({ x: projectile.x, y: projectile.y, radius: projectile.explosionRadius, life: .42, duration: .42 });
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var enemy = S.enemies[i], dx = enemy.x - projectile.x, dy = enemy.y - projectile.y;
      if (dx * dx + dy * dy > Math.pow(projectile.explosionRadius + C.enemies[enemy.type].radius, 2)) continue;
      Game.damageEnemy(enemy, projectile.explosionDamage, projectile);
      Game.applyBurn(enemy, projectile.burnDps, projectile.burnDuration);
      Game.applyKnockback(enemy, projectile.x, projectile.y, projectile.explosionKnockback);
      if (enemy.hp <= 0) Game.killEnemy(i);
    }
  };
  Game.splitDryIceProjectile = function (projectile, enemy) {
    if (projectile.splitCount <= 0 || projectile.isShard || projectile.splitTriggered) return;
    projectile.splitTriggered = true;
    var angle = Math.atan2(projectile.vy, projectile.vx), count = projectile.splitCount;
    for (var i = 0; i < count; i++) {
      var shardAngle = angle + (i - (count - 1) / 2) * .2;
      S.skillProjectiles.push({ type: "iceShard", x: enemy.x, y: enemy.y, vx: Math.cos(shardAngle) * 245, vy: Math.sin(shardAngle) * 245, radius: Math.max(3, projectile.radius * .58), damage: projectile.damage * .45, knockback: projectile.knockback * .5, pierce: 0, splitCount: 0, freezeDuration: projectile.freezeDuration, slowFactor: projectile.slowFactor, critical: false, hitEnemies: [enemy], isShard: true });
    }
  };
  Game.updateSkillProjectiles = function (dt) {
    for (var i = S.skillProjectiles.length - 1; i >= 0; i--) {
      var projectile = S.skillProjectiles[i];
      projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt;
      var removed = projectile.x < -30 || projectile.x > C.width + 30 || projectile.y < -30 || projectile.y > C.height + 30;
      if (!removed && projectile.type === "thermobaric" && projectile.hasImpacted) {
        projectile.fuseTimer = Math.max(0, projectile.fuseTimer - dt);
        if (projectile.fuseTimer === 0) { Game.explodeThermobaric(projectile); removed = true; }
      }
      for (var j = S.enemies.length - 1; j >= 0 && !removed; j--) {
        var enemy = S.enemies[j], radius = C.enemies[enemy.type].radius + projectile.radius;
        if (projectile.hitEnemies.indexOf(enemy) >= 0 || Math.pow(projectile.x - enemy.x, 2) + Math.pow(projectile.y - enemy.y, 2) >= radius * radius) continue;
        projectile.hitEnemies.push(enemy);
        if (projectile.type === "thermobaric") {
          Game.damageEnemy(enemy, projectile.impactDamage, projectile);
          Game.applyKnockback(enemy, projectile.x - projectile.vx, projectile.y - projectile.vy, projectile.impactKnockback);
          if (enemy.hp <= 0) Game.killEnemy(j);
          if (projectile.pierce > 0) { projectile.pierce--; projectile.hasImpacted = true; projectile.fuseTimer = .18; }
          else { Game.explodeThermobaric(projectile); removed = true; }
        } else {
          Game.damageEnemy(enemy, projectile.damage, projectile);
          Game.applyKnockback(enemy, projectile.x - projectile.vx, projectile.y - projectile.vy, projectile.knockback);
          if (projectile.freezeDuration > 0) {
            enemy.slow = Math.max(enemy.slow || 0, projectile.freezeDuration);
            enemy.slowFactor = Math.min(enemy.slowFactor || .58, projectile.slowFactor);
          }
          Game.splitDryIceProjectile(projectile, enemy);
          if (enemy.hp <= 0) Game.killEnemy(j);
          projectile.pierce--;
          if (projectile.pierce < 0) removed = true;
        }
      }
      if (removed) S.skillProjectiles.splice(i, 1);
    }
  };
  Game.gainXp = function (amount) { var p = S.player; if (p.level >= C.maxLevel) return; p.xp += amount; while (p.xp >= p.nextXp && p.level < C.maxLevel) { p.xp -= p.nextXp; p.level++; p.nextXp = Math.floor(p.nextXp * 1.22 + 10); S.screen = "upgrade"; S.upgradeCards = Game.rollTraits(); break; } };
  Game.rollTraits = function () {
    var p = S.player, allTraits = C.traits.concat(C.skillTraits || []);
    var pool = allTraits.filter(function (trait) {
      if ((p.traits[trait.id] || 0) >= trait.max) return false;
      if (trait.unlocksSkill) return !p.skills[trait.skillId].unlocked;
      if (trait.skillId) return p.skills[trait.skillId].unlocked;
      return true;
    }).slice(), cards = [];
    while (pool.length && cards.length < 3) cards.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return cards;
  };
  Game.chooseTrait = function (index) {
    if (S.screen !== "upgrade" || !S.upgradeCards[index]) return;
    var trait = S.upgradeCards[index], p = S.player;
    p.traits[trait.id] = (p.traits[trait.id] || 0) + 1;
    if (trait.skillId) {
      var skill = p.skills[trait.skillId];
      if (trait.unlocksSkill) { skill.unlocked = true; skill.level = 1; skill.fireTimer = 0; }
      else skill.level++;
    }
    trait.apply(p);
    Game.addText(p.x, p.y - 38, trait.name + (trait.skillId ? " Lv." + p.skills[trait.skillId].level : " Lv." + p.traits[trait.id]), C.colors.green);
    S.screen = "playing";
  };
  Game.killEnemy = function (index) { var enemy = S.enemies[index], info = C.enemies[enemy.type]; S.session.kills++; Game.gainXp(info.xp); Game.addText(enemy.x, enemy.y, "+" + info.xp + " XP", C.colors.yellow); Game.burst(enemy.x, enemy.y, enemy.type === "boss" ? 24 : 8, info.accent); if (enemy.type === "boss") { S.screen = "victory"; S.session.message = "街区安全"; } S.enemies.splice(index, 1); };
  Game.damageEnemy = function (enemy, amount, bullet) { enemy.hp -= amount; enemy.hitFlash = .08; if (S.player.burn) Game.applyBurn(enemy, 10 + S.player.burn * 3, 1.5 + S.player.burn * .4); if (S.player.freeze) { enemy.slow = Math.max(enemy.slow, 1.2 + S.player.freeze * .25); enemy.slowFactor = Math.min(enemy.slowFactor || .58, .58); } Game.addText(enemy.x + U.rand(-5, 5), enemy.y - C.enemies[enemy.type].radius, bullet.critical ? Math.ceil(amount) + " 暴击" : String(Math.ceil(amount)), bullet.critical ? C.colors.yellow : C.colors.text); };
})(window.Game = window.Game || {});
