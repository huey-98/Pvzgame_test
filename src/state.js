/* 运行时状态层：集中管理一局游戏的数据。 */
(function (Game) {
  "use strict";
  var C = Game.config;
  Game.state = { screen: "menu", selectedLevel: 1, player: null, bullets: [], skillProjectiles: [], explosions: [], enemies: [], particles: [], texts: [], upgradeCards: [], wall: null, session: null };
  Game.reset = function () {
    var s = Game.state;
    var skills = {};
    Object.keys(C.skillDefaults).forEach(function (id) {
      skills[id] = {};
      Object.keys(C.skillDefaults[id]).forEach(function (key) { skills[id][key] = C.skillDefaults[id][key]; });
      skills[id].fireTimer = skills[id].fireInterval * .5;
      skills[id].burstShotsRemaining = 0;
      skills[id].burstTimer = 0;
      skills[id].burstAngle = -Math.PI / 2;
    });
    s.player = { x: C.width / 2, y: C.height - 58, aimAngle: -Math.PI / 2, manualAimTimer: 0, maxHp: 100, hp: 100, damage: 18, fireInterval: .52, fireTimer: .05, magazineSize: C.magazineCapacity, ammo: C.magazineCapacity, reloadDuration: C.reloadDuration, reloadTimer: 0, burst: 0, burstShotsRemaining: 0, burstTimer: 0, burstAngle: -Math.PI / 2, spread: 0, pierce: 0, bulletRadius: 4, crit: .08, critDamage: 1.5, burn: 0, freeze: 0, bulletType: "normal", skills: skills, level: 1, xp: 0, nextXp: 50, traits: {} };
    s.bullets = []; s.skillProjectiles = []; s.explosions = []; s.enemies = []; s.particles = []; s.texts = []; s.upgradeCards = [];
    s.wall = { x: C.width / 2, y: C.height - 125, width: C.width - 30, height: 30, maxHp: 260, hp: 260 };
    s.session = { level: s.selectedLevel, elapsed: 0, wave: 1, spawnCount: 0, spawnTimer: .25, eliteSpawned: false, bossSpawned: false, kills: 0, message: "", messageTimer: 0 };
  };
  Game.openLevelSelect = function () { Game.state.screen = "levelSelect"; };
  Game.openZombieCodex = function () { Game.state.zombieCodexCategory = "minion"; Game.state.selectedZombieCodexId = null; Game.state.codexPage = 0; Game.state.screen = "zombieCodex"; };
  Game.openSkillCodex = function () { Game.state.skillCodexCategory = "rifle"; Game.state.codexPage = 0; Game.state.screen = "skillCodex"; };
  Game.backToMenu = function () { Game.state.screen = "menu"; };
  Game.pause = function () { if (Game.state.screen === "playing") Game.state.screen = "paused"; };
  Game.resume = function () { if (Game.state.screen === "paused") Game.state.screen = "playing"; };
  Game.start = function (levelId) {
    var level = Game.config.levels.find(function (item) { return item.id === (levelId || Game.state.selectedLevel); });
    if (!level || !level.unlocked) return;
    Game.state.selectedLevel = level.id;
    Game.reset();
    Game.state.screen = "playing";
    document.getElementById("start-hint").style.display = "none";
  };
  Game.exitToMenu = function () { Game.reset(); Game.state.screen = "menu"; document.getElementById("start-hint").style.display = "block"; };
})(window.Game = window.Game || {});
