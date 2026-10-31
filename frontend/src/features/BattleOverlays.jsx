import { useEffect, useRef } from "react";
import { Button, formatTime, StatBar } from "../components/ui.jsx";
import { actions, getConfig } from "../game/actions.js";

function SkillButton({ skill }) {
  const timer = useRef(null);
  function release() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    actions.setSkillRangePreview(null);
  }
  useEffect(function () { return release; }, []);
  return (
    <button
      className="skill-hud-button"
      style={{ "--skill-color": skill.color }}
      title={skill.name + " · 账户 Lv." + skill.accountLevel + " · 局内 Lv." + skill.level + " · 长按查看射程"}
      onPointerDown={function () {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(function () { actions.setSkillRangePreview(skill.id); }, getConfig().skillRangeHoldMs || 350);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      <b>{skill.icon}</b><small>Lv.{skill.level}</small><em>A{skill.accountLevel}</em>
    </button>
  );
}

export function BattleHud({ snapshot }) {
  const hud = snapshot.hud;
  if (!hud || (snapshot.screen !== "playing" && snapshot.screen !== "testArena")) return null;
  return (
    <div className="battle-hud">
      <button className="hud-pause" onClick={actions.pause}>Ⅱ</button>
      <div className="hud-center">
        <strong>{snapshot.screen === "testArena" ? "测试场" : "第 " + snapshot.selectedLevel + " 关 · " + snapshot.selectedLevelName}</strong>
        <span>{snapshot.screen === "testArena" ? "自由验证构筑" : "第 " + hud.wave + " / " + hud.waves + " 波 · 剩余 " + hud.remaining}</span>
      </div>
      <button className={"hud-rifle " + (hud.rifleEnabled ? "active" : "")} onClick={actions.toggleRifle}>{hud.rifleEnabled ? "步枪开" : "步枪关"}</button>
      <div className="hud-bars">
        <StatBar label="角色" value={hud.playerHp} max={hud.playerMaxHp} tone="green" />
        <StatBar label="城墙" value={hud.wallHp} max={hud.wallMaxHp} tone="cyan" />
      </div>
      <div className="hud-meta">
        <span>Lv.{hud.level}</span>
        <div className="xp-track"><i style={{ width: Math.min(100, hud.xp / hud.nextXp * 100).toFixed(1) + "%" }} /></div>
        <span>{hud.ammo}/{hud.magazineSize}</span>
      </div>
      <div className="skill-hud">
        {hud.skills.map(function (skill) { return <SkillButton skill={skill} key={skill.id} />; })}
        {Array.from({ length: Math.max(0, hud.maxSkillSlots - hud.skills.length) }).map(function (_, index) { return <div className="skill-hud-empty" key={index}>—</div>; })}
      </div>
      {hud.messageTimer > 0 ? <div className="battle-message">{hud.message}</div> : null}
    </div>
  );
}

export function PauseOverlay() {
  return (
    <div className="battle-overlay">
      <div className="modal-card pause-card">
        <span className="screen-badge">BATTLE PAUSED</span>
        <h2>战斗暂停</h2>
        <p>尸潮和子弹都已停止</p>
        <Button variant="success" onClick={actions.resume}>继续战斗</Button>
        <Button variant="danger" onClick={actions.quitLevel}>退出关卡</Button>
      </div>
    </div>
  );
}

export function UpgradeOverlay({ snapshot }) {
  return (
    <div className="battle-overlay">
      <div className="upgrade-card">
        <span className="screen-badge">LEVEL UP</span>
        <h2>等级提升！</h2>
        <p>选择一项强化，战斗将继续</p>
        <div className="upgrade-options">
          {snapshot.upgradeCards.map(function (card, index) {
            return (
              <button key={card.id} className={"upgrade-option " + (card.rarity === "稀有" || card.rarity === "史诗" ? "rare" : "")} onClick={function () { actions.chooseTrait(index); }}>
                <b>{card.icon || "✦"}</b>
                <strong>{card.name}</strong>
                <small>{card.rarity} · 最多 {card.max} 级</small>
                <p>{card.desc}</p>
                <em>选择</em>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function rewardSummary(reward) {
  if (!reward) return [];
  const rows = [], equipmentBlueprints = [], skillBlueprints = [];
  Object.keys(reward.resources || {}).forEach(function (id) {
    const info = getConfig().resources.find(function (resource) { return resource.id === id; });
    if (id.indexOf("skillBlueprint") === 0) skillBlueprints.push((info ? info.name : id) + " +" + reward.resources[id]);
    else if (id.indexOf("blueprint") === 0) equipmentBlueprints.push((info ? info.name : id) + " +" + reward.resources[id]);
    else rows.push((info ? info.name : id) + " +" + reward.resources[id]);
  });
  if (equipmentBlueprints.length) rows.push("装备图纸 · " + equipmentBlueprints.join("，"));
  if (skillBlueprints.length) rows.push("技能图纸 · " + skillBlueprints.join("，"));
  if (reward.gems && reward.gems.length) rows.push("宝石 +" + reward.gems.length);
  if (reward.equipment && reward.equipment.length) rows.push("装备 +" + reward.equipment.length);
  return rows;
}

export function ResultOverlay({ snapshot }) {
  const win = snapshot.screen === "victory";
  const retreat = snapshot.screen === "retreat";
  const hud = snapshot.hud;
  const rows = rewardSummary(snapshot.reward);
  return (
    <div className="battle-overlay">
      <div className="modal-card result-card">
        <span className="screen-badge">{win ? "MISSION CLEAR" : retreat ? "RETREAT" : "MISSION FAILED"}</span>
        <h2>{win ? "关卡通关" : retreat ? "已撤离" : "城墙失守"}</h2>
        <div className="result-stats">
          <span><b>{formatTime(hud ? hud.elapsed : 0)}</b>用时</span>
          <span><b>{hud ? hud.kills : 0}</b>击杀</span>
          <span><b>Lv.{hud ? hud.level : 1}</b>等级</span>
        </div>
        <div className="reward-box">
          <h3>本局奖励</h3>
          {snapshot.reward && snapshot.reward.status === "pending" ? <p>正在结算…</p> : null}
          {rows.map(function (row) { return <p key={row}>{row}</p>; })}
          {snapshot.reward && snapshot.reward.status === "pending" ? null : snapshot.reward && snapshot.reward.status !== "done" ? <p>{snapshot.reward.note || "奖励未保存"}</p> : null}
        </div>
        <p className={snapshot.lastReportSaved ? "save-ok" : "save-note"}>{snapshot.lastReportSaved ? "成绩已保存到账户 · " + (snapshot.account ? snapshot.account.username : "") : "成绩未保存 · " + (snapshot.lastReportReason || snapshot.statusNote || "未登录")}</p>
        <div className="modal-actions">
          <Button variant={win ? "success" : "warning"} onClick={function () { actions.startLevel(snapshot.selectedLevel); }}>重新开始</Button>
          <Button variant="ghost" onClick={actions.backToMenu}>返回首页</Button>
        </div>
      </div>
    </div>
  );
}
