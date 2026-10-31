const emptySnapshot = {
  screen: "menu",
  selectedLevel: 1,
  selectedLevelName: "",
  accountStatus: "loading",
  accountMode: "login",
  account: null,
  resources: [],
  records: [],
  totals: { wins: 0, attempts: 0 },
  completedCount: 0,
  completedLevels: [],
  gems: [],
  accountBusy: false,
  accountError: "",
  attributes: null,
  equipment: [],
  equipmentBag: [],
  wall: null,
  skills: [],
  skillBusy: false,
  skillBusyId: null,
  skillError: "",
  skillNotice: "",
  hud: null,
  upgradeCards: [],
  reward: null,
  testArena: null,
  lastReportSaved: false,
  lastReportReason: "",
  statusNote: "正在连接账户服务…"
};

let snapshot = emptySnapshot;
let serialized = JSON.stringify(snapshot);
let timer = null;
const listeners = new Set();

function game() {
  return window.Game || null;
}

function captureHud(Game) {
  const state = Game.state;
  const player = state.player;
  const wall = state.wall;
  const session = state.session;
  if (!player || !session) return null;
  const skillOrder = player.skillOrder || [];
  const skills = skillOrder.map(function (id) {
    const runtime = player.skills[id] || {};
    const definition = (Game.config.coreSkills || []).find(function (item) { return item.id === id; }) || {};
    return {
      id: id,
      name: definition.name || id,
      icon: definition.icon || "?",
      color: definition.color || "#c9a1ff",
      level: runtime.level || 1,
      accountLevel: player.accountSkills && player.accountSkills[id] ? player.accountSkills[id].level : 1,
      unlocked: !!runtime.unlocked
    };
  });
  return {
    playerHp: player.hp,
    playerMaxHp: player.maxHp,
    wallHp: wall ? wall.hp : 0,
    wallMaxHp: wall ? wall.maxHp : 0,
    level: player.level,
    xp: player.xp,
    nextXp: player.nextXp,
    ammo: player.ammo,
    magazineSize: player.magazineSize,
    reloadTimer: player.reloadTimer,
    rifleEnabled: player.rifleEnabled !== false,
    kills: session.kills,
    elapsed: session.elapsed,
    wave: session.wave,
    waves: session.waves ? session.waves.length : 0,
    remaining: Game.getRemainingEnemyCount ? Game.getRemainingEnemyCount() : 0,
    message: session.message || "",
    messageTimer: session.messageTimer || 0,
    skills: skills,
    maxSkillSlots: Game.config.maxSkillSlots
  };
}

function captureReward(reward) {
  if (!reward) return null;
  return {
    status: reward.status,
    tier: reward.tier,
    level: reward.level,
    win: reward.win,
    resources: Object.assign({}, reward.resources || {}),
    gems: (reward.gems || []).slice(),
    equipment: (reward.equipment || []).slice(),
    note: reward.note || "",
    reason: reward.reason || ""
  };
}

function capture() {
  const Game = game();
  if (!Game || !Game.state || !Game.accounts) return emptySnapshot;
  const state = Game.state;
  const accountState = Game.accounts.state || {};
  const testArena = state.testArena;
  const selectedLevel = Game.config.levels.find(function (level) { return level.id === state.selectedLevel; });
  return {
    screen: state.screen,
    selectedLevel: state.selectedLevel,
    selectedLevelName: selectedLevel ? selectedLevel.name : "",
    accountStatus: Game.accounts.getStatus(),
    accountMode: state.accountMode || "login",
    account: accountState.account ? Object.assign({}, accountState.account) : null,
    resources: Game.accounts.getResourceList(),
    records: Game.accounts.getLevelRecords(),
    totals: Game.accounts.getTotals(),
    completedCount: Game.accounts.getCompletedCount(),
    completedLevels: Object.keys(Game.accounts.getProgress().completed || {}).map(Number),
    gems: Game.gems ? Game.gems.getAll() : [],
    accountBusy: !!accountState.busy,
    accountError: accountState.error || "",
    attributes: Game.attributes ? Game.attributes.get() : null,
    equipment: Game.equipment ? Game.equipment.getSlots() : [],
    equipmentBag: Game.equipment ? Game.equipment.getBag() : [],
    wall: Game.wall ? Game.wall.getView() : null,
    skills: Game.skillProgress ? Game.skillProgress.getAll() : [],
    equipmentBusy: !!accountState.equipmentBusy,
    equipmentBusySlot: accountState.equipmentBusySlot || null,
    equipmentError: accountState.equipmentError || "",
    equipmentNotice: accountState.equipmentNotice || "",
    equipmentBagBusy: !!accountState.equipmentBagBusy,
    equipmentBagError: accountState.equipmentBagError || "",
    equipmentBagNotice: accountState.equipmentBagNotice || "",
    wallBusy: !!accountState.wallBusy,
    wallAction: accountState.wallAction || null,
    wallError: accountState.wallError || "",
    wallNotice: accountState.wallNotice || "",
    gemBusy: !!accountState.gemBusy,
    gemAction: accountState.gemAction || null,
    gemError: accountState.gemError || "",
    gemNotice: accountState.gemNotice || "",
    skillBusy: !!accountState.skillBusy,
    skillBusyId: accountState.skillBusyId || null,
    skillError: accountState.skillError || "",
    skillNotice: accountState.skillNotice || "",
    hud: captureHud(Game),
    upgradeCards: (state.upgradeCards || []).map(function (card) {
      return {
        id: card.id,
        name: card.name,
        rarity: card.rarity,
        icon: card.icon,
        desc: card.desc,
        max: card.max,
        skillId: card.skillId || null
      };
    }),
    reward: captureReward(state.session && state.session.reward),
    testArena: testArena ? {
      enemyIndex: testArena.enemyIndex,
      skillIndex: testArena.skillIndex,
      traitIndex: testArena.traitIndex,
      controlsVisible: testArena.controlsVisible,
      enemyIds: (testArena.enemyIds || []).slice()
    } : null,
    lastReportSaved: !!accountState.lastReportSaved,
    lastReportReason: accountState.lastReportReason || "",
    statusNote: Game.accounts.getStatusNote()
  };
}

export function refreshUiStore() {
  if (typeof window === "undefined" || !window.Game) return snapshot;
  const next = capture();
  const nextSerialized = JSON.stringify(next);
  if (nextSerialized !== serialized) {
    serialized = nextSerialized;
    snapshot = next;
    listeners.forEach(function (listener) { listener(); });
  }
  return snapshot;
}

export function subscribeUiStore(listener) {
  listeners.add(listener);
  return function () { listeners.delete(listener); };
}

export function getUiSnapshot() {
  return snapshot;
}

export function startUiStore() {
  if (timer !== null) return function () {};
  refreshUiStore();
  timer = window.setInterval(refreshUiStore, 100);
  return function () {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };
}
