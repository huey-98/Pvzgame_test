/* 运行时状态层：集中管理一局游戏的数据。 */
(function (Game) {
  "use strict";
  var C = Game.config;
  Game.state = { screen: "menu", player: null, bullets: [], enemies: [], particles: [], texts: [], upgradeCards: [], wall: null, session: null };
  Game.reset = function () {
    var s = Game.state;
    s.player = { x: C.width / 2, y: C.height - 76, aimAngle: -Math.PI / 2, manualAimTimer: 0, maxHp: 100, hp: 100, damage: 18, fireInterval: .52, fireTimer: .05, burst: 0, spread: 0, pierce: 0, bulletRadius: 4, crit: .08, critDamage: 1.5, burn: 0, freeze: 0, level: 1, xp: 0, nextXp: 50, traits: {} };
    s.bullets = []; s.enemies = []; s.particles = []; s.texts = []; s.upgradeCards = [];
    s.wall = { x: C.width / 2, y: C.height - 171, width: C.width - 30, height: 22, maxHp: 260, hp: 260 };
    s.session = { elapsed: 0, wave: 1, spawnCount: 0, spawnTimer: .25, bossSpawned: false, kills: 0, message: "", messageTimer: 0 };
  };
  Game.start = function () { Game.reset(); Game.state.screen = "playing"; document.getElementById("start-hint").style.display = "none"; };
})(window.Game = window.Game || {});
