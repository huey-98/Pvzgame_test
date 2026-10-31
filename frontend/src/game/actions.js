import { refreshUiStore } from "./ui-store.js";

function Game() {
  return window.Game;
}

function track(task) {
  const result = Promise.resolve(task);
  result.finally(function () { refreshUiStore(); });
  return result;
}

function run(action) {
  const result = action();
  refreshUiStore();
  return result;
}

export const actions = {
  openAccount: function () { return run(function () { Game().openAccount(); }); },
  openLogin: function (register) {
    return run(function () {
      Game().setAccountMode(register ? "register" : "login");
      Game().openLogin();
    });
  },
  login: function (username, password) {
    return track(Game().accounts.login(username, password).then(function (result) {
      if (result && result.ok) Game().state.screen = "account";
      return result;
    }));
  },
  register: function (username, password) {
    return track(Game().accounts.register(username, password).then(function (result) {
      if (result && result.ok) Game().state.screen = "account";
      return result;
    }));
  },
  logout: function () {
    return track(Game().accounts.logout().then(function () { Game().backToMenu(); }));
  },
  removeAccount: function (password) {
    return track(Game().accounts.removeAccount(password).then(function (result) {
      if (result && result.ok) Game().state.screen = "menu";
      return result;
    }));
  },
  importLegacy: function () { return track(Game().accounts.importLegacy()); },
  backToMenu: function () { return run(function () { Game().exitToMenu(); }); },
  openLevelSelect: function () { return run(function () { Game().openLevelSelect(); }); },
  openZombieCodex: function () { return run(function () { Game().openZombieCodex(); }); },
  openSkillCodex: function () { return run(function () { Game().openSkillCodex(); }); },
  openCharacter: function () { return run(function () { Game().openCharacter(); }); },
  openSkillProgress: function () { return run(function () { Game().openSkillProgress(); }); },
  openAttributes: function () { return run(function () { Game().openAttributes(); }); },
  openEquipment: function () { return run(function () { Game().openEquipment(); }); },
  openEquipmentBag: function () { return run(function () { Game().openEquipmentBag(); }); },
  openWall: function () { return run(function () { Game().openWall(); }); },
  backToCharacter: function () { return run(function () { Game().backToCharacter(); }); },
  backToEquipment: function () { return run(function () { Game().backToEquipment(); }); },
  startContinue: function () { return run(function () { Game().start(Game().getContinueLevel()); }); },
  startLevel: function (levelId) { return run(function () { Game().start(levelId); }); },
  startTestArena: function () { return run(function () { Game().startTestArena(); }); },
  exitTestArena: function () { return run(function () { Game().exitTestArena(); }); },
  pause: function () { return run(function () { Game().pause(); }); },
  resume: function () { return run(function () { Game().resume(); }); },
  quitLevel: function () { return track(Game().quitLevel()); },
  chooseTrait: function (index) { return run(function () { Game().chooseTrait(index); }); },
  toggleRifle: function () { return run(function () { Game().toggleRifle(); }); },
  upgradeEquipment: function (slotId) { return track(Game().upgradeEquipment(slotId)); },
  equipEquipment: function (itemId) { return track(Game().accounts.equipEquipment(itemId)); },
  upgradeWall: function (action) { return track(Game().upgradeWall(action)); },
  upgradeSkill: function (skillId) { return track(Game().upgradeSkill(skillId)); },
  socketGem: function (gemId, slotIndex) { return track(Game().accounts.socketGem(gemId, slotIndex)); },
  unsocketGem: function (gemId) { return track(Game().accounts.unsocketGem(gemId)); },
  toggleGemLock: function (gemId, locked) { return track(Game().accounts.toggleGemLock(gemId, locked)); },
  synthesizeAllGems: function () { return track(Game().accounts.synthesizeAllGems()); },
  selectTestEnemy: function (offset) { return run(function () { Game().selectTestEnemy(offset); }); },
  setTestEnemy: function (id) { return run(function () { Game().setTestEnemy(id); }); },
  selectTestSkill: function (offset) { return run(function () { Game().selectTestSkill(offset); }); },
  selectTestTrait: function (offset) { return run(function () { Game().selectTestTrait(offset); }); },
  testSpawnEnemy: function (count) { return run(function () { Game().testSpawnEnemy(count); }); },
  testClearEnemies: function () { return run(function () { Game().testClearEnemies(); }); },
  testRestore: function () { return run(function () { Game().testRestore(); }); },
  testUnlockSkill: function () { return run(function () { Game().testUnlockSkill(); }); },
  testApplyTrait: function () { return run(function () { Game().testApplyTrait(); }); },
  testClearBuild: function () { return run(function () { Game().testClearBuild(); }); },
  toggleTestControls: function () {
    return run(function () {
      const arena = Game().state.testArena;
      if (arena) arena.controlsVisible = !arena.controlsVisible;
    });
  },
  setSkillRangePreview: function (id) {
    return run(function () { Game().state.skillRangePreview = id || null; });
  }
};

export function getConfig() {
  return Game().config;
}

export function getGame() {
  return Game();
}
