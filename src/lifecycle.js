(function (Game) {
  "use strict";
  var mounted = false, frameId = null, loadTimer = null, lastTime = 0, accountLoad = null;

  function loop(time) {
    if (!mounted) return;
    var dt = Math.min(.033, (time - lastTime) / 1000 || 0);
    lastTime = time;
    Game.update(dt);
    Game.draw();
    frameId = window.requestAnimationFrame(loop);
  }

  Game.mount = function (options) {
    options = options || {};
    if (mounted) return Promise.resolve({ mounted: true, reused: true });
    if (!Game.initializeView || !Game.initializeView(options.canvas)) {
      return Promise.reject(new Error("Canvas 初始化失败"));
    }
    if (Game.initializeInput) Game.initializeInput(options.canvas);
    Game.uiMode = "legacy";
    mounted = true;
    lastTime = 0;
    Game.reset();
    Game.draw();
    if (Game.accounts && Game.accounts.load && !accountLoad) accountLoad = Game.accounts.load();
    if (Game.loadSprites) {
      Game.loadSprites(function () { if (mounted) Game.draw(); });
      loadTimer = window.setTimeout(function () { if (mounted) Game.draw(); }, 1200);
    }
    frameId = window.requestAnimationFrame(loop);
    return Promise.resolve({ mounted: true, reused: false });
  };

  Game.destroy = function () {
    mounted = false;
    if (frameId !== null) window.cancelAnimationFrame(frameId);
    if (loadTimer !== null) window.clearTimeout(loadTimer);
    frameId = null;
    loadTimer = null;
    lastTime = 0;
    if (Game.destroyInput) Game.destroyInput();
    if (Game.destroyView) Game.destroyView();
    Game.uiMode = "legacy";
    return Promise.resolve();
  };

  Game.isMounted = function () { return mounted; };
})(window.Game = window.Game || {});
