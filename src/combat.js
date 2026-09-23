/* 战斗领域：敌人生成、瞄准、射击、伤害、经验和词条。 */
(function (Game) {
  "use strict";
  var C = Game.config, S = Game.state, U = Game.utils;
  Game.spawnEnemy = function (type) { var info = C.enemies[type], enemy = { type: type, x: U.rand(22, C.width - 22), y: -info.radius - 8, hp: info.hp, maxHp: info.hp, slow: 0, burn: 0, hitFlash: 0, attackTimer: 0 }; if (type === "boss") enemy.x = C.width / 2; S.enemies.push(enemy); };
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
      S.bullets.push({ x: laneMuzzle.x, y: laneMuzzle.y, vx: Math.cos(bulletAngle) * 300, vy: Math.sin(bulletAngle) * 300, damage: p.damage * (critical ? p.critDamage : 1), critical: critical, radius: p.bulletRadius, pierce: p.pierce, color: bulletColor });
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
  Game.gainXp = function (amount) { var p = S.player; if (p.level >= C.maxLevel) return; p.xp += amount; while (p.xp >= p.nextXp && p.level < C.maxLevel) { p.xp -= p.nextXp; p.level++; p.nextXp = Math.floor(p.nextXp * 1.22 + 10); S.screen = "upgrade"; S.upgradeCards = Game.rollTraits(); break; } };
  Game.rollTraits = function () { var p = S.player, pool = C.traits.filter(function (trait) { return (p.traits[trait.id] || 0) < trait.max; }).slice(), cards = []; while (pool.length && cards.length < 3) cards.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); return cards; };
  Game.chooseTrait = function (index) { if (S.screen !== "upgrade" || !S.upgradeCards[index]) return; var trait = S.upgradeCards[index], p = S.player; p.traits[trait.id] = (p.traits[trait.id] || 0) + 1; trait.apply(p); Game.addText(p.x, p.y - 38, trait.name + " Lv." + p.traits[trait.id], C.colors.green); S.screen = "playing"; };
  Game.killEnemy = function (index) { var enemy = S.enemies[index], info = C.enemies[enemy.type]; S.session.kills++; Game.gainXp(info.xp); Game.addText(enemy.x, enemy.y, "+" + info.xp + " XP", C.colors.yellow); Game.burst(enemy.x, enemy.y, enemy.type === "boss" ? 24 : 8, info.accent); if (enemy.type === "boss") { S.screen = "victory"; S.session.message = "街区安全"; } S.enemies.splice(index, 1); };
  Game.damageEnemy = function (enemy, amount, bullet) { enemy.hp -= amount; enemy.hitFlash = .08; if (S.player.burn) enemy.burn = Math.max(enemy.burn, 1.5 + S.player.burn * .4); if (S.player.freeze) enemy.slow = Math.max(enemy.slow, 1.2 + S.player.freeze * .25); Game.addText(enemy.x + U.rand(-5, 5), enemy.y - C.enemies[enemy.type].radius, bullet.critical ? Math.ceil(amount) + " 暴击" : String(Math.ceil(amount)), bullet.critical ? C.colors.yellow : C.colors.text); };
})(window.Game = window.Game || {});
