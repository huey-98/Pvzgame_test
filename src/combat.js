/* 战斗领域：敌人生成、瞄准、射击、伤害、经验和词条。 */
(function (Game) {
  "use strict";
  var C = Game.config, S = Game.state, U = Game.utils;
  Game.getWaveHpScale = function () {
    var session = S.session;
    if (!session || session.testArena || !session.waves) return 1;
    var plan = session.waves[session.wave - 1];
    return (plan && plan.hpScale) || 1;
  };
  Game.isFlyingEnemy = function (enemy) {
    var info = enemy && C.enemies[enemy.type];
    return !!(info && info.flying);
  };
  Game.canHitEnemy = function (source, enemy) {
    return !(source && source.groundOnly && Game.isFlyingEnemy(enemy));
  };
  Game.blocksProjectile = function (enemy) {
    var info = enemy && C.enemies[enemy.type];
    return !!(info && info.blocksProjectiles);
  };
  Game.getSkillElement = function (id) {
    var list = C.coreSkills || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].element || "physical";
    return "physical";
  };
  Game.getRifleElement = function (p) {
    if (p && p.bulletType === "ice") return "ice";
    if (p && p.bulletType === "fire") return "fire";
    return "physical";
  };
  Game.getDamageElement = function (source) { return (source && source.element) || "physical"; };
  Game.getElementDamageScale = function (enemy, element) {
    var info = enemy && C.enemies[enemy.type], table = info && info.damageTakenByElement, scale = table ? table[element] : undefined;
    return scale === undefined || scale === null ? 1 : scale;
  };
  Game.getDamageSourceScale = function (enemy, source) {
    var info = enemy && C.enemies[enemy.type], table = info && info.damageTakenBySource, id = source && source.damageSource, scale = table && id ? table[id] : undefined;
    return scale === undefined || scale === null ? 1 : scale;
  };
  Game.isBossEnemy = function (enemy) {
    var info = enemy && C.enemies[enemy.type];
    return !!(info && info.codexCategory === "boss");
  };
  Game.isRaging = function (enemy) { return !!enemy && (enemy.rageTimer || 0) > 0; };
  Game.getEnemyMoveSpeed = function (enemy, info) {
    info = info || (enemy && C.enemies[enemy.type]);
    if (!enemy || !info || Game.isHardControlled(enemy)) return 0;
    return info.speed * (enemy.slow > 0 ? enemy.slowFactor || .58 : 1) * (Game.isRaging(enemy) ? info.rageSpeedMultiplier || 1 : 1) * Game.getEnemySpeedMultiplier(enemy, info);
  };
  Game.tryStartRage = function (enemy) {
    var info = enemy && C.enemies[enemy.type];
    if (!info || !info.rageHpRatio || !info.rageDuration || enemy.rageTriggered || enemy.hp <= 0 || enemy.hp >= enemy.maxHp * info.rageHpRatio) return false;
    enemy.rageTriggered = true;
    enemy.rageTimer = info.rageDuration;
    enemy.rageRecoveryTimer = 0;
    enemy.slow = 0;
    enemy.slowFactor = .58;
    enemy.control = 0;
    enemy.controlType = "";
    enemy.burn = 0;
    enemy.burnDps = 0;
    enemy.frostbiteStacks = {};
    enemy.frostbiteDps = {};
    enemy.damageTakenTimer = 0;
    enemy.damageTakenMultiplier = 1;
    enemy.wound = 0;
    enemy.woundFactor = 0;
    enemy.woundExtra = 0;
    enemy.woundExtraFactor = 0;
    Game.addText(enemy.x, enemy.y - info.radius - 12, "狂暴冲锋", info.accent);
    Game.burst(enemy.x, enemy.y, 12, info.accent);
    return true;
  };
  Game.getStatusScale = function (enemy, status) {
    var info = enemy && C.enemies[enemy.type], immune = info && info.statusImmune, table = info && info.statusDurationScale;
    if (Game.isRaging(enemy)) return 0;
    if (immune && immune[status]) return 0;
    var scale = table ? table[status] : undefined;
    return scale === undefined || scale === null ? 1 : scale;
  };
  Game.getEnemySpeedMultiplier = function (enemy, info) {
    info = info || (enemy && C.enemies[enemy.type]);
    if (!enemy || !info || !info.speedBoostBelowHpRatio || !info.speedBoostMultiplier) return 1;
    return enemy.hp < enemy.maxHp * info.speedBoostBelowHpRatio ? info.speedBoostMultiplier : 1;
  };
  Game.spawnEnemy = function (type, options) {
    var info = C.enemies[type], opts = options || {}, radius = info.radius;
    var edge = Math.max(22, radius + 4);
    var x = opts.x === undefined ? U.rand(edge, C.width - edge) : U.clamp(opts.x, radius, C.width - radius);
    var y = opts.y === undefined ? -radius - 8 : U.clamp(opts.y, -radius, S.wall ? S.wall.y - S.wall.height / 2 - radius - 3 : C.height);
    var maxHp = Math.round(info.hp * ((S.session && S.session.hpScale) || 1) * Game.getWaveHpScale());
    var enemy = { type: type, x: x, y: y, hp: maxHp, maxHp: maxHp, slow: 0, slowFactor: .58, damageTakenTimer: 0, damageTakenMultiplier: 1, burn: 0, burnDps: 0, frostbiteStacks: {}, frostbiteDps: {}, control: 0, controlType: "", wound: 0, woundFactor: 0, woundExtra: 0, woundExtraFactor: 0, hitFlash: 0, attackTimer: 0, summons: 0, regenPerSecond: info.regenPerSecond || 0, armorCharges: info.armorCharges || 0, armorStamp: -1e9, armorFlash: 0, wallExplosionTriggered: false, rageTriggered: false, rageTimer: 0, rageRecoveryTimer: 0 };
    if (Game.isBossEnemy({ type: type })) enemy.x = C.width / 2;
    S.enemies.push(enemy);
    if (info.codexCategory === "elite" && !opts.silent) {
      S.session.message = "精英来袭：" + info.name + "！";
      S.session.messageTimer = 2.5;
      Game.burst(enemy.x, enemy.y, 18, info.accent);
    }
  };
  Game.testSpawnEnemy = function (count) {
    var arena = S.testArena, ids = Game.getTestEnemyIds(), type, info, amount = Math.max(1, count || 1);
    if (!S.session || !S.session.testArena || !arena || !ids.length) return;
    type = ids[arena.enemyIndex] || ids[0];
    info = C.enemies[type];
    for (var i = 0; i < amount; i++) {
      Game.spawnEnemy(type, { x: Game.isBossEnemy({ type: type }) ? C.width / 2 : U.rand(info.radius + 12, C.width - info.radius - 12), y: U.rand(150, 285), silent: true });
    }
    S.session.message = "生成 " + amount + " 只 · " + info.name;
    S.session.messageTimer = 1.2;
  };
  Game.testUnlockSkill = function () {
    var arena = S.testArena, definition = arena && C.coreSkills[arena.skillIndex], skill, unlockTrait;
    if (!S.session || !S.session.testArena || !definition) return;
    skill = S.player.skills[definition.id];
    if (skill.unlocked) { S.session.message = definition.name + " 已解锁"; }
    else {
      Game.unlockSkill(definition.id, true);
      unlockTrait = (C.skillTraits || []).filter(function (trait) { return trait.skillId === definition.id && trait.unlocksSkill; })[0];
      if (unlockTrait) S.player.traits[unlockTrait.id] = 1;
      S.session.message = "已解锁：" + definition.name;
    }
    S.session.messageTimer = 1.5;
  };
  Game.testApplyTrait = function () {
    var arena = S.testArena, definition = arena && C.coreSkills[arena.skillIndex], skill, traits, trait, count;
    if (!S.session || !S.session.testArena || !definition) return;
    skill = S.player.skills[definition.id];
    if (!skill.unlocked) { S.session.message = "请先解锁" + definition.name; S.session.messageTimer = 1.4; return; }
    traits = (C.skillTraits || []).filter(function (item) { return item.skillId === definition.id && !item.unlocksSkill; });
    trait = traits[arena.traitIndex];
    if (!trait) return;
    count = S.player.traits[trait.id] || 0;
    if (count >= trait.max) { S.session.message = trait.name + "已满级"; S.session.messageTimer = 1.4; return; }
    S.player.traits[trait.id] = count + 1;
    skill.level++;
    trait.apply(S.player);
    S.session.message = "已应用：" + trait.name + " Lv." + S.player.traits[trait.id];
    S.session.messageTimer = 1.5;
  };
  Game.testClearBuild = function () {
    var p = S.player, skills = {};
    if (!S.session || !S.session.testArena) return;
    Object.keys(C.skillDefaults).forEach(function (id) {
      skills[id] = {};
      Object.keys(C.skillDefaults[id]).forEach(function (key) { skills[id][key] = C.skillDefaults[id][key]; });
      skills[id].fireTimer = skills[id].fireInterval * .5;
      skills[id].burstShotsRemaining = 0;
      skills[id].burstTimer = 0;
      skills[id].burstAngle = -Math.PI / 2;
      skills[id].progressSkillId = id;
    });
    p.damage = 28; p.fireInterval = .52; p.burst = 0; p.spread = 0; p.pierce = 0; p.bulletRadius = 4; p.crit = C.attributes.base.critRate; p.critDamage = C.attributes.base.critDamage; p.burn = 0; p.freeze = 0; p.bulletType = "normal"; p.skills = skills; p.traits = {}; p.skillOrder = [];
    p.ammo = p.magazineSize; p.reloadTimer = 0; p.rifleEnabled = true; p.fireTimer = 0; p.burstShotsRemaining = 0; p.burstTimer = 0;
    if (Game.attributes) Game.attributes.applyPlayer(p);
    S.bullets = []; S.skillProjectiles = []; S.armoredCars = []; S.bombDrops = []; S.bombZones = []; S.electromagneticZones = []; S.tornadoes = []; S.drones = []; S.hailStorms = []; S.fuelShells = []; S.fuelPools = []; S.explosions = [];
    S.session.message = "技能和词条已清空";
    S.session.messageTimer = 1.5;
  };
  Game.testClearEnemies = function () {
    if (!S.session || !S.session.testArena) return;
    S.enemies = [];
    S.pendingSpawns = [];
    S.bullets = [];
    S.skillProjectiles = [];
    S.armoredCars = [];
    S.bombDrops = [];
    S.bombZones = [];
    S.electromagneticZones = [];
    S.tornadoes = [];
    S.drones = [];
    S.hailStorms = [];
    S.fuelShells = [];
    S.fuelPools = [];
    S.explosions = [];
    S.session.message = "测试场已清空";
    S.session.messageTimer = 1.2;
  };
  Game.testRestore = function () {
    if (!S.session || !S.session.testArena) return;
    S.wall.hp = S.wall.maxHp;
    S.player.hp = S.player.maxHp;
    S.player.ammo = S.player.magazineSize;
    S.player.reloadTimer = 0;
    S.player.fireTimer = 0;
    Object.keys(S.player.skills).forEach(function (type) {
      S.player.skills[type].fireTimer = 0;
      S.player.skills[type].burstShotsRemaining = 0;
      S.player.skills[type].burstTimer = 0;
      S.player.skills[type].active = false;
      S.player.skills[type].activeElapsed = 0;
    });
    S.session.message = "状态已恢复";
    S.session.messageTimer = 1.2;
  };
  Game.queueSplitSpawns = function (enemy, info) {
    if (!info.splitInto || !info.splitCount) return;
    var parentRadius = C.enemies[enemy.type].radius, childRadius = C.enemies[info.splitInto].radius, gap = parentRadius + childRadius + 6;
    for (var i = 0; i < info.splitCount; i++) {
      var offset = info.splitCount === 1 ? 0 : (i - (info.splitCount - 1) / 2) * gap;
      S.pendingSpawns.push({ type: info.splitInto, x: enemy.x + offset, y: enemy.y });
    }
  };
  Game.flushPendingSpawns = function () {
    if (!S.pendingSpawns || !S.pendingSpawns.length) return;
    var queue = S.pendingSpawns;
    S.pendingSpawns = [];
    queue.forEach(function (item) { Game.spawnEnemy(item.type, { x: item.x, y: item.y, silent: true }); });
  };
  Game.getEnemyHoldY = function (info) {
    if (!S.wall || !info) return C.height;
    var wallLine = S.wall.y - S.wall.height / 2;
    if (info.ranged) return wallLine - info.ranged.standoff;
    return wallLine - info.radius - 3 - (info.flying ? (C.flyingHover || 0) : 0);
  };
  Game.getRangeLine = function (rangeName) {
    var wallTop = S.wall ? S.wall.y - S.wall.height / 2 : C.height;
    var ranges = C.ranges || {};
    return wallTop - (ranges[rangeName] || 0);
  };
  Game.getSkillRangeName = function (id) {
    var list = C.coreSkills || [];
    if (id === "rifle") return C.rifleRange || "far";
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].range || "far";
    return "far";
  };
  Game.getSkillRangeLine = function (id) { return Game.getRangeLine(Game.getSkillRangeName(id)); };
  Game.isSkillRangeEngaged = function (id) {
    var line = Game.getSkillRangeLine(id);
    for (var i = 0; i < S.enemies.length; i++) if (S.enemies[i].y >= line) return true;
    return false;
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
    var rifleLine = Game.getSkillRangeLine("rifle");
    S.enemies.forEach(function (enemy) {
      if (enemy.y < rifleLine) return;
      var info = C.enemies[enemy.type];
      var speed = Game.getEnemyMoveSpeed(enemy);
      var attackY = Game.getEnemyHoldY(info);
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
  Game.toggleRifle = function () {
    var p = S.player;
    if (!p) return;
    p.rifleEnabled = p.rifleEnabled === false;
    if (!p.rifleEnabled) {
      p.burstShotsRemaining = 0;
      p.burstTimer = 0;
      p.fireTimer = 0;
      p.reloadTimer = p.reloadDuration;
      S.bullets = [];
      S.session.message = "步枪已关闭，正在换弹";
    } else S.session.message = "步枪已开启";
    S.session.messageTimer = 1.2;
  };
  Game.fireShot = function (p, shotAngle) {
    var lanes = 1 + p.spread;
    var muzzle = Game.getWeaponMuzzle(p, C.muzzleDistance, shotAngle);
    var bulletColor = p.bulletType === "ice" ? C.colors.ice : p.bulletType === "fire" ? C.colors.fire : "#ffffff";
    // 齐射以等角度展开弹道；整轮弹药由 Game.fire 统一扣除。
    for (var lane = 0; lane < lanes; lane++) {
      var spreadOffset = lane - (lanes - 1) / 2, bulletAngle = shotAngle + spreadOffset * C.spreadAngle;
      var laneMuzzle = Game.getWeaponMuzzle(p, C.muzzleDistance, bulletAngle), critical = Math.random() < U.clamp(p.crit || 0, 0, 1);
      S.bullets.push({ x: laneMuzzle.x, y: laneMuzzle.y, vx: Math.cos(bulletAngle) * 300, vy: Math.sin(bulletAngle) * 300, damage: p.damage * (critical ? p.critDamage : 1), critical: critical, radius: p.bulletRadius, pierce: p.pierce, color: bulletColor, element: Game.getRifleElement(p), damageSource: "rifle", hitEnemies: [] });
    }
    for (var i = 0; i < 3; i++) S.particles.push({ x: muzzle.x + U.rand(-3, 3), y: muzzle.y + U.rand(-3, 3), vx: U.rand(-20, 20), vy: U.rand(-65, -25), life: .18, maxLife: .18, color: bulletColor, size: U.rand(2, 4) });
    return lanes;
  };
  Game.fire = function () {
    var p = S.player;
    if (p.reloadTimer > 0) return;
    if (!Game.isSkillRangeEngaged("rifle")) return;
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
    return { x: C.width / 2 + (ring.offsetX || 64), y: C.height + (ring.offsetY || -100) };
  };
  Game.getSkillTargetAngle = function (type, origin, preferredAwayFrom) {
    var skill = S.player.skills[type], targetAngle = null, bestTime = Infinity, bestDiversity = -1;
    var rangeLine = Game.getSkillRangeLine(type);
    S.enemies.forEach(function (enemy) {
      if (enemy.y < rangeLine) return;
      var info = C.enemies[enemy.type], speed = Game.getEnemyMoveSpeed(enemy);
      var attackY = Game.getEnemyHoldY(info);
      var predictedX = enemy.x, predictedY = enemy.y, flightTime = 0, targetX, targetY;
      for (var i = 0; i < 3; i++) {
        var dx = predictedX - origin.x, dy = predictedY - origin.y;
        flightTime = Math.max(0, (Math.sqrt(dx * dx + dy * dy) - skill.projectileRadius) / skill.projectileSpeed);
        predictedY = Math.min(attackY, enemy.y + speed * flightTime);
        targetX = predictedX;
        targetY = predictedY;
      }
      var angle = Math.atan2(targetY - origin.y, targetX - origin.x);
      if ((type === "dryIce" || type === "airBlade") && skill.spread > 0) {
        var lanes = 1 + skill.spread, lockLane = Math.floor((lanes - 1) / 2);
        angle -= (lockLane - (lanes - 1) / 2) * C.spreadAngle;
      }
      var diversity = Infinity;
      if (preferredAwayFrom && preferredAwayFrom.length) {
        preferredAwayFrom.forEach(function (previousAngle) {
          var angleDifference = Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle));
          diversity = Math.min(diversity, Math.abs(angleDifference));
        });
      } else diversity = 0;
      if (targetAngle === null || diversity > bestDiversity + .000001 || (Math.abs(diversity - bestDiversity) <= .000001 && flightTime < bestTime)) {
        bestTime = flightTime;
        bestDiversity = diversity;
        targetAngle = angle;
      }
    });
    return targetAngle;
  };
  Game.getElectromagneticTargets = function (skill) {
    var rangeLine = Game.getSkillRangeLine("electromagnetic");
    return S.enemies.filter(function (enemy) { return enemy.y >= rangeLine; }).sort(function (a, b) {
      var aInfo = C.enemies[a.type], bInfo = C.enemies[b.type];
      var aScore = a.y + aInfo.radius * .35, bScore = b.y + bInfo.radius * .35;
      if (Game.isBossEnemy(a)) aScore += 10;
      if (Game.isBossEnemy(b)) bScore += 10;
      return bScore - aScore;
    }).slice(0, 1 + skill.extraTargets + (Game.hasProgressMilestone("electromagnetic", 2) ? 1 : 0));
  };
  Game.launchElectromagnetic = function () {
    var skill = S.player.skills.electromagnetic, targets;
    if (!skill.unlocked || skill.fireTimer > 0) return false;
    targets = Game.getElectromagneticTargets(skill);
    if (!targets.length) return false;
    var stunDuration = skill.stunDuration + (Game.hasProgressMilestone("electromagnetic", 7) ? .8 : 0);
    var chainTargets = Game.hasProgressMilestone("electromagnetic", 18) ? 4 : Game.hasProgressMilestone("electromagnetic", 12) ? 2 : 0;
    targets.forEach(function (target, index) {
      S.skillProjectiles.push({ type: "electromagnetic", target: target, x: target.x, y: target.y, delay: index * .14, damage: skill.damage, stunDuration: stunDuration, chainTargets: chainTargets, frozenShards: Game.hasProgressMilestone("electromagnetic", 22), burnZone: Game.hasProgressMilestone("electromagnetic", 26), explosion: skill.explosion, explosionDamage: skill.explosionDamage, explosionRadius: skill.explosionRadius, matrix: skill.matrix, matrixDuration: skill.matrixDuration, matrixDps: skill.matrixDps, matrixRadius: skill.matrixRadius, matrixSlowFactor: skill.matrixSlowFactor, element: Game.getSkillElement("electromagnetic"), damageSource: "electromagnetic", progressSkillId: "electromagnetic" });
    });
    skill.fireTimer = skill.fireInterval;
    return true;
  };
  Game.getHighEnergyBeamEnd = function (origin, angle) {
    var dx = Math.cos(angle), dy = Math.sin(angle), distances = [];
    if (dx > .0001) distances.push((C.width - origin.x) / dx);
    if (dx < -.0001) distances.push(-origin.x / dx);
    if (dy > .0001) distances.push((C.height - origin.y) / dy);
    if (dy < -.0001) distances.push(-origin.y / dy);
    distances = distances.filter(function (distance) { return distance > 0; });
    var length = distances.length ? Math.min.apply(Math, distances) : 0;
    return { x: origin.x + dx * length, y: origin.y + dy * length };
  };
  Game.getHighEnergyBeamAngle = function (origin, skill, excludedAngle) {
    var bestAngle = null, bestScore = -1, rangeLine = Game.getSkillRangeLine("highEnergyBeam");
    S.enemies.forEach(function (candidate) {
      if (candidate.y < rangeLine) return;
      var angle = Math.atan2(candidate.y - origin.y, candidate.x - origin.x);
      if (Math.sin(angle) >= 0) return;
      if (excludedAngle !== undefined && excludedAngle !== null && Math.abs(Math.atan2(Math.sin(angle - excludedAngle), Math.cos(angle - excludedAngle))) < .18) return;
      var end = Game.getHighEnergyBeamEnd(origin, angle), dx = end.x - origin.x, dy = end.y - origin.y, length = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / length, uy = dy / length, score = 0;
      S.enemies.forEach(function (enemy) {
        var ex = enemy.x - origin.x, ey = enemy.y - origin.y, along = ex * ux + ey * uy, across = Math.abs(ex * uy - ey * ux), radius = skill.beamWidth / 2 + C.enemies[enemy.type].radius;
        if (along >= 0 && along <= length && across <= radius) score += Game.isBossEnemy(enemy) ? 2 : C.enemies[enemy.type].codexCategory === "elite" ? 1.5 : 1;
      });
      if (score > bestScore) { bestScore = score; bestAngle = angle; }
    });
    return bestAngle;
  };
  Game.getHighEnergyBeamReflectionEnd = function (end, origin) {
    var dx = end.x - origin.x, dy = end.y - origin.y;
    if (end.x <= .5 || end.x >= C.width - .5) dx = -dx;
    if (end.y <= .5 || end.y >= C.height - .5) dy = -dy;
    if (Math.abs(dx) < .0001 && Math.abs(dy) < .0001) return { x: end.x, y: end.y };
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    return Game.getHighEnergyBeamEnd(end, Math.atan2(dy / length, dx / length));
  };
  Game.makeHighEnergyBeam = function (origin, angle, width, bounce) {
    var end = Game.getHighEnergyBeamEnd(origin, angle), beams = [{ x: origin.x, y: origin.y, x2: end.x, y2: end.y, width: width }];
    if (bounce) {
      var reflected = Game.getHighEnergyBeamReflectionEnd(end, origin);
      beams.push({ x: end.x, y: end.y, x2: reflected.x, y2: reflected.y, width: width });
    }
    return beams;
  };
  Game.launchHighEnergyBeam = function (skill) {
    var origin = Game.getSkillMuzzle(), angle = Game.getHighEnergyBeamAngle(origin, skill), end;
    if (!skill.unlocked || skill.active || skill.fireTimer > 0 || angle === null) return false;
    end = Game.getHighEnergyBeamEnd(origin, angle);
    var width = skill.beamWidth * (Game.hasProgressMilestone("highEnergyBeam", 22) ? 1.25 : 1);
    var beams = Game.makeHighEnergyBeam(origin, angle, width, Game.hasProgressMilestone("highEnergyBeam", 18));
    if (Game.hasProgressMilestone("highEnergyBeam", 26)) {
      var secondAngle = Game.getHighEnergyBeamAngle(origin, skill, angle);
      if (secondAngle === null || Math.sin(secondAngle) >= 0) {
        secondAngle = angle >= -Math.PI / 2 ? angle - .35 : angle + .35;
      }
      if (Math.sin(secondAngle) < 0) beams = beams.concat(Game.makeHighEnergyBeam(origin, secondAngle, width, Game.hasProgressMilestone("highEnergyBeam", 18)));
    }
    skill.active = true; skill.activeAngle = angle; skill.activeBeams = beams; skill.activeWidth = width; skill.activeX = origin.x; skill.activeY = origin.y; skill.activeX2 = end.x; skill.activeY2 = end.y; skill.activeDuration = skill.duration * (Game.hasProgressMilestone("highEnergyBeam", 26) ? .6 : 1); skill.activeHits = skill.baseDamageHits + skill.bonusDamageHits + (Game.hasProgressMilestone("highEnergyBeam", 2) ? 5 : 0); skill.activeElapsed = 0; skill.damageTicksDone = 0;
    return true;
  };
  Game.hitHighEnergyBeam = function (skill) {
    var beams = skill.activeBeams || [{ x: skill.activeX, y: skill.activeY, x2: skill.activeX2, y2: skill.activeY2, width: skill.beamWidth }];
    beams.forEach(function (beam) {
      var dx = beam.x2 - beam.x, dy = beam.y2 - beam.y, length = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / length, uy = dy / length;
      for (var i = S.enemies.length - 1; i >= 0; i--) {
        var enemy = S.enemies[i], ex = enemy.x - beam.x, ey = enemy.y - beam.y, along = ex * ux + ey * uy, across = Math.abs(ex * uy - ey * ux), reach = beam.width / 2 + C.enemies[enemy.type].radius;
        if (along < 0 || along > length || across > reach) continue;
        if (!Game.isRaging(enemy) && (skill.crippleEnabled || Game.hasProgressMilestone("highEnergyBeam", 12))) {
          var duration = Math.max(skill.crippleEnabled ? skill.damageTakenDuration : 0, 4);
          var multiplier = Math.max(skill.crippleEnabled ? skill.damageTakenMultiplier : 1, 1.15);
          enemy.damageTakenTimer = Math.max(enemy.damageTakenTimer || 0, duration);
          enemy.damageTakenMultiplier = Math.max(enemy.damageTakenMultiplier || 1, multiplier);
        }
        if ((skill.slowEnabled && skill.slowDuration > 0) || Game.hasProgressMilestone("highEnergyBeam", 7)) Game.applySlow(enemy, Math.max(skill.slowEnabled ? skill.slowDuration : 0, .8), Math.min(skill.slowEnabled ? skill.slowFactor : 1, .3));
        Game.damageEnemy(enemy, skill.damage, { critical: false, noWeaponEffects: true, silentText: true, element: Game.getSkillElement("highEnergyBeam"), damageSource: "highEnergyBeam", progressSkillId: "highEnergyBeam" });
        if (enemy.hp <= 0) Game.killEnemy(i);
      }
    });
  };
  Game.launchSkillVolley = function (type, angle) {
    var skill = S.player.skills[type], origin = Game.getSkillMuzzle();
    if (type === "thermobaric") {
      var explosionRadius = skill.explosionRadius * (Game.hasProgressMilestone(type, 2) ? 1.15 : 1);
      var impactKnockback = skill.impactKnockback * (Game.hasProgressMilestone(type, 12) ? 1.2 : 1);
      var explosionKnockback = skill.explosionKnockback * (Game.hasProgressMilestone(type, 12) ? 1.2 : 1);
      S.skillProjectiles.push({ type: type, x: origin.x, y: origin.y, vx: Math.cos(angle) * skill.projectileSpeed, vy: Math.sin(angle) * skill.projectileSpeed, radius: skill.projectileRadius, impactDamage: skill.impactDamage, impactKnockback: impactKnockback, explosionDamage: skill.explosionDamage, explosionRadius: explosionRadius, explosionKnockback: explosionKnockback, burnDps: skill.burnDps, burnDuration: skill.burnDuration + (Game.hasProgressMilestone(type, 7) ? 1 : 0), pierce: skill.pierce + (Game.hasProgressMilestone(type, 18) ? 1 : 0), impactBurn: Game.hasProgressMilestone(type, 18), ignoreBurnImmunity: Game.hasProgressMilestone(type, 26), secondaryExplosion: Game.hasProgressMilestone(type, 22), hasImpacted: false, fuseTimer: 0, critical: false, element: Game.getSkillElement(type), damageSource: type, progressSkillId: type, hitEnemies: [] });
      return;
    }
    if (type === "airBlade") {
      var bladeLanes = 1 + skill.spread + (Game.hasProgressMilestone("airBlade", 22) ? 1 : 0);
      var bladePierce = skill.pierce + (Game.hasProgressMilestone("airBlade", 2) ? 1 : 0) + (Game.hasProgressMilestone("airBlade", 12) ? 3 : 0);
      var bladeKnockback = skill.knockback * (Game.hasProgressMilestone("airBlade", 7) ? 1.25 : 1);
      var bladeRadius = skill.projectileRadius * (Game.hasProgressMilestone("airBlade", 18) ? 1.3 : 1);
      var woundExtraDuration = Math.max(skill.woundExtraDuration, Game.hasProgressMilestone("airBlade", 26) ? 1 : 0);
      var woundExtraFactor = Math.max(skill.woundExtraFactor, Game.hasProgressMilestone("airBlade", 26) ? .4 : 0);
      for (var blade = 0; blade < bladeLanes; blade++) {
        var bladeAngle = angle + (blade - (bladeLanes - 1) / 2) * C.spreadAngle;
        S.skillProjectiles.push({ type: type, x: origin.x, y: origin.y, vx: Math.cos(bladeAngle) * skill.projectileSpeed, vy: Math.sin(bladeAngle) * skill.projectileSpeed, radius: bladeRadius, damage: skill.damage, knockback: bladeKnockback, pierce: bladePierce, woundDuration: skill.woundDuration, woundFactor: skill.woundFactor, woundExtraDuration: woundExtraDuration, woundExtraFactor: woundExtraFactor, critical: false, element: Game.getSkillElement(type), damageSource: type, progressSkillId: type, hitEnemies: [] });
      }
      return;
    }
    var lanes = 1 + skill.spread;
    var dryIceSlowDuration = Math.max(skill.slowDuration, Game.hasProgressMilestone("dryIce", 2) ? .8 : 0);
    var dryIceSlowFactor = Game.hasProgressMilestone("dryIce", 2) ? Math.min(skill.slowFactor, .5) : skill.slowFactor;
    var dryIceFreezeDuration = skill.freezeDuration > 0 && Game.hasProgressMilestone("dryIce", 7) ? skill.freezeDuration + .5 : skill.freezeDuration;
    var dryIcePierce = skill.pierce + (Game.hasProgressMilestone("dryIce", 12) ? 1 : 0);
    var dryIceFrostbiteDuration = skill.frostbiteDuration * (Game.hasProgressMilestone("dryIce", 18) ? 1.25 : 1);
    var dryIceSplitCount = skill.splitCount + (Game.hasProgressMilestone("dryIce", 22) ? 2 : 0);
    var dryIceMaxStacks = skill.frostbiteMaxStacks + (Game.hasProgressMilestone("dryIce", 26) ? 20 : 0);
    for (var lane = 0; lane < lanes; lane++) {
      var bulletAngle = angle + (lane - (lanes - 1) / 2) * C.spreadAngle;
      S.skillProjectiles.push({ type: type, x: origin.x, y: origin.y, vx: Math.cos(bulletAngle) * skill.projectileSpeed, vy: Math.sin(bulletAngle) * skill.projectileSpeed, radius: skill.projectileRadius, damage: skill.damage, knockback: skill.knockback, pierce: dryIcePierce, splitCount: dryIceSplitCount, slowDuration: dryIceSlowDuration, freezeDuration: dryIceFreezeDuration, slowFactor: dryIceSlowFactor, frostbiteEnabled: !!skill.frostbiteEnabled, frostbiteSource: type, frostbiteDps: skill.frostbiteDps, frostbiteDuration: dryIceFrostbiteDuration, frostbiteMaxStacks: dryIceMaxStacks, critical: false, element: Game.getSkillElement(type), damageSource: type, hitEnemies: [] });
    }
  };
  Game.launchArmoredCars = function (skill) {
    var wall = S.wall, count = 1 + skill.extraCars + (Game.hasProgressMilestone("armoredCar", 2) ? 1 : 0);
    var scale = (1 + skill.sizeLevel * .15) * (Game.hasProgressMilestone("armoredCar", 18) ? 1.25 : 1);
    var slowDuration = skill.slowDuration + (Game.hasProgressMilestone("armoredCar", 7) ? .6 : 0) + (Game.hasProgressMilestone("armoredCar", 22) ? 1 : 0);
    var stunChance = skill.stunChance + (Game.hasProgressMilestone("armoredCar", 12) ? .15 : 0) + (Game.hasProgressMilestone("armoredCar", 22) ? .1 : 0);
    var stunDuration = Math.max(skill.stunDuration, Game.hasProgressMilestone("armoredCar", 12) ? .5 : 0);
    var minX = wall.x - wall.width / 2 + skill.carWidth * scale / 2, maxX = wall.x + wall.width / 2 - skill.carWidth * scale / 2;
    var laneWidth = (maxX - minX) / count, startY = wall.y - wall.height / 2 - skill.carLength * scale / 2;
    for (var i = 0; i < count; i++) {
      var x = count === 1 ? U.rand(minX, maxX) : minX + laneWidth * (i + .5) + U.rand(-laneWidth * .18, laneWidth * .18);
      S.armoredCars.push({ x: U.clamp(x, minX, maxX), y: startY, speed: skill.speed, width: skill.carWidth * scale, length: skill.carLength * scale, damage: skill.damage, hitInterval: skill.hitInterval, slowFactor: skill.slowFactor, slowDuration: slowDuration, stunChance: stunChance, stunDuration: stunDuration, groundOnly: !!skill.groundOnly, element: Game.getSkillElement("armoredCar"), damageSource: "armoredCar", progressSkillId: "armoredCar", pulseTimer: 1, rankedPulse: Game.hasProgressMilestone("armoredCar", 26), contacts: [], impactFlash: 0 });
    }
  };
  Game.tickSkillCooldown = function (skill, dt) {
    var p = S.player, rate = (p && p.cooldownRate) || 1, progress = p && p.accountSkills && skill.progressSkillId ? p.accountSkills[skill.progressSkillId] : null;
    rate *= progress && progress.cooldownRate ? progress.cooldownRate : 1;
    skill.fireTimer = Math.max(0, skill.fireTimer - dt * rate);
  };
  Game.updateSkills = function (dt) {
    var p = S.player;
    Object.keys(p.skills).forEach(function (type) {
      var skill = p.skills[type];
      if (!skill.unlocked) return;
      if (type === "armoredCar") {
        Game.tickSkillCooldown(skill, dt);
        if (skill.fireTimer <= 0 && Game.isSkillRangeEngaged(type)) { Game.launchArmoredCars(skill); skill.fireTimer = skill.fireInterval; }
        return;
      }
      if (type === "bombardment") {
        Game.tickSkillCooldown(skill, dt);
        if (skill.fireTimer <= 0 && Game.isSkillRangeEngaged(type)) Game.launchBombardment();
        return;
      }
      if (type === "electromagnetic") {
        Game.tickSkillCooldown(skill, dt);
        if (skill.fireTimer <= 0 && Game.isSkillRangeEngaged(type)) Game.launchElectromagnetic();
        return;
      }
      if (type === "chainLightning") {
        Game.tickSkillCooldown(skill, dt);
        if (skill.fireTimer <= 0 && Game.isSkillRangeEngaged(type)) Game.launchChainLightning();
        return;
      }
      if (type === "highEnergyBeam") {
        if (skill.active) {
          var beamDuration = skill.activeDuration || skill.duration, beamHits = skill.activeHits || skill.damageHits;
          skill.activeElapsed = Math.min(beamDuration, skill.activeElapsed + dt);
          while (skill.damageTicksDone < beamHits && skill.activeElapsed + .000001 >= beamDuration * (skill.damageTicksDone + 1) / beamHits) {
            Game.hitHighEnergyBeam(skill);
            skill.damageTicksDone++;
          }
          if (skill.activeElapsed >= beamDuration) { skill.active = false; skill.activeBeams = null; skill.fireTimer = skill.fireInterval; }
        } else {
          Game.tickSkillCooldown(skill, dt);
          if (skill.fireTimer <= 0 && Game.isSkillRangeEngaged(type)) Game.launchHighEnergyBeam(skill);
        }
        return;
      }
      if (type === "whirlwindCannon") {
        if (skill.active) {
          var whirlwindDuration = skill.activeDuration || skill.duration;
          skill.activeElapsed = Math.min(whirlwindDuration, skill.activeElapsed + dt);
          if (skill.activeElapsed >= whirlwindDuration) { skill.active = false; skill.fireTimer = skill.fireInterval; }
          return;
        }
        Game.tickSkillCooldown(skill, dt);
        if (skill.fireTimer <= 0 && Game.isSkillRangeEngaged(type)) Game.launchWhirlwindCannon();
        return;
      }
      if (type === "hailGenerator") {
        if (skill.active) {
          var hailDuration = skill.activeDuration || skill.duration;
          skill.activeElapsed = Math.min(hailDuration, skill.activeElapsed + dt);
          if (skill.activeElapsed >= hailDuration) skill.active = false;
        }
        Game.tickSkillCooldown(skill, dt);
        if (skill.fireTimer <= 0 && !skill.active && Game.isSkillRangeEngaged(type)) Game.launchHailGenerator();
        return;
      }
      if (type === "drone") {
        if (skill.active) {
          var droneDuration = skill.activeDuration || skill.duration;
          skill.activeElapsed = Math.min(droneDuration, skill.activeElapsed + dt);
          if (skill.activeElapsed >= droneDuration) skill.active = false;
        }
        Game.tickSkillCooldown(skill, dt);
        if (skill.fireTimer <= 0 && !skill.active && Game.isSkillRangeEngaged(type)) Game.launchDrone();
        return;
      }
      if (type === "fuelBomb") {
        var fuelWindow = skill.activeDuration || skill.flightTime + skill.duration;
        if (skill.active) {
          skill.activeElapsed = Math.min(fuelWindow, skill.activeElapsed + dt);
          if (skill.activeElapsed >= fuelWindow) skill.active = false;
        }
        Game.tickSkillCooldown(skill, dt);
        if (skill.fireTimer <= 0 && !skill.active && Game.isSkillRangeEngaged(type)) Game.launchFuelBomb();
        return;
      }
      if (skill.burstShotsRemaining > 0) {
        skill.burstTimer -= dt;
        if (skill.burstTimer <= 0) {
          var burstOrigin = Game.getSkillMuzzle(), burstAngles = skill.burstAngles || [], burstAngle = Game.getSkillTargetAngle(type, burstOrigin, burstAngles);
          if (burstAngle !== null) {
            Game.launchSkillVolley(type, burstAngle);
            burstAngles.push(burstAngle);
          }
          skill.burstShotsRemaining--;
          if (skill.burstShotsRemaining > 0) skill.burstTimer = .18;
          else skill.burstAngles = [];
        }
        return;
      }
      Game.tickSkillCooldown(skill, dt);
      if (skill.fireTimer > 0 || !Game.isSkillRangeEngaged(type)) return;
      var origin = Game.getSkillMuzzle(), angle = Game.getSkillTargetAngle(type, origin);
      if (angle === null) return;
      Game.launchSkillVolley(type, angle);
      skill.fireTimer = skill.fireInterval;
      skill.burstShotsRemaining = skill.burst;
      skill.burstTimer = skill.burst > 0 ? .18 : 0;
      skill.burstAngles = skill.burst > 0 ? [angle] : [];
    });
  };
  Game.applyKnockback = function (enemy, sourceX, sourceY, distance) {
    if (!enemy || !(distance > 0)) return false;
    var scale = Game.getStatusScale(enemy, "knockback");
    if (scale <= 0) return false;
    if (Game.blockWithArmor(enemy)) return false;
    var dx = enemy.x - sourceX, dy = enemy.y - sourceY, length = Math.sqrt(dx * dx + dy * dy) || 1;
    var radius = C.enemies[enemy.type].radius, push = distance * scale;
    enemy.x = U.clamp(enemy.x + dx / length * push, radius, C.width - radius);
    enemy.y = Math.max(-radius, enemy.y + dy / length * push);
    return true;
  };
  Game.applyPull = function (enemy, sourceX, sourceY, distance) {
    if (!enemy || !(distance > 0)) return false;
    var scale = Game.getStatusScale(enemy, "pull");
    if (scale <= 0) return false;
    if (Game.blockWithArmor(enemy)) return false;
    var dx = sourceX - enemy.x, dy = sourceY - enemy.y, length = Math.sqrt(dx * dx + dy * dy) || 1;
    var radius = C.enemies[enemy.type].radius, pull = distance * scale;
    enemy.x = U.clamp(enemy.x + dx / length * pull, radius, C.width - radius);
    enemy.y = Math.max(-radius, enemy.y + dy / length * pull);
    return true;
  };
  Game.blockWithArmor = function (enemy) {
    if (!enemy.armorCharges || enemy.armorCharges <= 0) return false;
    var elapsed = (S.session && S.session.elapsed) || 0;
    if (elapsed - (enemy.armorStamp === undefined ? -1e9 : enemy.armorStamp) < C.armorBlockWindow) return true;
    enemy.armorStamp = elapsed;
    enemy.armorCharges--;
    enemy.armorFlash = .34;
    if (enemy.armorCharges === 0) Game.addText(enemy.x, enemy.y - C.enemies[enemy.type].radius - 12, "护甲破碎", C.colors.cyan);
    return true;
  };
  Game.isHardControlled = function (enemy) { return !!enemy && (enemy.control || 0) > 0; };
  Game.applyHardControl = function (enemy, type, duration) {
    if (!duration || duration <= 0) return false;
    var scale = Game.getStatusScale(enemy, type), status = (S.player && S.player.statusDurationMultiplier) || 1;
    if (scale <= 0) return false;
    if (Game.blockWithArmor(enemy)) return false;
    var time = duration * scale * status;
    if (time >= (enemy.control || 0)) { enemy.control = time; enemy.controlType = type; }
    return true;
  };
  Game.applyStun = function (enemy, duration) { return Game.applyHardControl(enemy, "stun", duration); };
  Game.applyFreeze = function (enemy, duration) { return Game.applyHardControl(enemy, "freeze", duration); };
  Game.applyParalysis = function (enemy, duration) { return Game.applyHardControl(enemy, "paralysis", duration); };
  Game.applySlow = function (enemy, duration, factor) {
    var scale = Game.getStatusScale(enemy, "slow"), status = (S.player && S.player.statusDurationMultiplier) || 1;
    if (scale <= 0) return false;
    if (Game.blockWithArmor(enemy)) return false;
    enemy.slow = Math.max(enemy.slow || 0, duration * scale * status);
    enemy.slowFactor = Math.min(enemy.slowFactor || .58, factor);
    return true;
  };
  Game.applyBurn = function (enemy, dps, duration, skillId, options) {
    var p = S.player || {}, scale = Game.getStatusScale(enemy, "burn");
    var attack = p.attackMultiplier === undefined ? 1 : p.attackMultiplier, fire = p.elementMultipliers && p.elementMultipliers.fire !== undefined ? p.elementMultipliers.fire : 1;
    var status = p.statusDurationMultiplier || 1;
    var info = enemy && C.enemies[enemy.type];
    if (scale <= 0 && options && options.ignoreImmunity && info && info.statusImmune && info.statusImmune.burn && !Game.isRaging(enemy)) {
      var durationScale = info.statusDurationScale ? info.statusDurationScale.burn : undefined;
      scale = durationScale === undefined || durationScale === null ? 1 : durationScale;
    }
    if (scale <= 0) return false;
    if (Game.blockWithArmor(enemy)) return false;
    var progressScale = Game.getProgressSkillDamageScale(skillId);
    enemy.burn = Math.max(enemy.burn || 0, duration * scale * status);
    enemy.burnDps = Math.max(enemy.burnDps || 0, dps * attack * fire * progressScale);
    return true;
  };
  Game.applyFrostbite = function (enemy, source, dps, duration, maxStacks) {
    if (!enemy || !source || !(dps > 0) || !(duration > 0) || !(maxStacks > 0)) return false;
    var scale = Game.getStatusScale(enemy, "frostbite"), p = S.player || {};
    var status = p.statusDurationMultiplier || 1, attack = p.attackMultiplier === undefined ? 1 : p.attackMultiplier, ice = p.elementMultipliers && p.elementMultipliers.ice !== undefined ? p.elementMultipliers.ice : 1, progressScale = Game.getProgressSkillDamageScale(source);
    if (scale <= 0) return false;
    if (Game.blockWithArmor(enemy)) return false;
    var stacks = enemy.frostbiteStacks || (enemy.frostbiteStacks = {}), list = stacks[source] || (stacks[source] = []);
    var time = duration * scale * status;
    if (list.length < maxStacks) list.push(time);
    else {
      var weakest = 0;
      for (var i = 1; i < list.length; i++) if (list[i] < list[weakest]) weakest = i;
      if (time > list[weakest]) list[weakest] = time;
    }
    enemy.frostbiteDps = enemy.frostbiteDps || {};
    enemy.frostbiteDps[source] = Math.max(enemy.frostbiteDps[source] || 0, dps * attack * ice * progressScale);
    return true;
  };
  Game.getFrostbiteStacks = function (enemy, source) {
    var stacks = enemy && enemy.frostbiteStacks, total = 0;
    if (!stacks) return 0;
    if (source) return stacks[source] ? stacks[source].length : 0;
    Object.keys(stacks).forEach(function (id) { total += stacks[id].length; });
    return total;
  };
  Game.getFrostbiteDps = function (enemy, source) {
    var stacks = enemy && enemy.frostbiteStacks, table = enemy && enemy.frostbiteDps, total = 0;
    if (!stacks || !table) return 0;
    Object.keys(stacks).forEach(function (id) {
      if (source && id !== source) return;
      total += stacks[id].length * (table[id] || 0);
    });
    return total;
  };
  Game.tickFrostbite = function (enemy, dt) {
    var stacks = enemy && enemy.frostbiteStacks;
    if (!stacks) return;
    Object.keys(stacks).forEach(function (id) {
      var list = stacks[id];
      for (var i = list.length - 1; i >= 0; i--) {
        list[i] -= dt;
        if (list[i] <= 0) list.splice(i, 1);
      }
    });
  };
  Game.applyWound = function (enemy, duration, factor, extraDuration, extraFactor) {
    var base = duration > 0, extra = extraDuration > 0;
    if (!base && !extra) return false;
    var scale = Game.getStatusScale(enemy, "wound"), status = (S.player && S.player.statusDurationMultiplier) || 1;
    if (scale <= 0) return false;
    if (Game.blockWithArmor(enemy)) return false;
    if (base) {
      enemy.wound = Math.max(enemy.wound || 0, duration * scale * status);
      enemy.woundFactor = Math.max(enemy.woundFactor || 0, factor || 0);
    }
    if (extra) {
      enemy.woundExtra = Math.max(enemy.woundExtra || 0, extraDuration * scale * status);
      enemy.woundExtraFactor = Math.max(enemy.woundExtraFactor || 0, extraFactor || 0);
    }
    return true;
  };
  Game.getHealScale = function (enemy) {
    var cut = 0;
    if (enemy.wound > 0) cut += enemy.woundFactor || 0;
    if (enemy.woundExtra > 0) cut += enemy.woundExtraFactor || 0;
    return U.clamp(1 - cut, 0, 1);
  };
  Game.explodeThermobaric = function (projectile) {
    S.explosions.push({ x: projectile.x, y: projectile.y, radius: projectile.explosionRadius, life: .42, duration: .42 });
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var enemy = S.enemies[i], dx = enemy.x - projectile.x, dy = enemy.y - projectile.y;
      if (dx * dx + dy * dy > Math.pow(projectile.explosionRadius + C.enemies[enemy.type].radius, 2)) continue;
      Game.damageEnemy(enemy, projectile.explosionDamage, projectile);
      Game.applyBurn(enemy, projectile.burnDps, projectile.burnDuration, "thermobaric", { ignoreImmunity: !!projectile.ignoreBurnImmunity });
      Game.applyKnockback(enemy, projectile.x, projectile.y, projectile.explosionKnockback);
      if (enemy.hp <= 0) Game.killEnemy(i);
    }
    if (projectile.secondaryExplosion) {
      S.skillProjectiles.push({ type: "thermobaricEcho", x: projectile.x, y: projectile.y, delay: .6, damage: projectile.explosionDamage * .45, radius: projectile.explosionRadius * .7, element: projectile.element, damageSource: "thermobaric", progressSkillId: "thermobaric" });
    }
  };
  Game.damageSkillArea = function (options) {
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var enemy = S.enemies[i], info = C.enemies[enemy.type], dx = enemy.x - options.x, dy = enemy.y - options.y, reach = options.radius + info.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      if (options.sourceObject && !Game.canHitEnemy(options.sourceObject, enemy)) continue;
      Game.damageEnemy(enemy, options.damage, { critical: false, noWeaponEffects: true, silentText: !!options.silentText, element: options.element, damageSource: options.damageSource, progressSkillId: options.progressSkillId || options.damageSource });
      if (options.onHit) options.onHit(enemy);
      if (enemy.hp <= 0) Game.killEnemy(i);
    }
  };
  Game.splitDryIceProjectile = function (projectile, enemy) {
    if (projectile.splitCount <= 0 || projectile.isShard || projectile.splitTriggered) return;
    projectile.splitTriggered = true;
    var angle = Math.atan2(projectile.vy, projectile.vx), count = projectile.splitCount;
    for (var i = 0; i < count; i++) {
      var shardAngle = angle + (i - (count - 1) / 2) * .2;
      S.skillProjectiles.push({ type: "iceShard", x: enemy.x, y: enemy.y, vx: Math.cos(shardAngle) * 245, vy: Math.sin(shardAngle) * 245, radius: Math.max(3, projectile.radius * .58), damage: projectile.damage * .45, knockback: projectile.knockback * .5, pierce: 0, splitCount: 0, slowDuration: projectile.slowDuration, freezeDuration: projectile.freezeDuration, slowFactor: projectile.slowFactor, frostbiteEnabled: projectile.frostbiteEnabled, frostbiteSource: projectile.frostbiteSource, frostbiteDps: projectile.frostbiteDps, frostbiteDuration: projectile.frostbiteDuration, frostbiteMaxStacks: projectile.frostbiteMaxStacks, critical: false, element: projectile.element, damageSource: "dryIce", hitEnemies: [enemy], isShard: true });
    }
  };
  Game.updateSkillProjectiles = function (dt) {
    for (var i = S.skillProjectiles.length - 1; i >= 0; i--) {
      var projectile = S.skillProjectiles[i];
      if (projectile.type === "chainLightning") {
        if (Game.updateChainLightnings(projectile, dt)) S.skillProjectiles.splice(i, 1);
        continue;
      }
      if (projectile.type === "electromagnetic") {
        if (S.enemies.indexOf(projectile.target) >= 0) { projectile.x = projectile.target.x; projectile.y = projectile.target.y; }
        projectile.delay -= dt;
        if (projectile.delay <= 0) { Game.resolveElectromagneticStrike(projectile); S.skillProjectiles.splice(i, 1); }
        continue;
      }
      if (projectile.type === "thermobaricEcho" || projectile.type === "bombardmentEcho") {
        projectile.delay -= dt;
        if (projectile.delay > 0) continue;
        S.explosions.push({ type: projectile.type, x: projectile.x, y: projectile.y, radius: projectile.radius, life: .48, duration: .48 });
        Game.damageSkillArea(projectile);
        S.skillProjectiles.splice(i, 1);
        continue;
      }
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
          if (projectile.impactBurn) Game.applyBurn(enemy, projectile.burnDps, projectile.burnDuration, "thermobaric", { ignoreImmunity: !!projectile.ignoreBurnImmunity });
          Game.applyKnockback(enemy, projectile.x - projectile.vx, projectile.y - projectile.vy, projectile.impactKnockback);
          if (enemy.hp <= 0) Game.killEnemy(j);
          if (Game.blocksProjectile(enemy)) { Game.explodeThermobaric(projectile); removed = true; }
          else if (projectile.pierce > 0) { projectile.pierce--; projectile.hasImpacted = true; projectile.fuseTimer = .18; }
          else { Game.explodeThermobaric(projectile); removed = true; }
        } else {
          Game.damageEnemy(enemy, projectile.damage, projectile);
          if (projectile.knockback > 0) Game.applyKnockback(enemy, projectile.x - projectile.vx, projectile.y - projectile.vy, projectile.knockback);
          if (projectile.slowDuration > 0) Game.applySlow(enemy, projectile.slowDuration, projectile.slowFactor);
          if (projectile.freezeDuration > 0) Game.applyFreeze(enemy, projectile.freezeDuration);
          if (projectile.frostbiteEnabled) Game.applyFrostbite(enemy, projectile.frostbiteSource, projectile.frostbiteDps, projectile.frostbiteDuration, projectile.frostbiteMaxStacks);
          if (projectile.woundDuration > 0 || projectile.woundExtraDuration > 0) Game.applyWound(enemy, projectile.woundDuration, projectile.woundFactor, projectile.woundExtraDuration, projectile.woundExtraFactor);
          Game.splitDryIceProjectile(projectile, enemy);
          if (enemy.hp <= 0) Game.killEnemy(j);
          if (Game.blocksProjectile(enemy)) removed = true;
          else {
            projectile.pierce--;
            if (projectile.pierce < 0) removed = true;
          }
        }
      }
      if (removed) S.skillProjectiles.splice(i, 1);
    }
  };
  Game.resolveElectromagneticStrike = function (strike) {
    var targetIndex = S.enemies.indexOf(strike.target), centerX = strike.x, centerY = strike.y, enemy;
    if (targetIndex < 0) return;
    enemy = S.enemies[targetIndex];
    centerX = enemy.x; centerY = enemy.y;
    var wasFrozen = Game.isHardControlled(enemy) && enemy.controlType === "freeze";
    var wasBurning = (enemy.burn || 0) > 0;
    S.explosions.push({ type: "electromagneticStrike", x: centerX, y: centerY, radius: 18, life: .3, duration: .3 });
    Game.damageEnemy(enemy, strike.damage, { critical: false, noWeaponEffects: true, element: strike.element, damageSource: "electromagnetic", progressSkillId: "electromagnetic" });
    Game.applyParalysis(enemy, strike.stunDuration);
    if (enemy.hp <= 0) Game.killEnemy(targetIndex);
    if (strike.chainTargets > 0) Game.spawnElectromagneticChain(strike, enemy);
    if (strike.frozenShards && wasFrozen) {
      for (var shard = 0; shard < 4; shard++) {
        var shardAngle = Math.PI * 2 * shard / 4;
        S.skillProjectiles.push({ type: "electromagneticShard", x: centerX, y: centerY, vx: Math.cos(shardAngle) * 245, vy: Math.sin(shardAngle) * 245, radius: 5, damage: strike.damage * .25, knockback: 0, pierce: 0, splitCount: 0, slowDuration: 0, freezeDuration: .5, slowFactor: .58, frostbiteEnabled: false, critical: false, element: "ice", damageSource: "electromagnetic", progressSkillId: "electromagnetic", hitEnemies: [] });
      }
    }
    if (strike.burnZone && wasBurning) S.electromagneticZones.push({ x: centerX, y: centerY, radius: 38, life: 1, duration: 1, tickInterval: .25, tickTimer: 0, tickDamage: strike.damage * .2, slowFactor: .6, slowDuration: 1, element: strike.element, damageSource: "electromagnetic" });
    if (strike.explosion) {
      S.explosions.push({ type: "electromagnetic", x: centerX, y: centerY, radius: strike.explosionRadius, life: .48, duration: .48 });
      for (var i = S.enemies.length - 1; i >= 0; i--) {
        enemy = S.enemies[i];
        if ((enemy.x - centerX) * (enemy.x - centerX) + (enemy.y - centerY) * (enemy.y - centerY) > Math.pow(strike.explosionRadius + C.enemies[enemy.type].radius, 2)) continue;
        Game.damageEnemy(enemy, strike.explosionDamage, { critical: false, noWeaponEffects: true, element: strike.element, damageSource: "electromagnetic", progressSkillId: "electromagnetic" });
        if (enemy.hp <= 0) Game.killEnemy(i);
      }
    }
    if (strike.matrix) S.electromagneticZones.push({ x: centerX, y: centerY, radius: strike.matrixRadius, life: strike.matrixDuration, duration: strike.matrixDuration, damage: strike.matrixDps, slowFactor: strike.matrixSlowFactor, element: strike.element, damageSource: "electromagnetic" });
  };
  Game.spawnElectromagneticChain = function (strike, enemy) {
    var chainSkill = { bounces: Math.max(0, strike.chainTargets - 1), damage: strike.damage * .45, stunDuration: 0, jumpDelay: .08, burnEnabled: false };
    var taken = [enemy], start = Game.getChainLightningJumpTarget(enemy, { hitEnemies: [enemy] }, taken);
    if (!start) return;
    var chain = Game.buildChainLightning(chainSkill, { x: enemy.x, y: enemy.y }, start, taken);
    chain.damageSource = "electromagnetic";
    chain.progressSkillId = "electromagnetic";
    chain.noParalysis = true;
    S.skillProjectiles.push(chain);
  };
  Game.updateElectromagneticZones = function (dt) {
    for (var i = S.electromagneticZones.length - 1; i >= 0; i--) {
      var zone = S.electromagneticZones[i];
      zone.life -= dt;
      if (zone.life <= 0) { S.electromagneticZones.splice(i, 1); continue; }
      if (zone.tickInterval) {
        zone.tickTimer = (zone.tickTimer || 0) - dt;
        if (zone.tickTimer > 0) continue;
        zone.tickTimer = zone.tickInterval;
      }
      for (var j = S.enemies.length - 1; j >= 0; j--) {
        var enemy = S.enemies[j], info = C.enemies[enemy.type], dx = enemy.x - zone.x, dy = enemy.y - zone.y, reach = zone.radius + info.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        Game.damageEnemy(enemy, zone.tickInterval ? zone.tickDamage : zone.damage * dt, { critical: false, noWeaponEffects: true, silentText: true, element: zone.element, damageSource: zone.damageSource || "electromagnetic", progressSkillId: "electromagnetic" });
        Game.applySlow(enemy, zone.slowDuration || .24, zone.slowFactor);
        if (enemy.hp <= 0) Game.killEnemy(j);
      }
    }
  };
  function bombardmentImpact(skill, point, wait) { return (wait || 0) + (point.y + 24) / skill.bombSpeed; }
  function bombardmentCoverage(skill, point, impactTime) {
    var score = 0;
    S.enemies.forEach(function (enemy) {
      var info = C.enemies[enemy.type], speed = Game.getEnemyMoveSpeed(enemy);
      var attackY = Game.getEnemyHoldY(info), predictedY = Math.min(attackY, enemy.y + speed * impactTime);
      var dx = enemy.x - point.x, dy = predictedY - point.y, distance = Math.sqrt(dx * dx + dy * dy), reach = skill.blastRadius + info.radius;
      if (distance > reach) return;
      var weight = Game.isBossEnemy(enemy) ? 1.6 : info.codexCategory === "elite" ? 1.3 : 1;
      score += weight * (1.1 - distance / reach);
    });
    return score;
  }
  function pushBombTargetAway(point, taken, offset, minY, maxY) {
    var result = { x: point.x, y: point.y }, margin = C.enemies.boss.radius;
    var angles = [0, Math.PI / 3, -Math.PI / 3, Math.PI * 2 / 3, -Math.PI * 2 / 3, Math.PI];
    taken.forEach(function (other) {
      var dx = result.x - other.x, dy = result.y - other.y, gap = Math.sqrt(dx * dx + dy * dy), base = Math.atan2(dy, dx);
      if (gap >= offset) return;
      if (gap < .001) base = 0;
      for (var i = 0; i < angles.length; i++) {
        var angle = base + angles[i];
        var nx = U.clamp(other.x + Math.cos(angle) * offset, margin, C.width - margin);
        var ny = U.clamp(other.y + Math.sin(angle) * offset, minY, maxY);
        var ndx = nx - other.x, ndy = ny - other.y;
        if (Math.sqrt(ndx * ndx + ndy * ndy) >= offset - .5) { result.x = nx; result.y = ny; return; }
      }
      result.x = U.clamp(other.x + Math.cos(base) * offset, margin, C.width - margin);
      result.y = U.clamp(other.y + Math.sin(base) * offset, minY, maxY);
    });
    return result;
  }
  Game.isBombTargetTooClose = function (point, taken, separation) {
    for (var i = 0; i < taken.length; i++) {
      var dx = point.x - taken[i].x, dy = point.y - taken[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < separation) return true;
    }
    return false;
  };
  Game.getBombardmentTarget = function (skill, delay, avoid) {
    if (!S.enemies.length) return null;
    var wait = delay || 0, taken = avoid || [], candidates = [];
    var separation = Math.max(56, skill.blastRadius * (skill.bombMinSeparationRatio || .9));
    var minY = 82, maxY = S.wall.y - S.wall.height / 2 - C.enemies.boss.radius;
    var rangeLine = Game.getSkillRangeLine("bombardment");
    S.enemies.forEach(function (candidate) {
      if (candidate.y < rangeLine) return;
      var candidateInfo = C.enemies[candidate.type], candidateSpeed = Game.getEnemyMoveSpeed(candidate);
      var candidateAttackY = Game.getEnemyHoldY(candidateInfo), targetY = candidate.y;
      for (var step = 0; step < 3; step++) {
        var estimateY = U.clamp(targetY, minY, maxY), dropTime = (estimateY + 24) / skill.bombSpeed;
        targetY = Math.min(candidateAttackY, candidate.y + candidateSpeed * dropTime);
      }
      var point = { x: U.clamp(candidate.x, C.enemies.boss.radius, C.width - C.enemies.boss.radius), y: U.clamp(targetY, minY, maxY) };
      point.score = bombardmentCoverage(skill, point, bombardmentImpact(skill, point, wait));
      candidates.push(point);
    });
    if (!candidates.length) return null;
    var main = candidates[0], alternative = null, index;
    for (index = 1; index < candidates.length; index++) if (candidates[index].score > main.score) main = candidates[index];
    if (!taken.length) return { x: main.x, y: main.y };
    for (index = 0; index < candidates.length; index++) {
      if (Game.isBombTargetTooClose(candidates[index], taken, separation)) continue;
      if (!alternative || candidates[index].score > alternative.score) alternative = candidates[index];
    }
    if (alternative && alternative.score >= main.score * (skill.bombAltScoreRatio || .45)) return { x: alternative.x, y: alternative.y };
    return Game.spreadBombTarget(skill, main, taken, separation, minY, maxY, wait);
  };
  Game.spreadBombTarget = function (skill, point, taken, separation, minY, maxY, wait) {
    var offset = separation, fallback = null;
    for (var attempt = 0; attempt < 4; attempt++) {
      var result = pushBombTargetAway(point, taken, offset, minY, maxY);
      if (bombardmentCoverage(skill, result, bombardmentImpact(skill, result, wait)) > 0) return result;
      if (!fallback) fallback = result;
      offset *= .5;
    }
    return fallback;
  };
  Game.launchBombardment = function () {
    var skill = S.player.skills.bombardment;
    if (!skill.unlocked || skill.fireTimer > 0) return false;
    var dropDelay = skill.bombDropDelay || .42, targets = [], index, target;
    var bombCount = 1 + skill.extraBombs + (Game.hasProgressMilestone("bombardment", 2) ? 1 : 0);
    var blastRadius = skill.blastRadius * (Game.hasProgressMilestone("bombardment", 12) ? 1.3 : 1);
    var stunDuration = Math.max(skill.stunDuration, Game.hasProgressMilestone("bombardment", 7) ? .8 : 0);
    var centerDamageMultiplier = skill.centerDamageMultiplier + (Game.hasProgressMilestone("bombardment", 22) ? .8 : 0);
    var targetingSkill = {};
    Object.keys(skill).forEach(function (key) { targetingSkill[key] = skill[key]; });
    targetingSkill.blastRadius = blastRadius;
    for (index = 0; index < bombCount; index++) {
      target = Game.getBombardmentTarget(targetingSkill, index * dropDelay, targets);
      if (!target) break;
      targets.push(target);
    }
    if (!targets.length) return false;
    targets.forEach(function (point, order) {
      S.bombDrops.push({ x: point.x, y: -24, targetX: point.x, targetY: point.y, delay: order * dropDelay, speed: skill.bombSpeed, damage: skill.damage, radius: blastRadius, centerRadius: skill.centerRadius, knockback: skill.knockback, centerDamageMultiplier: centerDamageMultiplier, stunDuration: stunDuration, burnEnabled: Game.hasProgressMilestone("bombardment", 18), echoEnabled: Game.hasProgressMilestone("bombardment", 26), thermonuclear: skill.thermonuclear, heatDuration: skill.heatDuration, heatDps: skill.heatDps, heatSlowFactor: skill.heatSlowFactor, element: Game.getSkillElement("bombardment"), damageSource: "bombardment", progressSkillId: "bombardment" });
    });
    skill.fireTimer = skill.fireInterval;
    return true;
  };
  Game.explodeBombardment = function (bomb) {
    S.explosions.push({ type: "bombardment", x: bomb.targetX, y: bomb.targetY, radius: bomb.radius, life: .62, duration: .62 });
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var enemy = S.enemies[i], dx = enemy.x - bomb.targetX, dy = enemy.y - bomb.targetY, distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > bomb.radius + C.enemies[enemy.type].radius) continue;
      var damage = bomb.damage * (distance <= bomb.centerRadius ? bomb.centerDamageMultiplier : 1);
      Game.damageEnemy(enemy, damage, { critical: false, noWeaponEffects: true, element: bomb.element, damageSource: "bombardment", progressSkillId: "bombardment" });
      if (bomb.stunDuration > 0) Game.applyStun(enemy, bomb.stunDuration);
      if (bomb.burnEnabled) Game.applyBurn(enemy, damage * .12, 2, "bombardment");
      if (distance > .001) Game.applyKnockback(enemy, bomb.targetX, bomb.targetY, bomb.knockback * (1 - Math.min(distance / (bomb.radius * 1.5), .45)));
      else Game.applyKnockback(enemy, bomb.targetX, bomb.targetY + 1, bomb.knockback);
      if (enemy.hp <= 0) Game.killEnemy(i);
    }
    if (bomb.thermonuclear) S.bombZones.push({ x: bomb.targetX, y: bomb.targetY, radius: bomb.radius, life: bomb.heatDuration, duration: bomb.heatDuration, damage: bomb.heatDps, slowFactor: bomb.heatSlowFactor, element: bomb.element, damageSource: "bombardment" });
    if (bomb.echoEnabled) S.skillProjectiles.push({ type: "bombardmentEcho", x: bomb.targetX, y: bomb.targetY, delay: .8, damage: bomb.damage * .4, radius: bomb.radius * .6, element: bomb.element, damageSource: "bombardment", progressSkillId: "bombardment" });
    Game.burst(bomb.targetX, bomb.targetY, 24, C.colors.yellow);
  };
  Game.updateBombardment = function (dt) {
    for (var i = S.bombDrops.length - 1; i >= 0; i--) {
      var bomb = S.bombDrops[i];
      if (bomb.delay > 0) { bomb.delay = Math.max(0, bomb.delay - dt); continue; }
      bomb.y += bomb.speed * dt;
      if (bomb.y >= bomb.targetY) { Game.explodeBombardment(bomb); S.bombDrops.splice(i, 1); }
    }
    for (var j = S.bombZones.length - 1; j >= 0; j--) {
      var zone = S.bombZones[j];
      zone.life -= dt;
      if (zone.life <= 0) { S.bombZones.splice(j, 1); continue; }
      for (var k = S.enemies.length - 1; k >= 0; k--) {
        var enemy = S.enemies[k], dx = enemy.x - zone.x, dy = enemy.y - zone.y, reach = zone.radius + C.enemies[enemy.type].radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        Game.damageEnemy(enemy, zone.damage * dt, { critical: false, noWeaponEffects: true, silentText: true, element: zone.element, damageSource: zone.damageSource || "bombardment" });
        Game.applySlow(enemy, .24, zone.slowFactor);
        if (enemy.hp <= 0) Game.killEnemy(k);
      }
    }
  };
  Game.getWhirlwindField = function (radius) {
    var wallTop = S.wall ? S.wall.y - S.wall.height / 2 : C.height, minY = 96 + radius;
    return { minX: radius + 4, maxX: Math.max(radius + 4, C.width - radius - 4), minY: minY, maxY: Math.max(minY, wallTop - radius - 6) };
  };
  Game.getWhirlwindEnemyWeight = function (enemy) {
    var info = C.enemies[enemy.type];
    return Game.isBossEnemy(enemy) ? 1.6 : info.codexCategory === "elite" ? 1.3 : 1;
  };
  Game.getWhirlwindChaseTarget = function (tornado, field) {
    var skill = S.player.skills.whirlwindCannon, clusterRadius = skill.clusterRadius, threatRange = Math.max(1, field.maxY - field.minY);
    var best = null, bestScore = -Infinity;
    S.enemies.forEach(function (enemy) {
      var info = C.enemies[enemy.type];
      if (!Game.canHitEnemy(skill, enemy)) return;
      if (enemy.y < field.minY - tornado.radius || enemy.y > field.maxY + info.radius + tornado.radius) return;
      var dx = enemy.x - tornado.x, dy = enemy.y - tornado.y, distance = Math.sqrt(dx * dx + dy * dy), cluster = 0;
      S.enemies.forEach(function (other) {
        if (!Game.canHitEnemy(skill, other)) return;
        var ox = other.x - enemy.x, oy = other.y - enemy.y;
        if (ox * ox + oy * oy > clusterRadius * clusterRadius) return;
        cluster += Game.getWhirlwindEnemyWeight(other);
      });
      var score = cluster * skill.clusterWeight - distance * .35 + ((enemy.y - field.minY) / threatRange) * skill.threatWeight;
      S.tornadoes.forEach(function (other) {
        if (other === tornado) return;
        var ox = enemy.x - other.x, oy = enemy.y - other.y, reach = tornado.radius + other.radius + 24;
        if (ox * ox + oy * oy <= reach * reach) score -= skill.clusterWeight;
      });
      if (score > bestScore) { bestScore = score; best = enemy; }
    });
    if (!best) return null;
    return { x: U.clamp(best.x + U.rand(-1, 1) * skill.clusterJitter * tornado.radius, field.minX, field.maxX), y: U.clamp(best.y + U.rand(-1, 1) * skill.clusterJitter * tornado.radius, field.minY, field.maxY) };
  };
  Game.pickWhirlwindTarget = function (tornado, field) {
    var skill = S.player.skills.whirlwindCannon, target = Game.getWhirlwindChaseTarget(tornado, field);
    if (target) {
      tornado.targetX = target.x;
      tornado.targetY = target.y;
      tornado.retargetTimer = U.rand(.5, 1.2);
    } else {
      tornado.targetX = U.rand(field.minX, field.maxX);
      tornado.targetY = U.rand(field.minY, field.maxY);
      tornado.retargetTimer = U.rand(1.1, 2.1);
    }
  };
  Game.spawnWhirlwind = function (skill, options) {
    var opts = options || {}, count = opts.count || 1, field = Game.getWhirlwindField(skill.radius);
    var band = (field.maxX - field.minX) / count, bandX = field.minX + band * (opts.index || 0);
    var radius = opts.radius || skill.radius, duration = opts.duration || skill.duration, pullSpeed = opts.pullSpeed || skill.pullSpeed;
    var tornado = {
      x: U.rand(bandX, bandX + band), y: U.rand(field.minY, field.minY + (field.maxY - field.minY) * .5),
      radius: radius, life: duration, duration: duration, speed: skill.speed, stationary: false,
      damage: skill.damage, hitInterval: skill.hitInterval, pullSpeed: pullSpeed, progressBlade: !!opts.progressBlade, groundOnly: !!skill.groundOnly, element: Game.getSkillElement("whirlwindCannon"), damageSource: "whirlwindCannon", progressSkillId: "whirlwindCannon", contacts: [], targetX: 0, targetY: 0, retargetTimer: 0
    };
    tornado.targetX = tornado.x;
    tornado.targetY = tornado.y;
    S.tornadoes.push(tornado);
  };
  Game.launchWhirlwindCannon = function () {
    var skill = S.player.skills.whirlwindCannon, count = 1 + skill.extraTornadoes + (Game.hasProgressMilestone("whirlwindCannon", 12) ? 1 : 0);
    if (!skill.unlocked || skill.active || skill.fireTimer > 0) return false;
    var duration = skill.duration + (Game.hasProgressMilestone("whirlwindCannon", 2) ? 2 : 0);
    var radius = skill.radius * (Game.hasProgressMilestone("whirlwindCannon", 18) ? 1.2 : 1);
    var pullSpeed = skill.pullSpeed * (Game.hasProgressMilestone("whirlwindCannon", 7) ? 1.25 : 1);
    for (var i = 0; i < count; i++) Game.spawnWhirlwind(skill, { index: i, count: count, duration: duration, radius: radius, pullSpeed: pullSpeed, progressBlade: Game.hasProgressMilestone("whirlwindCannon", 22) });
    skill.active = true;
    skill.activeElapsed = 0;
    skill.activeDuration = duration;
    return true;
  };
  Game.spawnStormWhirlwind = function (skill, tornado, override) {
    var opts = override || {}, duration = opts.duration || skill.stormDuration, radiusScale = opts.radiusScale || skill.stormRadiusScale, pullScale = opts.pullScale || skill.stormPullScale, damageScale = opts.damageScale || skill.stormDamageScale;
    S.tornadoes.push({ x: tornado.x, y: tornado.y, radius: tornado.radius * radiusScale, life: duration, duration: duration, speed: 0, stationary: true, damage: tornado.damage * damageScale, hitInterval: tornado.hitInterval, pullSpeed: tornado.pullSpeed * pullScale, progressBlade: !!tornado.progressBlade, groundOnly: !!skill.groundOnly, element: tornado.element, damageSource: "whirlwindCannon", progressSkillId: "whirlwindCannon", contacts: [], targetX: tornado.x, targetY: tornado.y, retargetTimer: 0 });
    Game.burst(tornado.x, tornado.y, 18, C.colors.cyan);
  };
  Game.spawnWhirlwindBlade = function (tornado, enemy) {
    var air = S.player.skills.airBlade, source = air && air.unlocked ? air : C.skillDefaults.airBlade, angle = Math.atan2(enemy.y - tornado.y, enemy.x - tornado.x);
    S.skillProjectiles.push({ type: "airBlade", x: tornado.x, y: tornado.y, vx: Math.cos(angle) * source.projectileSpeed, vy: Math.sin(angle) * source.projectileSpeed, radius: source.projectileRadius, damage: source.damage, knockback: 0, pierce: 0, woundDuration: 0, woundFactor: 0, woundExtraDuration: 0, woundExtraFactor: 0, critical: false, noWeaponEffects: true, fromWhirlwind: true, element: Game.getSkillElement("whirlwindCannon"), damageSource: "whirlwindCannon", progressSkillId: "whirlwindCannon", hitEnemies: [] });
  };
  Game.moveWhirlwind = function (tornado, dt) {
    var field = Game.getWhirlwindField(tornado.radius);
    tornado.retargetTimer -= dt;
    if (tornado.retargetTimer <= 0) Game.pickWhirlwindTarget(tornado, field);
    var dx = tornado.targetX - tornado.x, dy = tornado.targetY - tornado.y, distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 10) return;
    var step = Math.min(tornado.speed * dt, distance);
    tornado.x = U.clamp(tornado.x + dx / distance * step, field.minX, field.maxX);
    tornado.y = U.clamp(tornado.y + dy / distance * step, field.minY, field.maxY);
  };
  Game.updateWhirlwinds = function (dt) {
    if (!S.tornadoes || !S.tornadoes.length) return;
    var skill = S.player.skills.whirlwindCannon;
    for (var i = S.tornadoes.length - 1; i >= 0; i--) {
      var tornado = S.tornadoes[i];
      tornado.life -= dt;
      if (tornado.life <= 0) {
        if (!tornado.stationary && Game.hasProgressMilestone("whirlwindCannon", 26)) Game.spawnStormWhirlwind(skill, tornado, { duration: 1.5, radiusScale: 1.45, pullScale: 1.15, damageScale: 1 });
        else if (!tornado.stationary && skill.stormGather) Game.spawnStormWhirlwind(skill, tornado);
        S.tornadoes.splice(i, 1);
        continue;
      }
      if (!tornado.stationary) Game.moveWhirlwind(tornado, dt);
      tornado.contacts.forEach(function (contact) { contact.hitTimer = Math.max(0, contact.hitTimer - dt); });
      for (var j = S.enemies.length - 1; j >= 0; j--) {
        var enemy = S.enemies[j], info = C.enemies[enemy.type];
        if (!Game.canHitEnemy(tornado, enemy)) continue;
        var dx = enemy.x - tornado.x, dy = enemy.y - tornado.y, reach = tornado.radius + info.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        var distance = Math.sqrt(dx * dx + dy * dy) || 1;
        Game.applyPull(enemy, tornado.x, tornado.y, tornado.pullSpeed * dt * (.35 + .65 * (1 - distance / reach)));
        var contactIndex = -1;
        for (var k = 0; k < tornado.contacts.length; k++) if (tornado.contacts[k].enemy === enemy) { contactIndex = k; break; }
        if (contactIndex < 0) { tornado.contacts.push({ enemy: enemy, hitTimer: 0 }); contactIndex = tornado.contacts.length - 1; }
        if (tornado.contacts[contactIndex].hitTimer > 0) continue;
        tornado.contacts[contactIndex].hitTimer = tornado.hitInterval;
        Game.damageEnemy(enemy, tornado.damage, { critical: false, noWeaponEffects: true, silentText: true, element: tornado.element, damageSource: "whirlwindCannon", progressSkillId: "whirlwindCannon" });
        if (tornado.progressBlade) Game.spawnWhirlwindBlade(tornado, enemy);
        Game.burst(enemy.x, enemy.y, 1, C.colors.cyan);
        if (enemy.hp <= 0) { Game.killEnemy(j); tornado.contacts.splice(contactIndex, 1); }
      }
    }
  };
  Game.getDroneChaseTarget = function (drone, field) {
    var skill = S.player.skills.drone, clusterRadius = skill.clusterRadius, threatRange = Math.max(1, field.maxY - field.minY);
    var best = null, bestScore = -Infinity;
    S.enemies.forEach(function (enemy) {
      var info = C.enemies[enemy.type];
      if (!Game.canHitEnemy(drone, enemy)) return;
      if (enemy.y < field.minY - drone.radius || enemy.y > field.maxY + info.radius + drone.radius) return;
      var dx = enemy.x - drone.x, dy = enemy.y - drone.y, distance = Math.sqrt(dx * dx + dy * dy), cluster = 0;
      S.enemies.forEach(function (other) {
        if (!Game.canHitEnemy(drone, other)) return;
        var ox = other.x - enemy.x, oy = other.y - enemy.y;
        if (ox * ox + oy * oy > clusterRadius * clusterRadius) return;
        cluster += Game.getWhirlwindEnemyWeight(other);
      });
      var score = cluster * skill.clusterWeight - distance * .35 + ((enemy.y - field.minY) / threatRange) * skill.threatWeight;
      S.drones.forEach(function (other) {
        if (other === drone) return;
        var ox = enemy.x - other.x, oy = enemy.y - other.y, reach = drone.radius + other.radius + 24;
        if (ox * ox + oy * oy <= reach * reach) score -= skill.clusterWeight;
      });
      if (score > bestScore) { bestScore = score; best = enemy; }
    });
    if (!best) return null;
    return { x: U.clamp(best.x + U.rand(-1, 1) * skill.clusterJitter * drone.radius, field.minX, field.maxX), y: U.clamp(best.y + U.rand(-1, 1) * skill.clusterJitter * drone.radius, field.minY, field.maxY) };
  };
  Game.pickDroneTarget = function (drone, field) {
    var target = Game.getDroneChaseTarget(drone, field);
    if (target) {
      drone.targetX = target.x;
      drone.targetY = target.y;
      drone.retargetTimer = U.rand(.45, 1.1);
    } else {
      drone.targetX = U.rand(field.minX, field.maxX);
      drone.targetY = U.rand(field.minY, field.maxY);
      drone.retargetTimer = U.rand(1.1, 2.1);
    }
  };
  Game.getDroneRadius = function (skill, extraScale) { return skill.radius * (1 + (skill.sizeLevel || 0) * .3) * (extraScale || 1); };
  Game.spawnDrone = function (skill, options) {
    var opts = options || {}, count = opts.count || 1, sizeScale = opts.sizeScale || 1, radius = Game.getDroneRadius(skill, sizeScale), field = Game.getWhirlwindField(radius);
    var band = (field.maxX - field.minX) / count, bandX = field.minX + band * (opts.index || 0);
    var drone = {
      x: U.rand(bandX, bandX + band), y: U.rand(field.minY, field.minY + (field.maxY - field.minY) * .5),
      radius: radius, baseRadius: skill.radius, sizeLevel: skill.sizeLevel || 0,
      life: opts.duration || skill.duration, duration: opts.duration || skill.duration, speed: opts.speed || skill.speed,
      damage: skill.damage * (opts.damageScale || 1), hitInterval: skill.hitInterval, stunDuration: opts.stunDuration === undefined ? skill.stunDuration : opts.stunDuration, bladeEnabled: !!skill.bladeEnabled,
      groundOnly: !!skill.groundOnly, element: Game.getSkillElement("drone"), damageSource: "drone", progressSkillId: "drone", contacts: [], targetX: 0, targetY: 0, retargetTimer: 0, spin: U.rand(0, Math.PI * 2)
    };
    drone.targetX = drone.x;
    drone.targetY = drone.y;
    S.drones.push(drone);
    return drone;
  };
  Game.launchDrone = function () {
    var skill = S.player.skills.drone;
    if (!skill.unlocked || skill.active || skill.fireTimer > 0) return false;
    var duration = skill.duration + (Game.hasProgressMilestone("drone", 2) ? 1.5 : 0);
    var sizeScale = Game.hasProgressMilestone("drone", 7) ? 1.15 : 1;
    var speed = skill.speed * (Game.hasProgressMilestone("drone", 18) ? 1.15 : 1);
    var stunDuration = Game.hasProgressMilestone("drone", 26) ? Math.max(skill.stunDuration, .6) : skill.stunDuration;
    var count = Game.hasProgressMilestone("drone", 22) ? 2 : 1;
    for (var i = 0; i < count; i++) Game.spawnDrone(skill, { index: i, count: count, duration: duration, sizeScale: sizeScale, speed: speed, stunDuration: stunDuration, damageScale: i === 1 ? .7 : 1 });
    skill.active = true;
    skill.activeElapsed = 0;
    skill.activeDuration = duration;
    skill.fireTimer = skill.fireInterval;
    return true;
  };
  Game.spawnDroneBlade = function (drone, enemy) {
    var skill = S.player.skills.airBlade, source = skill && skill.unlocked ? skill : C.skillDefaults.airBlade;
    var angle = Math.atan2(enemy.y - drone.y, enemy.x - drone.x);
    S.skillProjectiles.push({
      type: "airBlade", x: drone.x, y: drone.y, vx: Math.cos(angle) * source.projectileSpeed, vy: Math.sin(angle) * source.projectileSpeed,
      radius: source.projectileRadius, damage: source.damage, knockback: 0, pierce: 0,
      woundDuration: 0, woundFactor: 0, woundExtraDuration: 0, woundExtraFactor: 0,
      critical: false, noWeaponEffects: true, fromDrone: true, element: Game.getSkillElement("drone"), damageSource: "drone", progressSkillId: "drone", hitEnemies: [enemy]
    });
    return S.skillProjectiles[S.skillProjectiles.length - 1];
  };
  Game.moveDrone = function (drone, dt) {
    var field = Game.getWhirlwindField(drone.radius);
    drone.spin += dt * 9;
    drone.retargetTimer -= dt;
    if (drone.retargetTimer <= 0) Game.pickDroneTarget(drone, field);
    var dx = drone.targetX - drone.x, dy = drone.targetY - drone.y, distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 8) return;
    var step = Math.min(drone.speed * dt, distance);
    drone.x = U.clamp(drone.x + dx / distance * step, field.minX, field.maxX);
    drone.y = U.clamp(drone.y + dy / distance * step, field.minY, field.maxY);
  };
  Game.updateDrones = function (dt) {
    if (!S.drones || !S.drones.length) return;
    for (var i = S.drones.length - 1; i >= 0; i--) {
      var drone = S.drones[i];
      drone.life -= dt;
      if (drone.life <= 0) { S.drones.splice(i, 1); continue; }
      Game.moveDrone(drone, dt);
      drone.contacts.forEach(function (contact) { contact.hitTimer = Math.max(0, contact.hitTimer - dt); });
      for (var j = S.enemies.length - 1; j >= 0; j--) {
        var enemy = S.enemies[j], info = C.enemies[enemy.type];
        if (!Game.canHitEnemy(drone, enemy)) continue;
        var dx = enemy.x - drone.x, dy = enemy.y - drone.y, reach = drone.radius + info.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        var contactIndex = -1;
        for (var k = 0; k < drone.contacts.length; k++) if (drone.contacts[k].enemy === enemy) { contactIndex = k; break; }
        if (contactIndex < 0) { drone.contacts.push({ enemy: enemy, hitTimer: 0 }); contactIndex = drone.contacts.length - 1; }
        if (drone.contacts[contactIndex].hitTimer > 0) continue;
        drone.contacts[contactIndex].hitTimer = drone.hitInterval;
        Game.damageEnemy(enemy, drone.damage, { critical: false, noWeaponEffects: true, silentText: true, element: drone.element, damageSource: "drone", progressSkillId: "drone" });
        if (Game.hasProgressMilestone("drone", 12)) {
          enemy.damageTakenTimer = Math.max(enemy.damageTakenTimer || 0, 5);
          enemy.damageTakenMultiplier = Math.max(enemy.damageTakenMultiplier || 1, 1.3);
        }
        if (drone.bladeEnabled) Game.spawnDroneBlade(drone, enemy);
        if (drone.stunDuration > 0) Game.applyStun(enemy, drone.stunDuration);
        Game.burst(enemy.x, enemy.y, 1, "#a6c8ff");
        if (enemy.hp <= 0) { Game.killEnemy(j); drone.contacts.splice(contactIndex, 1); }
      }
    }
  };
  Game.getChainLightningStart = function (taken) {
    var rangeLine = Game.getSkillRangeLine("chainLightning"), best = null, bestScore = -Infinity, fallback = null, fallbackScore = -Infinity;
    S.enemies.forEach(function (enemy) {
      if (enemy.y < rangeLine) return;
      var score = enemy.y + C.enemies[enemy.type].radius * .35 + (Game.isBossEnemy(enemy) ? 10 : 0);
      if (taken && taken.indexOf(enemy) >= 0) {
        if (score > fallbackScore) { fallbackScore = score; fallback = enemy; }
        return;
      }
      if (score > bestScore) { bestScore = score; best = enemy; }
    });
    return best || fallback;
  };
  Game.getChainLightningJumpTarget = function (from, chain, taken) {
    var best = null, bestDistance = Infinity, fallback = null, fallbackDistance = Infinity;
    S.enemies.forEach(function (enemy) {
      if (chain.hitEnemies.indexOf(enemy) >= 0) return;
      var dx = enemy.x - from.x, dy = enemy.y - from.y, distance = dx * dx + dy * dy;
      if (taken && taken.indexOf(enemy) >= 0) {
        if (distance < fallbackDistance) { fallbackDistance = distance; fallback = enemy; }
        return;
      }
      if (distance < bestDistance) { bestDistance = distance; best = enemy; }
    });
    return best || fallback;
  };
  Game.buildChainLightning = function (skill, origin, start, taken) {
    var chain = {
      type: "chainLightning", originX: origin.x, originY: origin.y,
      nodes: [{ target: start, x: start.x, y: start.y, struck: false }],
      hitEnemies: [start], next: 0, timer: 0, life: .32, jumpDelay: Math.max(.03, skill.jumpDelay || .08),
      damage: skill.damage, stunDuration: skill.stunDuration, element: Game.getSkillElement("chainLightning"), damageSource: "chainLightning", progressSkillId: "chainLightning",
      burnEnabled: !!skill.burnEnabled, burnDps: skill.burnDps || 0, burnDuration: skill.burnDuration || 0
    };
    var cursor = start;
    for (var i = 0; i < skill.bounces; i++) {
      var next = Game.getChainLightningJumpTarget(cursor, chain, taken);
      if (!next) break;
      chain.nodes.push({ target: next, x: next.x, y: next.y, struck: false });
      chain.hitEnemies.push(next);
      cursor = next;
    }
    return chain;
  };
  Game.launchChainLightning = function () {
    var skill = S.player.skills.chainLightning, count, taken = [], made = 0, origin, start, chain;
    if (!skill.unlocked || skill.fireTimer > 0) return false;
    var localExtra = skill.extraChains || 0, accountExtra = Game.hasProgressMilestone("chainLightning", 22) ? 1 : 0;
    var runtime = { bounces: skill.bounces + (Game.hasProgressMilestone("chainLightning", 2) ? 2 : 0), damage: skill.damage, stunDuration: skill.stunDuration + (Game.hasProgressMilestone("chainLightning", 7) ? .4 : 0), jumpDelay: skill.jumpDelay, burnEnabled: !!skill.burnEnabled, burnDps: skill.burnDps || 0, burnDuration: skill.burnDuration || 0 };
    count = 1 + localExtra + accountExtra;
    origin = Game.getSkillMuzzle();
    for (var i = 0; i < count; i++) {
      start = Game.getChainLightningStart(taken);
      if (!start) break;
      chain = Game.buildChainLightning(runtime, origin, start, taken);
      if (i >= 1 + localExtra) chain.damage *= .7;
      chain.nodes.forEach(function (node) { if (taken.indexOf(node.target) < 0) taken.push(node.target); });
      S.skillProjectiles.push(chain);
      made++;
    }
    if (!made) return false;
    skill.fireTimer = skill.fireInterval;
    return true;
  };
  Game.resolveChainLightningNode = function (chain) {
    var node = chain.nodes[chain.next], enemy = node.target, index = S.enemies.indexOf(enemy);
    chain.next++;
    if (index < 0) return false;
    node.x = enemy.x; node.y = enemy.y; node.struck = true;
    S.explosions.push({ type: "chainSpark", x: enemy.x, y: enemy.y, radius: 13, life: .26, duration: .26 });
    var damageScale = 1, burning = (enemy.burn || 0) > 0, frozen = Game.isHardControlled(enemy) && enemy.controlType === "freeze";
    var isChainSkill = (chain.damageSource || "chainLightning") === "chainLightning";
    if (!chain.freeChain && isChainSkill && ((Game.hasProgressMilestone("chainLightning", 12) && burning) || (Game.hasProgressMilestone("chainLightning", 18) && frozen))) damageScale = 1.35;
    Game.damageEnemy(enemy, chain.damage * damageScale, { critical: false, noWeaponEffects: true, element: chain.element, damageSource: chain.damageSource || "chainLightning", progressSkillId: chain.progressSkillId || "chainLightning" });
    if (chain.burnEnabled && chain.burnDps > 0) Game.applyBurn(enemy, chain.burnDps, chain.burnDuration, "chainLightning");
    if (!chain.noParalysis) Game.applyParalysis(enemy, chain.stunDuration);
    if (!chain.freeChain && isChainSkill && Game.hasProgressMilestone("chainLightning", 26) && Math.random() < .2) Game.spawnFreeChainLightning(enemy);
    Game.burst(enemy.x, enemy.y, 3, "#c9a1ff");
    if (enemy.hp <= 0) Game.killEnemy(index);
    return true;
  };
  Game.spawnFreeChainLightning = function (enemy) {
    var defaults = C.skillDefaults.chainLightning, taken = [enemy], start = Game.getChainLightningJumpTarget(enemy, { hitEnemies: [enemy] }, taken), chain;
    if (!start) return;
    chain = Game.buildChainLightning({ bounces: defaults.bounces, damage: defaults.damage, stunDuration: defaults.stunDuration, jumpDelay: defaults.jumpDelay, burnEnabled: false }, { x: enemy.x, y: enemy.y }, start, taken);
    chain.freeChain = true;
    chain.damageSource = "chainLightningFree";
    chain.progressSkillId = "";
    S.skillProjectiles.push(chain);
  };
  Game.updateChainLightnings = function (chain, dt) {
    if (chain.next < chain.nodes.length) {
      chain.timer -= dt;
      while (chain.next < chain.nodes.length && chain.timer <= 0) {
        Game.resolveChainLightningNode(chain);
        chain.timer += chain.jumpDelay;
      }
      if (chain.next >= chain.nodes.length) chain.timer = chain.life;
      return false;
    }
    chain.timer -= dt;
    return chain.timer <= 0;
  };
  Game.getHailCoverage = function (skill, point) {
    var score = 0;
    S.enemies.forEach(function (enemy) {
      var info = C.enemies[enemy.type], dx = enemy.x - point.x, dy = enemy.y - point.y, reach = skill.radius + info.radius;
      if (dx * dx + dy * dy > reach * reach) return;
      score += Game.isBossEnemy(enemy) ? 1.6 : info.codexCategory === "elite" ? 1.3 : 1;
    });
    return score;
  };
  Game.getHailTargetPoint = function (skill, taken) {
    var radius = skill.radius * (Game.hasProgressMilestone("hailGenerator", 7) ? 1.25 : 1) * (Game.hasProgressMilestone("hailGenerator", 26) ? 1.2 : 1);
    var rangeLine = Game.getSkillRangeLine("hailGenerator"), others = taken || [], margin = radius * .5;
    var best = null, bestScore = -1, bestWeighted = -1, bestGap = Infinity;
    S.enemies.forEach(function (enemy) {
      if (enemy.y < rangeLine) return;
      var point = { x: U.clamp(enemy.x, margin, C.width - margin), y: U.clamp(enemy.y, 60, C.height - 120) };
      var score = Game.getHailCoverage(skill, point), penalty = 1, nearest = Infinity;
      others.forEach(function (other) {
        var dx = point.x - other.x, dy = point.y - other.y, gap = Math.sqrt(dx * dx + dy * dy);
        nearest = Math.min(nearest, gap);
        if (gap < radius) penalty = Math.min(penalty, gap / radius);
      });
      var weighted = score * penalty;
      if (weighted > bestWeighted || (Math.abs(weighted - bestWeighted) < .000001 && score > bestScore)) {
        bestWeighted = weighted;
        bestScore = score;
        best = point;
        bestGap = nearest;
      }
    });
    if (best && bestGap < 1) {
      var push = radius * .55, direction = best.x + push <= C.width - margin ? 1 : -1;
      best = { x: U.clamp(best.x + direction * push, margin, C.width - margin), y: best.y };
    }
    return best;
  };
  Game.spawnHailStorm = function (skill, point) {
    var radius = skill.radius * (Game.hasProgressMilestone("hailGenerator", 7) ? 1.25 : 1) * (Game.hasProgressMilestone("hailGenerator", 26) ? 1.2 : 1);
    var duration = skill.duration + (Game.hasProgressMilestone("hailGenerator", 12) ? .75 : 0);
    var freezeDuration = skill.freezeDuration + (Game.hasProgressMilestone("hailGenerator", 2) ? .25 : 0) + (Game.hasProgressMilestone("hailGenerator", 26) ? .25 : 0);
    var frostbiteEnabled = !!skill.frostbiteEnabled || Game.hasProgressMilestone("hailGenerator", 18);
    var frostbiteMaxStacks = skill.frostbiteMaxStacks + (Game.hasProgressMilestone("hailGenerator", 22) ? 5 : 0);
    S.hailStorms.push({
      x: point.x, y: point.y, radius: radius, life: duration, duration: duration,
      damage: skill.damage, hitInterval: skill.hitInterval, tickTimer: 0, slowFactor: skill.slowFactor, slowDuration: skill.slowDuration, freezeDuration: freezeDuration, element: Game.getSkillElement("hailGenerator"), damageSource: "hailGenerator",
      frostbiteEnabled: frostbiteEnabled, frostbiteDps: skill.frostbiteDps, frostbiteDuration: skill.frostbiteDuration, frostbiteMaxStacks: frostbiteMaxStacks,
      explodeOnEnd: !!skill.explodeOnEnd, explosionRadius: skill.explosionRadius, explosionFreezeDuration: skill.explosionFreezeDuration
    });
  };
  Game.launchHailGenerator = function () {
    var skill = S.player.skills.hailGenerator, count = 1 + skill.extraHails, taken = [], launched = 0;
    if (!skill.unlocked || skill.active || skill.fireTimer > 0) return false;
    for (var i = 0; i < count; i++) {
      var point = Game.getHailTargetPoint(skill, taken);
      if (!point) break;
      taken.push(point);
      Game.spawnHailStorm(skill, point);
      launched++;
    }
    if (!launched) return false;
    skill.active = true;
    skill.activeElapsed = 0;
    skill.activeDuration = skill.duration + (Game.hasProgressMilestone("hailGenerator", 12) ? .75 : 0);
    skill.fireTimer = skill.fireInterval;
    return true;
  };
  Game.explodeHailStorm = function (storm) {
    S.explosions.push({ type: "hailFrost", x: storm.x, y: storm.y, radius: storm.explosionRadius, life: .5, duration: .5 });
    S.enemies.forEach(function (enemy) {
      var info = C.enemies[enemy.type], dx = enemy.x - storm.x, dy = enemy.y - storm.y, reach = storm.explosionRadius + info.radius;
      if (dx * dx + dy * dy > reach * reach) return;
      Game.applyFreeze(enemy, storm.explosionFreezeDuration);
    });
    Game.burst(storm.x, storm.y, 18, C.colors.ice);
  };
  Game.updateHailStorms = function (dt) {
    if (!S.hailStorms || !S.hailStorms.length) return;
    for (var i = S.hailStorms.length - 1; i >= 0; i--) {
      var storm = S.hailStorms[i];
      storm.life -= dt;
      if (storm.life <= 0) {
        if (storm.explodeOnEnd) Game.explodeHailStorm(storm);
        S.hailStorms.splice(i, 1);
        continue;
      }
      storm.tickTimer -= dt;
      if (storm.tickTimer > 0) continue;
      storm.tickTimer = storm.hitInterval;
      for (var j = S.enemies.length - 1; j >= 0; j--) {
        var enemy = S.enemies[j], info = C.enemies[enemy.type];
        var dx = enemy.x - storm.x, dy = enemy.y - storm.y, reach = storm.radius + info.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        Game.damageEnemy(enemy, storm.damage, { critical: false, noWeaponEffects: true, silentText: true, element: storm.element, damageSource: "hailGenerator", progressSkillId: "hailGenerator" });
        Game.applySlow(enemy, storm.slowDuration, storm.slowFactor);
        Game.applyFreeze(enemy, storm.freezeDuration);
        if (storm.frostbiteEnabled) Game.applyFrostbite(enemy, "hailGenerator", storm.frostbiteDps, storm.frostbiteDuration, storm.frostbiteMaxStacks);
        Game.burst(enemy.x, enemy.y, 1, C.colors.ice);
        if (enemy.hp <= 0) Game.killEnemy(j);
      }
    }
  };
  Game.getFuelBombCoverage = function (skill, point) {
    var score = 0;
    S.enemies.forEach(function (enemy) {
      if (Game.isFlyingEnemy(enemy)) return;
      var info = C.enemies[enemy.type], dx = enemy.x - point.x, dy = enemy.y - point.y, reach = skill.radius + info.radius;
      if (dx * dx + dy * dy > reach * reach) return;
      score += Game.isBossEnemy(enemy) ? 1.6 : info.codexCategory === "elite" ? 1.3 : 1;
    });
    return score;
  };
  Game.getFuelBombTarget = function (skill, taken, ignoreRange) {
    var radius = skill.radius * (Game.hasProgressMilestone("fuelBomb", 2) ? 1.2 : 1) * (Game.hasProgressMilestone("fuelBomb", 18) ? 1.1 : 1);
    var rangeLine = ignoreRange ? -Infinity : Game.getSkillRangeLine("fuelBomb"), others = taken || [], margin = radius * .5;
    var best = null, bestScore = -1, bestWeighted = -1, bestGap = Infinity;
    S.enemies.forEach(function (enemy) {
      if (enemy.y < rangeLine || Game.isFlyingEnemy(enemy)) return;
      var point = { x: U.clamp(enemy.x, margin, C.width - margin), y: U.clamp(enemy.y, 60, C.height - 120) };
      var score = Game.getFuelBombCoverage(skill, point), penalty = 1, nearest = Infinity;
      others.forEach(function (other) {
        var dx = point.x - other.x, dy = point.y - other.y, gap = Math.sqrt(dx * dx + dy * dy);
        nearest = Math.min(nearest, gap);
        if (gap < radius) penalty = Math.min(penalty, gap / radius);
      });
      var weighted = score * penalty;
      if (weighted > bestWeighted || (Math.abs(weighted - bestWeighted) < .000001 && score > bestScore)) {
        bestWeighted = weighted;
        bestScore = score;
        best = point;
        bestGap = nearest;
      }
    });
    if (best && bestGap < 1) {
      var push = radius * .55, direction = best.x + push <= C.width - margin ? 1 : -1;
      best = { x: U.clamp(best.x + direction * push, margin, C.width - margin), y: best.y };
    }
    return best;
  };
  Game.spawnFuelShell = function (skill, point, damageScale) {
    var scale = damageScale === undefined ? 1 : damageScale, origin = Game.getSkillMuzzle();
    var radius = skill.radius * (Game.hasProgressMilestone("fuelBomb", 2) ? 1.2 : 1) * (Game.hasProgressMilestone("fuelBomb", 18) ? 1.1 : 1);
    var duration = skill.duration + (Game.hasProgressMilestone("fuelBomb", 7) ? .5 : 0);
    var slowFactor = Game.hasProgressMilestone("fuelBomb", 12) ? Math.min(skill.slowFactor, .65) : skill.slowFactor;
    var slowDuration = Game.hasProgressMilestone("fuelBomb", 12) ? Math.max(skill.slowDuration, 1) : skill.slowDuration;
    var explosionDamage = Game.hasProgressMilestone("fuelBomb", 22) ? skill.damage * 1.8 * scale : skill.damage * (skill.explosionDamageScale || 0) * scale;
    S.fuelShells.push({
      originX: origin.x, originY: origin.y, x: origin.x, y: origin.y, targetX: point.x, targetY: point.y,
      elapsed: 0, flightTime: skill.flightTime, arcHeight: skill.arcHeight || 0, damageScale: scale,
      radius: radius, duration: duration, hitInterval: skill.hitInterval,
      damage: skill.damage * scale, burnDps: skill.burnDps * scale, burnDuration: skill.burnDuration,
      slowFactor: slowFactor, slowDuration: slowDuration, stunDuration: Game.hasProgressMilestone("fuelBomb", 26) ? 1 : 0, groundOnly: !!skill.groundOnly, element: Game.getSkillElement("fuelBomb"), damageSource: "fuelBomb", progressSkillId: "fuelBomb",
      explodeOnEnd: !!skill.explodeOnEnd,
      explosionRadius: radius * (skill.explosionRadiusScale || 1),
      explosionDamage: explosionDamage
    });
    return S.fuelShells[S.fuelShells.length - 1];
  };
  Game.spawnFuelPool = function (shell) {
    S.fuelPools.push({
      x: shell.targetX, y: shell.targetY, radius: shell.radius, life: shell.duration, duration: shell.duration,
      damage: shell.damage, hitInterval: shell.hitInterval, tickTimer: 0, burnDps: shell.burnDps, burnDuration: shell.burnDuration,
      slowFactor: shell.slowFactor, slowDuration: shell.slowDuration, stunDuration: shell.stunDuration || 0, groundOnly: shell.groundOnly, element: shell.element, damageSource: "fuelBomb",
      explodeOnEnd: shell.explodeOnEnd, explosionRadius: shell.explosionRadius, explosionDamage: shell.explosionDamage
    });
    Game.burst(shell.targetX, shell.targetY, 6, C.colors.fire);
    return S.fuelPools[S.fuelPools.length - 1];
  };
  Game.launchFuelBomb = function () {
    var skill = S.player.skills.fuelBomb, shellCount = 1 + skill.extraShells, taken = [], launched = 0;
    if (!skill.unlocked || skill.active || skill.fireTimer > 0) return false;
    var mainPoint = Game.getFuelBombTarget(skill, taken, false);
    if (!mainPoint) return false;
    taken.push(mainPoint);
    Game.spawnFuelShell(skill, mainPoint, 1);
    launched++;
    for (var i = 1; i < shellCount; i++) {
      var point = Game.getFuelBombTarget(skill, taken, true);
      if (!point) break;
      taken.push(point);
      Game.spawnFuelShell(skill, point, skill.extraDamageScale);
      launched++;
    }
    if (!launched) return false;
    skill.active = true;
    skill.activeElapsed = 0;
    skill.activeDuration = skill.flightTime + skill.duration + (Game.hasProgressMilestone("fuelBomb", 7) ? .5 : 0);
    skill.fireTimer = skill.fireInterval;
    return true;
  };
  Game.explodeFuelPool = function (pool) {
    S.explosions.push({ type: "fuelBlast", x: pool.x, y: pool.y, radius: pool.explosionRadius, life: .5, duration: .5 });
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var enemy = S.enemies[i], info = C.enemies[enemy.type], dx = enemy.x - pool.x, dy = enemy.y - pool.y, reach = pool.explosionRadius + info.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      if (!Game.canHitEnemy(pool, enemy)) continue;
      Game.damageEnemy(enemy, pool.explosionDamage, { critical: false, noWeaponEffects: true, silentText: true, element: pool.element, damageSource: "fuelBomb", progressSkillId: "fuelBomb" });
      Game.applyBurn(enemy, pool.burnDps, pool.burnDuration, "fuelBomb");
      if (enemy.hp <= 0) Game.killEnemy(i);
    }
    Game.burst(pool.x, pool.y, 18, C.colors.fire);
  };
  Game.updateFuelBombs = function (dt) {
    var i, shell, pool, progress;
    for (i = S.fuelShells.length - 1; i >= 0; i--) {
      shell = S.fuelShells[i];
      shell.elapsed += dt;
      progress = U.clamp(shell.elapsed / shell.flightTime, 0, 1);
      shell.x = shell.originX + (shell.targetX - shell.originX) * progress;
      shell.y = shell.originY + (shell.targetY - shell.originY) * progress;
      if (progress >= 1) { Game.spawnFuelPool(shell); S.fuelShells.splice(i, 1); }
    }
    for (i = S.fuelPools.length - 1; i >= 0; i--) {
      pool = S.fuelPools[i];
      pool.life -= dt;
      if (pool.life <= 0) {
        if (pool.explodeOnEnd) Game.explodeFuelPool(pool);
        S.fuelPools.splice(i, 1);
        continue;
      }
      pool.tickTimer -= dt;
      if (pool.tickTimer > 0) continue;
      pool.tickTimer = pool.hitInterval;
      for (var j = S.enemies.length - 1; j >= 0; j--) {
        var enemy = S.enemies[j], info = C.enemies[enemy.type];
        if (!Game.canHitEnemy(pool, enemy)) continue;
        var dx = enemy.x - pool.x, dy = enemy.y - pool.y, reach = pool.radius + info.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        Game.damageEnemy(enemy, pool.damage, { critical: false, noWeaponEffects: true, silentText: true, element: pool.element, damageSource: "fuelBomb", progressSkillId: "fuelBomb" });
        Game.applyBurn(enemy, pool.burnDps, pool.burnDuration, "fuelBomb");
        if (pool.slowFactor < 1) Game.applySlow(enemy, pool.slowDuration, pool.slowFactor);
        if (pool.stunDuration > 0) Game.applyStun(enemy, pool.stunDuration);
        Game.burst(enemy.x, enemy.y, 1, C.colors.fire);
        if (enemy.hp <= 0) Game.killEnemy(j);
      }
    }
  };
  Game.nextXpAfter = function (current) {
    return Math.floor(current * C.xpMultiplier + C.xpBonus);
  };
  Game.gainXp = function (amount) {
    var p = S.player;
    if (S.session && S.session.testArena) return;
    if (p.level >= C.maxLevel) return;
    p.xp += amount * (S.session.xpScale || 1);
    while (p.xp >= p.nextXp && p.level < C.maxLevel) {
      p.xp -= p.nextXp;
      p.level++;
      p.nextXp = Game.nextXpAfter(p.nextXp);
      if (p.level >= C.maxLevel) {
        p.xp = p.nextXp;
        S.session.message = "LV.MAX · 清空剩余尸潮";
        S.session.messageTimer = 2.6;
        break;
      }
      var cards = Game.rollTraits();
      if (!cards.length) continue;
      S.screen = "upgrade";
      S.upgradeCards = cards;
      break;
    }
  };
  Game.grantMaxLevel = function () {
    var p = S.player;
    while (p.level < C.maxLevel) {
      p.xp -= p.nextXp;
      p.level++;
      p.nextXp = Game.nextXpAfter(p.nextXp);
    }
    p.xp = p.nextXp;
  };
  Game.unlockSkill = function (id, force) {
    var skill = S.player.skills[id], order = S.player.skillOrder;
    if (!skill || skill.unlocked) return false;
    if (!order) order = S.player.skillOrder = [];
    if (!force && order.length >= C.maxSkillSlots) return false;
    skill.unlocked = true;
    skill.level = 1;
    skill.fireTimer = 0;
    if (order.indexOf(id) < 0) order.push(id);
    return true;
  };
  Game.getSkillSlotCount = function () { return (S.player.skillOrder || []).length; };
  Game.canUnlockSkill = function () { return Game.getSkillSlotCount() < C.maxSkillSlots; };
  Game.rollTraits = function () {
    var p = S.player, allTraits = C.traits.concat(C.skillTraits || []), slotsFull = !Game.canUnlockSkill();
    var pool = allTraits.filter(function (trait) {
      if ((p.traits[trait.id] || 0) >= trait.max) return false;
      if (trait.unlocksSkill) return !slotsFull && !p.skills[trait.skillId].unlocked;
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
      if (trait.unlocksSkill) Game.unlockSkill(trait.skillId);
      else p.skills[trait.skillId].level++;
    }
    trait.apply(p);
    Game.addText(p.x, p.y - 38, trait.name + (trait.skillId ? " Lv." + p.skills[trait.skillId].level : " Lv." + p.traits[trait.id]), C.colors.green);
    if (trait.unlocksSkill && !Game.canUnlockSkill()) {
      S.session.message = "技能槽已满 · " + C.maxSkillSlots + " / " + C.maxSkillSlots;
      S.session.messageTimer = 2.4;
    }
    S.screen = "playing";
  };
  Game.getCodexEnemyIds = function (category) {
    return Object.keys(C.enemies).filter(function (id) {
      var info = C.enemies[id];
      return !info.codexHidden && (info.codexCategory || "minion") === category;
    });
  };
  Game.getSkillGroups = function () {
    var groups = [{ id: "rifle", name: "步枪强化", icon: "✦", status: "已实装", element: "physical", elementNote: "冰子弹为冰属性 · 火子弹为火属性", detail: "主角步枪的基础强化词条，覆盖伤害、射速、齐射、连发、穿透、暴击与特殊弹种，是每局构筑的起点。", traits: C.traits }];
    (C.coreSkills || []).forEach(function (skill) {
      groups.push({ id: skill.id, name: skill.name, icon: skill.icon, status: skill.status, element: skill.element, detail: skill.detail, traits: (C.skillTraits || []).filter(function (trait) { return trait.skillId === skill.id; }) });
    });
    return groups;
  };
  Game.killEnemy = function (index) {
    var enemy = S.enemies[index], info = C.enemies[enemy.type];
    S.session.kills++;
    Game.gainXp(info.xp);
    Game.addText(enemy.x, enemy.y, "+" + info.xp + " XP", C.colors.yellow);
    Game.burst(enemy.x, enemy.y, Game.isBossEnemy(enemy) ? 24 : info.splitInto ? 14 : 8, info.splitInto ? C.colors.purple : info.accent);
    if (info.splitInto) Game.addText(enemy.x, enemy.y - 20, "分裂 ×" + info.splitCount, C.colors.purple);
    Game.queueSplitSpawns(enemy, info);
    S.enemies.splice(index, 1);
  };
  Game.getProgressSkill = function (skillId) {
    var snapshot = S.player && S.player.accountSkills;
    return snapshot && skillId ? snapshot[skillId] || null : null;
  };
  Game.getProgressSkillDamageScale = function (skillId) {
    var progress = Game.getProgressSkill(skillId);
    return progress && progress.damageScale ? progress.damageScale : 1;
  };
  Game.hasProgressMilestone = function (skillId, level) {
    var progress = Game.getProgressSkill(skillId);
    return !!(progress && progress.milestones && progress.milestones[level]);
  };
  Game.damageEnemy = function (enemy, amount, bullet) {
    if (Game.isRaging(enemy)) return false;
    if (Game.blockWithArmor(enemy)) { enemy.hitFlash = .08; Game.addText(enemy.x + U.rand(-5, 5), enemy.y - C.enemies[enemy.type].radius, "格挡", C.colors.cyan); return; }
    var element = Game.getDamageElement(bullet);
    enemy.lastHitElement = element;
    var p = S.player || {}, attack = p.attackMultiplier === undefined ? 1 : p.attackMultiplier;
    var elementAttack = p.elementMultipliers && p.elementMultipliers[element] !== undefined ? p.elementMultipliers[element] : 1;
    var progressSkillId = bullet && (bullet.progressSkillId || bullet.damageSource), progressScale = Game.getProgressSkillDamageScale(progressSkillId);
    var actualDamage = amount * attack * elementAttack * progressScale * Game.getElementDamageScale(enemy, element) * Game.getDamageSourceScale(enemy, bullet) * (enemy.damageTakenTimer > 0 ? enemy.damageTakenMultiplier || 1 : 1); enemy.hp -= actualDamage; enemy.hitFlash = .08; Game.tryStartRage(enemy); if (!bullet.noWeaponEffects && S.player.burn) Game.applyBurn(enemy, 10 + S.player.burn * 3, 1.5 + S.player.burn * .4); if (!bullet.noWeaponEffects && S.player.freeze && element === "ice") { Game.applySlow(enemy, 1.2 + S.player.freeze * .25, .58); Game.applyFreeze(enemy, C.rifleFreezeDuration); } if (!bullet.silentText) Game.addText(enemy.x + U.rand(-5, 5), enemy.y - C.enemies[enemy.type].radius, bullet.critical ? Math.ceil(actualDamage) + " 暴击" : String(Math.ceil(actualDamage)), bullet.critical ? C.colors.yellow : C.colors.text);
    return true;
  };
  Game.throwEnemyShot = function (enemy) {
    var info = C.enemies[enemy.type], ranged = info.ranged;
    if (!ranged) return false;
    S.enemyShots.push({ type: ranged.shot || "basketball", accent: info.accent, x: enemy.x, y: enemy.y + info.radius * .3, targetY: S.wall.y - S.wall.height / 2, startY: enemy.y + info.radius * .3, damage: ranged.damage, speed: ranged.projectileSpeed, radius: ranged.projectileRadius, spin: 0, travel: 0 });
    return true;
  };
  Game.updateEnemyShots = function (dt) {
    for (var i = S.enemyShots.length - 1; i >= 0; i--) {
      var shot = S.enemyShots[i];
      shot.y += shot.speed * dt;
      shot.spin += dt * 7;
      shot.travel += shot.speed * dt;
      if (shot.y < shot.targetY) continue;
      shot.y = shot.targetY;
      S.wall.hp -= shot.damage;
      Game.burst(shot.x, shot.targetY, 5, shot.accent || C.enemies.basketball.accent);
      Game.addText(shot.x, shot.targetY - 19, "-" + shot.damage, C.colors.red);
      S.enemyShots.splice(i, 1);
      if (S.wall.hp <= 0) {
        S.wall.hp = 0;
        if (S.session) S.session.messageTimer = 3;
        Game.loseLevel("城墙失守");
        return;
      }
    }
  };
})(window.Game = window.Game || {});
