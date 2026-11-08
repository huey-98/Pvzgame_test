"use strict";

var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
global.window = {};
require(path.join(root, "src", "config.js"));
var C = window.Game.config;

var failures = [];
var warnings = [];
var passes = [];

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

function fail(message) { failures.push(message); }
function warn(message) { warnings.push(message); }
function pass(message) { passes.push(message); }

function scan(text, pattern, handler) {
  var match;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(text))) handler(match);
}

var readme = read("README.md");
var plan = read("DEVELOPMENT_PLAN.md");
var agents = read("AGENTS.md");
var docsIndex = read("docs/README.md");
var planCurrent = plan.split(/^## 11\./m)[0];
var currentDocs = [["README.md", readme], ["DEVELOPMENT_PLAN.md", planCurrent]];

var levelCount = C.levels.length;
var maxLevel = C.maxLevel;

var minionCount = 0;
var eliteCount = 0;
var formCount = 0;
var shapes = {};
Object.keys(C.enemies).forEach(function (id) {
  var enemy = C.enemies[id];
  if (enemy.codexCategory === "minion" && !enemy.codexHidden) minionCount++;
  if (enemy.codexCategory === "elite" && !enemy.codexHidden) eliteCount++;
  if (enemy.damageTakenByElement) {
    formCount++;
    shapes[JSON.stringify(enemy.damageTakenByElement)] = true;
  }
});
var resistGroups = Object.keys(shapes).length;

currentDocs.forEach(function (pair) {
  var name = pair[0];
  var text = pair[1];
  scan(text, /(?:全部|现有|展示)\s*(\d+)\s*个关卡/g, function (m) {
    if (Number(m[1]) !== levelCount) {
      fail(name + " 写关卡总数 " + m[1] + "，config 为 " + levelCount);
    }
  });
  scan(text, /(?:升级至|升至|最多升至|可升至)\s*(?:LV\.)?(\d+)\s*级/g, function (m) {
    if (Number(m[1]) !== maxLevel) {
      fail(name + " 写升级到 " + m[1] + " 级，config.maxLevel 为 " + maxLevel);
    }
  });
  scan(text, /(\d+)\s*级上限/g, function (m) {
    if (Number(m[1]) !== maxLevel) {
      fail(name + " 写 " + m[1] + " 级上限，config.maxLevel 为 " + maxLevel);
    }
  });
  scan(text, /小怪与精英(?:分类)?各\s*\*{0,2}(\d+)\s*种/g, function (m) {
    if (Number(m[1]) !== minionCount || Number(m[1]) !== eliteCount) {
      fail(name + " 写图鉴各 " + m[1] + " 种，config 为小怪 " + minionCount + " / 精英 " + eliteCount);
    }
  });
  scan(text, /(?:已实装|已实现|当前共)\s*(\d+)\s*组/g, function (m) {
    if (Number(m[1]) !== resistGroups) {
      fail(name + " 写抗性 " + m[1] + " 组，config 为 " + resistGroups + " 组");
    }
  });
  scan(text, /(?:覆盖|组[、,]\s*)\s*(\d+)\s*种形态/g, function (m) {
    if (Number(m[1]) !== formCount) {
      fail(name + " 写抗性 " + m[1] + " 种形态，config 为 " + formCount + " 种");
    }
  });
});

[["README.md", readme], ["DEVELOPMENT_PLAN.md", planCurrent], ["AGENTS.md", agents], ["docs/README.md", docsIndex]].forEach(function (pair) {
  var name = pair[0];
  scan(pair[1], /tmp[\\/]([A-Za-z0-9_-]+\.js)\b/g, function (m) {
    if (!fs.existsSync(path.join(root, "tmp", m[1]))) {
      fail(name + " 引用的 tmp/" + m[1] + " 不存在");
    }
  });
});

var planLevels = {};
scan(plan, /^### 关卡\s*(\d+)：/gm, function (m) { planLevels[Number(m[1])] = true; });
var readmeLevels = {};
scan(readme, /^-\s*第\s*(\d+)\s*关「/gm, function (m) { readmeLevels[Number(m[1])] = true; });

function compress(ids) {
  ids.sort(function (a, b) { return a - b; });
  var parts = [];
  var index = 0;
  while (index < ids.length) {
    var start = ids[index];
    var end = start;
    while (index + 1 < ids.length && ids[index + 1] === end + 1) { index++; end = ids[index]; }
    parts.push(start === end ? String(start) : start + "～" + end);
    index++;
  }
  return parts.join("、");
}

var planMissing = [];
var readmeMissing = [];
C.levels.forEach(function (level) {
  if (!planLevels[level.id]) planMissing.push(level.id);
  if (!readmeLevels[level.id]) readmeMissing.push(level.id);
});
if (planMissing.length) warn("DEVELOPMENT_PLAN.md 缺少第 " + compress(planMissing) + " 关的小节");
if (readmeMissing.length) warn("README.md 缺少第 " + compress(readmeMissing) + " 关的功能条目");

if (!failures.length) pass("关卡总数 " + levelCount + "、等级上限 " + maxLevel + "、图鉴 " + minionCount + "/" + eliteCount + "、抗性 " + resistGroups + " 组 / " + formCount + " 种均与 config 一致");
if (!warnings.length) pass("文档中的关卡小节与引用脚本均完整");

passes.forEach(function (m) { console.log("  ok    " + m); });
warnings.forEach(function (m) { console.log("  warn  " + m); });
failures.forEach(function (m) { console.log("  FAIL  " + m); });
console.log("");
console.log("check-docs: " + passes.length + " passed, " + warnings.length + " warnings, " + failures.length + " failed");
process.exit(failures.length ? 1 : 0);
