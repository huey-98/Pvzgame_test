/* 账户数据层：前端访问账户数据的唯一入口，内存缓存 + 异步落库。 */
(function (Game) {
  "use strict";
  var C = Game.config;

  var state = {
    status: "loading",
    account: null,
    progress: {},
    sessionProgress: {},
    resources: {},
    equipment: null,
    equipmentBag: [],
    equipmentBusy: false,
    equipmentBusySlot: null,
    equipmentError: "",
    equipmentNotice: "",
    equipmentBagBusy: false,
    equipmentBagError: "",
    equipmentBagNotice: "",
    wall: null,
    wallBusy: false,
    wallAction: null,
    wallError: "",
    wallNotice: "",
    gems: null,
    gemBusy: false,
    gemAction: null,
    gemError: "",
    gemNotice: "",
    error: "",
    busy: false,
    lastReportSaved: false,
    lastReportReason: "",
    pendingWrites: 0,
    notice: ""
  };

  function settings() { return C.accounts || {}; }
  function apiBase() { return settings().apiBase || ""; }
  function legacyKey() { return settings().legacyKey || "blockline.progress"; }
  function isFileProtocol() { return !!window.location && window.location.protocol === "file:"; }

  function readLegacy() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(legacyKey())) || {};
      return stored.completed || {};
    } catch (error) {
      return {};
    }
  }

  function request(path, options) {
    options = options || {};
    if (typeof window.fetch !== "function") return Promise.resolve({ status: 0, data: null, networkError: true });
    var controller = window.AbortController ? new window.AbortController() : null;
    var timer = window.setTimeout(function () { if (controller) controller.abort(); }, settings().timeoutMs || 4000);
    var init = { method: options.method || "GET", credentials: "same-origin", headers: {} };
    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    if (controller) init.signal = controller.signal;
    return window.fetch(apiBase() + path, init).then(function (response) {
      return response.text().then(function (raw) {
        var data = null;
        if (raw) { try { data = JSON.parse(raw); } catch (error) { data = null; } }
        return { status: response.status, data: data };
      });
    }).then(function (result) {
      window.clearTimeout(timer);
      return result;
    }, function () {
      window.clearTimeout(timer);
      return { status: 0, data: null, networkError: true };
    });
  }

  function errorMessage(result, fallback) {
    var data = result && result.data;
    if (data && data.error && data.error.message) return data.error.message;
    return fallback;
  }

  function forgetAccount() {
    state.account = null;
    state.progress = {};
    state.sessionProgress = {};
    state.resources = {};
    state.equipment = null;
    state.equipmentBusy = false;
    state.equipmentBusySlot = null;
    state.equipmentBag = [];
    state.equipmentBagBusy = false;
    state.equipmentBagError = "";
    state.equipmentBagNotice = "";
    state.wall = null;
    state.wallBusy = false;
    state.wallAction = null;
    state.gems = null;
    state.gemBusy = false;
    state.gemAction = null;
    if (Game.equipment) Game.equipment.clear();
    if (Game.wall) Game.wall.clear();
    if (Game.gems) Game.gems.clear();
  }

  function applyMe(data) {
    state.account = data.account || null;
    state.progress = data.progress || {};
    state.sessionProgress = {};
    state.resources = data.resources || {};
    state.equipment = data.equipment || null;
    state.equipmentBag = data.equipmentBag || [];
    state.wall = data.wall || null;
    state.gems = data.gems || [];
    state.status = state.account ? "ready" : "guest";
    state.error = "";
    if (Game.equipment) { Game.equipment.applyAccount(state.equipment); Game.equipment.applyBag(state.equipmentBag); }
    if (Game.wall) Game.wall.applyAccount(state.wall);
    if (Game.gems) Game.gems.applyAccount(state.gems);
  }

  function applyResources(values) {
    Object.keys(values || {}).forEach(function (id) { state.resources[id] = values[id]; });
  }

  function load() {
    if (isFileProtocol()) {
      state.status = "offline";
      state.error = "未连接数据库";
      forgetAccount();
      return Promise.resolve(state.status);
    }
    return request(settings().healthPath || "/api/health").then(function (health) {
      if (health.networkError || health.status !== 200 || !health.data || health.data.ok !== true) {
        state.status = "offline";
        state.error = "未连接数据库";
        forgetAccount();
        return state.status;
      }
      return request("/api/me").then(function (result) {
        if (result.status === 200 && result.data) { applyMe(result.data); return state.status; }
        if (result.status === 401) { state.status = "guest"; forgetAccount(); state.error = ""; return state.status; }
        state.status = "offline";
        state.error = errorMessage(result, "未连接数据库");
        forgetAccount();
        return state.status;
      });
    });
  }

  function authenticate(path, username, password) {
    state.busy = true;
    state.error = "";
    if (isFileProtocol()) {
      state.busy = false;
      state.status = "offline";
      state.error = "未连接数据库";
      return Promise.resolve({ ok: false, error: state.error });
    }
    return request(path, { method: "POST", body: { username: username, password: password } }).then(function (result) {
      state.busy = false;
      if (result.status === 200 || result.status === 201) {
        return load().then(function () { return { ok: state.status === "ready" }; });
      }
      if (result.networkError) {
        state.status = "offline";
        state.error = "未连接数据库";
        forgetAccount();
        return { ok: false, error: state.error };
      }
      state.error = errorMessage(result, "操作失败");
      return { ok: false, error: state.error, status: result.status };
    });
  }

  function login(username, password) { return authenticate("/api/auth/login", username, password); }
  function register(username, password) { return authenticate("/api/auth/register", username, password); }

  function logout() {
    state.busy = true;
    return request("/api/auth/logout", { method: "POST" }).then(function () {
      state.busy = false;
      state.lastReportSaved = false;
      forgetAccount();
      if (state.status !== "offline") state.status = "guest";
      return { ok: true };
    });
  }

  function removeAccount(password) {
    state.busy = true;
    state.error = "";
    return request("/api/me", { method: "DELETE", body: { password: password } }).then(function (result) {
      state.busy = false;
      if (result.status === 204) {
        state.lastReportSaved = false;
        forgetAccount();
        if (state.status !== "offline") state.status = "guest";
        return { ok: true };
      }
      if (result.networkError) state.status = "offline";
      state.error = errorMessage(result, "删除失败");
      return { ok: false, error: state.error, status: result.status };
    });
  }

  function recordOf(levelId) { return state.progress[String(levelId)] || null; }

  function optimisticReport(levelId, stats, target) {
    var key = String(levelId);
    var row = target[key];
    row = {
      levelId: levelId,
      completed: !!(row && row.completed),
      completedAt: row ? row.completedAt : null,
      bestTime: row ? row.bestTime : null,
      bestKills: row ? row.bestKills : null,
      attempts: (row && row.attempts ? row.attempts : 0) + 1,
      wins: row && row.wins ? row.wins : 0
    };
    if (stats.win) {
      row.completed = true;
      row.wins += 1;
      if (!row.completedAt) row.completedAt = new Date().toISOString();
      if (stats.time !== undefined && stats.time !== null && (row.bestTime === null || stats.time < row.bestTime)) row.bestTime = stats.time;
      if (stats.kills !== undefined && stats.kills !== null && (row.bestKills === null || stats.kills > row.bestKills)) row.bestKills = stats.kills;
    }
    target[key] = row;
  }

  function reportRun(levelId, stats) {
    stats = stats || {};
    if (state.status !== "ready") {
      optimisticReport(levelId, stats, state.sessionProgress);
      state.lastReportSaved = false;
      state.lastReportReason = state.status === "offline" ? "未连接数据库" : "未登录";
      return Promise.resolve({ ok: false, reason: state.status });
    }
    optimisticReport(levelId, stats, state.progress);
    state.lastReportSaved = true;
    state.lastReportReason = "";
    state.pendingWrites += 1;
    return request("/api/me/progress", {
      method: "POST",
      body: { levelId: levelId, time: stats.time, kills: stats.kills, win: !!stats.win }
    }).then(function (result) {
      state.pendingWrites -= 1;
      if (result.status === 200 && result.data && result.data.level) {
        state.progress[String(levelId)] = result.data.level;
        return { ok: true };
      }
      state.lastReportSaved = false;
      if (result.networkError) { state.status = "offline"; state.lastReportReason = "未连接数据库"; }
      else if (result.status === 401) { state.status = "guest"; forgetAccount(); state.lastReportReason = "登录已过期"; }
      else state.lastReportReason = errorMessage(result, "保存失败");
      return { ok: false, status: result.status };
    });
  }

  function addResource(resourceId, delta) {
    if (state.status !== "ready") return Promise.resolve({ ok: false });
    return request("/api/me/resources", { method: "POST", body: { resourceId: resourceId, delta: delta } }).then(function (result) {
      if (result.status === 200 && result.data && result.data.resources) {
        applyResources(result.data.resources);
        return { ok: true };
      }
      return { ok: false, status: result.status };
    });
  }

  function claimRewards(levelId, level, win) {
    if (state.status !== "ready") return Promise.resolve({ ok: false, reason: state.status, error: statusNote() });
    return request("/api/me/rewards", { method: "POST", body: { levelId: levelId, level: level, win: !!win } }).then(function (result) {
      if (result.status === 200 && result.data && result.data.rewards) {
        applyResources(result.data.resources || {});
        state.equipment = result.data.equipment || state.equipment;
        state.equipmentBag = result.data.equipmentBag || [];
        state.gems = result.data.gems || [];
        if (Game.equipment) { Game.equipment.applyAccount(state.equipment); Game.equipment.applyBag(state.equipmentBag); }
        if (Game.gems) Game.gems.applyAccount(state.gems);
        return { ok: true, tier: result.data.tier, rewards: result.data.rewards };
      }
      if (result.status === 401) {
        state.status = "guest";
        forgetAccount();
        return { ok: false, reason: "guest", error: "登录已过期" };
      }
      if (result.networkError) {
        state.status = "offline";
        return { ok: false, reason: "offline", error: "未连接数据库" };
      }
      return { ok: false, error: errorMessage(result, "奖励领取失败"), status: result.status };
    }, function () {
      state.status = "offline";
      return { ok: false, reason: "offline", error: "未连接数据库" };
    });
  }

  function equipEquipment(itemId) {
    if (state.status !== "ready") return Promise.resolve({ ok: false, error: "登录后才能换装" });
    if (state.equipmentBagBusy) return Promise.resolve({ ok: false, error: "正在换装" });
    state.equipmentBagBusy = true;
    state.equipmentBagError = "";
    state.equipmentBagNotice = "";
    return request("/api/me/equipment/equip", { method: "POST", body: { itemId: itemId } }).then(function (result) {
      state.equipmentBagBusy = false;
      if (result.status === 200 && result.data && result.data.equipment) {
        state.equipment = result.data.equipment;
        state.equipmentBag = result.data.equipmentBag || [];
        if (Game.equipment) { Game.equipment.applyAccount(state.equipment); Game.equipment.applyBag(state.equipmentBag); }
        var slot = (C.equipment.slots || []).filter(function (entry) { return entry.id === result.data.slotId; })[0];
        var element = C.elements[result.data.element];
        state.equipmentBagNotice = "已换装：" + (slot ? slot.name : "装备") + (element ? " · " + element.name : "");
        return { ok: true, slotId: result.data.slotId, element: result.data.element };
      }
      if (result.status === 401) {
        state.status = "guest";
        forgetAccount();
        state.equipmentBagError = "登录已过期";
        return { ok: false, error: state.equipmentBagError, status: 401 };
      }
      state.equipmentBagError = errorMessage(result, result.networkError ? "未连接数据库" : "换装失败");
      return { ok: false, error: state.equipmentBagError, status: result.status };
    }, function () {
      state.equipmentBagBusy = false;
      state.equipmentBagError = "未连接数据库";
      return { ok: false, error: state.equipmentBagError };
    });
  }

  function upgradeEquipment(slotId) {
    if (state.status !== "ready") return Promise.resolve({ ok: false, error: "登录后才能强化装备" });
    if (state.equipmentBusy) return Promise.resolve({ ok: false, error: "正在强化装备" });
    state.equipmentBusy = true;
    state.equipmentBusySlot = slotId;
    state.equipmentError = "";
    state.equipmentNotice = "";
    return request("/api/me/equipment/upgrade", { method: "POST", body: { slotId: slotId } }).then(function (result) {
      state.equipmentBusy = false;
      state.equipmentBusySlot = null;
      if (result.status === 200 && result.data && result.data.equipment) {
        state.equipment = result.data.equipment;
        applyResources(result.data.resources || {});
        state.equipmentNotice = "强化成功 · Lv." + (result.data.level || 0);
        if (Game.equipment) Game.equipment.applyAccount(state.equipment);
        return { ok: true, level: result.data.level, slotId: result.data.slotId };
      }
      if (result.status === 401) {
        state.status = "guest";
        forgetAccount();
        state.equipmentError = "登录已过期";
        return { ok: false, error: state.equipmentError, status: 401 };
      }
      state.equipmentError = errorMessage(result, result.networkError ? "未连接数据库" : "强化失败");
      return { ok: false, error: state.equipmentError, status: result.status };
    }, function () {
      state.equipmentBusy = false;
      state.equipmentBusySlot = null;
      state.equipmentError = "未连接数据库";
      return { ok: false, error: state.equipmentError };
    });
  }

  function upgradeWall(action) {
    if (state.status !== "ready") return Promise.resolve({ ok: false, error: "登录后才能强化城墙" });
    if (state.wallBusy) return Promise.resolve({ ok: false, error: "正在处理城墙操作" });
    state.wallBusy = true;
    state.wallAction = action;
    state.wallError = "";
    state.wallNotice = "";
    return request("/api/me/wall/upgrade", { method: "POST", body: { action: action } }).then(function (result) {
      state.wallBusy = false;
      state.wallAction = null;
      if (result.status === 200 && result.data && result.data.wall) {
        state.wall = result.data.wall;
        applyResources(result.data.resources || {});
        state.wallNotice = action === "breakthrough" ? "稀土突破成功" : "城墙升级成功 · Lv." + (result.data.level || 0);
        if (Game.wall) Game.wall.applyAccount(state.wall);
        return { ok: true, action: action, level: result.data.level, breakthroughs: result.data.breakthroughs };
      }
      if (result.status === 401) {
        state.status = "guest";
        forgetAccount();
        state.wallError = "登录已过期";
        return { ok: false, error: state.wallError, status: 401 };
      }
      state.wallError = errorMessage(result, result.networkError ? "未连接数据库" : "城墙操作失败");
      return { ok: false, error: state.wallError, status: result.status };
    }, function () {
      state.wallBusy = false;
      state.wallAction = null;
      state.wallError = "未连接数据库";
      return { ok: false, error: state.wallError };
    });
  }

  function runGemAction(action, path, body, notice) {
    if (state.status !== "ready") return Promise.resolve({ ok: false, error: "登录后才能管理宝石" });
    if (state.gemBusy) return Promise.resolve({ ok: false, error: "正在处理宝石" });
    state.gemBusy = true;
    state.gemAction = action;
    state.gemError = "";
    state.gemNotice = "";
    return request(path, { method: "POST", body: body }).then(function (result) {
      state.gemBusy = false;
      state.gemAction = null;
      if (result.status === 200 && result.data && result.data.gems) {
        state.gems = result.data.gems;
        if (Game.gems) Game.gems.applyAccount(state.gems);
        state.gemNotice = notice(result.data);
        return { ok: true, data: result.data };
      }
      if (result.status === 401) {
        state.status = "guest";
        forgetAccount();
        state.gemError = "登录已过期";
        return { ok: false, error: state.gemError, status: 401 };
      }
      state.gemError = errorMessage(result, result.networkError ? "未连接数据库" : "宝石操作失败");
      return { ok: false, error: state.gemError, status: result.status };
    }, function () {
      state.gemBusy = false;
      state.gemAction = null;
      state.gemError = "未连接数据库";
      return { ok: false, error: state.gemError };
    });
  }

  function socketGem(gemId, slotIndex) {
    return runGemAction("socket", "/api/me/gems/socket", { gemId: gemId, slotIndex: slotIndex === undefined ? null : slotIndex }, function (data) {
      return data && data.replacedId ? "已替换宝石" : "宝石已镶嵌";
    });
  }

  function unsocketGem(gemId) {
    return runGemAction("unsocket", "/api/me/gems/unsocket", { gemId: gemId }, function () { return "宝石已卸下"; });
  }

  function synthesizeGems(partId, quality) {
    return runGemAction("synthesize", "/api/me/gems/synthesize", { partId: partId, quality: quality }, function (data) {
      var info = C.gems.qualities[data.gem ? data.gem.quality : quality + 1];
      return "合成成功 · " + (info ? info.name : "新宝石");
    });
  }

  function synthesizeAllGems() {
    return runGemAction("synthesize", "/api/me/gems/synthesize-all", {}, function (data) {
      var count = data && data.synthesized ? data.synthesized : 0;
      return "一键合成完成 · 获得 " + count + " 颗";
    });
  }

  function toggleGemLock(gemId, locked) {
    return runGemAction("lock", "/api/me/gems/lock", { gemId: gemId, locked: !!locked }, function () {
      return locked ? "宝石已锁定" : "宝石已解锁";
    });
  }

  function completedMap() {
    var map = {};
    if (state.status !== "ready") {
      var legacy = readLegacy();
      Object.keys(legacy).forEach(function (id) { if (legacy[id]) map[id] = true; });
      Object.keys(state.sessionProgress).forEach(function (id) {
        if (state.sessionProgress[id] && state.sessionProgress[id].completed) map[id] = true;
      });
    }
    Object.keys(state.progress).forEach(function (id) {
      if (state.progress[id] && state.progress[id].completed) map[id] = true;
    });
    return map;
  }

  function completedCount() { return Object.keys(completedMap()).length; }

  function resourceList() {
    var list = [];
    (C.resources || []).forEach(function (item) {
      list.push({
        id: item.id,
        name: item.name,
        color: item.color,
        description: item.description || "",
        usage: item.usage || "",
        source: item.source || "",
        amount: state.resources[item.id] || 0
      });
    });
    return list;
  }

  function levelRecords() {
    var list = [];
    Object.keys(state.progress).forEach(function (id) { list.push(state.progress[id]); });
    list.sort(function (a, b) { return a.levelId - b.levelId; });
    return list.filter(function (row) { return row.attempts > 0 || row.completed; });
  }

  function totals() {
    var wins = 0, attempts = 0;
    levelRecords().forEach(function (row) { wins += row.wins || 0; attempts += row.attempts || 0; });
    return { wins: wins, attempts: attempts };
  }

  function pendingLegacy() {
    var legacy = readLegacy(), keys = Object.keys(legacy), pending = [];
    keys.forEach(function (id) {
      if (!legacy[id]) return;
      if (Game.isLevelCompleted(Number(id))) return;
      pending.push(Number(id));
    });
    return pending;
  }

  function importLegacy() {
    var pending = pendingLegacy();
    if (!pending.length || state.status !== "ready") return Promise.resolve({ ok: false, count: 0 });
    var chain = Promise.resolve(), imported = 0;
    pending.forEach(function (levelId) {
      chain = chain.then(function () {
        return request("/api/me/progress", { method: "POST", body: { levelId: levelId, win: true } }).then(function (result) {
          if (result.status === 200 && result.data && result.data.level) {
            state.progress[String(levelId)] = result.data.level;
            imported += 1;
          }
        });
      });
    });
    return chain.then(function () {
      state.notice = imported ? "已导入 " + imported + " 关旧进度" : "没有可导入的旧进度";
      return { ok: true, count: imported };
    });
  }

  function statusLabel() {
    if (state.status === "ready" && state.account) return state.account.username;
    if (state.status === "offline") return "离线";
    return "未登录";
  }

  function statusNote() {
    if (state.status === "offline") return "未连接数据库 · 本局进度不会保存";
    if (state.status === "guest") return "未登录 · 进度不会保存";
    if (state.status === "loading") return "正在连接账户服务…";
    return "";
  }

  Game.accounts = {
    state: state,
    load: load,
    login: login,
    register: register,
    logout: logout,
    removeAccount: removeAccount,
    reportRun: reportRun,
    addResource: addResource,
    claimRewards: claimRewards,
    applyResources: applyResources,
    upgradeEquipment: upgradeEquipment,
    getEquipment: function () { return state.equipment; },
    equipEquipment: equipEquipment,
    getEquipmentBag: function () { return state.equipmentBag; },
    upgradeWall: upgradeWall,
    getWall: function () { return state.wall; },
    socketGem: socketGem,
    unsocketGem: unsocketGem,
    synthesizeGems: synthesizeGems,
    synthesizeAllGems: synthesizeAllGems,
    toggleGemLock: toggleGemLock,
    getGems: function () { return state.gems; },
    getProgress: function () { return { completed: completedMap() }; },
    isCompleted: function (levelId) { return !!completedMap()[levelId]; },
    getRecord: recordOf,
    getCompletedCount: completedCount,
    getResources: function () {
      var result = {};
      resourceList().forEach(function (item) { result[item.id] = item.amount; });
      return result;
    },
    getResourceList: resourceList,
    getLevelRecords: levelRecords,
    getTotals: totals,
    getPendingLegacy: pendingLegacy,
    importLegacy: importLegacy,
    getStatus: function () { return state.status; },
    getStatusLabel: statusLabel,
    getStatusNote: statusNote,
    getUsername: function () { return state.account ? state.account.username : ""; },
    getCreatedAt: function () { return state.account ? state.account.createdAt : null; }
  };
})(window.Game = window.Game || {});
