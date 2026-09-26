/* 视图层：使用逻辑坐标绘制，并根据设备像素比提升 Canvas 清晰度。 */
(function (Game) {
  "use strict";
  var C = Game.config, S = Game.state, U = Game.utils;
  var canvas = document.getElementById("game"), ctx = canvas.getContext("2d"), pixelRatio = 1;
  Game.view = { canvas: canvas, ctx: ctx };

  function resizeCanvas() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(C.width * pixelRatio);
    canvas.height = Math.round(C.height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function panel(x, y, w, h, fill, stroke, radius) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, .24)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    U.roundedRect(ctx, x, y, w, h, radius || 12, fill, stroke);
    ctx.restore();
  }

  function text(value, x, y, font, color, align) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || "left";
    ctx.fillText(value, x, y);
  }

  function badge(label, x, y, w, color) {
    U.roundedRect(ctx, x, y, w, 20, 10, "rgba(5, 16, 23, .72)", "rgba(255,255,255,.12)");
    text(label, x + w / 2, y + 14, "bold 10px Segoe UI, Microsoft YaHei", color, "center");
  }

  function drawSkillSlot(x, skill, icon, color) {
    U.roundedRect(ctx, x, 62, 42, 24, 6, skill.unlocked ? "rgba(18, 39, 49, .96)" : "rgba(5, 16, 23, .58)", skill.unlocked ? color : "rgba(153,205,218,.2)");
    if (skill.unlocked) {
      text(icon, x + 10, 78, "bold 13px Segoe UI, Microsoft YaHei", color, "center");
      text("Lv." + skill.level, x + 38, 78, "bold 8px Segoe UI, Microsoft YaHei", C.colors.text, "right");
    } else text("—", x + 21, 78, "10px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  Game.draw = function () {
    Game.drawBackground();
    Game.drawEnemies();
    Game.drawWall();
    Game.drawSkillRing();
    Game.drawBullets();
    Game.drawPlayer();
    Game.drawEffects();
    Game.drawHud();
    if (S.screen === "menu") Game.drawMenu();
    if (S.screen === "levelSelect") Game.drawLevelSelect();
    if (S.screen === "zombieCodex") Game.drawZombieCodex();
    if (S.screen === "skillCodex") Game.drawSkillCodex();
    if (S.screen === "upgrade") Game.drawUpgrade();
    if (S.screen === "paused") Game.drawPause();
    if (S.screen === "victory" || S.screen === "defeat") Game.drawResult();
  };

  Game.drawBackground = function () {
    var gradient = ctx.createLinearGradient(0, 0, 0, C.height);
    gradient.addColorStop(0, "#102f42");
    gradient.addColorStop(.55, "#0a1f2c");
    gradient.addColorStop(1, "#050d14");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, C.width, C.height);

    var glow = ctx.createRadialGradient(C.width / 2, 116, 8, C.width / 2, 116, 260);
    glow.addColorStop(0, "rgba(58, 168, 192, .16)");
    glow.addColorStop(1, "rgba(58, 168, 192, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, C.width, C.height);

    ctx.strokeStyle = "rgba(153, 205, 218, .055)";
    ctx.lineWidth = 1;
    for (var x = 15; x < C.width; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.height); ctx.stroke(); }
    for (var y = 86; y < C.height; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.width, y); ctx.stroke(); }

    // 远处的城市剪影，增加纵深但不干扰战斗对象。
    ctx.fillStyle = "rgba(3, 12, 18, .42)";
    for (var building = 0; building < 8; building++) {
      var buildingX = building * 52 - 8, buildingH = 38 + (building * 29) % 80;
      ctx.fillRect(buildingX, 310 - buildingH, 42, buildingH);
      ctx.fillStyle = "rgba(104, 216, 255, .06)";
      for (var windowY = 324 - buildingH; windowY < 306; windowY += 16) ctx.fillRect(buildingX + 9, windowY, 5, 5);
      ctx.fillStyle = "rgba(3, 12, 18, .42)";
    }

    ctx.fillStyle = "rgba(255, 255, 255, .025)";
    for (var i = 0; i < 7; i++) ctx.fillRect((i * 67 + 18) % C.width, 125 + (i * 83) % C.height, 26, 10);
    var lineY = S.player ? S.player.y + 24 : C.height - 52;
    ctx.strokeStyle = "rgba(255, 107, 107, .28)";
    ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(C.width, lineY); ctx.stroke();
    ctx.setLineDash([]);
  };

  Game.drawPlayer = function () {
    var p = S.player;
    if (!p) return;
    var body = Game.sprites.images.playerBody, rifle = Game.sprites.images.playerRifle;
    var bodySpec = C.sprites.playerBody, rifleSpec = C.sprites.playerRifle;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "rgba(0, 0, 0, .45)";
    ctx.beginPath(); ctx.ellipse(2, bodySpec.height - bodySpec.anchorY - 3, bodySpec.width * .36, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (rifle && rifleSpec) {
      ctx.save();
      ctx.translate(rifleSpec.mountX, rifleSpec.mountY);
      ctx.rotate(p.aimAngle + Math.PI / 2);
      ctx.drawImage(rifle, -rifleSpec.anchorX, -rifleSpec.anchorY, rifleSpec.width, rifleSpec.height);
      ctx.restore();
    }
    if (body) ctx.drawImage(body, -bodySpec.anchorX, -bodySpec.anchorY, bodySpec.width, bodySpec.height);
    if (rifleSpec) {
      ctx.save();
      ctx.translate(rifleSpec.mountX, rifleSpec.mountY);
      ctx.rotate(p.aimAngle + Math.PI / 2);
      ctx.fillStyle = "#ffd166"; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, -C.muzzleDistance, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

  Game.drawBullets = function () {
    S.bullets.forEach(function (bullet) {
      var length = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) || 1;
      var angle = Math.atan2(bullet.vy, bullet.vx), trail = 8, bulletColor = bullet.color || "#ffffff";
      ctx.save();
      ctx.strokeStyle = bulletColor;
      ctx.globalAlpha = .42;
      ctx.lineWidth = bullet.radius * .75;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(bullet.x, bullet.y); ctx.lineTo(bullet.x - bullet.vx / length * trail, bullet.y - bullet.vy / length * trail); ctx.stroke();
      ctx.globalAlpha = 1;
      // 普通子弹始终保持白色细长椭圆；后续特殊弹种可通过 bullet.color 扩展外观。
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(angle);
      ctx.fillStyle = bulletColor;
      ctx.shadowColor = bulletColor; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.ellipse(0, 0, bullet.radius * 1.9, bullet.radius * .62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    (S.skillProjectiles || []).forEach(function (projectile) {
      var angle = Math.atan2(projectile.vy, projectile.vx), r = projectile.radius;
      ctx.save();
      ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
      if (projectile.type === "thermobaric") {
        ctx.shadowColor = "#ff4c35"; ctx.shadowBlur = 14;
        ctx.fillStyle = "#c92b28"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = "#ffbd65"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r * .58, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#ffe0a0"; ctx.beginPath(); ctx.arc(r * .15, -r * .18, Math.max(1.5, r * .2), 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.shadowColor = "#65dfff"; ctx.shadowBlur = 12;
        ctx.fillStyle = projectile.type === "iceShard" ? "#b8f5ff" : "#55bdf5";
        ctx.beginPath(); ctx.moveTo(r * 2.2, 0); ctx.lineTo(-r * .9, -r * .9); ctx.lineTo(-r * .35, 0); ctx.lineTo(-r * .9, r * .9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(239, 255, 255, .85)"; ctx.beginPath(); ctx.moveTo(r * 1.3, 0); ctx.lineTo(-r * .45, -r * .32); ctx.lineTo(-r * .1, 0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
  };

  Game.drawEnemies = function (singleEnemy) {
    (singleEnemy ? [singleEnemy] : S.enemies).forEach(function (enemy) {
      var info = C.enemies[enemy.type], r = info.radius, pulse = 1 + Math.sin(S.session.elapsed * 4) * .03;
      var isRunner = enemy.type === "runner" || enemy.type === "runnerElite", isElite = info.codexCategory === "elite";
      var shirtColor = isElite ? (isRunner ? "#98633b" : "#617745") : isRunner ? "#705345" : enemy.type === "boss" ? "#4d2d3b" : "#3f6655";
      var shirtShadow = isElite ? "#3b3026" : isRunner ? "#382b2d" : enemy.type === "boss" ? "#281c2a" : "#243c39";
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.scale(pulse, pulse);
      if (isElite) {
        ctx.shadowColor = "rgba(255, 209, 102, .72)"; ctx.shadowBlur = 13;
        ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1.5, r * .09);
        ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      var skinGradient = ctx.createLinearGradient(-r, -r, r, r);
      skinGradient.addColorStop(0, "#e1ad86"); skinGradient.addColorStop(.55, "#a8665e"); skinGradient.addColorStop(1, "#5a3842");
      if (enemy.type === "boss") { ctx.shadowColor = "rgba(255, 107, 107, .65)"; ctx.shadowBlur = 18; }
      if (enemy.hitFlash > 0) ctx.globalAlpha = .45;

      // 僵尸投影、双腿和歪斜的手臂。
      ctx.fillStyle = "rgba(0, 0, 0, .34)";
      ctx.beginPath(); ctx.ellipse(0, r * 1.05, r * 1.05, r * .34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = shirtShadow; ctx.lineWidth = Math.max(2, r * .24); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-r * .25, r * .45); ctx.lineTo(-r * .4, r * .98); ctx.moveTo(r * .24, r * .45); ctx.lineTo(r * .4, r * .98); ctx.stroke();
      ctx.strokeStyle = "#202b2d"; ctx.lineWidth = Math.max(2, r * .15);
      ctx.beginPath(); ctx.moveTo(-r * .48, r * .98); ctx.lineTo(-r * .16, r * .98); ctx.moveTo(r * .16, r * .98); ctx.lineTo(r * .5, r * .98); ctx.stroke();
      ctx.strokeStyle = shirtShadow; ctx.lineWidth = Math.max(2, r * .22);
      ctx.beginPath(); ctx.moveTo(-r * .55, -r * .02); ctx.lineTo(-r * 1.02, r * .48); ctx.moveTo(r * .55, -r * .02); ctx.lineTo(r * 1.02, r * .36); ctx.stroke();

      // 破损上衣和向前凸出的腹部。
      U.roundedRect(ctx, -r * .65, -r * .12, r * 1.3, r * 1.1, r * .2, shirtColor, shirtShadow);
      ctx.fillStyle = "rgba(221, 239, 202, .22)";
      ctx.beginPath(); ctx.moveTo(-r * .5, r * .2); ctx.lineTo(-r * .1, r * .08); ctx.lineTo(r * .45, r * .33); ctx.lineTo(r * .34, r * .78); ctx.lineTo(-r * .45, r * .68); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(18, 26, 29, .55)";
      ctx.beginPath(); ctx.moveTo(-r * .65, r * .58); ctx.lineTo(-r * .2, r * .76); ctx.lineTo(-r * .33, r * 1.02); ctx.lineTo(-r * .64, r * .86); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * .15, r * .66); ctx.lineTo(r * .62, r * .52); ctx.lineTo(r * .65, r * .9); ctx.lineTo(r * .34, r * 1.02); ctx.closePath(); ctx.fill();

      // 腐烂的头部、头发、发光眼睛和张开的嘴。
      ctx.fillStyle = skinGradient;
      ctx.beginPath(); ctx.arc(0, -r * .72, r * .58, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(93, 46, 50, .55)";
      ctx.beginPath(); ctx.arc(r * .25, -r * .7, r * .4, -.8, 1.25); ctx.fill();
      ctx.fillStyle = "#273336";
      ctx.beginPath(); ctx.arc(-r * .22, -r * 1.13, r * .3, Math.PI * 1.05, Math.PI * 1.9); ctx.arc(r * .26, -r * 1.1, r * .3, Math.PI * 1.1, Math.PI * 1.95); ctx.fill();
      ctx.fillStyle = info.accent;
      ctx.beginPath(); ctx.arc(-r * .22, -r * .78, Math.max(1, r * .13), 0, Math.PI * 2); ctx.arc(r * .22, -r * .78, Math.max(1, r * .13), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#211b24";
      ctx.beginPath(); ctx.arc(-r * .22, -r * .78, Math.max(.5, r * .06), 0, Math.PI * 2); ctx.arc(r * .22, -r * .78, Math.max(.5, r * .06), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#3b2029"; ctx.lineWidth = Math.max(1, r * .08); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-r * .23, -r * .51); ctx.quadraticCurveTo(0, -r * .4, r * .25, -r * .53); ctx.stroke();

      // 特殊僵尸的识别部件。
       if (isRunner) { ctx.strokeStyle = isElite ? "#fff0a5" : "#ffe0a7"; ctx.lineWidth = Math.max(1, r * .12); ctx.beginPath(); ctx.moveTo(-r * .7, r * .55); ctx.lineTo(-r * 1.18, r * .9); ctx.moveTo(r * .7, r * .48); ctx.lineTo(r * 1.16, r * .72); ctx.stroke(); }
      if (enemy.type === "boss") { ctx.fillStyle = "#6d3949"; ctx.beginPath(); ctx.moveTo(-r * .65, -r * 1.18); ctx.lineTo(-r * .82, -r * 1.7); ctx.lineTo(-r * .35, -r * 1.35); ctx.lineTo(0, -r * 1.78); ctx.lineTo(r * .3, -r * 1.3); ctx.lineTo(r * .82, -r * 1.7); ctx.lineTo(r * .65, -r * 1.1); ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.colors.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      if (enemy.type !== "boss" && !enemy.hideHealthBar) { ctx.fillStyle = "rgba(0, 0, 0, .5)"; ctx.fillRect(enemy.x - r, enemy.y - r - 13, r * 2, 3); ctx.fillStyle = C.colors.green; ctx.fillRect(enemy.x - r, enemy.y - r - 13, r * 2 * U.clamp(enemy.hp / enemy.maxHp, 0, 1), 3); }
    });
  };

  function drawCodexEnemyModel(id, enemy, x, y, width, height, detail) {
    var isBoss = id === "boss", topExtent = isBoss ? 1.78 : 1.43, bottomExtent = 1.05;
    var totalExtent = topExtent + bottomExtent, scale = Math.min(detail ? 3.2 : 2.7, (height - 8) / (enemy.radius * totalExtent));
    var centerX = x + width / 2, centerY = y + height / 2;
    var modelY = centerY + (topExtent - bottomExtent) * enemy.radius * scale / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
    ctx.translate(centerX, modelY); ctx.scale(scale, scale); ctx.translate(-centerX, -modelY);
    Game.drawEnemies({ type: id, x: centerX, y: modelY, hp: enemy.hp, maxHp: enemy.hp, hitFlash: 0, slow: 0, hideHealthBar: true });
    ctx.restore();
  }

  Game.drawWall = function () {
    var wall = S.wall;
    if (!wall) return;
    var left = wall.x - wall.width / 2, top = wall.y - wall.height / 2;
    ctx.save();
    var healthy = wall.hp > wall.maxHp * .35;
    var frontHeight = 56;
    var wallGradient = ctx.createLinearGradient(0, top, 0, top + frontHeight);
    wallGradient.addColorStop(0, healthy ? "#607a7d" : "#875861");
    wallGradient.addColorStop(.22, healthy ? "#3e5960" : "#68474f");
    wallGradient.addColorStop(1, healthy ? "#1d313b" : "#3b2933");
    var metalGradient = ctx.createLinearGradient(0, top - 8, 0, top + 9);
    metalGradient.addColorStop(0, "#b9d1c8"); metalGradient.addColorStop(.45, "#6d898b"); metalGradient.addColorStop(1, "#2a424a");

    // 地面投影和墙体底部厚度。
    ctx.shadowColor = "rgba(0, 0, 0, .62)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
    ctx.fillStyle = "rgba(0, 0, 0, .58)"; ctx.fillRect(left + 5, top + 11, wall.width, frontHeight + 8);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#14262f"; ctx.fillRect(left + 3, top + frontHeight, wall.width - 1, 10);

    // 前面板、上斜面和左右侧面共同组成城墙的立体轮廓。
    ctx.fillStyle = wallGradient; ctx.fillRect(left, top + 5, wall.width, frontHeight);
    ctx.fillStyle = healthy ? "#6b8586" : "#80535b";
    ctx.beginPath(); ctx.moveTo(left, top + 5); ctx.lineTo(left + wall.width, top + 5); ctx.lineTo(left + wall.width - 10, top - 7); ctx.lineTo(left + 10, top - 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(235, 255, 243, .28)";
    ctx.beginPath(); ctx.moveTo(left + 10, top - 7); ctx.lineTo(left + wall.width - 10, top - 7); ctx.lineTo(left + wall.width - 10, top - 3); ctx.lineTo(left + 14, top - 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = healthy ? "#213c46" : "#4b3038";
    ctx.beginPath(); ctx.moveTo(left, top + 5); ctx.lineTo(left + 10, top - 7); ctx.lineTo(left + 10, top + 1); ctx.lineTo(left + 5, top + 9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(left + wall.width, top + 5); ctx.lineTo(left + wall.width - 10, top - 7); ctx.lineTo(left + wall.width - 10, top + 1); ctx.lineTo(left + wall.width - 5, top + 9); ctx.closePath(); ctx.fill();

    // 内嵌装甲板和斜向高光。
    for (var panelX = left + 7; panelX < left + wall.width - 7; panelX += 47) {
      ctx.fillStyle = "rgba(5, 16, 23, .46)"; ctx.fillRect(panelX, top + 17, 39, 31);
      ctx.strokeStyle = "rgba(170, 211, 207, .25)"; ctx.lineWidth = 1; ctx.strokeRect(panelX, top + 17, 39, 31);
      ctx.fillStyle = "rgba(104, 216, 255, .09)"; ctx.fillRect(panelX + 6, top + 23, 27, 2);
      ctx.fillStyle = "rgba(231, 255, 244, .13)";
      ctx.beginPath(); ctx.moveTo(panelX + 5, top + 45); ctx.lineTo(panelX + 24, top + 18); ctx.lineTo(panelX + 30, top + 18); ctx.lineTo(panelX + 11, top + 45); ctx.closePath(); ctx.fill();
    }

    // 顶部模块、立柱和铆钉，强调金属城墙的厚度。
    for (var capX = left + 9; capX < left + wall.width - 14; capX += 70) {
      U.roundedRect(ctx, capX, top - 11, 29, 15, 4, metalGradient, "#d3e4d8");
      U.roundedRect(ctx, capX + 5, top - 6, 19, 6, 2, "#26383f", "rgba(220, 255, 235, .35)");
    }
    for (var pillarX = left + 1; pillarX < left + wall.width; pillarX += 94) {
      var pillarGradient = ctx.createLinearGradient(pillarX, 0, pillarX + 12, 0);
      pillarGradient.addColorStop(0, "#172a33"); pillarGradient.addColorStop(.5, "#839b99"); pillarGradient.addColorStop(1, "#293f47");
      ctx.fillStyle = pillarGradient; ctx.fillRect(pillarX, top + 7, 12, frontHeight + 2);
      ctx.strokeStyle = "rgba(211, 235, 222, .38)"; ctx.strokeRect(pillarX, top + 7, 12, frontHeight + 2);
    }
    ctx.fillStyle = "#d0e0d6";
    for (var boltX = left + 12; boltX < left + wall.width; boltX += 47) {
      ctx.beginPath(); ctx.arc(boltX, top + 22, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(boltX, top + 48, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = healthy ? "rgba(210, 245, 229, .72)" : "rgba(255, 167, 167, .72)";
    ctx.lineWidth = 2; ctx.strokeRect(left, top + 5, wall.width, frontHeight);

    // 城墙耐久条位于城墙上沿，避免和顶部 HUD 争夺空间。
    U.roundedRect(ctx, left + 34, top - 25, wall.width - 68, 8, 4, "rgba(0, 0, 0, .72)");
    U.roundedRect(ctx, left + 34, top - 25, (wall.width - 68) * U.clamp(wall.hp / wall.maxHp, 0, 1), 8, 4, healthy ? C.colors.green : C.colors.red);
    text("城墙 " + Math.ceil(wall.hp) + " / " + wall.maxHp, wall.x, top - 30, "bold 10px Segoe UI, Microsoft YaHei", C.colors.text, "center");
    ctx.restore();
  };

  Game.drawSkillRing = function () {
    if (!S.player) return;
    var time = S.session ? S.session.elapsed : 0, ring = C.skillRing || {}, x = C.width / 2 + (ring.offsetX || 86), y = C.height + (ring.offsetY || -102) + Math.sin(time * 2.4) * 2, orbit = time * .8;
    ctx.save();

    // 小型幻形悬浮在人物右侧，阴影与主体分离，避免再像一块巨大的平面圆盘。
    ctx.fillStyle = "rgba(0, 0, 0, .42)";
    ctx.beginPath(); ctx.ellipse(x, y + 18, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(104, 216, 255, .34)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x, y + 16); ctx.stroke();

    // 蓝灰色机体和上下错层的腹部。
    var droneGradient = ctx.createLinearGradient(x - 18, y - 13, x + 16, y + 15);
    droneGradient.addColorStop(0, "#e1f1e5"); droneGradient.addColorStop(.28, "#91b7b8"); droneGradient.addColorStop(.62, "#527783"); droneGradient.addColorStop(1, "#1d3b49");
    ctx.shadowColor = "rgba(104, 216, 255, .42)"; ctx.shadowBlur = 9;
    ctx.fillStyle = "#183641";
    ctx.beginPath(); ctx.ellipse(x, y + 4, 18, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = droneGradient;
    ctx.beginPath(); ctx.moveTo(x - 17, y - 3); ctx.quadraticCurveTo(x - 12, y - 16, x, y - 14); ctx.quadraticCurveTo(x + 12, y - 16, x + 17, y - 3); ctx.lineTo(x + 12, y + 11); ctx.quadraticCurveTo(x, y + 19, x - 12, y + 11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(221, 255, 241, .68)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "rgba(234, 255, 239, .36)";
    ctx.beginPath(); ctx.moveTo(x - 11, y - 7); ctx.quadraticCurveTo(x - 3, y - 13, x + 6, y - 9); ctx.lineTo(x + 3, y - 5); ctx.lineTo(x - 9, y - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#244956";
    ctx.beginPath(); ctx.ellipse(x, y + 10, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#213a45"; ctx.fillRect(x - 11, y + 1, 22, 5);

    // 两侧机械臂、关节和悬浮翼，形成参考图中的小型伙伴轮廓。
    ctx.strokeStyle = "#294f5c"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - 13, y - 5); ctx.lineTo(x - 20, y - 12); ctx.lineTo(x - 22, y - 20); ctx.moveTo(x + 13, y - 5); ctx.lineTo(x + 20, y - 12); ctx.lineTo(x + 22, y - 20); ctx.stroke();
    ctx.fillStyle = "#b2ccca"; ctx.strokeStyle = "#274c58"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x - 22, y - 21, 4, 0, Math.PI * 2); ctx.arc(x + 22, y - 21, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#6b9698";
    ctx.beginPath(); ctx.arc(x - 20, y - 12, 3, 0, Math.PI * 2); ctx.arc(x + 20, y - 12, 3, 0, Math.PI * 2); ctx.fill();

    // 中央能量眼和微型旋转幻形。
    ctx.shadowColor = "rgba(104, 216, 255, .95)"; ctx.shadowBlur = 10;
    ctx.fillStyle = "#15323e";
    ctx.beginPath(); ctx.arc(x, y + 5, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#9ffff1";
    ctx.beginPath(); ctx.arc(x, y + 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.colors.cyan;
    ctx.beginPath(); ctx.arc(x, y + 5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(orbit);
    ctx.globalAlpha = .72; ctx.strokeStyle = "#b7fff1"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(4, -11); ctx.lineTo(0, -8); ctx.lineTo(-4, -11); ctx.closePath(); ctx.stroke();
    ctx.globalAlpha = .34; ctx.fillStyle = "#8fe8df"; ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  Game.drawEffects = function () {
    (S.explosions || []).forEach(function (explosion) {
      var progress = 1 - U.clamp(explosion.life / explosion.duration, 0, 1), radius = explosion.radius * (.45 + progress * .55);
      ctx.save(); ctx.globalAlpha = (1 - progress) * .62;
      ctx.fillStyle = "rgba(255, 75, 42, .42)"; ctx.beginPath(); ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1 - progress; ctx.strokeStyle = "#ffbf6b"; ctx.lineWidth = Math.max(2, 8 * (1 - progress));
      ctx.beginPath(); ctx.arc(explosion.x, explosion.y, radius * .84, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
    S.particles.forEach(function (particle) { ctx.globalAlpha = U.clamp(particle.life / particle.maxLife, 0, 1); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    S.texts.forEach(function (item) { ctx.globalAlpha = U.clamp(item.life, 0, 1); text(item.text, item.x, item.y, "bold 11px Segoe UI, Microsoft YaHei", item.color, "center"); });
    ctx.globalAlpha = 1;
  };

  Game.drawHud = function () {
    var p = S.player, session = S.session;
    if (!p || S.screen === "menu" || S.screen === "zombieCodex" || S.screen === "skillCodex") return;
    var level = C.levels.find(function (item) { return item.id === session.level; });
    panel(10, 10, C.width - 20, 86, "rgba(7, 21, 30, .82)", "rgba(153, 205, 218, .18)", 15);
    Game.drawPauseButton(17, 20, 32, 32);
    text(level ? level.name : "未知区域", C.width / 2, 31, "bold 17px Segoe UI, Microsoft YaHei", C.colors.text, "center");
    text("第 " + session.wave + " / " + C.waves.length + " 波", C.width - 18, 29, "bold 10px Segoe UI, Microsoft YaHei", C.colors.muted, "right");
    U.roundedRect(ctx, 67, 46, 166, 9, 4, "rgba(255,255,255,.12)");
    U.roundedRect(ctx, 67, 46, 166 * U.clamp(p.xp / p.nextXp, 0, 1), 9, 4, C.colors.cyan);
    text(p.level >= C.maxLevel ? "LV.MAX · 经验已满" : "LV." + p.level + "  " + Math.floor(p.xp) + " / " + p.nextXp + " XP", 150, 70, "10px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
    var rifleIcon = Game.sprites.images.playerRifle, ammoColor = p.reloadTimer > 0 ? C.colors.yellow : p.ammo <= 5 ? C.colors.red : C.colors.cyan;
    if (rifleIcon) {
      ctx.save(); ctx.translate(271, 48); ctx.rotate(Math.PI / 2); ctx.drawImage(rifleIcon, -5, -19, 10, 38); ctx.restore();
    } else {
      ctx.save(); ctx.strokeStyle = ammoColor; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(253, 47); ctx.lineTo(288, 47); ctx.stroke(); ctx.fillStyle = ammoColor; ctx.fillRect(259, 44, 15, 6); ctx.fillRect(267, 49, 4, 6); ctx.restore();
    }
    text(p.ammo + "\\" + p.magazineSize, C.width - 19, 49, "bold 12px Segoe UI, Microsoft YaHei", ammoColor, "right");
    if (p.reloadTimer > 0) {
      U.roundedRect(ctx, 302, 54, 36, 3, 2, "rgba(255,255,255,.14)");
      U.roundedRect(ctx, 302, 54, 36 * (1 - p.reloadTimer / p.reloadDuration), 3, 2, C.colors.yellow);
    }
    drawSkillSlot(248, p.skills.thermobaric, "♨", C.colors.fire);
    drawSkillSlot(293, p.skills.dryIce, "❄", C.colors.ice);
    if (session.messageTimer > 0) text(session.message, C.width / 2, 111, "bold 17px Segoe UI, Microsoft YaHei", C.colors.yellow, "center");
    var boss = S.enemies.find(function (enemy) { return enemy.type === "boss"; });
    if (boss) { badge("BOSS  ·  尸潮领主", 104, 101, 152, C.colors.red); U.roundedRect(ctx, 44, 127, C.width - 88, 8, 4, "rgba(0,0,0,.5)"); U.roundedRect(ctx, 44, 127, (C.width - 88) * U.clamp(boss.hp / boss.maxHp, 0, 1), 8, 4, C.colors.red); }
  };

  Game.drawPauseButton = function (x, y, w, h) {
    ctx.save();
    U.roundedRect(ctx, x, y, w, h, 10, "rgba(28, 65, 76, .92)", "rgba(153, 205, 218, .55)");
    ctx.fillStyle = C.colors.text;
    ctx.fillRect(x + 11, y + 8, 4, h - 16); ctx.fillRect(x + 18, y + 8, 4, h - 16);
    ctx.restore();
  };

  Game.drawPause = function () {
    Game.overlay();
    panel(28, 190, C.width - 56, 248, "rgba(10, 35, 49, .96)", "rgba(153, 205, 218, .2)", 20);
    badge("BATTLE PAUSED", 105, 216, 150, C.colors.cyan);
    text("战斗暂停", C.width / 2, 273, "bold 29px Segoe UI, Microsoft YaHei", C.colors.text, "center");
    text("尸潮和子弹都已停止", C.width / 2, 299, "13px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
    Game.button(C.width / 2 - 82, 326, 164, 44, "继续战斗", C.colors.green);
    Game.button(C.width / 2 - 82, 382, 164, 40, "退出关卡", C.colors.red);
  };

  Game.overlay = function () { ctx.fillStyle = "rgba(3, 9, 13, .84)"; ctx.fillRect(0, 0, C.width, C.height); };
  Game.button = function (x, y, w, h, label, color) { var gradient = ctx.createLinearGradient(x, y, x, y + h); gradient.addColorStop(0, color); gradient.addColorStop(1, "#2c9d91"); ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 16; U.roundedRect(ctx, x, y, w, h, 13, gradient); ctx.restore(); text(label, x + w / 2, y + h / 2 + 5, "bold 15px Segoe UI, Microsoft YaHei", "#071217", "center"); };
  Game.drawMenu = function () {
    Game.overlay();
    panel(28, 80, C.width - 56, 474, "rgba(10, 35, 49, .78)", "rgba(153, 205, 218, .18)", 20);
    badge("SURVIVAL  PROTOCOL", 102, 104, 156, C.colors.cyan);
    text("街区警戒线", C.width / 2, 164, "bold 31px Segoe UI, Microsoft YaHei", C.colors.yellow, "center");
    text("竖屏僵尸生存射击", C.width / 2, 194, "15px Segoe UI, Microsoft YaHei", C.colors.text, "center");
    text("步枪自动锁定目标 · 点击画面调整方向", C.width / 2, 229, "12px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
    Game.button(C.width / 2 - 82, 249, 164, 46, "开始战斗", C.colors.green);
    Game.button(C.width / 2 - 82, 309, 164, 42, "选择关卡", C.colors.cyan);
    Game.button(22, 365, 150, 44, "僵尸图鉴", "#58aaff");
    Game.button(188, 365, 150, 44, "技能图鉴", C.colors.purple);
    text("当前开放：第 1 关", C.width / 2, 462, "11px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
  };
  Game.drawLevelSelect = function () { Game.overlay(); panel(16, 60, C.width - 32, 530, "rgba(10, 35, 49, .94)", "rgba(153, 205, 218, .18)", 20); badge("MISSION SELECT", 105, 84, 150, C.colors.cyan); text("选择关卡", C.width / 2, 130, "bold 25px Segoe UI, Microsoft YaHei", C.colors.yellow, "center"); text("完成前一关后解锁后续区域", C.width / 2, 153, "12px Segoe UI, Microsoft YaHei", C.colors.muted, "center"); C.levels.forEach(function (level, index) { var x = 30, y = 180 + index * 100, unlocked = level.unlocked; panel(x, y, 300, 82, unlocked ? "#163b4d" : "rgba(24, 35, 46, .9)", unlocked ? "rgba(104,216,255,.38)" : "rgba(153,205,218,.12)", 14); text("0" + level.id, x + 24, y + 34, "bold 20px Segoe UI, Microsoft YaHei", unlocked ? C.colors.cyan : "#667985", "center"); text(level.name, x + 52, y + 29, "bold 15px Segoe UI, Microsoft YaHei", unlocked ? C.colors.text : "#71828b"); text(level.subtitle, x + 52, y + 52, "11px Segoe UI, Microsoft YaHei", unlocked ? C.colors.muted : "#56666e"); if (unlocked) { U.roundedRect(ctx, x + 226, y + 25, 60, 30, 10, "#245f73"); text("进入", x + 256, y + 44, "bold 11px Segoe UI, Microsoft YaHei", C.colors.text, "center"); } else { text("🔒 锁定", x + 256, y + 44, "bold 11px Segoe UI, Microsoft YaHei", "#7e8d94", "center"); } }); Game.button(C.width / 2 - 72, 518, 144, 40, "返回首页", "#4b7180"); };
  function drawCodexTab(x, y, w, label, active, color) {
    U.roundedRect(ctx, x, y, w, 31, 10, active ? "rgba(49, 105, 125, .95)" : "rgba(13, 29, 39, .9)", active ? color : "rgba(153,205,218,.18)");
    text(label, x + w / 2, y + 20, "bold 11px Segoe UI, Microsoft YaHei", active ? C.colors.text : C.colors.muted, "center");
  }
  function drawCodexPager(page, totalPages) {
    if (totalPages > 1) {
      Game.button(94, 521, 54, 31, "‹", C.colors.cyan);
      text((page + 1) + " / " + totalPages, C.width / 2, 542, "bold 11px Segoe UI, Microsoft YaHei", C.colors.text, "center");
      Game.button(212, 521, 54, 31, "›", C.colors.cyan);
    }
    Game.button(C.width / 2 - 72, 561, 144, 36, "返回首页", "#4b7180");
  }
  Game.drawZombieCodex = function () {
    Game.overlay();
    panel(14, 36, C.width - 28, 568, "rgba(10, 35, 49, .97)", "rgba(153, 205, 218, .22)", 20);
    badge("FIELD GUIDE  ·  ENEMIES", 91, 50, 178, C.colors.cyan);
    text("僵尸图鉴", C.width / 2, 95, "bold 23px Segoe UI, Microsoft YaHei", C.colors.yellow, "center");
    var categories = [{ id: "minion", label: "小怪", color: C.colors.green }, { id: "elite", label: "精英", color: C.colors.yellow }, { id: "boss", label: "首领", color: C.colors.red }];
    categories.forEach(function (category, index) { drawCodexTab(22 + index * 106, 107, 102, category.label, S.zombieCodexCategory === category.id, category.color); });
    var selected = categories.find(function (category) { return category.id === S.zombieCodexCategory; }) || categories[0];
    var entryIds = Object.keys(C.enemies).filter(function (id) { return (C.enemies[id].codexCategory || "minion") === selected.id; });
    var pages = Math.max(1, Math.ceil(entryIds.length / 4)), page = U.clamp(S.codexPage || 0, 0, pages - 1);
    S.codexPage = page;
    var selectedEnemy = S.selectedZombieCodexId ? C.enemies[S.selectedZombieCodexId] : null;
    if (selectedEnemy && (selectedEnemy.codexCategory || "minion") === selected.id) {
      panel(26, 148, 308, 385, "rgba(17, 47, 62, .94)", "rgba(104,216,255,.22)", 16);
      drawCodexEnemyModel(S.selectedZombieCodexId, selectedEnemy, 40, 153, 280, 152, true);
      text(selectedEnemy.name, C.width / 2, 330, "bold 20px Segoe UI, Microsoft YaHei", C.colors.text, "center");
      text("生命 " + selectedEnemy.hp + "   ·   移速 " + selectedEnemy.speed + " / 秒", 44, 353, "bold 11px Segoe UI, Microsoft YaHei", C.colors.cyan);
      text("城墙伤害 " + selectedEnemy.damage + "   ·   击杀经验 " + selectedEnemy.xp + "   ·   半径 " + selectedEnemy.radius, 44, 374, "bold 10px Segoe UI, Microsoft YaHei", C.colors.cyan);
      text("单位特征", 44, 404, "bold 11px Segoe UI, Microsoft YaHei", C.colors.yellow);
      ctx.font = "11px Segoe UI, Microsoft YaHei"; ctx.fillStyle = C.colors.text; ctx.textAlign = "left";
      U.wrapText(ctx, selectedEnemy.description || "详细资料待补充。", 44, 422, 272, 13);
      text("应对建议", 44, 465, "bold 11px Segoe UI, Microsoft YaHei", C.colors.yellow);
      ctx.font = "10px Segoe UI, Microsoft YaHei"; ctx.fillStyle = C.colors.muted; ctx.textAlign = "left";
      U.wrapText(ctx, selectedEnemy.tactics || "暂无应对建议。", 44, 482, 272, 12);
      Game.button(C.width / 2 - 82, 553, 164, 40, "返回图鉴列表", C.colors.cyan);
      return;
    }
    entryIds.slice(page * 4, page * 4 + 4).forEach(function (id, index) {
      var x = 26 + (index % 2) * 160, y = 155 + Math.floor(index / 2) * 160;
      panel(x, y, 148, 148, "rgba(17, 47, 62, .94)", "rgba(104,216,255,.3)", 16);
      drawCodexEnemyModel(id, C.enemies[id], x + 5, y + 5, 138, 112, false);
      text(C.enemies[id].name, x + 74, y + 136, "bold 13px Segoe UI, Microsoft YaHei", C.colors.text, "center");
    });
    if (!entryIds.length) text("该类别暂无收录单位。", C.width / 2, 300, "13px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
    drawCodexPager(page, pages);
  };
  function skillGroupColor(group) { return group.id === "rifle" ? C.colors.cyan : C.colors.purple; }
  Game.drawSkillCodex = function () {
    Game.overlay();
    panel(14, 36, C.width - 28, 568, "rgba(10, 35, 49, .97)", "rgba(153, 205, 218, .22)", 20);
    badge("FIELD GUIDE  ·  SKILLS", 91, 50, 178, C.colors.purple);
    text("技能图鉴", C.width / 2, 95, "bold 23px Segoe UI, Microsoft YaHei", C.colors.yellow, "center");
    var groups = Game.getSkillGroups();
    var selected = S.selectedSkillCodexId ? groups.find(function (group) { return group.id === S.selectedSkillCodexId; }) : null;
    if (selected) { drawSkillGroupDetail(selected); return; }
    text("选择技能查看介绍与专属词条", C.width / 2, 126, "11px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
    var perPage = 5, pages = Math.max(1, Math.ceil(groups.length / perPage)), page = U.clamp(S.codexPage || 0, 0, pages - 1);
    S.codexPage = page;
    groups.slice(page * perPage, page * perPage + perPage).forEach(function (group, index) {
      var x = 26, y = 146 + index * 70, color = skillGroupColor(group), implemented = !group.status || group.status === "已实装";
      panel(x, y, 308, 62, "rgba(17, 47, 62, .94)", "rgba(153,205,218,.24)", 14);
      text(group.icon, x + 28, y + 39, "bold 20px Segoe UI, Microsoft YaHei", color, "center");
      text(group.name, x + 54, y + 27, "bold 14px Segoe UI, Microsoft YaHei", C.colors.text);
      text(group.traits.length + " 个词条", x + 54, y + 47, "10px Segoe UI, Microsoft YaHei", C.colors.muted);
      text(group.status || "", x + 322, y + 27, "bold 10px Segoe UI, Microsoft YaHei", implemented ? C.colors.green : C.colors.yellow, "right");
      text("查看详情 ›", x + 322, y + 47, "10px Segoe UI, Microsoft YaHei", color, "right");
    });
    if (!groups.length) text("暂无技能收录。", C.width / 2, 300, "13px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
    drawCodexPager(page, pages);
  };
  function drawSkillGroupDetail(group) {
    var color = skillGroupColor(group), implemented = !group.status || group.status === "已实装";
    panel(24, 130, 312, 112, "rgba(17, 47, 62, .94)", "rgba(153,205,218,.28)", 16);
    text(group.icon, 52, 182, "bold 27px Segoe UI, Microsoft YaHei", color, "center");
    text(group.name, 82, 160, "bold 17px Segoe UI, Microsoft YaHei", C.colors.text);
    text(group.status || "", 320, 160, "bold 10px Segoe UI, Microsoft YaHei", implemented ? C.colors.green : C.colors.yellow, "right");
    ctx.font = "10px Segoe UI, Microsoft YaHei"; ctx.fillStyle = C.colors.muted; ctx.textAlign = "left";
    U.wrapText(ctx, group.detail || "技能说明待补充。", 82, 182, 238, 13);
    text("专属词条", 40, 268, "bold 13px Segoe UI, Microsoft YaHei", C.colors.yellow);
    var traits = group.traits || [], perPage = 3, pages = Math.max(1, Math.ceil(traits.length / perPage)), page = U.clamp(S.codexPage || 0, 0, pages - 1);
    S.codexPage = page;
    traits.slice(page * perPage, page * perPage + perPage).forEach(function (trait, index) {
      var x = 26, y = 282 + index * 76, rare = trait.rarity === "稀有" || trait.rarity === "史诗";
      panel(x, y, 308, 68, rare ? "#263352" : "#163b4d", rare ? "rgba(201,161,255,.34)" : "rgba(104,216,255,.24)", 12);
      text(trait.icon, x + 24, y + 32, "bold 18px Segoe UI, Microsoft YaHei", rare ? C.colors.purple : C.colors.cyan, "center");
      text(trait.name, x + 46, y + 24, "bold 13px Segoe UI, Microsoft YaHei", C.colors.text);
      text(trait.rarity + " · 最高 Lv." + trait.max, x + 294, y + 22, "bold 9px Segoe UI, Microsoft YaHei", rare ? C.colors.purple : C.colors.green, "right");
      ctx.font = "10px Segoe UI, Microsoft YaHei"; ctx.fillStyle = C.colors.muted; ctx.textAlign = "left";
      U.wrapText(ctx, trait.desc || trait.detail || "", x + 46, y + 44, 244, 12);
    });
    if (!traits.length) text("该技能暂无专属词条。", C.width / 2, 336, "12px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
    if (pages > 1) { Game.button(94, 521, 54, 31, "‹", color); text((page + 1) + " / " + pages, C.width / 2, 542, "bold 11px Segoe UI, Microsoft YaHei", C.colors.text, "center"); Game.button(212, 521, 54, 31, "›", color); }
    Game.button(C.width / 2 - 82, 561, 164, 36, "返回技能列表", color);
  }
  Game.drawUpgrade = function () { Game.overlay(); panel(16, 76, C.width - 32, 414, "rgba(10, 35, 49, .94)", "rgba(153, 205, 218, .18)", 20); text("等级提升！", C.width / 2, 119, "bold 25px Segoe UI, Microsoft YaHei", C.colors.yellow, "center"); text("选择一项强化，战斗将继续", C.width / 2, 143, "12px Segoe UI, Microsoft YaHei", C.colors.text, "center"); var cardW = 98, gap = 8, start = (C.width - cardW * 3 - gap * 2) / 2; S.upgradeCards.forEach(function (trait, i) { var x = start + i * (cardW + gap), y = 190, level = S.player.traits[trait.id] || 0, rare = trait.rarity === "稀有"; panel(x, y, cardW, 218, rare ? "#263352" : "#163b4d", rare ? "rgba(201,161,255,.45)" : "rgba(104,216,255,.28)", 14); text(trait.icon, x + cardW / 2, y + 50, "bold 31px Segoe UI, Microsoft YaHei", rare ? C.colors.purple : C.colors.cyan, "center"); text(trait.name, x + cardW / 2, y + 82, "bold 14px Segoe UI, Microsoft YaHei", C.colors.text, "center"); text(trait.rarity + " · Lv." + (level + 1) + "/" + trait.max, x + cardW / 2, y + 104, "bold 11px Segoe UI, Microsoft YaHei", rare ? C.colors.purple : C.colors.green, "center"); ctx.fillStyle = C.colors.muted; ctx.font = "11px Segoe UI, Microsoft YaHei"; ctx.textAlign = "center"; U.wrapText(ctx, trait.desc, x + cardW / 2, y + 135, 78, 16); U.roundedRect(ctx, x + 17, y + 181, 64, 27, 8, "#245f73"); text("选择", x + cardW / 2, y + 199, "bold 11px Segoe UI, Microsoft YaHei", C.colors.text, "center"); }); };
  Game.drawResult = function () { Game.overlay(); panel(30, 120, C.width - 60, 250, "rgba(10, 35, 49, .9)", "rgba(153, 205, 218, .18)", 20); var win = S.screen === "victory", session = S.session; text(win ? "关卡胜利" : "战斗失败", C.width / 2, 185, "bold 31px Segoe UI, Microsoft YaHei", win ? C.colors.green : C.colors.red, "center"); text(win ? "你守住了街区警戒线" : "尸潮突破了防线", C.width / 2, 217, "15px Segoe UI, Microsoft YaHei", C.colors.text, "center"); text("用时 " + U.formatTime(session.elapsed) + "  ·  击杀 " + session.kills + "  ·  等级 " + S.player.level, C.width / 2, 263, "13px Segoe UI, Microsoft YaHei", C.colors.muted, "center"); Game.button(C.width / 2 - 82, 307, 164, 48, "重新开始", win ? C.colors.green : C.colors.yellow); };
})(window.Game = window.Game || {});
