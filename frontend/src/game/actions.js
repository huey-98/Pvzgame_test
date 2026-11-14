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
  logout: function () { return track(Game().logoutAccount()); },
  removeAccount: function (password) {
    return track(Game().accounts.removeAccount(password).then(function (result) {
      if (result && result.ok) Game().state.screen = "menu";
      return result;
    }));
  },
  importLegacy: function () { return track(Game().importLegacyProgress()); },
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
  equipBagItem: function (itemId) { return track(Game().equipEquipmentItem(itemId)); },
  replaceCharacterEquipment: function (itemId) { return track(Game().replaceCharacterEquipment(itemId)); },
  upgradeWall: function (action) { return track(Game().upgradeWall(action)); },
  upgradeSkill: function (skillId) { return track(Game().upgradeSkill(skillId)); },
  upgradeRifle: function () { return track(Game().accounts.upgradeRifle()); },
  socketGem: function (gemId, slotIndex) { return track(Game().accounts.socketGem(gemId, slotIndex)); },
  socketCharacterGem: function (gemId) { return track(Game().socketCharacterGem(gemId)); },
  replaceCharacterGem: function (gemId, slotIndex) { return track(Game().replaceCharacterGem(gemId, slotIndex)); },
  unsocketGem: function (gemId) { return track(Game().unsocketGem(gemId)); },
  toggleGemLock: function (gemId, locked) {
    if (locked === undefined) return track(Game().toggleGemLock(gemId));
    return track(Game().accounts.toggleGemLock(gemId, locked));
  },
  synthesizeAllGems: function () { return track(Game().synthesizeAllGems()); },
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
  },
  openLevelPreview: function (levelId) { return run(function () { Game().openLevelPreview(levelId); }); },
  closeLevelPreview: function () { return run(function () { Game().closeLevelPreview(); }); },
  scrollLevelList: function (delta) { return run(function () { Game().scrollLevelList(delta); }); },
  setAccountResourcePage: function (delta) { return run(function () { Game().setAccountResourcePage(delta); }); },
  setAccountMode: function (mode) { return run(function () { Game().setAccountMode(mode); }); },
  selectCharacterPart: function (partId) { return run(function () { Game().selectCharacterPart(partId); }); },
  setCharacterTab: function (tab) { return run(function () { Game().setCharacterTab(tab); }); },
  openCharacterGems: function (partId) { return run(function () { Game().openCharacterGems(partId); }); },
  closeCharacterGems: function () { return run(function () { Game().closeCharacterGems(); }); },
  setCharacterGemPage: function (delta) { return run(function () { Game().setCharacterGemPage(delta); }); },
  openCharacterGemDetail: function (gemId) { return run(function () { Game().openCharacterGemDetail(gemId); }); },
  closeCharacterGemDetail: function () { return run(function () { Game().closeCharacterGemDetail(); }); },
  openCharacterEquip: function (itemId) { return run(function () { Game().openCharacterEquip(itemId); }); },
  closeCharacterEquip: function () { return run(function () { Game().closeCharacterEquip(); }); },
  setCharacterEquipPage: function (delta) { return run(function () { Game().setCharacterEquipPage(delta); }); },
  openCharacterResource: function (resourceId) { return run(function () { Game().openCharacterResource(resourceId); }); },
  closeCharacterResource: function () { return run(function () { Game().closeCharacterResource(); }); },
  setCharacterResourcePage: function (delta) { return run(function () { Game().setCharacterResourcePage(delta); }); },
  openGemSynthesis: function () { return run(function () { Game().openGemSynthesis(); }); },
  closeGemSynthesis: function () { return run(function () { Game().closeGemSynthesis(); }); },
  setGemSynthesisPage: function (delta) { return run(function () { Game().setGemSynthesisPage(delta); }); },
  focusGemSynthesis: function (gemId) { return run(function () { Game().focusGemSynthesis(gemId); }); },
  selectEquipmentBagPart: function (partId) { return run(function () { Game().selectEquipmentBagPart(partId); }); },
  setSkillProgressPage: function (delta) { return run(function () { Game().setSkillProgressPage(delta); }); },
  setZombieCategory: function (category) {
    return run(function () {
      const state = Game().state;
      state.zombieCodexCategory = category;
      state.selectedZombieCodexId = null;
      state.codexPage = 0;
    });
  },
  selectZombie: function (id) { return run(function () { Game().state.selectedZombieCodexId = id; }); },
  selectSkillCodex: function (id) {
    return run(function () {
      const state = Game().state;
      state.selectedSkillCodexId = id;
      state.codexPage = 0;
      state.skillCodexLevelPanel = false;
      state.skillCodexRequirementTraitId = null;
    });
  },
  clearSkillCodexSelection: function () {
    return run(function () {
      const state = Game().state;
      state.selectedSkillCodexId = null;
      state.codexPage = 0;
      state.skillCodexLevelPanel = false;
      state.skillCodexRequirementTraitId = null;
    });
  },
  setCodexPage: function (page) { return run(function () { Game().state.codexPage = page; }); },
  setSkillCodexLevelPanel: function (open) { return run(function () { Game().state.skillCodexLevelPanel = !!open; }); },
  setSkillRequirement: function (id) { return run(function () { Game().state.skillCodexRequirementTraitId = id || null; }); },
  setRifleMilestonePanel: function (open) { return run(function () { Game().state.rifleProgressMilestonePanel = !!open; }); }
};

export function getConfig() {
  return Game().config;
}

export function getGame() {
  return Game();
}
