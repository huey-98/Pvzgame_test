/* 运行时状态层：集中管理一局游戏的数据。 */
(function (Game) {
  "use strict";
  var C = Game.config;
  function setStartHint(display) {
    var node = typeof document !== "undefined" ? document.getElementById("start-hint") : null;
    if (node && node.style) node.style.display = display;
  }
  Game.state = { screen: "menu", selectedLevel: 1, accountMode: "login", player: null, bullets: [], skillProjectiles: [], armoredCars: [], bombDrops: [], bombZones: [], electromagneticZones: [], tornadoes: [], drones: [], hailStorms: [], fuelShells: [], fuelPools: [], enemyShots: [], explosions: [], enemies: [], pendingSpawns: [], particles: [], texts: [], upgradeCards: [], wall: null, session: null, testArena: null, skillRangePreview: null, levelPreview: null, characterPart: "arm", characterTab: "gem", characterGemPage: 0, characterGems: null, characterGemDetail: null, characterGemReplace: null, characterEquipItem: null, characterEquipPage: 0, gemSynthesisOpen: false, gemSynthesisPage: 0, gemSynthesisFocus: 0, equipmentBagPart: "arm" };
  Game.reset = function () {
    var s = Game.state;
    var level = C.levels.find(function (item) { return item.id === s.selectedLevel; });
    var waves = level && level.waves && level.waves.length ? level.waves : C.waves;
    var skills = {};
    Object.keys(C.skillDefaults).forEach(function (id) {
      skills[id] = {};
      Object.keys(C.skillDefaults[id]).forEach(function (key) { skills[id][key] = C.skillDefaults[id][key]; });
      skills[id].fireTimer = skills[id].fireInterval * .5;
      skills[id].burstShotsRemaining = 0;
      skills[id].burstTimer = 0;
      skills[id].burstAngle = -Math.PI / 2;
    });
    s.player = { x: C.width / 2, y: C.height - 58, aimAngle: -Math.PI / 2, manualAimTimer: 0, maxHp: 100, hp: 100, damage: 28, fireInterval: .52, fireTimer: .05, magazineSize: C.magazineCapacity, ammo: C.magazineCapacity, reloadDuration: C.reloadDuration, reloadTimer: 0, rifleEnabled: true, burst: 0, burstShotsRemaining: 0, burstTimer: 0, burstAngle: -Math.PI / 2, spread: 0, pierce: 0, bulletRadius: 4, crit: C.attributes.base.critRate, critDamage: C.attributes.base.critDamage, burn: 0, freeze: 0, bulletType: "normal", skills: skills, skillOrder: [], level: 1, xp: 0, nextXp: C.xpBase, traits: {} };
    s.bullets = []; s.skillProjectiles = []; s.armoredCars = []; s.bombDrops = []; s.bombZones = []; s.electromagneticZones = []; s.tornadoes = []; s.drones = []; s.hailStorms = []; s.fuelShells = []; s.fuelPools = []; s.enemyShots = []; s.explosions = []; s.enemies = []; s.pendingSpawns = []; s.particles = []; s.texts = []; s.upgradeCards = []; s.skillRangePreview = null; s.levelPreview = null;
    s.characterPart = "arm"; s.characterTab = "gem"; s.characterGemPage = 0; s.characterGems = null;
    s.characterGemDetail = null; s.characterGemReplace = null; s.characterEquipItem = null; s.characterEquipPage = 0;
    s.gemSynthesisOpen = false; s.gemSynthesisPage = 0; s.gemSynthesisFocus = 0; s.equipmentBagPart = "arm";
    s.wall = { x: C.width / 2, y: C.height - 125, width: C.width - 30, height: 30, maxHp: C.wallMaxHp, hp: C.wallMaxHp };
    if (Game.attributes) { Game.attributes.applyPlayer(s.player); Game.attributes.applyWall(s.wall); }
    s.session = { level: s.selectedLevel, waves: waves, xpScale: (level && level.xpScale) || 1, hpScale: (level && level.hpScale) || 1, elapsed: 0, wave: 1, spawnCount: 0, spawnTimer: .25, eliteSpawned: false, bossSpawned: false, kills: 0, message: "", messageTimer: 0, reward: null };
  };
  Game.layoutWorld = function () {
    var s = Game.state;
    if (s.wall) s.wall.y = C.height - 125;
    if (s.player) s.player.y = C.height - 58;
  };
  Game.openLevelSelect = function () { Game.state.levelPreview = null; Game.state.screen = "levelSelect"; };
  Game.openLevelPreview = function (levelId) {
    var level = C.levels.find(function (item) { return item.id === levelId; });
    if (!level) return false;
    Game.state.levelPreview = level.id;
    return true;
  };
  Game.closeLevelPreview = function () { Game.state.levelPreview = null; };
  Game.openZombieCodex = function () { Game.state.zombieCodexCategory = "minion"; Game.state.selectedZombieCodexId = null; Game.state.codexPage = 0; Game.state.screen = "zombieCodex"; };
  Game.openSkillCodex = function () { Game.state.selectedSkillCodexId = null; Game.state.codexPage = 0; Game.state.screen = "skillCodex"; };
  Game.openAttributes = function () {
    Game.state.characterGems = null;
    Game.state.characterGemDetail = null;
    Game.state.characterGemReplace = null;
    Game.state.characterEquipItem = null;
    Game.state.screen = "attributes";
  };
  Game.openCharacter = function () {
    Game.accounts.state.gemError = "";
    Game.accounts.state.gemNotice = "";
    Game.state.characterGems = null;
    Game.state.characterGemDetail = null;
    Game.state.characterGemReplace = null;
    Game.state.characterEquipItem = null;
    Game.state.screen = "character";
  };
  Game.selectCharacterPart = function (partId) {
    var valid = (C.equipment.slots || []).some(function (slot) { return slot.id === partId; });
    if (!valid) partId = (C.equipment.slots && C.equipment.slots[0] ? C.equipment.slots[0].id : "arm");
    Game.state.characterPart = partId;
  };
  Game.setCharacterTab = function (tab) {
    Game.state.characterTab = tab === "equipment" || tab === "resource" ? tab : "gem";
    Game.state.gemSynthesisOpen = false;
    Game.state.characterGemDetail = null;
    Game.state.characterEquipItem = null;
  };
  Game.openCharacterGems = function (partId) {
    Game.selectCharacterPart(partId);
    Game.state.characterGems = Game.state.characterPart;
    Game.state.characterGemDetail = null;
    Game.state.characterGemReplace = null;
    Game.state.characterEquipItem = null;
  };
  Game.closeCharacterGems = function () {
    Game.state.characterGems = null;
    Game.state.characterGemReplace = null;
  };
  Game.openCharacterGemDetail = function (gemId) {
    if (Game.state.screen !== "character" || !Game.gems) return false;
    var gem = Game.gems.findGem(gemId);
    if (!gem || gem.slotIndex !== null) return false;
    Game.state.characterGemDetail = gem.id;
    Game.state.characterEquipItem = null;
    return true;
  };
  Game.closeCharacterGemDetail = function () { Game.state.characterGemDetail = null; };
  Game.getCharacterGemDetail = function () {
    var id = Game.state.characterGemDetail;
    if (!id || !Game.gems) return null;
    var gem = Game.gems.findGem(id);
    if (!gem) return null;
    return { gem: gem, plan: Game.gems.planSocket(gem.id), part: Game.gems.getPart(gem.partId) };
  };
  Game.getCharacterGemReplace = function () {
    return Game.state.characterGemReplace && Game.gems ? Game.gems.findGem(Game.state.characterGemReplace) : null;
  };
  Game.openCharacterEquip = function (itemId) {
    if (Game.state.screen !== "character" || !Game.equipment) return false;
    var found = null;
    Game.equipment.getBagRows().forEach(function (item) { if (item.id === itemId) found = item; });
    if (!found) return false;
    Game.state.characterEquipItem = found.id;
    Game.state.characterGemDetail = null;
    Game.accounts.state.equipmentBagError = "";
    Game.accounts.state.equipmentBagNotice = "";
    return true;
  };
  Game.closeCharacterEquip = function () { Game.state.characterEquipItem = null; };
  Game.getCharacterEquipDetail = function () {
    var id = Game.state.characterEquipItem;
    if (!id || !Game.equipment) return null;
    var found = null;
    Game.equipment.getBagRows().forEach(function (item) { if (item.id === id) found = item; });
    return found;
  };
  Game.getCharacterEquipRows = function () {
    var all = Game.equipment ? Game.equipment.getBagRows() : [], geo = C.characterUI.equipCells;
    var perPage = geo.columns * geo.rows, pages = Math.max(1, Math.ceil(all.length / perPage)), page = Game.getCharacterEquipPage();
    return { items: all.slice(page * perPage, page * perPage + perPage), total: all.length, pages: pages, page: page };
  };
  Game.getCharacterEquipPageCount = function () {
    if (!Game.equipment) return 1;
    var geo = C.characterUI.equipCells;
    return Math.max(1, Math.ceil(Game.equipment.getBagRows().length / (geo.columns * geo.rows)));
  };
  Game.getCharacterEquipPage = function () {
    return Math.max(0, Math.min(Game.state.characterEquipPage, Game.getCharacterEquipPageCount() - 1));
  };
  Game.setCharacterEquipPage = function (delta) {
    Game.state.characterEquipPage = Math.max(0, Math.min(Game.state.characterEquipPage + delta, Game.getCharacterEquipPageCount() - 1));
  };
  Game.openEquipment = function () {
    Game.accounts.state.equipmentError = "";
    Game.accounts.state.equipmentNotice = "";
    Game.state.screen = "equipment";
  };
  Game.openEquipmentBag = function () {
    Game.accounts.state.equipmentBagError = "";
    Game.accounts.state.equipmentBagNotice = "";
    Game.selectEquipmentBagPart(Game.state.equipmentBagPart);
    Game.state.screen = "equipmentBag";
  };
  Game.selectEquipmentBagPart = function (partId) {
    var valid = (C.equipment.slots || []).some(function (slot) { return slot.id === partId; });
    if (!valid) partId = (C.equipment.slots && C.equipment.slots[0] ? C.equipment.slots[0].id : "arm");
    Game.state.equipmentBagPart = partId;
  };
  Game.backToEquipment = function () { Game.state.screen = "equipment"; };
  Game.equipEquipmentItem = function (itemId) {
    if (Game.state.screen !== "equipmentBag") return Promise.resolve({ ok: false });
    return Game.accounts.equipEquipment(itemId);
  };
  Game.openWall = function () {
    Game.accounts.state.wallError = "";
    Game.accounts.state.wallNotice = "";
    Game.state.screen = "wall";
  };
  Game.backToCharacter = function () {
    Game.state.characterGems = null;
    Game.state.characterGemDetail = null;
    Game.state.characterGemReplace = null;
    Game.state.characterEquipItem = null;
    Game.state.gemSynthesisOpen = false;
    Game.state.screen = "character";
  };
  Game.backToMenu = function () { Game.state.levelPreview = null; Game.state.screen = "menu"; };
  Game.getTestEnemyIds = function () { return Object.keys(C.enemies); };
  Game.startTestArena = function () {
    var s = Game.state, enemyIds = Game.getTestEnemyIds();
    s.selectedLevel = 1;
    Game.reset();
    s.testArena = { enemyIds: enemyIds, enemyIndex: 0, skillIndex: 0, traitIndex: 0, controlsVisible: true };
    s.session.testArena = true;
    s.session.level = 0;
    s.session.wave = 0;
    s.session.waves = [];
    s.wall.maxHp = 9999;
    s.wall.hp = s.wall.maxHp;
    s.screen = "testArena";
    setStartHint("none");
  };
  Game.selectTestEnemy = function (offset) {
    var arena = Game.state.testArena, ids = Game.getTestEnemyIds();
    if (!arena || !ids.length) return;
    arena.enemyIndex = (arena.enemyIndex + offset + ids.length) % ids.length;
  };
  Game.setTestEnemy = function (id) {
    var arena = Game.state.testArena, ids = Game.getTestEnemyIds(), index = ids.indexOf(id);
    if (!arena || index < 0) return;
    arena.enemyIndex = index;
  };
  Game.selectTestSkill = function (offset) {
    var arena = Game.state.testArena, skills = C.coreSkills || [];
    if (!arena || !skills.length) return;
    arena.skillIndex = (arena.skillIndex + offset + skills.length) % skills.length;
    arena.traitIndex = 0;
  };
  Game.selectTestTrait = function (offset) {
    var arena = Game.state.testArena, skill = arena && C.coreSkills[arena.skillIndex], traits;
    if (!arena || !skill) return;
    traits = (C.skillTraits || []).filter(function (trait) { return trait.skillId === skill.id && !trait.unlocksSkill; });
    if (!traits.length) return;
    arena.traitIndex = (arena.traitIndex + offset + traits.length) % traits.length;
  };
  Game.exitTestArena = function () { Game.exitToMenu(); };
  Game.pause = function () { if (Game.state.screen === "playing") { Game.state.skillRangePreview = null; Game.state.screen = "paused"; } };
  Game.resume = function () { if (Game.state.screen === "paused") Game.state.screen = "playing"; };
  Game.quitLevel = function () {
    var s = Game.state;
    if (s.screen !== "paused" || !s.session) return;
    s.screen = "retreat";
    s.session.message = "已撤离";
    Game.settleRewards(false);
  };
  Game.start = function (levelId) {
    var level = Game.config.levels.find(function (item) { return item.id === (levelId || Game.state.selectedLevel); });
    if (!level || !Game.isLevelUnlocked(level.id)) return;
    Game.state.selectedLevel = level.id;
    Game.reset();
    Game.state.screen = "playing";
    setStartHint("none");
  };
  Game.exitToMenu = function () { Game.reset(); Game.state.testArena = null; Game.state.screen = "menu"; setStartHint("block"); };
  Game.getProgress = function () { return Game.accounts.getProgress(); };
  Game.isLevelCompleted = function (levelId) { return Game.accounts.isCompleted(levelId); };
  Game.markLevelComplete = function (levelId, stats) {
    return Game.accounts.reportRun(levelId, { time: stats && stats.time, kills: stats && stats.kills, win: true });
  };
  Game.reportRun = function (win) {
    var session = Game.state.session;
    if (!session || session.testArena || !session.level) return null;
    return Game.accounts.reportRun(session.level, { time: session.elapsed, kills: session.kills, win: !!win });
  };
  Game.settleRewards = function (win) {
    var s = Game.state, session = s.session;
    if (!session || session.testArena || !session.level || session.reward) return null;
    var level = Math.max(1, Math.min(C.maxLevel, (s.player && s.player.level) || 1));
    var reward = session.reward = { status: "pending", tier: -1, level: level, win: !!win, resources: {}, gems: [], equipment: [], note: "" };
    if (!Game.accounts || !Game.accounts.claimRewards) {
      reward.status = "failed";
      reward.note = "账户服务不可用";
      return null;
    }
    return Game.accounts.claimRewards(session.level, level, !!win).then(function (result) {
      if (result && result.ok) {
        reward.status = "done";
        reward.tier = result.tier;
        reward.resources = (result.rewards && result.rewards.resources) || {};
        reward.gems = (result.rewards && result.rewards.gems) || [];
        reward.equipment = (result.rewards && result.rewards.equipment) || [];
        return result;
      }
      reward.reason = (result && result.reason) || "";
      reward.note = reward.reason === "offline" ? "未连接数据库 · 奖励不会保存"
        : reward.reason === "guest" ? ((result && result.error === "登录已过期") ? "登录已过期 · 奖励不会保存" : "未登录 · 奖励不会保存")
          : reward.reason === "loading" ? "正在连接账户服务…"
            : ((result && result.error) || "奖励未保存");
      reward.status = reward.reason ? "unsaved" : "failed";
      return result;
    });
  };
  Game.loseLevel = function (message) {
    var s = Game.state;
    if (s.screen !== "playing" || !s.session) return;
    s.session.message = message || "城墙失守";
    s.screen = "defeat";
    Game.reportRun(false);
    Game.settleRewards(false);
  };
  Game.openLogin = function () { Game.state.accountMode = "login"; Game.state.screen = "login"; };
  Game.setAccountMode = function (mode) { Game.state.accountMode = mode === "register" ? "register" : "login"; };
  Game.openAccount = function () {
    if (Game.accounts.getStatus() === "ready") Game.state.screen = "account";
    else Game.openLogin();
  };
  Game.logoutAccount = function () {
    Game.accounts.logout().then(function () { Game.backToMenu(); });
  };
  Game.importLegacyProgress = function () {
    if (Game.accounts.getStatus() !== "ready") { Game.accounts.state.notice = "登录后才能导入旧进度"; return; }
    Game.accounts.importLegacy();
  };
  Game.upgradeEquipment = function (slotId) {
    if (Game.state.screen !== "equipment") return Promise.resolve({ ok: false });
    return Game.accounts.upgradeEquipment(slotId);
  };
  Game.upgradeWall = function (action) {
    if (Game.state.screen !== "wall") return Promise.resolve({ ok: false });
    return Game.accounts.upgradeWall(action);
  };
  Game.getCharacterGemRows = function () {
    var all = Game.gems ? Game.gems.getBag() : [], geo = C.characterUI.gemCells;
    var perPage = geo.columns * geo.rows, pages = Math.max(1, Math.ceil(all.length / perPage)), page = Game.getCharacterGemPage();
    return { items: all.slice(page * perPage, page * perPage + perPage), total: all.length, pages: pages, page: page };
  };
  Game.getCharacterGemPageCount = function () {
    if (!Game.gems) return 1;
    var geo = C.characterUI.gemCells;
    return Math.max(1, Math.ceil(Game.gems.getBag().length / (geo.columns * geo.rows)));
  };
  Game.getCharacterGemPage = function () {
    return Math.max(0, Math.min(Game.state.characterGemPage, Game.getCharacterGemPageCount() - 1));
  };
  Game.setCharacterGemPage = function (delta) {
    Game.state.characterGemPage = Math.max(0, Math.min(Game.state.characterGemPage + delta, Game.getCharacterGemPageCount() - 1));
  };
  Game.getGemSynthesisPlan = function () {
    return Game.gems ? Game.gems.getSynthesisPlan() : [];
  };
  Game.getGemSynthesisSummary = function () {
    return Game.gems ? Game.gems.getSynthesisSummary() : { recipes: 0, gems: 0, locked: 0 };
  };
  Game.getGemSynthesisPageCount = function () {
    return Math.max(1, Math.ceil(Game.getGemSynthesisPlan().length / C.gemSynthesisUI.rows));
  };
  Game.getGemSynthesisPage = function () {
    return Math.max(0, Math.min(Game.state.gemSynthesisPage, Game.getGemSynthesisPageCount() - 1));
  };
  Game.setGemSynthesisPage = function (delta) {
    Game.state.gemSynthesisPage = Math.max(0, Math.min(Game.state.gemSynthesisPage + delta, Game.getGemSynthesisPageCount() - 1));
  };
  Game.openGemSynthesis = function () {
    if (Game.state.screen !== "character") return false;
    var plan = Game.getGemSynthesisPlan();
    Game.state.gemSynthesisOpen = true;
    Game.state.gemSynthesisPage = 0;
    Game.state.gemSynthesisFocus = plan.length ? plan[0].gems[0].id : 0;
    return true;
  };
  Game.closeGemSynthesis = function () {
    Game.state.gemSynthesisOpen = false;
    Game.state.gemSynthesisPage = 0;
    Game.state.gemSynthesisFocus = 0;
  };
  Game.focusGemSynthesis = function (gemId) {
    if (!Game.state.gemSynthesisOpen) return false;
    var found = Game.gems ? Game.gems.findGem(gemId) : null;
    if (!found) return false;
    Game.state.gemSynthesisFocus = found.id;
    return true;
  };
  Game.toggleGemLock = function (gemId) {
    if (Game.state.screen !== "character") return Promise.resolve({ ok: false });
    var found = Game.gems ? Game.gems.findGem(gemId) : null;
    if (!found) return Promise.resolve({ ok: false });
    return Game.accounts.toggleGemLock(gemId, !found.locked).then(function (result) {
      if (!result || !result.ok) return result;
      var plan = Game.getGemSynthesisPlan(), focus = Game.state.gemSynthesisFocus, stillListed = false;
      plan.forEach(function (recipe) {
        recipe.gems.forEach(function (gem) { if (gem.id === focus) stillListed = true; });
      });
      if (!stillListed) Game.state.gemSynthesisFocus = plan.length ? plan[0].gems[0].id : 0;
      Game.state.gemSynthesisPage = Math.max(0, Math.min(Game.state.gemSynthesisPage, Game.getGemSynthesisPageCount() - 1));
      return result;
    });
  };
  Game.synthesizeAllGems = function () {
    if (Game.state.screen !== "character") return Promise.resolve({ ok: false });
    return Game.accounts.synthesizeAllGems().then(function (result) {
      if (result && result.ok) Game.closeGemSynthesis();
      return result;
    });
  };
  Game.socketCharacterGem = function (gemId) {
    if (Game.state.screen !== "character" || !Game.gems) return Promise.resolve({ ok: false });
    var gem = Game.gems.findGem(gemId), plan = Game.gems.planSocket(gemId);
    if (!gem) return Promise.resolve({ ok: false, mode: "missing", error: "宝石不存在" });
    if (!plan.ok) return Promise.resolve({ ok: false, mode: plan.mode, error: plan.message });
    if (plan.mode === "pick") {
      Game.selectCharacterPart(gem.partId);
      Game.state.characterGems = gem.partId;
      Game.state.characterGemReplace = gem.id;
      Game.state.characterGemDetail = null;
      return Promise.resolve({ ok: false, mode: "pick", pending: true, error: plan.message });
    }
    return Game.accounts.socketGem(gemId).then(function (result) {
      if (result && result.ok) Game.state.characterGemDetail = null;
      return result;
    });
  };
  Game.replaceCharacterGem = function (gemId, slotIndex) {
    if (Game.state.screen !== "character" || !Game.gems) return Promise.resolve({ ok: false });
    return Game.accounts.socketGem(gemId, slotIndex).then(function (result) {
      if (result && result.ok) {
        Game.state.characterGemDetail = null;
        Game.state.characterGemReplace = null;
      }
      return result;
    });
  };
  Game.replaceCharacterEquipment = function (itemId) {
    if (Game.state.screen !== "character" || !Game.state.characterEquipItem) return Promise.resolve({ ok: false });
    return Game.accounts.equipEquipment(itemId);
  };
  Game.unsocketGem = function (gemId) {
    if (Game.state.screen !== "character") return Promise.resolve({ ok: false });
    return Game.accounts.unsocketGem(gemId);
  };
  Game.synthesizeGems = function (partId, quality) {
    if (Game.state.screen !== "character") return Promise.resolve({ ok: false });
    return Game.accounts.synthesizeGems(partId, quality);
  };
  Game.isLevelUnlocked = function (levelId) {
    var level = C.levels.find(function (item) { return item.id === levelId; });
    if (!level) return false;
    if (level.unlocked) return true;
    return Game.isLevelCompleted(levelId - 1);
  };
  Game.getLevelRowRect = function (index) {
    var geo = C.levelSelect, count = Math.max(1, C.levels.length);
    var height = Math.min(geo.rowHeight, (geo.backY - 12 - geo.listY) / count);
    return { x: geo.listX, y: geo.listY + index * height, w: geo.listWidth, h: height };
  };
  Game.getSkillCodexCardRect = function (index) {
    var geo = C.skillCodexUI, column = index % geo.cards.columns.length, row = Math.floor(index / geo.cards.columns.length);
    return { x: geo.cards.columns[column], y: geo.cards.rows[row], w: geo.cards.width, h: geo.cards.height };
  };
  Game.getSkillCodexCardIndex = function (point) {
    if (!point) return -1;
    for (var index = 0; index < C.skillCodexUI.cards.perPage; index++) {
      var rect = Game.getSkillCodexCardRect(index);
      if (point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h) return index;
    }
    return -1;
  };
  Game.getSkillCodexIconRect = function () {
    var geo = C.skillCodexUI, radius = geo.icon.size / 2;
    return { x: geo.icon.centerX - radius, y: geo.icon.centerY - radius, w: geo.icon.size, h: geo.icon.size };
  };
  Game.getSkillCodexPagerRect = function (key) { return C.skillCodexUI.pager[key === "next" ? "next" : "prev"]; };
  Game.getSkillCodexBackRect = function () { return C.skillCodexUI.back; };
  Game.getLevelInfoRect = function (index) {
    var geo = C.levelSelect, row = Game.getLevelRowRect(index), size = geo.infoSize;
    return { x: row.x + geo.infoX - size / 2, y: row.y + (row.h - size) / 2, w: size, h: size };
  };
  Game.getEquipmentCardRect = function (index) {
    var geo = C.equipmentUI, column = index % 2, row = Math.floor(index / 2);
    return { x: geo.cardX[column], y: geo.cardY[row], w: geo.cardWidth, h: geo.cardHeight };
  };
  Game.getEquipmentUpgradeRect = function (index) {
    var card = Game.getEquipmentCardRect(index);
    return { x: card.x + 10, y: card.y + 80, w: card.w - 20, h: 20 };
  };
  Game.getEquipmentBagTabRect = function (index) {
    var geo = C.equipmentBagUI.partTabs;
    return { x: geo.x + index * (geo.w + geo.gap), y: geo.y, w: geo.w, h: geo.h };
  };
  Game.getEquipmentBagRowRect = function (index) {
    var geo = C.equipmentBagUI;
    return { x: geo.listX, y: geo.listY + index * geo.rowHeight, w: geo.listWidth, h: geo.rowHeight - 4 };
  };
  Game.getEquipmentBagButtonRect = function (index) {
    var geo = C.equipmentBagUI, row = Game.getEquipmentBagRowRect(index);
    return { x: row.x + geo.equip.offsetX, y: row.y + geo.equip.offsetY, w: geo.equip.w, h: geo.equip.h };
  };
  Game.getWallActionButtonRect = function () {
    var rect = C.wallUI.actionButton;
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  };
  Game.getCharacterSlotRect = function (index) {
    var grid = C.characterUI.slotGrid, column = index % 2, row = Math.floor(index / 2);
    return { x: grid.x[column], y: grid.y[row], w: grid.size, h: grid.size };
  };
  Game.getCharacterSlotInfoRect = function (index) {
    var grid = C.characterUI.slotGrid, rect = Game.getCharacterSlotRect(index);
    return { x: rect.x + grid.size + 6, y: rect.y + 2, w: grid.infoWidth - 6, h: grid.size - 4 };
  };
  Game.getCharacterActionRect = function (key) { return key === "wall" ? C.characterUI.actionWall : C.characterUI.actionEquip; };
  Game.getCharacterHeaderRect = function (key) { return key === "attributes" ? C.characterUI.attributes : C.characterUI.back; };
  Game.getCharacterTabRect = function (index) {
    var geo = C.characterUI.tabs;
    return { x: geo.x + index * (geo.w + geo.gap), y: geo.y, w: geo.w, h: geo.h };
  };
  Game.getCharacterGemCellRect = function (index) {
    var geo = C.characterUI.gemCells, column = index % geo.columns, row = Math.floor(index / geo.columns);
    return { x: geo.x + column * (geo.size + geo.gap), y: geo.y + row * (geo.size + geo.gap), w: geo.size, h: geo.size };
  };
  Game.getCharacterEquipCellRect = function (index) {
    var geo = C.characterUI.equipCells, column = index % geo.columns, row = Math.floor(index / geo.columns);
    return { x: geo.x + column * (geo.size + geo.gap), y: geo.y + row * (geo.size + geo.gap), w: geo.size, h: geo.size };
  };
  Game.getCharacterResources = function () {
    return Game.accounts.getResourceList().filter(function (item) { return (item.amount || 0) > 0; });
  };
  Game.getCharacterResourceCellRect = function (index) {
    var geo = C.characterUI.resourceCells, column = index % geo.columns, row = Math.floor(index / geo.columns);
    return { x: geo.x + column * (geo.size + geo.gap), y: geo.y + row * (geo.size + geo.gap), w: geo.size, h: geo.size };
  };
  Game.getCharacterGemLockRect = function (index) {
    var geo = C.characterUI.bagLock, cell = Game.getCharacterGemCellRect(index);
    return { x: cell.x + geo.offsetX, y: cell.y + geo.offsetY, w: geo.w, h: geo.h };
  };
  Game.getCharacterGemPagerRect = function (key) { return C.characterUI.bagPager[key === "next" ? "next" : "prev"]; };
  Game.getCharacterBagActionRect = function () { return C.characterUI.bagAction; };
  Game.getCharacterGemPanel = function () { return C.characterUI.gemPanel; };
  Game.getCharacterGemSlotRowRect = function (index) {
    var geo = C.characterUI.gemRows;
    return { x: geo.x, y: geo.y + index * geo.height, w: geo.w, h: geo.height - 4 };
  };
  Game.getCharacterGemUnsocketRect = function (index) {
    var geo = C.characterUI.gemUnsocket, row = Game.getCharacterGemSlotRowRect(index);
    return { x: row.x + geo.offsetX, y: row.y + geo.offsetY, w: geo.w, h: geo.h };
  };
  Game.getCharacterGemCloseRect = function () { return C.characterUI.gemPanelClose; };
  Game.getCharacterGemDetailPanel = function () { return C.characterUI.gemDetail.panel; };
  Game.getCharacterGemDetailSocketRect = function () { return C.characterUI.gemDetail.socket; };
  Game.getCharacterGemDetailCloseRect = function () { return C.characterUI.gemDetail.close; };
  Game.getCharacterEquipDetailPanel = function () { return C.characterUI.equipDetail.panel; };
  Game.getCharacterEquipReplaceRect = function () { return C.characterUI.equipDetail.replace; };
  Game.getCharacterEquipCloseRect = function () { return C.characterUI.equipDetail.close; };
  Game.getCharacterEquipPagerRect = function (key) { return C.characterUI.equipPager[key === "next" ? "next" : "prev"]; };
  Game.getGemSynthesisRowRect = function (index) {
    var geo = C.gemSynthesisUI;
    return { x: geo.listX, y: geo.listY + index * geo.rowHeight, w: geo.listWidth, h: geo.rowHeight - 4 };
  };
  Game.getGemSynthesisGemRect = function (rowIndex, gemIndex) {
    var geo = C.gemSynthesisUI, row = Game.getGemSynthesisRowRect(rowIndex);
    return { x: row.x + geo.gemsX + gemIndex * geo.gemGap - 2, y: row.y + geo.gemsY - 2, w: geo.gemSize + 4, h: geo.gemSize + 4 };
  };
  Game.getGemSynthesisPrevRect = function () { return C.gemSynthesisUI.pagerPrev; };
  Game.getGemSynthesisNextRect = function () { return C.gemSynthesisUI.pagerNext; };
  Game.getGemSynthesisConfirmRect = function () { return C.gemSynthesisUI.confirm; };
  Game.getGemSynthesisCancelRect = function () { return C.gemSynthesisUI.cancel; };
  Game.getLevelBriefPanel = function () {
    var geo = C.levelSelect, roster = Game.getLevelRoster(Game.state.levelPreview);
    var rows = roster.minions.length + roster.elites.length + (roster.boss ? 1 : 0);
    var height = geo.briefTop + geo.briefHeadingStep * 3 + geo.briefGroupGap * 3 + geo.briefRowStep * rows + geo.briefBottom;
    return { x: geo.briefX, y: geo.briefY, w: geo.briefWidth, h: Math.max(geo.briefMinHeight, height) };
  };
  Game.getLevelBriefCloseRect = function () {
    var geo = C.levelSelect, box = Game.getLevelBriefPanel();
    return { x: box.x + box.w - geo.briefCloseSize - 10, y: box.y + 10, w: geo.briefCloseSize, h: geo.briefCloseSize };
  };
  Game.getLevelBriefLayout = function () {
    var geo = C.levelSelect, roster = Game.getLevelRoster(Game.state.levelPreview), y = geo.briefTop, groups = [];
    [roster.minions, roster.elites, roster.boss ? [roster.boss] : []].forEach(function (list) {
      var group = { y: y, rows: [] };
      list.forEach(function (entry, index) { group.rows.push({ entry: entry, y: y + geo.briefHeadingStep + index * geo.briefRowStep }); });
      y += geo.briefHeadingStep + list.length * geo.briefRowStep + geo.briefGroupGap;
      groups.push(group);
    });
    return { box: Game.getLevelBriefPanel(), groups: groups };
  };
  Game.getLevelRoster = function (levelId) {
    var level = C.levels.find(function (item) { return item.id === levelId; });
    var minions = [], elites = [], boss = null, bossWave = 0, minionSeen = {}, eliteSeen = {}, bossId = null;
    function collect(list, seen, id, wave) {
      var info = C.enemies[id];
      if (!info) return;
      if (seen[id]) { if (seen[id].waves.indexOf(wave) < 0) seen[id].waves.push(wave); return; }
      seen[id] = { id: id, name: info.name, color: info.color, accent: info.accent, wave: wave, waves: [wave] };
      list.push(seen[id]);
    }
    if (level && level.waves) {
      level.waves.forEach(function (wave, index) {
        var number = index + 1, unique = [];
        (wave.mix || []).forEach(function (id) { if (unique.indexOf(id) < 0) unique.push(id); });
        unique.forEach(function (id) { collect(minions, minionSeen, id, number); });
        if (wave.elite) collect(elites, eliteSeen, wave.elite, number);
        (wave.elitePool || []).forEach(function (id) { collect(elites, eliteSeen, id, number); });
        if (wave.boss) bossWave = number;
      });
    }
    Object.keys(C.enemies).forEach(function (id) { if (!bossId && (C.enemies[id].codexCategory || "minion") === "boss") bossId = id; });
    if (bossId && bossWave) boss = { id: bossId, name: C.enemies[bossId].name, color: C.enemies[bossId].color, accent: C.enemies[bossId].accent, wave: bossWave, waves: [bossWave] };
    return { minions: minions, elites: elites, boss: boss };
  };
  Game.getContinueLevel = function () {
    var pending = C.levels.filter(function (level) { return Game.isLevelUnlocked(level.id) && !Game.isLevelCompleted(level.id); });
    if (pending.length) return pending[0].id;
    var open = C.levels.filter(function (level) { return Game.isLevelUnlocked(level.id); });
    return open.length ? open[open.length - 1].id : 1;
  };
  Game.getRemainingEnemyCount = function () {
    var s = Game.state, session = s.session;
    if (!session) return 0;
    var plan = session.waves[session.wave - 1], count = s.enemies.length + s.pendingSpawns.length;
    if (plan) {
      count += Math.max(0, plan.total - session.spawnCount);
      if (plan.boss && !session.bossSpawned) count += 1;
    }
    return count;
  };
  Game.winLevel = function () {
    var s = Game.state;
    if (s.screen !== "playing" || !s.session) return;
    s.screen = "victory";
    s.session.message = "关卡通关";
    Game.reportRun(true);
    Game.settleRewards(true);
  };
})(window.Game = window.Game || {});
