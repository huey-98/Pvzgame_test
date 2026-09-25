/* 静态数据层：新增敌人、词条或波次时优先修改这里。 */
(function (Game) {
  "use strict";
  Game.config = {
    width: 360, height: 640, maxLevel: 10, rifleSideOffset: -6, muzzleDistance: 34, magazineCapacity: 35, reloadDuration: 2, spreadAngle: .2,
    sprites: {
      playerBody: { src: ["assets/player-man.png", "assets/player-body.png", "assets/man.png"], width: 74, height: 131, anchorX: 37, anchorY: 78 },
      playerRifle: { src: "assets/player-rifle.png", width: 18, height: 46, anchorX: 9, anchorY: 38, mountX: -6, mountY: -40 }
    },
    skillRing: { offsetX: 86, offsetY: -102 },
    colors: { bg: "#0b202c", text: "#f4f8fb", muted: "#9ab0bc", green: "#63e6a0", yellow: "#ffd166", red: "#ff6b6b", cyan: "#68d8ff", ice: "#58aaff", fire: "#ff9b52", purple: "#c9a1ff" },
    enemies: {
      normal: { name: "普通僵尸", codexCategory: "minion", description: "尸潮中的基础单位，生命与速度均衡，会持续向防线推进。", tactics: "优先利用自动锁定快速清理；单体威胁低，数量增加后会给城墙造成压力。", hp: 28, speed: 25, radius: 14, damage: 10, xp: 8, color: "#6eaa7b", accent: "#b1e4a0" },
      runner: { name: "快跑僵尸", codexCategory: "minion", description: "体型轻巧、生命较低，但移动速度明显快于普通僵尸。", tactics: "尽早击杀以免快速逼近城墙；齐射、连发和冰冻效果都能有效应对。", hp: 16, speed: 52, radius: 11, damage: 7, xp: 7, color: "#e5a052", accent: "#ffe0a7" },
      normalElite: { name: "普通僵尸精英", codexCategory: "elite", description: "普通僵尸的精英强化形态，体型更大，生命、移速和攻击力全面提升，仍以稳定推进为主要特性。", tactics: "精英单位更耐打且对城墙威胁更高，应集中火力尽早消灭。", hp: 420, speed: 32, radius: 22, damage: 20, xp: 35, color: "#647847", accent: "#ffd166" },
      runnerElite: { name: "快跑僵尸精英", codexCategory: "elite", description: "快跑僵尸的精英强化形态，保留高速冲锋特性，并拥有更大的体型、更高的生命和更强的攻击。", tactics: "速度与耐久兼备，出现后应优先集火；冰冻效果可以压制其推进速度。", hp: 300, speed: 68, radius: 19, damage: 16, xp: 30, color: "#a86735", accent: "#ffe08a" },
      boss: { name: "尸潮领主", codexCategory: "boss", description: "关卡首领，体型巨大、生命值极高；生命低于一半时进入狂暴状态，移动速度提升。", tactics: "持续输出并留意其接近城墙；燃烧、暴击与高伤害构筑有助于缩短战斗时间。", hp: 3000, speed: 12, radius: 34, damage: 24, xp: 100, color: "#9d5264", accent: "#ffb0bc" }
    },
    skillDefaults: {
      thermobaric: { unlocked: false, level: 0, fireInterval: 5, projectileSpeed: 250, projectileRadius: 8, impactDamage: 32, impactKnockback: 24, explosionDamage: 58, explosionRadius: 68, explosionKnockback: 42, burnDps: 10, burnDuration: 2.5, pierce: 0, burst: 0 },
      dryIce: { unlocked: false, level: 0, fireInterval: 4.2, projectileSpeed: 300, projectileRadius: 7, damage: 28, knockback: 12, pierce: 3, freezeDuration: 0, slowFactor: .58, splitCount: 0, spread: 0, burst: 0 }
    },
    traits: [
      { id: "damage", name: "增伤", rarity: "普通", max: 5, icon: "✦", desc: "子弹伤害 +25%", detail: "每级使所有步枪子弹伤害提高 25%，最高 5 级。稳定提升清理普通敌人和攻击首领的效率。", apply: function (p) { p.damage *= 1.25; } },
      { id: "burst", name: "连发", rarity: "普通", max: 3, icon: "➤", desc: "每次沿同一弹道连续发射 1 枚子弹", detail: "每级令每次攻击沿同一条弹道追加 1 颗子弹，最高 3 级；额外子弹不改变方向，连发整轮只消耗 1 发弹药。", apply: function (p) { p.burst += 1; } },
      { id: "firerate", name: "射速", rarity: "普通", max: 5, icon: "⚡", desc: "射击间隔 -15%", detail: "每级将步枪射击间隔缩短 15%，最高 5 级。提高持续输出频率，但弹匣耗尽时仍需完成换弹。", apply: function (p) { p.fireInterval *= .85; } },
      { id: "spread", name: "齐射", rarity: "稀有", max: 3, icon: "✣", desc: "每级增加 1 条分角弹道", detail: "每级增加 1 条同时发射的分角弹道，最高 3 级；相邻弹道角度间隔为 0.2 弧度，形成扇形覆盖。齐射整轮只消耗 1 发弹药。", apply: function (p) { p.spread += 1; } },
      { id: "pierce", name: "穿透", rarity: "稀有", max: 4, icon: "↠", desc: "子弹额外穿透 1 个敌人", detail: "每级令子弹额外穿过 1 个敌人，最高 4 级。适合沿同一方向聚集的尸潮。", apply: function (p) { p.pierce += 1; } },
      { id: "caliber", name: "大口径", rarity: "稀有", max: 3, icon: "●", desc: "子弹更大，伤害 +15%", detail: "每级令子弹半径增加 2，并使伤害提高 15%，最高 3 级；更容易命中，也能提升单发伤害。", apply: function (p) { p.bulletRadius += 2; p.damage *= 1.15; } },
      { id: "crit", name: "暴击", rarity: "普通", max: 5, icon: "♦", desc: "暴击率 +12%", detail: "每级增加 12% 暴击率，最高 5 级。暴击子弹造成基础伤害的 1.5 倍；可与弱点打击叠加。", apply: function (p) { p.crit += .12; } },
      { id: "weakpoint", name: "弱点打击", rarity: "稀有", max: 3, icon: "☄", desc: "暴击伤害 +50%", detail: "每级使暴击伤害倍率增加 0.5，最高 3 级。与暴击率配合时收益更高。", apply: function (p) { p.critDamage += .5; } },
      { id: "burn", name: "燃烧弹", rarity: "稀有", max: 3, icon: "♨", desc: "命中后附加持续伤害", detail: "将子弹切换为火焰属性，命中后施加持续燃烧；燃烧伤害和持续时间随等级提升，最高 3 级。", apply: function (p) { p.burn += 1; p.bulletType = "fire"; } },
      { id: "freeze", name: "冰冻弹", rarity: "稀有", max: 3, icon: "❄", desc: "命中后减缓敌人移动", detail: "将子弹切换为冰冻属性，命中后减缓敌人移动；减速持续时间随等级提升，最高 3 级。", apply: function (p) { p.freeze += .12; p.bulletType = "ice"; } }
    ],
    skillTraits: [
      { id: "unlockThermobaric", skillId: "thermobaric", unlocksSkill: true, name: "温压弹", rarity: "稀有", max: 1, icon: "♨", desc: "解锁温压弹技能", detail: "首次获取后解锁温压弹，技能槽显示 Lv1；之后可获取温压弹专属词条继续升级。", apply: function () {} },
      { id: "thermoBlast", skillId: "thermobaric", name: "爆炸增伤", rarity: "稀有", max: 5, icon: "✹", desc: "温压弹爆炸伤害 +25%", detail: "每级提升温压弹爆炸伤害 25%，最高 5 级；不影响命中时的冲击伤害。", apply: function (p) { p.skills.thermobaric.explosionDamage *= 1.25; } },
      { id: "thermoPierce", skillId: "thermobaric", name: "温压弹穿透", rarity: "稀有", max: 3, icon: "↠", desc: "温压弹穿透 +1", detail: "每级增加 1 次穿透；温压弹先对沿途目标造成冲击，穿透耗尽后再爆炸。", apply: function (p) { p.skills.thermobaric.pierce += 1; } },
      { id: "thermoBurst", skillId: "thermobaric", name: "温压弹连发", rarity: "稀有", max: 3, icon: "➤", desc: "每轮额外发射 1 颗温压弹", detail: "每级在一次温压弹攻击周期中追加 1 颗炮弹，沿相同方向依次发射，最高 3 级。", apply: function (p) { p.skills.thermobaric.burst += 1; } },
      { id: "thermoRadius", skillId: "thermobaric", name: "爆炸范围增大", rarity: "稀有", max: 3, icon: "◉", desc: "温压弹爆炸范围 +20%", detail: "每级扩大温压弹爆炸半径 20%，最高 3 级，可覆盖更密集的敌群。", apply: function (p) { p.skills.thermobaric.explosionRadius *= 1.2; } },
      { id: "thermoKnockback", skillId: "thermobaric", name: "击退强化", rarity: "稀有", max: 3, icon: "⇢", desc: "温压弹击退距离 +25%", detail: "每级强化温压弹命中冲击和爆炸冲击的击退距离 25%，最高 3 级。", apply: function (p) { p.skills.thermobaric.impactKnockback *= 1.25; p.skills.thermobaric.explosionKnockback *= 1.25; } },
      { id: "thermoImpact", skillId: "thermobaric", name: "冲击伤害增加", rarity: "稀有", max: 5, icon: "✦", desc: "温压弹冲击伤害 +25%", detail: "每级提升温压弹炮弹直接命中的冲击伤害 25%，最高 5 级；爆炸伤害由爆炸增伤强化。", apply: function (p) { p.skills.thermobaric.impactDamage *= 1.25; } },
      { id: "unlockDryIce", skillId: "dryIce", unlocksSkill: true, name: "干冰弹", rarity: "稀有", max: 1, icon: "❄", desc: "解锁干冰弹技能", detail: "首次获取后解锁干冰弹，技能槽显示 Lv1；之后可获取干冰弹专属词条继续升级。", apply: function () {} },
      { id: "iceFreeze", skillId: "dryIce", name: "冰冻", rarity: "稀有", max: 4, icon: "❄", desc: "干冰弹命中后减速", detail: "命中后冻结敌人移动，每级增加减速持续时间并增强减速效果，最高 4 级。", apply: function (p) { var skill = p.skills.dryIce; skill.freezeDuration += .55; skill.slowFactor = Math.max(.25, skill.slowFactor - .06); } },
      { id: "iceDamage", skillId: "dryIce", name: "干冰弹增伤", rarity: "稀有", max: 5, icon: "✦", desc: "干冰弹伤害 +25%", detail: "每级提升干冰弹及其分裂冰弹的命中伤害 25%，最高 5 级。", apply: function (p) { p.skills.dryIce.damage *= 1.25; } },
      { id: "icePierce", skillId: "dryIce", name: "干冰弹穿透", rarity: "稀有", max: 4, icon: "↠", desc: "干冰弹穿透 +1", detail: "每级增加 1 次额外穿透；基础干冰弹已可穿透 3 次。", apply: function (p) { p.skills.dryIce.pierce += 1; } },
      { id: "iceSplit", skillId: "dryIce", name: "分裂小冰弹", rarity: "稀有", max: 3, icon: "❄", desc: "干冰弹命中后分裂", detail: "干冰弹首次命中后分裂出 2 枚小冰弹，每级再增加 2 枚，最高 3 级；小冰弹造成部分伤害。", apply: function (p) { p.skills.dryIce.splitCount += 2; } },
      { id: "iceSpread", skillId: "dryIce", name: "干冰弹齐射", rarity: "稀有", max: 3, icon: "✣", desc: "每级增加 1 枚分角干冰弹", detail: "每级增加 1 枚同时发射的干冰弹，角度分开形成扇形覆盖，最高 3 级。", apply: function (p) { p.skills.dryIce.spread += 1; } },
      { id: "iceBurst", skillId: "dryIce", name: "干冰弹连发", rarity: "稀有", max: 3, icon: "➤", desc: "每轮额外发射 1 枚干冰弹", detail: "每级在一次干冰弹攻击周期中沿锁定方向追加 1 轮发射，最高 3 级。", apply: function (p) { p.skills.dryIce.burst += 1; } }
    ],
    coreSkills: [
      { id: "bombardment", name: "区域轰炸", icon: "✹", status: "筹备中", detail: "呼叫指定区域的连续炮击，对范围内敌人造成多段伤害。计划支持强化爆炸范围、落弹数量与伤害，尚未接入战斗。" },
      { id: "thermobaric", name: "温压弹", icon: "♨", status: "已实装", detail: "幻形自动发射红色炮弹。命中后造成冲击伤害与击退，穿透耗尽后发生范围爆炸，对范围内敌人造成爆炸伤害并施加燃烧。" },
      { id: "dryIce", name: "干冰弹", icon: "❄", status: "已实装", detail: "幻形自动发射蓝色圆锥弹，初始可额外穿透 3 个目标。命中造成伤害与微弱击退，可通过冰冻、分裂、齐射和连发词条强化。" },
      { id: "armoredCar", name: "装甲车支援", icon: "▰", status: "筹备中", detail: "召唤装甲车沿战线冲撞敌群，造成路径伤害并缓解城墙压力，尚未接入战斗。" }
    ],
    levels: [
      { id: 1, name: "街区警戒线", subtitle: "基础尸潮防守", unlocked: true },
      { id: 2, name: "地铁入口", subtitle: "分裂僵尸与更密集的波次", unlocked: false },
      { id: 3, name: "封锁工厂", subtitle: "投掷僵尸与完整 Boss 战", unlocked: false }
    ],
    waves: [
      { total: 12, interval: .72, mix: ["normal"] },
      { total: 18, interval: .65, mix: ["normal", "runner", "normal"] },
      { total: 20, interval: .62, mix: ["normal", "runner", "runner"] },
      { total: 26, interval: .54, mix: ["normal", "runner", "normal", "runner"], elite: "normalElite" },
      { total: 28, interval: .5, mix: ["normal", "runner", "normal", "runner"], boss: true }
    ]
  };
})(window.Game = window.Game || {});
