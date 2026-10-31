/* 技能养成数据层：只读账户技能等级，不修改局内词条等级。 */
(function (Game) {
  "use strict";
  var C = Game.config;
  var skills = {};

  function progressConfig() { return C.skillProgress || {}; }
  function finite(value) { return typeof value === "number" && isFinite(value) ? value : 0; }
  function clampLevel(value) { return Math.max(1, Math.min(progressConfig().maxLevel || 31, Math.round(finite(value) || 1))); }
  function definition(skillId) {
    return (C.coreSkills || []).filter(function (skill) { return skill.id === skillId; })[0] || null;
  }
  function currentOf(skillId) {
    var row = skills[skillId];
    if (row && typeof row === "object") return row;
    return { skillId: skillId, level: 1 };
  }
  function levelOf(skillId) { return clampLevel(currentOf(skillId).level); }
  function milestoneNodes() { return progressConfig().milestones || [2, 7, 12, 18, 22, 26]; }
  function hasMilestone(skillId, level) { return levelOf(skillId) >= Number(level); }
  function critBonusForLevel(level) {
    return (clampLevel(level) - 1) * (progressConfig().critPerLevel || .005);
  }
  function damageBonusForLevel(level) {
    return (clampLevel(level) - 1) * (progressConfig().damagePerLevel || .08);
  }
  function cooldownRateForLevel(level) {
    return Math.pow(1 - (progressConfig().cooldownPerLevel || .015), clampLevel(level) - 1);
  }
  function recalculateAttributes() {
    if (Game.attributes && Game.attributes.setSkillModifiers) {
      Game.attributes.setSkillModifiers({ critRate: getCritBonus() });
    }
  }
  function getCritBonus() {
    var order = progressConfig().order || [];
    return order.reduce(function (total, skillId) { return total + critBonusForLevel(levelOf(skillId)); }, 0);
  }
  function traitsFor(skillId) {
    var table = C.skillProgressTraits && C.skillProgressTraits[skillId] ? C.skillProgressTraits[skillId] : {};
    return milestoneNodes().map(function (node) {
      var trait = table[node] || {};
      return {
        level: node,
        name: trait.name || ("强化节点 " + node),
        detail: trait.detail || "",
        unlocked: hasMilestone(skillId, node)
      };
    });
  }
  function nextMilestone(skillId) {
    var level = levelOf(skillId);
    var nodes = milestoneNodes();
    for (var i = 0; i < nodes.length; i++) if (level < nodes[i]) return nodes[i];
    return null;
  }
  function getView(skillId) {
    var core = definition(skillId) || {}, row = currentOf(skillId), level = levelOf(skillId), maxLevel = progressConfig().maxLevel || 31;
    return {
      skillId: skillId,
      name: core.name || (row.name || skillId),
      icon: core.icon || "◈",
      color: core.color || "#68d8ff",
      element: core.element || "physical",
      level: level,
      maxLevel: maxLevel,
      blueprintId: progressConfig().blueprints ? progressConfig().blueprints[skillId] : "",
      critBonus: critBonusForLevel(level),
      damageBonus: damageBonusForLevel(level),
      cooldownReduction: 1 - cooldownRateForLevel(level),
      nextCost: row.nextCost || null,
      milestones: traitsFor(skillId),
      nextMilestone: nextMilestone(skillId)
    };
  }

  Game.skillProgress = {
    applyAccount: function (payload) {
      skills = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
      recalculateAttributes();
    },
    clear: function () {
      skills = {};
      recalculateAttributes();
    },
    get: function (skillId) { return currentOf(skillId); },
    getAll: function () {
      var order = progressConfig().order || [];
      return order.map(getView);
    },
    getLevel: levelOf,
    getCritBonus: getCritBonus,
    getDamageBonus: function (skillId) { return damageBonusForLevel(levelOf(skillId)); },
    getDamageScale: function (skillId) { return 1 + damageBonusForLevel(levelOf(skillId)); },
    getCooldownRate: function (skillId) { return cooldownRateForLevel(levelOf(skillId)); },
    getCooldownReduction: function (skillId) { return 1 - cooldownRateForLevel(levelOf(skillId)); },
    hasMilestone: hasMilestone,
    getView: getView,
    getCombatSnapshot: function (forceLevelOne) {
      var order = progressConfig().order || [], snapshot = {};
      order.forEach(function (skillId) {
        var level = forceLevelOne ? 1 : levelOf(skillId), milestones = {};
        milestoneNodes().forEach(function (node) { milestones[node] = level >= node; });
        snapshot[skillId] = { level: level, damageScale: 1 + damageBonusForLevel(level), cooldownRate: cooldownRateForLevel(level), milestones: milestones };
      });
      return snapshot;
    }
  };
})(window.Game = window.Game || {});
