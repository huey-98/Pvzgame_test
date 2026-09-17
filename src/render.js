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

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  Game.draw = function () {
    Game.drawBackground();
    Game.drawEnemies();
    Game.drawWall();
    Game.drawBullets();
    Game.drawPlayer();
    Game.drawEffects();
    Game.drawHud();
    if (S.screen === "menu") Game.drawMenu();
    if (S.screen === "upgrade") Game.drawUpgrade();
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
    var x = p.x, y = p.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0, 0, 0, .35)";
    ctx.beginPath(); ctx.ellipse(0, 18, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(104, 216, 255, .18)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 2, 25, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#347695";
    ctx.beginPath(); ctx.arc(0, 4, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b8e4f0";
    ctx.beginPath(); ctx.arc(0, -8, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#203340"; ctx.fillRect(-10, -15, 20, 6);
    ctx.fillStyle = "#0b202c"; ctx.fillRect(-7, -13, 14, 2);
    ctx.save();
    ctx.rotate(p.aimAngle + Math.PI / 2);
    ctx.fillStyle = "#f7cc78"; ctx.fillRect(-2.5, -38, 5, 25);
    ctx.fillStyle = "#ffd166"; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, -40, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  Game.drawBullets = function () {
    S.bullets.forEach(function (bullet) {
      var length = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) || 1;
      var trail = bullet.critical ? 12 : 8;
      ctx.save();
      ctx.strokeStyle = bullet.critical ? "rgba(255, 209, 102, .5)" : "rgba(104, 216, 255, .42)";
      ctx.lineWidth = bullet.radius * 1.2;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(bullet.x, bullet.y); ctx.lineTo(bullet.x - bullet.vx / length * trail, bullet.y - bullet.vy / length * trail); ctx.stroke();
      ctx.fillStyle = bullet.critical ? C.colors.yellow : C.colors.cyan;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  };

  Game.drawEnemies = function () {
    S.enemies.forEach(function (enemy) {
      var info = C.enemies[enemy.type], pulse = 1 + Math.sin(S.session.elapsed * 4) * .03;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.scale(pulse, pulse);
      if (enemy.type === "boss") { ctx.shadowColor = "rgba(255, 107, 107, .65)"; ctx.shadowBlur = 18; }
      if (enemy.hitFlash > 0) ctx.globalAlpha = .45;
      ctx.fillStyle = "rgba(0, 0, 0, .28)";
      ctx.beginPath(); ctx.ellipse(0, info.radius * .82, info.radius * 1.1, info.radius * .38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = info.color;
      ctx.beginPath(); ctx.arc(0, 0, info.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = info.accent; ctx.lineWidth = enemy.type === "boss" ? 3 : 1.5;
      ctx.beginPath(); ctx.arc(0, 0, info.radius - 1, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = info.accent;
      ctx.beginPath(); ctx.arc(-info.radius * .3, -info.radius * .22, info.radius * .18, 0, Math.PI * 2); ctx.arc(info.radius * .3, -info.radius * .22, info.radius * .18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#17252b";
      ctx.beginPath(); ctx.arc(-info.radius * .3, -info.radius * .22, info.radius * .08, 0, Math.PI * 2); ctx.arc(info.radius * .3, -info.radius * .22, info.radius * .08, 0, Math.PI * 2); ctx.fill();
      if (enemy.type === "runner") { ctx.strokeStyle = "#ffe0a7"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-info.radius * .7, info.radius * .5); ctx.lineTo(-info.radius * 1.1, info.radius * .9); ctx.moveTo(info.radius * .7, info.radius * .5); ctx.lineTo(info.radius * 1.1, info.radius * .9); ctx.stroke(); }
      if (enemy.type === "bucket") { ctx.fillStyle = "#4f6272"; ctx.fillRect(-info.radius * .7, -info.radius * 1.1, info.radius * 1.4, info.radius * .42); ctx.strokeStyle = "#d6e0ea"; ctx.strokeRect(-info.radius * .7, -info.radius * 1.1, info.radius * 1.4, info.radius * .42); }
      if (enemy.type === "boss") { ctx.strokeStyle = C.colors.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, info.radius + 5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      if (enemy.type !== "boss") { ctx.fillStyle = "rgba(0, 0, 0, .5)"; ctx.fillRect(enemy.x - info.radius, enemy.y - info.radius - 8, info.radius * 2, 3); ctx.fillStyle = C.colors.green; ctx.fillRect(enemy.x - info.radius, enemy.y - info.radius - 8, info.radius * 2 * U.clamp(enemy.hp / enemy.maxHp, 0, 1), 3); }
    });
  };

  Game.drawWall = function () {
    var wall = S.wall;
    if (!wall) return;
    var left = wall.x - wall.width / 2, top = wall.y - wall.height / 2;
    ctx.save();
    ctx.shadowColor = "rgba(255, 180, 120, .18)"; ctx.shadowBlur = 16;
    ctx.fillStyle = "rgba(0, 0, 0, .35)"; ctx.fillRect(left + 4, top + 6, wall.width, wall.height);
    ctx.fillStyle = wall.hp > wall.maxHp * .35 ? "#755b4d" : "#9b4d4d"; ctx.fillRect(left, top, wall.width, wall.height);
    ctx.shadowBlur = 0; ctx.fillStyle = "#a77d62";
    for (var x = left + 8; x < left + wall.width - 8; x += 28) { ctx.fillRect(x, top + 4, 18, 4); ctx.fillRect(x + 9, top + 13, 18, 4); }
    ctx.strokeStyle = "#d0a17d"; ctx.lineWidth = 2; ctx.strokeRect(left, top, wall.width, wall.height);
    U.roundedRect(ctx, left, top - 13, wall.width, 7, 4, "rgba(0, 0, 0, .5)");
    U.roundedRect(ctx, left, top - 13, wall.width * U.clamp(wall.hp / wall.maxHp, 0, 1), 7, 4, wall.hp > wall.maxHp * .35 ? C.colors.green : C.colors.red);
    text("城墙 " + Math.ceil(wall.hp) + " / " + wall.maxHp, wall.x, top - 19, "bold 11px Segoe UI, Microsoft YaHei", C.colors.text, "center");
    ctx.restore();
  };

  Game.drawEffects = function () {
    S.particles.forEach(function (particle) { ctx.globalAlpha = U.clamp(particle.life / particle.maxLife, 0, 1); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    S.texts.forEach(function (item) { ctx.globalAlpha = U.clamp(item.life, 0, 1); text(item.text, item.x, item.y, "bold 11px Segoe UI, Microsoft YaHei", item.color, "center"); });
    ctx.globalAlpha = 1;
  };

  Game.drawHud = function () {
    var p = S.player, wall = S.wall, session = S.session;
    if (!p || S.screen === "menu") return;
    panel(10, 10, C.width - 20, 78, "rgba(7, 21, 30, .78)", "rgba(153, 205, 218, .16)", 14);
    text("防线", 20, 27, "bold 10px Segoe UI, Microsoft YaHei", C.colors.muted);
    text(Math.ceil(wall.hp) + " / " + wall.maxHp, 20, 43, "bold 13px Segoe UI, Microsoft YaHei", C.colors.text);
    U.roundedRect(ctx, 20, 51, 94, 6, 3, "rgba(255,255,255,.12)"); U.roundedRect(ctx, 20, 51, 94 * U.clamp(wall.hp / wall.maxHp, 0, 1), 6, 3, wall.hp > wall.maxHp * .35 ? C.colors.green : C.colors.red);
    text("等级 " + p.level + (p.level >= C.maxLevel ? " · MAX" : ""), C.width / 2, 32, "bold 13px Segoe UI, Microsoft YaHei", C.colors.text, "center");
    U.roundedRect(ctx, 132, 43, 96, 7, 4, "rgba(255,255,255,.12)"); U.roundedRect(ctx, 132, 43, 96 * U.clamp(p.xp / p.nextXp, 0, 1), 7, 4, C.colors.cyan);
    text(p.level >= C.maxLevel ? "经验已满" : Math.floor(p.xp) + " / " + p.nextXp + " XP", C.width / 2, 64, "10px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
    text("第 " + session.wave + " / " + C.waves.length + " 波", C.width - 20, 27, "bold 10px Segoe UI, Microsoft YaHei", C.colors.muted, "right");
    text("击杀 " + session.kills + "  ·  场上 " + S.enemies.length, C.width - 20, 64, "10px Segoe UI, Microsoft YaHei", C.colors.muted, "right");
    if (session.messageTimer > 0) { text(session.message, C.width / 2, 122, "bold 18px Segoe UI, Microsoft YaHei", C.colors.yellow, "center"); }
    var boss = S.enemies.find(function (enemy) { return enemy.type === "boss"; });
    if (boss) { badge("BOSS  ·  尸潮领主", 104, 101, 152, C.colors.red); U.roundedRect(ctx, 44, 127, C.width - 88, 8, 4, "rgba(0,0,0,.5)"); U.roundedRect(ctx, 44, 127, (C.width - 88) * U.clamp(boss.hp / boss.maxHp, 0, 1), 8, 4, C.colors.red); }
  };

  Game.overlay = function () { ctx.fillStyle = "rgba(3, 9, 13, .84)"; ctx.fillRect(0, 0, C.width, C.height); };
  Game.button = function (x, y, w, h, label, color) { var gradient = ctx.createLinearGradient(x, y, x, y + h); gradient.addColorStop(0, color); gradient.addColorStop(1, "#2c9d91"); ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 16; U.roundedRect(ctx, x, y, w, h, 13, gradient); ctx.restore(); text(label, x + w / 2, y + h / 2 + 5, "bold 15px Segoe UI, Microsoft YaHei", "#071217", "center"); };
  Game.drawMenu = function () { Game.overlay(); panel(28, 104, C.width - 56, 350, "rgba(10, 35, 49, .78)", "rgba(153, 205, 218, .18)", 20); badge("SURVIVAL  PROTOCOL", 102, 130, 156, C.colors.cyan); text("街区警戒线", C.width / 2, 190, "bold 31px Segoe UI, Microsoft YaHei", C.colors.yellow, "center"); text("竖屏僵尸生存射击", C.width / 2, 219, "15px Segoe UI, Microsoft YaHei", C.colors.text, "center"); text("步枪自动锁定目标 · 点击画面调整方向", C.width / 2, 261, "12px Segoe UI, Microsoft YaHei", C.colors.muted, "center"); Game.button(C.width / 2 - 82, 316, 164, 48, "开始战斗", C.colors.green); text("5 波尸潮  /  守住防线  /  击败 Boss", C.width / 2, 405, "11px Segoe UI, Microsoft YaHei", C.colors.muted, "center"); };
  Game.drawUpgrade = function () { Game.overlay(); panel(16, 76, C.width - 32, 414, "rgba(10, 35, 49, .94)", "rgba(153, 205, 218, .18)", 20); text("等级提升！", C.width / 2, 119, "bold 25px Segoe UI, Microsoft YaHei", C.colors.yellow, "center"); text("选择一项强化，战斗将继续", C.width / 2, 143, "12px Segoe UI, Microsoft YaHei", C.colors.text, "center"); var cardW = 98, gap = 8, start = (C.width - cardW * 3 - gap * 2) / 2; S.upgradeCards.forEach(function (trait, i) { var x = start + i * (cardW + gap), y = 190, level = S.player.traits[trait.id] || 0, rare = trait.rarity === "稀有"; panel(x, y, cardW, 218, rare ? "#263352" : "#163b4d", rare ? "rgba(201,161,255,.45)" : "rgba(104,216,255,.28)", 14); text(trait.icon, x + cardW / 2, y + 50, "bold 31px Segoe UI, Microsoft YaHei", rare ? C.colors.purple : C.colors.cyan, "center"); text(trait.name, x + cardW / 2, y + 82, "bold 14px Segoe UI, Microsoft YaHei", C.colors.text, "center"); text(trait.rarity + " · Lv." + (level + 1) + "/" + trait.max, x + cardW / 2, y + 104, "bold 11px Segoe UI, Microsoft YaHei", rare ? C.colors.purple : C.colors.green, "center"); ctx.fillStyle = C.colors.muted; ctx.font = "11px Segoe UI, Microsoft YaHei"; ctx.textAlign = "center"; U.wrapText(ctx, trait.desc, x + cardW / 2, y + 135, 78, 16); U.roundedRect(ctx, x + 17, y + 181, 64, 27, 8, "#245f73"); text("选择", x + cardW / 2, y + 199, "bold 11px Segoe UI, Microsoft YaHei", C.colors.text, "center"); }); };
  Game.drawResult = function () { Game.overlay(); panel(30, 120, C.width - 60, 250, "rgba(10, 35, 49, .9)", "rgba(153, 205, 218, .18)", 20); var win = S.screen === "victory", session = S.session; text(win ? "关卡胜利" : "战斗失败", C.width / 2, 185, "bold 31px Segoe UI, Microsoft YaHei", win ? C.colors.green : C.colors.red, "center"); text(win ? "你守住了街区警戒线" : "尸潮突破了防线", C.width / 2, 217, "15px Segoe UI, Microsoft YaHei", C.colors.text, "center"); text("用时 " + U.formatTime(session.elapsed) + "  ·  击杀 " + session.kills + "  ·  等级 " + S.player.level, C.width / 2, 263, "13px Segoe UI, Microsoft YaHei", C.colors.muted, "center"); Game.button(C.width / 2 - 82, 307, 164, 48, "重新开始", win ? C.colors.green : C.colors.yellow); };
})(window.Game = window.Game || {});
