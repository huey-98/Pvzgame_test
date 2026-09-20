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
    Game.drawSkillRing();
    Game.drawBullets();
    Game.drawPlayer();
    Game.drawEffects();
    Game.drawHud();
    if (S.screen === "menu") Game.drawMenu();
    if (S.screen === "levelSelect") Game.drawLevelSelect();
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
    var x = p.x, y = p.y;
    ctx.save();
    ctx.translate(x, y);
    var bodyGradient = ctx.createLinearGradient(-17, -6, 17, 10);
    bodyGradient.addColorStop(0, "#17161b"); bodyGradient.addColorStop(.3, "#5c3b32"); bodyGradient.addColorStop(.58, "#9a6242"); bodyGradient.addColorStop(1, "#251e24");
    var legGradient = ctx.createLinearGradient(-13, 0, 13, 0);
    legGradient.addColorStop(0, "#20242a"); legGradient.addColorStop(.45, "#6c5d55"); legGradient.addColorStop(.7, "#827165"); legGradient.addColorStop(1, "#252128");
    var skinGradient = ctx.createLinearGradient(-10, -44, 10, -21);
    skinGradient.addColorStop(0, "#ffe2b7"); skinGradient.addColorStop(.58, "#d4956e"); skinGradient.addColorStop(1, "#9b5b4b");
    var hairGradient = ctx.createLinearGradient(-14, -50, 12, -28);
    hairGradient.addColorStop(0, "#fff3af"); hairGradient.addColorStop(.42, "#e3b35e"); hairGradient.addColorStop(1, "#81502f");
    var aimX = Math.cos(p.aimAngle), aimY = Math.sin(p.aimAngle), sideX = -aimY, sideY = aimX;
    var frontHandX = Math.max(-28, Math.min(28, aimX * 37 + sideX * 6));
    var frontHandY = Math.max(-42, Math.min(16, aimY * 37 + sideY * 6));
    var rearHandX = Math.max(-22, Math.min(24, aimX * 17 + sideX * 6));
    var rearHandY = Math.max(-24, Math.min(16, aimY * 17 + sideY * 6));
    var drawHead = function () {
      // 参考图采用侧身背影：脸部只露出一小块，金色头发成为人物主轮廓。
      ctx.save();
      ctx.translate(-3, 0);
      ctx.fillStyle = skinGradient;
      ctx.beginPath(); ctx.ellipse(-3, -35, 10.5, 11.5, -.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(126, 69, 57, .45)";
      ctx.beginPath(); ctx.ellipse(2, -34, 6.8, 9, -.2, -.9, 1.35); ctx.fill();
      ctx.fillStyle = "#f2c28c";
      ctx.beginPath(); ctx.arc(-11, -34, 2.1, -.8, 1.1); ctx.fill();
      ctx.fillStyle = "#513332";
      ctx.beginPath(); ctx.arc(-8, -36, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hairGradient;
      ctx.beginPath(); ctx.moveTo(-14, -34); ctx.quadraticCurveTo(-15, -45, -7, -49); ctx.quadraticCurveTo(2, -53, 10, -45); ctx.quadraticCurveTo(14, -40, 9, -33); ctx.lineTo(5, -36); ctx.lineTo(2, -40); ctx.lineTo(-2, -35); ctx.lineTo(-6, -40); ctx.lineTo(-10, -35); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff4bd";
      ctx.beginPath(); ctx.moveTo(-10, -44); ctx.quadraticCurveTo(-2, -49, 6, -46); ctx.lineTo(3, -43); ctx.lineTo(-7, -42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#b8783b";
      ctx.beginPath(); ctx.moveTo(-12, -35); ctx.lineTo(-10, -26); ctx.lineTo(-7, -34); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255, 227, 181, .72)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(-3, -35, 10.5, 11.5, -.08, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    // 地面投影和分开的战斗站姿：一条腿支撑，一条腿向后屈曲。
    ctx.fillStyle = "rgba(0, 0, 0, .5)";
    ctx.beginPath(); ctx.ellipse(1, 29, 29, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#1a1b20"; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(-6, 9); ctx.lineTo(-14, 20); ctx.lineTo(-9, 29); ctx.moveTo(6, 9); ctx.lineTo(13, 19); ctx.lineTo(8, 29); ctx.stroke();
    ctx.strokeStyle = legGradient; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-6, 9); ctx.lineTo(-14, 20); ctx.lineTo(-9, 29); ctx.moveTo(6, 9); ctx.lineTo(13, 19); ctx.lineTo(8, 29); ctx.stroke();
    ctx.strokeStyle = "rgba(211, 180, 151, .72)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-13, 20); ctx.lineTo(-8, 22); ctx.moveTo(8, 19); ctx.lineTo(13, 20); ctx.stroke();
    U.roundedRect(ctx, -16, 27, 11, 5, 2, "#1b1a20", "#8a766b");
    U.roundedRect(ctx, 4, 27, 12, 5, 2, "#1b1a20", "#8a766b");

    // 背包位于身体后侧。
    U.roundedRect(ctx, 8, -4, 10, 23, 4, "#211c20", "#845441");
    U.roundedRect(ctx, 11, 0, 5, 12, 2, "#634032");
    U.roundedRect(ctx, 11, 14, 5, 4, 2, "#d29650");

    // 身体位于头部下方，使用背壳、胸甲和腹部高光表现立体感。
    U.roundedRect(ctx, -11, -16, 29, 33, 8, "#171419", "rgba(7, 9, 13, .8)");
    U.roundedRect(ctx, -15, -19, 29, 33, 8, bodyGradient, "#a87352");
    ctx.fillStyle = "rgba(245, 187, 118, .25)";
    ctx.beginPath(); ctx.moveTo(-14, -11); ctx.lineTo(-8, -18); ctx.lineTo(10, -18); ctx.lineTo(14, -11); ctx.lineTo(14, 6); ctx.lineTo(9, 12); ctx.lineTo(-11, 12); ctx.lineTo(-15, 6); ctx.closePath(); ctx.fill();
    U.roundedRect(ctx, -9, -14, 18, 22, 5, "rgba(58, 45, 43, .94)", "rgba(218, 159, 103, .35)");
    ctx.fillStyle = "rgba(255, 209, 133, .48)"; ctx.fillRect(-6, -11, 12, 2);
    ctx.fillStyle = "rgba(25, 17, 21, .55)"; ctx.fillRect(-9, 4, 18, 4);
    ctx.fillStyle = "#e4a24e"; ctx.fillRect(-4, -4, 8, 6);
    ctx.strokeStyle = "rgba(225, 183, 128, .5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-11, -12); ctx.lineTo(-7, 8); ctx.moveTo(10, -11); ctx.lineTo(7, 8); ctx.stroke();
    ctx.fillStyle = "#261d22"; ctx.fillRect(-14, 9, 28, 5);
    ctx.fillStyle = "#cda37b"; ctx.fillRect(-9, 10, 4, 2); ctx.fillRect(5, 10, 4, 2);

    // 短颈隐藏在衣领后，让头部与身体紧密结合。
    U.roundedRect(ctx, -5, -23, 8, 5, 3, "#a96754", "#6e4038");

    // 肩甲位于手臂后侧。
    ctx.fillStyle = "#714a38"; ctx.strokeStyle = "#bd875e"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(-14, -13, 5, 7, -.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(14, -13, 5, 7, .25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 枪械放在人物右侧，先绘制让双臂压在枪械上方。
    ctx.save();
    ctx.translate(sideX * 6, sideY * 6);
    ctx.rotate(p.aimAngle + Math.PI / 2);
    var rifleGradient = ctx.createLinearGradient(-6, 0, 6, 0);
    rifleGradient.addColorStop(0, "#11181b"); rifleGradient.addColorStop(.45, "#596865"); rifleGradient.addColorStop(1, "#1c2829");
    ctx.shadowColor = "rgba(0, 0, 0, .62)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;

    // M4 枪托：短枪托、缓冲管和后部肩托。
    ctx.fillStyle = "#20292a";
    ctx.beginPath(); ctx.moveTo(-4, -16); ctx.lineTo(4, -16); ctx.lineTo(5, -8); ctx.lineTo(2, -5); ctx.lineTo(-5, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#394847"; ctx.fillRect(-5, -11, 10, 4);
    ctx.fillStyle = "#11181b"; ctx.fillRect(-5, -8, 10, 3);

    // M4 机匣、扳机护圈、手枪握把和弹匣。
    ctx.fillStyle = rifleGradient;
    ctx.beginPath(); ctx.moveTo(-5, -32); ctx.lineTo(5, -32); ctx.lineTo(5, -17); ctx.lineTo(3, -14); ctx.lineTo(-4, -14); ctx.lineTo(-5, -18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#101719"; ctx.fillRect(-4, -29, 8, 3);
    ctx.strokeStyle = "#9aac9f"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-3, -21); ctx.quadraticCurveTo(0, -16, 3, -21); ctx.stroke();
    ctx.fillStyle = "#252f2f";
    ctx.beginPath(); ctx.moveTo(-3, -17); ctx.lineTo(3, -17); ctx.lineTo(2, -7); ctx.lineTo(-2, -5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#4d5b55";
    ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(4, -18); ctx.lineTo(3, -7); ctx.lineTo(-3, -7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#18211f";
    ctx.beginPath(); ctx.moveTo(-4, -16); ctx.lineTo(4, -16); ctx.lineTo(3, -1); ctx.lineTo(-3, -1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#697873"; ctx.fillRect(-3, -15, 6, 2);

    // M4 护木与顶部导轨。
    ctx.fillStyle = rifleGradient;
    ctx.beginPath(); ctx.moveTo(-5, -49); ctx.lineTo(5, -49); ctx.lineTo(5, -30); ctx.lineTo(-5, -30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(188, 211, 198, .45)"; ctx.lineWidth = 1;
    for (var railY = -46; railY <= -33; railY += 4) { ctx.beginPath(); ctx.moveTo(-5, railY); ctx.lineTo(5, railY); ctx.stroke(); }
    ctx.fillStyle = "#202b2a"; ctx.fillRect(-3, -55, 6, 25);
    ctx.fillStyle = "#71817a"; ctx.fillRect(-2, -53, 2, 19);

    // M4 长枪管、前准星和枪口制退器；枪口位置与 combat.js 保持一致。
    ctx.fillStyle = "#11191a"; ctx.fillRect(-2, -63, 4, 33);
    ctx.fillStyle = "#5d6d67"; ctx.fillRect(-2, -57, 2, 18);
    ctx.fillStyle = "#1d2827"; ctx.fillRect(-4, -64, 8, 4);
    ctx.fillStyle = "#8fa69b"; ctx.fillRect(-2, -66, 4, 3);
    ctx.fillStyle = "#151e1e"; ctx.fillRect(-5, -67, 10, 3);
    ctx.fillStyle = "#ffd166"; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, -68, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;

    // 双臂按照真实持枪关系绘制：左臂连接前握把，右臂连接后握把和扳机。
    var drawArm = function (shoulderX, shoulderY, elbowX, elbowY, handX, handY) {
      ctx.strokeStyle = "#241c20"; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(shoulderX, shoulderY); ctx.lineTo(elbowX, elbowY); ctx.lineTo(handX, handY); ctx.stroke();
      ctx.strokeStyle = "#8a573f"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(shoulderX, shoulderY); ctx.lineTo(elbowX, elbowY); ctx.lineTo(handX, handY); ctx.stroke();
      ctx.strokeStyle = "rgba(225, 164, 111, .52)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(shoulderX - 1, shoulderY - 1); ctx.lineTo(elbowX - 1, elbowY - 1); ctx.stroke();
      ctx.fillStyle = skinGradient;
      ctx.beginPath(); ctx.arc(handX, handY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f4c994";
      ctx.beginPath(); ctx.arc(handX - 1, handY - 1, 1.6, 0, Math.PI * 2); ctx.fill();
    };
    drawArm(-12, -10, -11, -21, frontHandX, frontHandY);
    drawArm(12, -10, 14, -14, rearHandX, rearHandY);

    // 最后绘制头部，保持参考图中的清晰头身关系。
    drawHead();
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
  };

  Game.drawEnemies = function () {
    S.enemies.forEach(function (enemy) {
      var info = C.enemies[enemy.type], r = info.radius, pulse = 1 + Math.sin(S.session.elapsed * 4) * .03;
      var shirtColor = enemy.type === "runner" ? "#705345" : enemy.type === "bucket" ? "#58656c" : enemy.type === "boss" ? "#4d2d3b" : "#3f6655";
      var shirtShadow = enemy.type === "runner" ? "#382b2d" : enemy.type === "bucket" ? "#303d45" : enemy.type === "boss" ? "#281c2a" : "#243c39";
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.scale(pulse, pulse);
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
      if (enemy.type === "runner") { ctx.strokeStyle = "#ffe0a7"; ctx.lineWidth = Math.max(1, r * .12); ctx.beginPath(); ctx.moveTo(-r * .7, r * .55); ctx.lineTo(-r * 1.18, r * .9); ctx.moveTo(r * .7, r * .48); ctx.lineTo(r * 1.16, r * .72); ctx.stroke(); }
      if (enemy.type === "bucket") { ctx.fillStyle = "#536775"; ctx.fillRect(-r * .7, -r * 1.28, r * 1.4, r * .48); ctx.fillStyle = "rgba(220, 239, 240, .3)"; ctx.fillRect(-r * .58, -r * 1.2, r * .82, r * .1); ctx.strokeStyle = "#d6e0ea"; ctx.lineWidth = Math.max(1, r * .08); ctx.strokeRect(-r * .7, -r * 1.28, r * 1.4, r * .48); }
      if (enemy.type === "boss") { ctx.fillStyle = "#6d3949"; ctx.beginPath(); ctx.moveTo(-r * .65, -r * 1.18); ctx.lineTo(-r * .82, -r * 1.7); ctx.lineTo(-r * .35, -r * 1.35); ctx.lineTo(0, -r * 1.78); ctx.lineTo(r * .3, -r * 1.3); ctx.lineTo(r * .82, -r * 1.7); ctx.lineTo(r * .65, -r * 1.1); ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.colors.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      if (enemy.type !== "boss") { ctx.fillStyle = "rgba(0, 0, 0, .5)"; ctx.fillRect(enemy.x - r, enemy.y - r - 13, r * 2, 3); ctx.fillStyle = C.colors.green; ctx.fillRect(enemy.x - r, enemy.y - r - 13, r * 2 * U.clamp(enemy.hp / enemy.maxHp, 0, 1), 3); }
    });
  };

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
    var time = S.session ? S.session.elapsed : 0, x = C.width / 2 + 43, y = C.height - 70 + Math.sin(time * 2.4) * 2, orbit = time * .8;
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
    S.particles.forEach(function (particle) { ctx.globalAlpha = U.clamp(particle.life / particle.maxLife, 0, 1); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    S.texts.forEach(function (item) { ctx.globalAlpha = U.clamp(item.life, 0, 1); text(item.text, item.x, item.y, "bold 11px Segoe UI, Microsoft YaHei", item.color, "center"); });
    ctx.globalAlpha = 1;
  };

  Game.drawHud = function () {
    var p = S.player, session = S.session;
    if (!p || S.screen === "menu") return;
    var level = C.levels.find(function (item) { return item.id === session.level; });
    panel(10, 10, C.width - 20, 72, "rgba(7, 21, 30, .82)", "rgba(153, 205, 218, .18)", 15);
    Game.drawPauseButton(17, 20, 32, 32);
    text(level ? level.name : "未知区域", C.width / 2, 31, "bold 17px Segoe UI, Microsoft YaHei", C.colors.text, "center");
    text("第 " + session.wave + " / " + C.waves.length + " 波", C.width - 18, 29, "bold 10px Segoe UI, Microsoft YaHei", C.colors.muted, "right");
    U.roundedRect(ctx, 67, 46, 226, 9, 4, "rgba(255,255,255,.12)");
    U.roundedRect(ctx, 67, 46, 226 * U.clamp(p.xp / p.nextXp, 0, 1), 9, 4, C.colors.cyan);
    text(p.level >= C.maxLevel ? "LV.MAX · 经验已满" : "LV." + p.level + "  " + Math.floor(p.xp) + " / " + p.nextXp + " XP", C.width / 2, 70, "10px Segoe UI, Microsoft YaHei", C.colors.muted, "center");
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
  Game.drawMenu = function () { Game.overlay(); panel(28, 96, C.width - 56, 382, "rgba(10, 35, 49, .78)", "rgba(153, 205, 218, .18)", 20); badge("SURVIVAL  PROTOCOL", 102, 122, 156, C.colors.cyan); text("街区警戒线", C.width / 2, 182, "bold 31px Segoe UI, Microsoft YaHei", C.colors.yellow, "center"); text("竖屏僵尸生存射击", C.width / 2, 211, "15px Segoe UI, Microsoft YaHei", C.colors.text, "center"); text("步枪自动锁定目标 · 点击画面调整方向", C.width / 2, 251, "12px Segoe UI, Microsoft YaHei", C.colors.muted, "center"); Game.button(C.width / 2 - 82, 294, 164, 46, "开始战斗", C.colors.green); Game.button(C.width / 2 - 82, 356, 164, 42, "选择关卡", C.colors.cyan); text("当前开放：第 1 关", C.width / 2, 434, "11px Segoe UI, Microsoft YaHei", C.colors.muted, "center"); };
  Game.drawLevelSelect = function () { Game.overlay(); panel(16, 60, C.width - 32, 530, "rgba(10, 35, 49, .94)", "rgba(153, 205, 218, .18)", 20); badge("MISSION SELECT", 105, 84, 150, C.colors.cyan); text("选择关卡", C.width / 2, 130, "bold 25px Segoe UI, Microsoft YaHei", C.colors.yellow, "center"); text("完成前一关后解锁后续区域", C.width / 2, 153, "12px Segoe UI, Microsoft YaHei", C.colors.muted, "center"); C.levels.forEach(function (level, index) { var x = 30, y = 180 + index * 100, unlocked = level.unlocked; panel(x, y, 300, 82, unlocked ? "#163b4d" : "rgba(24, 35, 46, .9)", unlocked ? "rgba(104,216,255,.38)" : "rgba(153,205,218,.12)", 14); text("0" + level.id, x + 24, y + 34, "bold 20px Segoe UI, Microsoft YaHei", unlocked ? C.colors.cyan : "#667985", "center"); text(level.name, x + 52, y + 29, "bold 15px Segoe UI, Microsoft YaHei", unlocked ? C.colors.text : "#71828b"); text(level.subtitle, x + 52, y + 52, "11px Segoe UI, Microsoft YaHei", unlocked ? C.colors.muted : "#56666e"); if (unlocked) { U.roundedRect(ctx, x + 226, y + 25, 60, 30, 10, "#245f73"); text("进入", x + 256, y + 44, "bold 11px Segoe UI, Microsoft YaHei", C.colors.text, "center"); } else { text("🔒 锁定", x + 256, y + 44, "bold 11px Segoe UI, Microsoft YaHei", "#7e8d94", "center"); } }); Game.button(C.width / 2 - 72, 518, 144, 40, "返回首页", "#4b7180"); };
  Game.drawUpgrade = function () { Game.overlay(); panel(16, 76, C.width - 32, 414, "rgba(10, 35, 49, .94)", "rgba(153, 205, 218, .18)", 20); text("等级提升！", C.width / 2, 119, "bold 25px Segoe UI, Microsoft YaHei", C.colors.yellow, "center"); text("选择一项强化，战斗将继续", C.width / 2, 143, "12px Segoe UI, Microsoft YaHei", C.colors.text, "center"); var cardW = 98, gap = 8, start = (C.width - cardW * 3 - gap * 2) / 2; S.upgradeCards.forEach(function (trait, i) { var x = start + i * (cardW + gap), y = 190, level = S.player.traits[trait.id] || 0, rare = trait.rarity === "稀有"; panel(x, y, cardW, 218, rare ? "#263352" : "#163b4d", rare ? "rgba(201,161,255,.45)" : "rgba(104,216,255,.28)", 14); text(trait.icon, x + cardW / 2, y + 50, "bold 31px Segoe UI, Microsoft YaHei", rare ? C.colors.purple : C.colors.cyan, "center"); text(trait.name, x + cardW / 2, y + 82, "bold 14px Segoe UI, Microsoft YaHei", C.colors.text, "center"); text(trait.rarity + " · Lv." + (level + 1) + "/" + trait.max, x + cardW / 2, y + 104, "bold 11px Segoe UI, Microsoft YaHei", rare ? C.colors.purple : C.colors.green, "center"); ctx.fillStyle = C.colors.muted; ctx.font = "11px Segoe UI, Microsoft YaHei"; ctx.textAlign = "center"; U.wrapText(ctx, trait.desc, x + cardW / 2, y + 135, 78, 16); U.roundedRect(ctx, x + 17, y + 181, 64, 27, 8, "#245f73"); text("选择", x + cardW / 2, y + 199, "bold 11px Segoe UI, Microsoft YaHei", C.colors.text, "center"); }); };
  Game.drawResult = function () { Game.overlay(); panel(30, 120, C.width - 60, 250, "rgba(10, 35, 49, .9)", "rgba(153, 205, 218, .18)", 20); var win = S.screen === "victory", session = S.session; text(win ? "关卡胜利" : "战斗失败", C.width / 2, 185, "bold 31px Segoe UI, Microsoft YaHei", win ? C.colors.green : C.colors.red, "center"); text(win ? "你守住了街区警戒线" : "尸潮突破了防线", C.width / 2, 217, "15px Segoe UI, Microsoft YaHei", C.colors.text, "center"); text("用时 " + U.formatTime(session.elapsed) + "  ·  击杀 " + session.kills + "  ·  等级 " + S.player.level, C.width / 2, 263, "13px Segoe UI, Microsoft YaHei", C.colors.muted, "center"); Game.button(C.width / 2 - 82, 307, 164, 48, "重新开始", win ? C.colors.green : C.colors.yellow); };
})(window.Game = window.Game || {});
