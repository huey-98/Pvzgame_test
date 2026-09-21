/* 静态数据层：新增敌人、词条或波次时优先修改这里。 */
(function (Game) {
  "use strict";
  Game.config = {
    width: 360, height: 640, maxLevel: 10, rifleSideOffset: -6, muzzleDistance: 34,
    sprites: {
      playerBody: { src: ["assets/player-man.png", "assets/player-body.png", "assets/man.png"], width: 74, height: 131, anchorX: 37, anchorY: 78 },
      playerRifle: { src: "assets/player-rifle.png", width: 18, height: 46, anchorX: 9, anchorY: 38, mountX: -6, mountY: -40 }
    },
    skillRing: { offsetX: 86, offsetY: -102 },
    colors: { bg: "#0b202c", text: "#f4f8fb", muted: "#9ab0bc", green: "#63e6a0", yellow: "#ffd166", red: "#ff6b6b", cyan: "#68d8ff", ice: "#58aaff", fire: "#ff9b52", purple: "#c9a1ff" },
    enemies: {
      normal: { name: "普通僵尸", hp: 28, speed: 25, radius: 14, damage: 10, xp: 8, color: "#6eaa7b", accent: "#b1e4a0" },
      runner: { name: "快跑僵尸", hp: 16, speed: 52, radius: 11, damage: 7, xp: 7, color: "#e5a052", accent: "#ffe0a7" },
      bucket: { name: "铁桶僵尸", hp: 82, speed: 15, radius: 17, damage: 16, xp: 18, color: "#8290a2", accent: "#d6e0ea" },
      boss: { name: "尸潮领主", hp: 900, speed: 12, radius: 34, damage: 24, xp: 100, color: "#9d5264", accent: "#ffb0bc" }
    },
    traits: [
      { id: "damage", name: "增伤", rarity: "普通", max: 5, icon: "✦", desc: "子弹伤害 +25%", apply: function (p) { p.damage *= 1.25; } },
      { id: "burst", name: "连发", rarity: "普通", max: 3, icon: "➤", desc: "每次沿同一弹道连续发射 1 枚子弹", apply: function (p) { p.burst += 1; } },
      { id: "firerate", name: "射速", rarity: "普通", max: 5, icon: "⚡", desc: "射击间隔 -15%", apply: function (p) { p.fireInterval *= .85; } },
      { id: "spread", name: "齐射", rarity: "稀有", max: 3, icon: "✣", desc: "每级增加 1 条平行弹道", apply: function (p) { p.spread += 1; } },
      { id: "pierce", name: "穿透", rarity: "稀有", max: 4, icon: "↠", desc: "子弹额外穿透 1 个敌人", apply: function (p) { p.pierce += 1; } },
      { id: "caliber", name: "大口径", rarity: "稀有", max: 3, icon: "●", desc: "子弹更大，伤害 +15%", apply: function (p) { p.bulletRadius += 2; p.damage *= 1.15; } },
      { id: "crit", name: "暴击", rarity: "普通", max: 5, icon: "♦", desc: "暴击率 +12%", apply: function (p) { p.crit += .12; } },
      { id: "weakpoint", name: "弱点打击", rarity: "稀有", max: 3, icon: "☄", desc: "暴击伤害 +50%", apply: function (p) { p.critDamage += .5; } },
      { id: "burn", name: "燃烧弹", rarity: "稀有", max: 3, icon: "♨", desc: "命中后附加持续伤害", apply: function (p) { p.burn += 1; p.bulletType = "fire"; } },
      { id: "freeze", name: "冰冻弹", rarity: "稀有", max: 3, icon: "❄", desc: "命中后减速 12%", apply: function (p) { p.freeze += .12; p.bulletType = "ice"; } }
    ],
    levels: [
      { id: 1, name: "街区警戒线", subtitle: "基础尸潮防守", unlocked: true },
      { id: 2, name: "地铁入口", subtitle: "分裂僵尸与更密集的波次", unlocked: false },
      { id: 3, name: "封锁工厂", subtitle: "投掷僵尸与完整 Boss 战", unlocked: false }
    ],
    waves: [
      { total: 12, interval: .72, mix: ["normal"] },
      { total: 18, interval: .65, mix: ["normal", "runner", "normal"] },
      { total: 20, interval: .62, mix: ["normal", "bucket", "runner"] },
      { total: 26, interval: .54, mix: ["normal", "runner", "bucket", "normal"] },
      { total: 28, interval: .5, mix: ["normal", "runner", "bucket", "runner"], boss: true }
    ]
  };
})(window.Game = window.Game || {});
