/* 战斗领域：敌人生成、瞄准、射击、伤害、经验和词条。 */
(function (Game) {
  "use strict";
  var C = Game.config, S = Game.state, U = Game.utils;
  Game.spawnEnemy = function (type) { var info = C.enemies[type], enemy = { type: type, x: U.rand(22, C.width - 22), y: -info.radius - 8, hp: info.hp, maxHp: info.hp, slow: 0, burn: 0, hitFlash: 0, attackTimer: 0 }; if (type === "boss") enemy.x = C.width / 2; S.enemies.push(enemy); };
  Game.updateAim = function (dt) { var p = S.player; if (p.manualAimTimer > 0) { p.manualAimTimer -= dt; return; } var target = null, bestDistance = Infinity; S.enemies.forEach(function (enemy) { if (enemy.y > p.y + 40) return; var distance = Math.pow(enemy.x - p.x, 2) + Math.pow(enemy.y - p.y, 2); if (distance < bestDistance) { bestDistance = distance; target = enemy; } }); p.aimAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : -Math.PI / 2; };
  Game.setManualAim = function (x, y) { var p = S.player, dx = x - p.x, dy = y - p.y; if (dx * dx + dy * dy < 16) return; p.aimAngle = Math.atan2(dy, dx); p.manualAimTimer = 2.5; S.session.message = "手动瞄准"; S.session.messageTimer = .7; };
  Game.getWeaponMuzzle = function (p, distance, angle) {
    var rifle = C.sprites && C.sprites.playerRifle;
    var muzzleDistance = distance || C.muzzleDistance, shotAngle = angle === undefined ? p.aimAngle : angle;
    var mountX = rifle && rifle.mountX !== undefined ? rifle.mountX : 0;
    var mountY = rifle && rifle.mountY !== undefined ? rifle.mountY : 0;
    return { x: p.x + mountX + Math.cos(shotAngle) * muzzleDistance, y: p.y + mountY + Math.sin(shotAngle) * muzzleDistance };
  };
  Game.fireShot = function (p, shotAngle) {
    var lanes = 1 + p.spread;
    var muzzle = Game.getWeaponMuzzle(p, C.muzzleDistance, shotAngle);
    var perpendicularX = -Math.sin(shotAngle), perpendicularY = Math.cos(shotAngle);
    var bulletColor = p.bulletType === "ice" ? C.colors.ice : p.bulletType === "fire" ? C.colors.fire : "#ffffff";
    // 齐射只改变平行弹道数量，不再改变子弹角度。
    for (var lane = 0; lane < lanes; lane++) {
      var offset = (lane - (lanes - 1) / 2) * 8, critical = Math.random() < p.crit;
      S.bullets.push({ x: muzzle.x + perpendicularX * offset, y: muzzle.y + perpendicularY * offset, vx: Math.cos(shotAngle) * 300, vy: Math.sin(shotAngle) * 300, damage: p.damage * (critical ? p.critDamage : 1), critical: critical, radius: p.bulletRadius, pierce: p.pierce, color: bulletColor });
    }
    for (var i = 0; i < 3; i++) S.particles.push({ x: muzzle.x + U.rand(-3, 3), y: muzzle.y + U.rand(-3, 3), vx: U.rand(-20, 20), vy: U.rand(-65, -25), life: .18, maxLife: .18, color: bulletColor, size: U.rand(2, 4) });
  };
  Game.fire = function () {
    var p = S.player;
    p.burstAngle = p.aimAngle;
    Game.fireShot(p, p.burstAngle);
    p.fireTimer = p.fireInterval;
    p.burstShotsRemaining = p.burst;
    p.burstTimer = p.burst > 0 ? Math.max(.06, p.fireInterval * .2) : 0;
  };
  Game.fireBurstShot = function () {
    var p = S.player;
    if (p.burstShotsRemaining <= 0) return;
    Game.fireShot(p, p.burstAngle);
    p.burstShotsRemaining--;
    if (p.burstShotsRemaining > 0) p.burstTimer = Math.max(.06, p.fireInterval * .2);
  };
  Game.gainXp = function (amount) { var p = S.player; if (p.level >= C.maxLevel) return; p.xp += amount; while (p.xp >= p.nextXp && p.level < C.maxLevel) { p.xp -= p.nextXp; p.level++; p.nextXp = Math.floor(p.nextXp * 1.22 + 10); S.screen = "upgrade"; S.upgradeCards = Game.rollTraits(); break; } };
  Game.rollTraits = function () { var p = S.player, pool = C.traits.filter(function (trait) { return (p.traits[trait.id] || 0) < trait.max; }).slice(), cards = []; while (pool.length && cards.length < 3) cards.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); return cards; };
  Game.chooseTrait = function (index) { if (S.screen !== "upgrade" || !S.upgradeCards[index]) return; var trait = S.upgradeCards[index], p = S.player; p.traits[trait.id] = (p.traits[trait.id] || 0) + 1; trait.apply(p); Game.addText(p.x, p.y - 38, trait.name + " Lv." + p.traits[trait.id], C.colors.green); S.screen = "playing"; };
  Game.killEnemy = function (index) { var enemy = S.enemies[index], info = C.enemies[enemy.type]; S.session.kills++; Game.gainXp(info.xp); Game.addText(enemy.x, enemy.y, "+" + info.xp + " XP", C.colors.yellow); Game.burst(enemy.x, enemy.y, enemy.type === "boss" ? 24 : 8, info.accent); if (enemy.type === "boss") { S.screen = "victory"; S.session.message = "街区安全"; } S.enemies.splice(index, 1); };
  Game.damageEnemy = function (enemy, amount, bullet) { enemy.hp -= amount; enemy.hitFlash = .08; if (S.player.burn) enemy.burn = Math.max(enemy.burn, 1.5 + S.player.burn * .4); if (S.player.freeze) enemy.slow = Math.max(enemy.slow, 1.2 + S.player.freeze * .25); Game.addText(enemy.x + U.rand(-5, 5), enemy.y - C.enemies[enemy.type].radius, bullet.critical ? Math.ceil(amount) + " 暴击" : String(Math.ceil(amount)), bullet.critical ? C.colors.yellow : C.colors.text); };
})(window.Game = window.Game || {});
