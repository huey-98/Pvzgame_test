/* 角色属性层：基础值 + 外部修正，计算最终战斗属性。 */
(function (Game) {
  "use strict";
  var C = Game.config;

  var modifiers = {};
  var gemModifiers = {};
  var skillModifiers = {};
  var wallHpExtra = 0;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function finite(value) { return typeof value === "number" && isFinite(value) ? value : 0; }

  function compute() {
    var base = C.attributes.base, caps = C.attributes.caps, mod = modifiers || {}, gem = gemModifiers || {}, skill = skillModifiers || {};
    var attack = Math.max(0, base.attack + finite(mod.attack) + finite(gem.attack));
    var elements = {};
    Object.keys(base.elementAttack).forEach(function (id) {
      var extra = mod.elementAttack ? finite(mod.elementAttack[id]) : 0;
      var gemExtra = gem.elementAttack ? finite(gem.elementAttack[id]) : 0;
      elements[id] = Math.max(0, base.elementAttack[id] + extra + gemExtra);
    });
    var cooldown = clamp(base.cooldownReduction + finite(mod.cooldownReduction) + finite(gem.cooldownReduction), 0, caps.cooldownReduction);
    var wallBonus = Math.max(0, base.wallHpBonus + finite(mod.wallHpBonus) + finite(gem.wallHpBonus) + finite(wallHpExtra));
    var crit = clamp(base.critRate + finite(mod.critRate) + finite(gem.critRate) + finite(skill.critRate), 0, caps.critRate);
    var critDamage = clamp(base.critDamage + finite(mod.critDamage) + finite(gem.critDamage), 1, caps.critDamage);
    var status = clamp(base.statusDurationMultiplier + finite(mod.statusDurationMultiplier) + finite(gem.statusDurationMultiplier), 1, caps.statusDurationMultiplier);
    return {
      attack: attack,
      elementAttack: elements,
      cooldownReduction: cooldown,
      wallHpBonus: wallBonus,
      wallMaxHp: Math.max(1, C.wallMaxHp + wallBonus),
      critRate: crit,
      critDamage: critDamage,
      statusDurationMultiplier: status
    };
  }

  var current = compute();

  function snapshot() {
    var copy = {}, elements = {};
    Object.keys(current.elementAttack).forEach(function (id) { elements[id] = current.elementAttack[id]; });
    Object.keys(current).forEach(function (key) { if (key !== "elementAttack") copy[key] = current[key]; });
    copy.elementAttack = elements;
    return copy;
  }

  Game.attributes = {
    get: snapshot,
    setModifiers: function (mods) {
      modifiers = mods && typeof mods === "object" ? mods : {};
      current = compute();
    },
    clearModifiers: function () {
      modifiers = {};
      current = compute();
    },
    setGemModifiers: function (mods) {
      gemModifiers = mods && typeof mods === "object" ? mods : {};
      current = compute();
    },
    clearGemModifiers: function () {
      gemModifiers = {};
      current = compute();
    },
    setSkillModifiers: function (mods) {
      skillModifiers = mods && typeof mods === "object" ? mods : {};
      current = compute();
    },
    clearSkillModifiers: function () {
      skillModifiers = {};
      current = compute();
    },
    setWallHpBonus: function (value) {
      wallHpExtra = Math.max(0, finite(value));
      current = compute();
    },
    getWallHpBonus: function () { return wallHpExtra; },
    applyPlayer: function (p) {
      if (!p) return;
      p.attackMultiplier = current.attack / 100;
      p.cooldownRate = 1 / (1 - current.cooldownReduction);
      p.statusDurationMultiplier = current.statusDurationMultiplier;
      p.elementMultipliers = {};
      Object.keys(current.elementAttack).forEach(function (id) { p.elementMultipliers[id] = current.elementAttack[id] / 100; });
      p.crit = current.critRate;
      p.critDamage = current.critDamage;
    },
    applyWall: function (wall) {
      if (!wall) return;
      wall.maxHp = current.wallMaxHp;
      wall.hp = wall.maxHp;
    },
    getAttackMultiplier: function () { return current.attack / 100; },
    getCooldownRate: function () { return 1 / (1 - current.cooldownReduction); },
    getStatusDurationMultiplier: function () { return current.statusDurationMultiplier; },
    getElementMultiplier: function (id) { return current.elementAttack[id] === undefined ? 1 : current.elementAttack[id] / 100; },
    getSkillCritBonus: function () { return finite(skillModifiers.critRate); }
  };
})(window.Game = window.Game || {});
