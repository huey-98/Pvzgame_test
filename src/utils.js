(function (Game) {
  "use strict";
  var U = Game.utils = {};
  U.clamp = function (v, min, max) { return Math.max(min, Math.min(max, v)); };
  U.rand = function (min, max) { return min + Math.random() * (max - min); };
  U.choose = function (items) { return items[Math.floor(Math.random() * items.length)]; };
  U.formatTime = function (time) { var minutes = Math.floor(time / 60), seconds = Math.floor(time % 60); return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0"); };
  U.roundedRect = function (ctx, x, y, w, h, r, fill, stroke) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
  U.wrapText = function (ctx, text, x, y, maxWidth, lineHeight) { var line = "", lines = []; for (var i = 0; i < text.length; i++) { if (ctx.measureText(line + text[i]).width > maxWidth) { lines.push(line); line = text[i]; } else line += text[i]; } if (line) lines.push(line); lines.slice(0, 3).forEach(function (item, index) { ctx.fillText(item, x, y + index * lineHeight); }); };
})(window.Game = window.Game || {});
