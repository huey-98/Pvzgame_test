/* 步枪账户养成层：只读限级与高级节点，不参与局内词条升级。 */
(function (Game) {
  "use strict";
  var C = Game.config;
  var level = 1;
  var milestones = {};

  function config() { return C.rifleProgress || {}; }
  function finite(value) { return typeof value === "number" && isFinite(value) ? value : 0; }
  function baseLevel() { return Math.max(1, Math.round(finite(config().baseLevel) || 1)); }
  function clampLevel(value) { return Math.max(baseLevel(), Math.round(finite(value) || baseLevel())); }
  function nodes() { return config().milestones || []; }

  function current() {
    return {
      level: level,
      damage: finite(config().baseDamage) + finite(config().damagePerLevel) * (level - baseLevel()),
      damagePerLevel: finite(config().damagePerLevel),
      blueprintId: config().blueprintId || "",
      cooldownRate: 1,
      fireRateScale: level >= 36 ? finite(config().fireRateScale) || 1 : 1,
      reloadScale: level >= 14 ? finite(config().reloadScale) || 1 : 1,
      bonusPierce: level >= 52 ? finite(config().bonusPierce) : 0
    };
  }

  function hasNode(node) { return level >= node; }
  function nextNode() {
    var list = nodes();
    for (var i = 0; i < list.length; i++) if (!hasNode(list[i])) return list[i];
    return null;
  }

  Game.rifleProgress = {
    applyAccount: function (payload) {
      var row = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
      level = clampLevel(row && row.level ? row.level : baseLevel());
      milestones = {};
      nodes().forEach(function (node) { milestones[node] = hasNode(node); });
    },
    clear: function () {
      level = baseLevel();
      milestones = {};
    },
    getLevel: function () { return level; },
    getView: function () {
      var view = current(), cost = null, next = nextNode();
      cost = {};
      cost.coin = finite(config().coinBase) + finite(config().coinPerLevel) * (level - baseLevel());
      if (view.blueprintId) cost[view.blueprintId] = finite(config().blueprintPerLevel) * (level - baseLevel() + 1);
      return {
        level: level,
        maxLevel: null,
        damage: view.damage,
        damagePerLevel: view.damagePerLevel,
        blueprintId: view.blueprintId,
        cooldownReduction: 0,
        critBonus: 0,
        nextCost: cost,
        milestones: nodes().map(function (node) {
          var trait = C.rifleProgressTraits && C.rifleProgressTraits[node] ? C.rifleProgressTraits[node] : {};
          return {
            level: node,
            name: trait.name || "步枪节点",
            detail: trait.detail || "",
            unlocked: hasNode(node)
          };
        }),
        nextMilestone: next
      };
    },
    getCombatSnapshot: function (forceLevelOne) {
      var snapshot = current();
      if (forceLevelOne) {
        level = baseLevel();
        snapshot = current();
        milestones = {};
      }
      snapshot.milestones = {};
      nodes().forEach(function (node) { snapshot.milestones[node] = hasNode(node); });
      return snapshot;
    }
  };
})(window.Game = window.Game || {});
