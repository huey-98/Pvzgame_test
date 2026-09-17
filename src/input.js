/* 输入层：将鼠标/触控事件转换为游戏动作。 */
(function (Game) {
  "use strict";
  var C = Game.config, S = Game.state, canvas = Game.view.canvas;
  Game.pointerPosition = function (event) { var rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * C.width / rect.width, y: (event.clientY - rect.top) * C.height / rect.height }; };
  canvas.addEventListener("pointerdown", function (event) { event.preventDefault(); var point = Game.pointerPosition(event), center = C.width / 2; if (S.screen === "menu") { if (point.x > center - 100 && point.x < center + 100 && point.y > 290 && point.y < 390) Game.start(); return; } if (S.screen === "upgrade") { var cardW = 98, gap = 8, start = (C.width - cardW * 3 - gap * 2) / 2; for (var i = 0; i < 3; i++) { var x = start + i * (cardW + gap); if (point.x >= x && point.x <= x + cardW && point.y >= 175 && point.y <= 430) { Game.chooseTrait(i); return; } } return; } if (S.screen === "victory" || S.screen === "defeat") { if (point.x > center - 105 && point.x < center + 105 && point.y > 290 && point.y < 390) Game.start(); return; } if (S.screen === "playing") Game.setManualAim(point.x, point.y); });
})(window.Game = window.Game || {});
