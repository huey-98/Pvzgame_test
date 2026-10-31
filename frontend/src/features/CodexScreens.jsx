import { useMemo, useState } from "react";
import { Button, Empty, formatPercent, Screen } from "../components/ui.jsx";
import { actions, getConfig, getGame } from "../game/actions.js";

const categoryLabels = {
  minion: { name: "小怪", color: "#63e6a0" },
  elite: { name: "精英", color: "#ffd166" },
  boss: { name: "首领", color: "#ff6b6b" }
};

function elementLabels(enemy, config) {
  const labels = [];
  Object.keys(enemy.damageTakenByElement || {}).forEach(function (id) {
    const info = config.elements[id];
    const value = enemy.damageTakenByElement[id];
    labels.push((info ? info.name : id) + " " + (value > 1 ? "+" : "−") + Math.round(Math.abs(value - 1) * 100) + "%");
  });
  return labels;
}

function mechanicLabels(enemy) {
  const labels = [];
  if (enemy.armorCharges) labels.push("装甲 " + enemy.armorCharges + " 层");
  if (enemy.ranged) labels.push("远程");
  if (enemy.flying) labels.push("飞行");
  if (enemy.blocksProjectiles) labels.push("阻挡弹道");
  if (enemy.boss || enemy.codexCategory === "boss") labels.push("首领");
  if (enemy.statusImmune) Object.keys(enemy.statusImmune).forEach(function (id) { labels.push("免疫 " + id); });
  if (enemy.explodeWall) labels.push("撞线爆炸");
  if (enemy.summonType) labels.push("阈值召唤");
  return labels;
}

export function ZombieCodexScreen() {
  const config = getConfig();
  const [category, setCategory] = useState("minion");
  const [selectedId, setSelectedId] = useState(null);
  const ids = useMemo(function () { return getGame().getCodexEnemyIds(category); }, [category]);
  const selected = selectedId ? config.enemies[selectedId] : null;

  return (
    <Screen title="僵尸图鉴" subtitle="查看单位数值、机制与应对建议" badge="FIELD GUIDE · ENEMIES" onBack={actions.backToMenu}>
      <div className="tab-row">
        {Object.keys(categoryLabels).map(function (id) {
          return <Button key={id} variant={category === id ? "cyan" : "ghost"} onClick={function () { setCategory(id); setSelectedId(null); }}>{categoryLabels[id].name}</Button>;
        })}
      </div>
      {selected ? (
        <div className="codex-detail">
          <Button variant="ghost" className="detail-back" onClick={function () { setSelectedId(null); }}>‹ 返回列表</Button>
          <div className="codex-hero">
            <i style={{ background: selected.color, borderColor: selected.accent }}>{selected.name.slice(0, 1)}</i>
            <div>
              <span>{categoryLabels[category].name}</span>
              <h2>{selected.name}</h2>
              <p>生命 {selected.hp} · 移速 {selected.speed} · 伤害 {selected.damage} · 经验 {selected.xp}</p>
            </div>
          </div>
          <p className="codex-copy">{selected.description}</p>
          <div className="trait-list">
            {elementLabels(selected, config).map(function (label) { return <span key={label}>{label}</span>; })}
            {mechanicLabels(selected).map(function (label) { return <span key={label}>{label}</span>; })}
          </div>
          <div className="tactics"><b>应对建议</b><p>{selected.tactics}</p></div>
        </div>
      ) : (
        <div className="codex-grid">
          {ids.map(function (id) {
            const enemy = config.enemies[id];
            return (
              <button className="codex-card" key={id} onClick={function () { setSelectedId(id); }}>
                <i style={{ background: enemy.color, borderColor: enemy.accent }}>{enemy.name.slice(0, 1)}</i>
                <strong>{enemy.name}</strong>
                <small>生命 {enemy.hp} · 移速 {enemy.speed}</small>
              </button>
            );
          })}
          {!ids.length ? <Empty>暂无收录</Empty> : null}
        </div>
      )}
    </Screen>
  );
}

export function SkillCodexScreen() {
  const [selectedId, setSelectedId] = useState(null);
  const config = getConfig();
  const groups = useMemo(function () { return getGame().getSkillGroups(); }, []);
  const selected = selectedId ? groups.find(function (group) { return group.id === selectedId; }) : null;
  const progress = selected && config.skillProgress.order.indexOf(selected.id) >= 0 && getGame().skillProgress ? getGame().skillProgress.getView(selected.id) : null;
  const accountState = getGame().accounts.state;
  return (
    <Screen title="技能图鉴" subtitle={"每局最多装备 " + config.maxSkillSlots + " 个核心技能"} badge="FIELD GUIDE · SKILLS" onBack={actions.backToMenu}>
      {selected ? (
        <div className="codex-detail">
          <Button variant="ghost" className="detail-back" onClick={function () { setSelectedId(null); }}>‹ 返回列表</Button>
          <div className="skill-hero">
            <span style={{ color: selected.color || "#68d8ff" }}>{selected.icon}</span>
            <div><h2>{selected.name}</h2><p>{selected.status || "已实装"} · {selected.traits.length} 个词条{progress ? " · 账户 Lv." + progress.level + " / " + progress.maxLevel : ""}</p></div>
          </div>
          <p className="codex-copy">{selected.detail}</p>
          {progress ? (
            <div className="trait-cards">
              <article className="trait-card rare">
                <div><b>账户强化 Lv.{progress.level} / {progress.maxLevel}</b><small>暴击 +{formatPercent(progress.critBonus)} · 伤害 +{Math.round(progress.damageBonus * 100)}% · 冷却 −{Math.round(progress.cooldownReduction * 100)}%</small></div>
                <p>{progress.milestones.filter(function (node) { return node.unlocked; }).map(function (node) { return node.name; }).join(" · ") || "尚未解锁高级节点"}</p>
                <p>{progress.nextCost ? "金币 " + progress.nextCost.coin + " · 专属图纸 " + progress.nextCost[progress.blueprintId] : "已达到最高等级"}</p>
                <Button variant={progress.level >= progress.maxLevel ? "ghost" : "violet"} disabled={progress.level >= progress.maxLevel || accountState.skillBusy || getGame().accounts.getStatus() !== "ready"} onClick={function () { actions.upgradeSkill(progress.skillId); }}>{progress.level >= progress.maxLevel ? "已满级" : accountState.skillBusyId === progress.skillId ? "强化中…" : "强化"}</Button>
              </article>
            </div>
          ) : null}
          <div className="trait-cards">
            {selected.traits.map(function (trait) {
              return (
                <article key={trait.id} className={"trait-card " + (trait.rarity === "稀有" || trait.rarity === "史诗" ? "rare" : "")}>
                  <div><b>{trait.name}</b><small>{trait.rarity} · 最多 {trait.max} 级</small></div>
                  <p>{trait.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="skill-list">
          {groups.map(function (group) {
            return (
              <button className="skill-row" key={group.id} onClick={function () { setSelectedId(group.id); }}>
                <span style={{ color: group.color || "#68d8ff" }}>{group.icon}</span>
                <div><strong>{group.name}</strong><small>{group.traits.length} 个词条</small></div>
                <em>{group.status || "已实装"}</em>
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
