/* 游戏循环的数据更新，不包含 Canvas 绘制。 */
(function (Game) {
  "use strict";
  var C = Game.config, S = Game.state, U = Game.utils;
  Game.spawnWaveEnemy = function () { var session = S.session, plan = C.waves[session.wave - 1]; if (!plan || session.spawnCount >= plan.total) return; Game.spawnEnemy(U.choose(plan.mix)); session.spawnCount++; session.spawnTimer = plan.interval * U.rand(.7, 1.15); };
  Game.update = function (dt) {
    if (S.screen !== "playing") return;
    var session = S.session, p = S.player, wall = S.wall; session.elapsed += dt; if (session.messageTimer > 0) session.messageTimer -= dt;
    var plan = C.waves[session.wave - 1];
    if (plan) { session.spawnTimer -= dt; if (session.spawnTimer <= 0) Game.spawnWaveEnemy(); if (plan.boss && !session.bossSpawned && session.spawnCount >= plan.total && S.enemies.filter(function (e) { return e.type !== "boss"; }).length < 8) { Game.spawnEnemy("boss"); session.bossSpawned = true; session.message = "尸潮领主出现！"; session.messageTimer = 2.6; } }
    Game.updateAim(dt); p.fireTimer -= dt;
    if (p.burstShotsRemaining > 0) { p.burstTimer -= dt; if (p.burstTimer <= 0) Game.fireBurstShot(); }
    else if (p.fireTimer <= 0) Game.fire();
    for (var i = S.bullets.length - 1; i >= 0; i--) { var bullet = S.bullets[i]; bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; var removed = bullet.y < -20 || bullet.x < -20 || bullet.x > C.width + 20; for (var j = S.enemies.length - 1; j >= 0 && !removed; j--) { var enemy = S.enemies[j], radius = C.enemies[enemy.type].radius + bullet.radius; if (Math.pow(bullet.x - enemy.x, 2) + Math.pow(bullet.y - enemy.y, 2) < radius * radius) { Game.damageEnemy(enemy, bullet.damage, bullet); bullet.pierce--; if (enemy.hp <= 0) Game.killEnemy(j); if (bullet.pierce < 0) removed = true; } } if (removed) S.bullets.splice(i, 1); }
    for (var k = S.enemies.length - 1; k >= 0; k--) { var current = S.enemies[k], info = C.enemies[current.type]; current.hitFlash = Math.max(0, current.hitFlash - dt); current.attackTimer -= dt; if (current.burn > 0) { current.burn -= dt; current.hp -= (10 + p.burn * 3) * dt; if (current.hp <= 0) { Game.killEnemy(k); continue; } } current.slow = Math.max(0, current.slow - dt); var speed = info.speed * (current.slow > 0 ? .58 : 1) * (current.type === "boss" && current.hp < current.maxHp * .5 ? 1.5 : 1), attackY = wall.y - wall.height / 2 - info.radius - 3; if (current.y >= attackY) { current.y = attackY; if (current.attackTimer <= 0) { wall.hp -= info.damage; current.attackTimer = current.type === "boss" ? .65 : 1.0; Game.burst(current.x, wall.y, 4, C.colors.red); Game.addText(current.x, wall.y - 19, "-" + info.damage, C.colors.red); if (wall.hp <= 0) { wall.hp = 0; session.message = "城墙失守"; S.screen = "defeat"; } } } else { current.y += speed * dt; if (current.y > C.height + info.radius + 24) S.enemies.splice(k, 1); } }
    Game.updateEffects(dt);
    if (S.screen === "playing" && plan && session.spawnCount >= plan.total && S.enemies.length === 0 && (!plan.boss || session.bossSpawned)) { if (session.wave >= C.waves.length) S.screen = "victory"; else { session.wave++; session.spawnCount = 0; session.spawnTimer = 1.4; session.bossSpawned = false; session.message = "第 " + session.wave + " 波"; session.messageTimer = 1.8; } }
  };
  Game.burst = function (x, y, count, color) { for (var i = 0; i < count; i++) { var angle = U.rand(0, Math.PI * 2), speed = U.rand(25, 105); S.particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: U.rand(.25, .65), maxLife: .65, color: color, size: U.rand(1.5, 4) }); } };
  Game.addText = function (x, y, text, color) { S.texts.push({ x: x, y: y, text: text, color: color, life: 1 }); };
  Game.updateEffects = function (dt) { S.particles.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 35 * dt; p.life -= dt; }); S.particles = S.particles.filter(function (p) { return p.life > 0; }); S.texts.forEach(function (t) { t.y -= 24 * dt; t.life -= dt; }); S.texts = S.texts.filter(function (t) { return t.life > 0; }); };
})(window.Game = window.Game || {});
