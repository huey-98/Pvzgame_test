/* 应用入口：初始化状态并驱动 requestAnimationFrame。 */
(function (Game) {
  "use strict";
  var lastTime = 0;
  function loop(time) { var dt = Math.min(.033, (time - lastTime) / 1000 || 0); lastTime = time; Game.update(dt); Game.draw(); window.requestAnimationFrame(loop); }
  Game.reset();
  window.requestAnimationFrame(loop);
})(window.Game = window.Game || {});
