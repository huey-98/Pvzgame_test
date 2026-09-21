(function (Game) {
  "use strict";
  var C = Game.config;
  Game.sprites = { images: {}, ready: false };
  Game.loadSprites = function (done) {
    var specs = C.sprites || {}, keys = Object.keys(specs), pending = keys.length;
    if (!pending) { Game.sprites.ready = true; if (done) done(); return; }
    function finish() {
      pending -= 1;
      if (pending <= 0) { Game.sprites.ready = true; if (done) done(); }
    }
    keys.forEach(function (key) {
      var sources = [].concat(specs[key].src), index = 0;
      var tryLoad = function () {
        if (index >= sources.length) { finish(); return; }
        var img = new Image();
        img.onload = function () {
          if (img.naturalWidth) Game.sprites.images[key] = img;
          finish();
        };
        img.onerror = function () { index += 1; tryLoad(); };
        img.src = sources[index];
      };
      tryLoad();
    });
  };
})(window.Game = window.Game || {});
