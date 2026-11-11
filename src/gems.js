/* 宝石层：部位槽位、背包词条与属性修正。 */
(function (Game) {
  "use strict";
  var C = Game.config;

  var state = { data: null };

  function finite(value) { return typeof value === "number" && isFinite(value) ? value : 0; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function partIds() {
    var ids = {};
    (C.equipment.slots || []).forEach(function (slot) { ids[slot.id] = true; });
    return ids;
  }

  function normalizeAffix(raw) {
    if (!raw || typeof raw !== "object") return null;
    var kind = String(raw.kind || ""), name = String(raw.name || ""), id = String(raw.id || "");
    if (!kind || !name || !id) return null;
    var element = null;
    if (kind === "elementAttack") {
      element = String(raw.element || "");
      if (!C.elements[element]) return null;
    }
    return {
      id: id,
      kind: kind,
      element: element,
      name: name,
      value: finite(raw.value),
      percent: !!raw.percent,
      text: String(raw.text || (name + " +" + finite(raw.value)))
    };
  }

  function normalize(data) {
    if (Object.prototype.toString.call(data) !== "[object Array]") return [];
    var validParts = partIds(), used = {}, out = [];
    data.forEach(function (row) {
      if (!row || typeof row !== "object") return;
      var partId = String(row.partId || "");
      if (!validParts[partId]) return;
      var quality = Math.round(finite(row.quality));
      if (quality < 0 || quality > C.gems.maxQuality) return;
      var affix = normalizeAffix(row.affix);
      if (!affix) return;
      var slot = row.slotIndex;
      if (slot !== null && slot !== undefined) {
        slot = Math.round(finite(slot));
        if (slot < 0 || slot >= C.gems.socketsPerPart) slot = null;
      } else slot = null;
      if (slot !== null) {
        var key = partId + ":" + slot;
        if (used[key]) slot = null;
        else used[key] = true;
      }
      out.push({
        id: Math.max(0, Math.round(finite(row.id))),
        partId: partId,
        quality: quality,
        slotIndex: slot,
        locked: !!row.locked,
        affix: affix
      });
    });
    return out;
  }

  function qualities() { return C.gems.qualities || []; }
  function qualityInfo(value) { return qualities()[clamp(Math.round(finite(value)), 0, C.gems.maxQuality)] || qualities()[0]; }

  function decorate(gem) {
    var info = qualityInfo(gem.quality);
    return {
      id: gem.id,
      partId: gem.partId,
      quality: gem.quality,
      qualityName: info.name,
      qualityShort: info.short,
      color: info.color,
      slotIndex: gem.slotIndex,
      locked: gem.locked,
      affix: gem.affix
    };
  }

  function getAll() { return state.data || []; }

  function getPart(partId) {
    var part = (C.equipment.slots || []).filter(function (slot) { return slot.id === partId; })[0] || C.equipment.slots[0];
    var id = part ? part.id : "arm";
    var sockets = [], counts = [], inventory = [], socketed = 0, locked = 0, i;
    for (i = 0; i < C.gems.socketsPerPart; i++) sockets.push(null);
    for (i = 0; i <= C.gems.maxQuality; i++) counts.push(0);
    getAll().forEach(function (gem) {
      if (gem.partId !== id) return;
      if (gem.locked) locked++;
      if (gem.slotIndex !== null) {
        sockets[gem.slotIndex] = decorate(gem);
        socketed++;
      } else {
        counts[gem.quality]++;
        inventory.push(decorate(gem));
      }
    });
    inventory.sort(function (a, b) {
      if (a.quality !== b.quality) return b.quality - a.quality;
      return a.id - b.id;
    });
    return {
      partId: id,
      name: part ? part.name : "手臂",
      short: part ? part.short : "臂",
      color: part ? part.color : C.colors.cyan,
      sockets: sockets,
      inventory: inventory,
      counts: counts,
      socketedCount: socketed,
      lockedCount: locked,
      capacity: C.gems.socketsPerPart,
      canSocket: socketed < C.gems.socketsPerPart
    };
  }

  function getSocket(partId, slotIndex) {
    var part = getPart(partId);
    if (slotIndex < 0 || slotIndex >= part.sockets.length) return null;
    return part.sockets[slotIndex];
  }

  function getBag() {
    var order = {}, rows = [];
    (C.equipment.slots || []).forEach(function (slot, index) { order[slot.id] = index; });
    getAll().forEach(function (gem) {
      if (gem.slotIndex !== null) return;
      rows.push(decorate(gem));
    });
    rows.sort(function (a, b) {
      if (a.quality !== b.quality) return b.quality - a.quality;
      var left = order[a.partId] === undefined ? 99 : order[a.partId];
      var right = order[b.partId] === undefined ? 99 : order[b.partId];
      if (left !== right) return left - right;
      return a.id - b.id;
    });
    return rows;
  }

  function getSynthesisPlan() {
    var plan = [], parts = C.equipment.slots || [];
    parts.forEach(function (part) {
      for (var quality = 0; quality < C.gems.maxQuality; quality++) {
        var pool = getAll().filter(function (gem) {
          return gem.partId === part.id && gem.quality === quality && gem.slotIndex === null && !gem.locked;
        }).sort(function (a, b) { return a.id - b.id; });
        for (var start = 0; start + C.gems.synthesisCost <= pool.length; start += C.gems.synthesisCost) {
          var resultQuality = quality + 1;
          plan.push({
            partId: part.id,
            partName: part.name,
            partShort: part.short,
            partColor: part.color,
            quality: quality,
            qualityName: C.gems.qualities[quality].name,
            qualityShort: C.gems.qualities[quality].short,
            color: C.gems.qualities[quality].color,
            resultQuality: resultQuality,
            resultName: C.gems.qualities[resultQuality].name,
            resultShort: C.gems.qualities[resultQuality].short,
            resultColor: C.gems.qualities[resultQuality].color,
            gems: pool.slice(start, start + C.gems.synthesisCost).map(decorate)
          });
        }
      }
    });
    return plan;
  }

  function getSynthesisSummary() {
    var plan = getSynthesisPlan(), locked = 0;
    getAll().forEach(function (gem) { if (gem.locked) locked++; });
    return { recipes: plan.length, gems: plan.length * C.gems.synthesisCost, locked: locked };
  }

  function findGem(gemId) {
    var found = null;
    getAll().forEach(function (gem) { if (gem.id === gemId) found = decorate(gem); });
    return found;
  }

  function socketedOf(partId) {
    var list = [];
    getAll().forEach(function (gem) {
      if (gem.partId === partId && gem.slotIndex !== null) list.push(decorate(gem));
    });
    return list;
  }

  function planSocket(gemId) {
    var gem = findGem(gemId), sockets, used = [], duplicate = null, free = -1, index;
    if (!gem) return { ok: false, mode: "missing", slotIndex: null, replacedId: null, message: "宝石不存在" };
    if (gem.slotIndex !== null) return { ok: false, mode: "socketed", slotIndex: gem.slotIndex, replacedId: null, message: "宝石已镶嵌" };
    sockets = socketedOf(gem.partId);
    for (index = 0; index < C.gems.socketsPerPart; index++) used.push(false);
    sockets.forEach(function (item) {
      used[item.slotIndex] = true;
      if (item.affix.id === gem.affix.id) duplicate = item;
    });
    for (index = 0; index < C.gems.socketsPerPart; index++) {
      if (!used[index]) { free = index; break; }
    }
    if (duplicate) {
      if (gem.quality > duplicate.quality) {
        return { ok: true, mode: "replace", slotIndex: duplicate.slotIndex, replacedId: duplicate.id, message: "将替换同词条的" + duplicate.qualityName + "宝石" };
      }
      return { ok: false, mode: "blocked", slotIndex: duplicate.slotIndex, replacedId: duplicate.id, message: "已镶嵌同词条宝石，需要更高品质" };
    }
    if (free >= 0) return { ok: true, mode: "place", slotIndex: free, replacedId: null, message: "可镶嵌到空槽 " + (free + 1) };
    return { ok: true, mode: "pick", slotIndex: null, replacedId: null, message: "宝石槽已满，请选择要替换的宝石" };
  }

  function emptyTotals() {
    var elements = {};
    Object.keys(C.elements).forEach(function (id) { elements[id] = 0; });
    return {
      attack: 0,
      elementAttack: elements,
      cooldownReduction: 0,
      wallHpBonus: 0,
      critRate: 0,
      critDamage: 0,
      statusDurationMultiplier: 0,
      wallBlockCharges: 0,
      eliteDamage: 0,
      debuffDamage: 0,
      rifleDamage: 0,
      lowWallDamage: 0
    };
  }

  function getTotals() {
    var totals = emptyTotals(), socketed = false;
    getAll().forEach(function (gem) {
      if (gem.slotIndex === null) return;
      socketed = true;
      var kind = gem.affix.kind, value = finite(gem.affix.value);
      if (kind === "attack") totals.attack += value;
      else if (kind === "elementAttack" && totals.elementAttack[gem.affix.element] !== undefined) totals.elementAttack[gem.affix.element] += value;
      else if (kind === "cooldownReduction") totals.cooldownReduction += value;
      else if (kind === "wallHpBonus") totals.wallHpBonus += value;
      else if (kind === "critRate") totals.critRate += value;
      else if (kind === "critDamage") totals.critDamage += value;
      else if (kind === "statusDurationMultiplier") totals.statusDurationMultiplier += value;
      else if (kind === "wallBlock") totals.wallBlockCharges += value;
      else if (kind === "eliteDamage") totals.eliteDamage += value;
      else if (kind === "debuffDamage") totals.debuffDamage += value;
      else if (kind === "rifleDamage") totals.rifleDamage += value;
      else if (kind === "lowWallDamage") totals.lowWallDamage += value;
    });
    totals.socketed = socketed;
    return totals;
  }

  function applyModifiers() {
    if (!Game.attributes) return;
    var totals = getTotals();
    if (totals.socketed) Game.attributes.setGemModifiers(totals);
    else Game.attributes.clearGemModifiers();
    if (Game.state && Game.state.player) Game.attributes.applyPlayer(Game.state.player);
  }

  function applyAccount(data) {
    state.data = normalize(data);
    applyModifiers();
  }

  function clear() {
    state.data = null;
    if (!Game.attributes) return;
    Game.attributes.clearGemModifiers();
    if (Game.state && Game.state.player) Game.attributes.applyPlayer(Game.state.player);
  }

  Game.gems = {
    state: state,
    applyAccount: applyAccount,
    clear: clear,
    getAll: getAll,
    getPart: getPart,
    getSocket: getSocket,
    getBag: getBag,
    getTotals: getTotals,
    getSynthesisPlan: getSynthesisPlan,
    getSynthesisSummary: getSynthesisSummary,
    findGem: findGem,
    planSocket: planSocket,
    qualityInfo: qualityInfo
  };
})(window.Game = window.Game || {});
