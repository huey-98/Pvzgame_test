import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { actions, getGame } from "../game/actions.js";
import { Badge, Btn, Dot, Flat, Icon, Panel, Pop, Rect, Stage, Text, WrapText, baselineTop, fontCss, measureWidth } from "../game/stage.jsx";

function game() { return getGame(); }
function colors(snapshot) { return snapshot.colors || game().config.colors; }
function width() { return game().config.width; }
function clip(value, max) {
  const text = value == null ? "" : String(value);
  return text.length > max ? text.slice(0, max) : text;
}
function pad2(value) { return value < 10 ? "0" + value : "" + value; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function percent(value) {
  const number = Math.round(value * 1000) / 10;
  return (number % 1 === 0 ? number.toFixed(0) : number.toFixed(1)) + "%";
}
function partInfo(partId) {
  const list = game().config.equipment.slots || [];
  for (let index = 0; index < list.length; index += 1) if (list[index].id === partId) return list[index];
  return list[0] || { id: "arm", name: "手臂", short: "臂", color: "#68d8ff" };
}
function affixValue(affix) {
  const value = affix.percent ? Math.round(affix.value * 1000) / 10 : affix.value;
  let label = String(value);
  if (label.indexOf(".") >= 0) label = label.replace(/0+$/, "").replace(/\.$/, "");
  return "+" + label + (affix.percent ? "%" : "");
}
function recordSummary(row) {
  const parts = [];
  if (row.completed) parts.push("已通关");
  if (row.bestTime !== null && row.bestTime !== undefined) parts.push("最佳 " + game().utils.formatTime(row.bestTime));
  if (row.bestKills !== null && row.bestKills !== undefined) parts.push("击杀 " + row.bestKills);
  if (!parts.length) parts.push("尝试 " + (row.attempts || 0) + " 次");
  return parts.join(" · ");
}
function resources() { return game().accounts.getResources(); }
function ready(snapshot) { return snapshot.accountStatus === "ready"; }

function Glyph(props) {
  const size = props.size;
  return <Icon x={props.x - size / 2} y={props.y - size / 2} w={size} h={size} draw={function (context) { game().drawEquipmentGlyph(context, props.kind, size / 2, size / 2, size, props.color); }} />;
}
function GemMark(props) {
  const size = props.size;
  return <Icon x={props.x - size / 2} y={props.y - size / 2} w={size} h={size} draw={function (context) { game().drawGemIcon(context, size / 2, size / 2, size, props.color); }} />;
}
function ResourceMark(props) {
  const size = props.size;
  return <Icon x={props.x - size / 2} y={props.y - size / 2} w={size} h={size} draw={function (context) { game().drawResourceIcon(context, props.id, size / 2, size / 2, size, props.color); }} />;
}
function MaterialMark(props) {
  const size = props.size;
  return <Icon x={props.x - size / 2} y={props.y - size / 2} w={size} h={size} draw={function (context) { game().drawMaterialIcon(context, props.kind, size / 2, size / 2, size); }} />;
}
function SkillMark(props) {
  const size = props.size;
  return <Icon x={props.x - size / 2} y={props.y - size / 2} w={size} h={size} draw={function (context) { game().drawSkillGlyph(context, props.id, size / 2, size / 2, size, props.color); }} />;
}
function EnemyMark(props) {
  return <Icon x={props.x} y={props.y} w={props.w} h={props.h} draw={function (context) { game().drawCodexEnemyModel(context, props.id, props.enemy, 0, 0, props.w, props.h, !!props.detail); }} />;
}
function MaterialLabel(props) {
  const left = props.align === "right" ? props.x - measureWidth(props.label, fontCss(10, true)) : props.x;
  return (
    <>
      <MaterialMark kind={props.kind} x={left - 8} y={props.y - 3} size={12} />
      <Text x={left} y={props.y} size={10} bold color={props.color}>{props.label}</Text>
    </>
  );
}
function Pager(props) {
  const rect = props.rect;
  const c = colors(props.snapshot);
  return <Flat rect={rect} radius={6} fill={props.enabled ? "rgba(26, 57, 70, .96)" : "rgba(24, 40, 48, .7)"} stroke={props.enabled ? "rgba(153, 205, 218, .32)" : "rgba(153, 205, 218, .12)"} label={props.label} size={12} baseline={rect.h / 2 + 4} color={props.enabled ? props.color : c.muted} onClick={props.enabled ? props.onClick : undefined} />;
}

function Banner(props) {
  const note = props.snapshot.statusNote;
  if (!note) return null;
  const menu = game().config.menu;
  const c = colors(props.snapshot);
  const color = props.snapshot.accountStatus === "offline" ? c.red : c.yellow;
  const left = props.snapshot.screen === "menu" ? (menu.bannerLeft || 0) : 0;
  const limit = Math.min(260, props.snapshot.viewWidth - left - 12);
  const bannerWidth = clamp(note.length * 12 + 26, 160, limit);
  const x = left + (props.snapshot.viewWidth - left - 12 - bannerWidth) / 2;
  return (
    <div className="meta-banner" style={{ left: x, top: menu.bannerY, width: bannerWidth, height: menu.bannerHeight, borderColor: color }}>
      <span className="meta-anchor" style={{ top: baselineTop(15, 10, true), fontSize: 10, lineHeight: 1, fontWeight: 700, color: color }}>{note}</span>
    </div>
  );
}

function MenuScreen(props) {
  const menu = game().config.menu;
  const buttons = menu.buttons;
  const c = colors(props.snapshot);
  const circle = menu.accountCircle;
  const ring = props.snapshot.accountStatus === "ready" ? c.green : props.snapshot.accountStatus === "offline" ? c.red : c.cyan;
  const W = width();
  return (
    <Stage width={props.snapshot.viewWidth} height={props.snapshot.viewHeight}>
      <button type="button" className="meta-orb" style={{ left: circle.x - circle.r - 1, top: circle.y - circle.r - 1, width: circle.r * 2 + 2, height: circle.r * 2 + 2, borderColor: ring, boxShadow: "0 0 12px " + ring }} onClick={function () { actions.openAccount(); }}>
        <span className="meta-anchor" style={{ top: baselineTop(circle.r + 5, 10, true), fontSize: 10, lineHeight: 1, fontWeight: 700, color: c.text }}>账户</span>
      </button>
      <Panel rect={{ x: menu.panelX, y: menu.panelY, w: menu.panelWidth, h: menu.panelHeight }} radius={20} fill="rgba(10, 35, 49, .78)" stroke="rgba(153, 205, 218, .18)" />
      <Badge x={102} y={104} w={156} label="SURVIVAL  PROTOCOL" color={c.cyan} />
      <Text x={W / 2} y={164} size={31} bold align="center" color={c.yellow}>街区警戒线</Text>
      <Text x={W / 2} y={194} size={15} align="center" color={c.text}>竖屏僵尸生存射击</Text>
      <Text x={W / 2} y={226} size={12} align="center" color={c.muted}>步枪自动锁定目标 · 点击画面调整方向</Text>
      <Btn rect={buttons.start} label="开始战斗" color={c.green} onClick={function () { actions.startContinue(); }} />
      <Btn rect={buttons.levelSelect} label="选择关卡" color={c.cyan} onClick={function () { actions.openLevelSelect(); }} />
      <Btn rect={buttons.testArena} label="进入测试场" color={c.yellow} onClick={function () { actions.startTestArena(); }} />
      <Btn rect={buttons.character} label="角色" color="#68d8ff" onClick={function () { actions.openCharacter(); }} />
      <Btn rect={buttons.skillCodex} label="技能图鉴" color={c.purple} onClick={function () { actions.openSkillCodex(); }} />
      <Btn rect={buttons.zombieCodex} label="僵尸图鉴" color="#58aaff" onClick={function () { actions.openZombieCodex(); }} />
      <Banner snapshot={props.snapshot} />
    </Stage>
  );
}

function LevelBrief(props) {
  const level = props.level;
  const c = colors(props.snapshot);
  const layout = game().getLevelBriefLayout();
  const box = layout.box;
  const close = game().getLevelBriefCloseRect();
  const W = width();
  const left = box.x + 20;
  const right = box.x + box.w - 20;
  const titles = ["小怪", "精英", "首领"];
  const titleColors = [c.green, c.yellow, c.red];
  return (
    <Pop onClose={function () { actions.closeLevelPreview(); }}>
      <Panel rect={box} radius={20} fill="rgba(10, 35, 49, .98)" stroke="rgba(153, 205, 218, .24)" />
      <Badge x={W / 2 - 75} y={box.y + 14} w={150} label="MISSION BRIEF" color={c.cyan} />
      <Flat rect={close} radius={9} fill="rgba(16, 41, 54, .96)" stroke="rgba(153, 205, 218, .24)" label="×" size={15} baseline={close.h / 2 + 5} color={c.muted} onClick={function () { actions.closeLevelPreview(); }} />
      <Text x={W / 2} y={box.y + 64} size={21} bold align="center" color={c.yellow}>{(level.id < 10 ? "0" + level.id : "" + level.id) + "  " + level.name}</Text>
      <Text x={W / 2} y={box.y + 86} size={11} align="center" color={c.muted}>{level.subtitle}</Text>
      <div className="meta-line" style={{ left: left, top: box.y + 100, width: right - left }} />
      <Text x={left} y={box.y + 122} size={12} bold color={c.cyan}>关卡简介</Text>
      <WrapText text={level.brief || level.subtitle} x={left} y={box.y + 142} maxWidth={right - left} lineHeight={16} size={12} color={c.text} />
      {layout.groups.map(function (group, index) {
        return (
          <div key={titles[index]}>
            <Text x={left} y={box.y + group.y} size={12} bold color={titleColors[index]}>{titles[index]}</Text>
            {group.rows.length ? group.rows.map(function (item) {
              const wave = item.entry.waves.length > 1 ? "第 " + item.entry.wave + " 波起 · 覆盖 " + item.entry.waves.length + " 波" : "第 " + item.entry.wave + " 波";
              return (
                <div key={item.entry.id}>
                  <Dot x={left + 6} y={box.y + item.y - 4} r={6} fill={item.entry.color} stroke={item.entry.accent} />
                  <Text x={left + 20} y={box.y + item.y} size={13} bold>{item.entry.name}</Text>
                  <Text x={right} y={box.y + item.y} size={10} align="right" color={c.muted}>{wave}</Text>
                </div>
              );
            }) : <Text x={left + 6} y={box.y + group.y + 20} size={12} color={c.muted}>—</Text>}
          </div>
        );
      })}
    </Pop>
  );
}

function LevelSelectScreen(props) {
  const snapshot = props.snapshot;
  const ui = game().config.levelSelect;
  const c = colors(snapshot);
  const W = width();
  const levels = game().config.levels || [];
  const viewport = game().getLevelListViewport();
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const tokenRef = useRef(0);
  useEffect(function () {
    const node = listRef.current;
    if (!node) return undefined;
    function pointOf(event) {
      const rect = node.getBoundingClientRect();
      return { y: (event.clientY - rect.top) * (node.offsetHeight / (rect.height || 1)) };
    }
    function onMove(event) {
      const drag = dragRef.current;
      if (!drag || game().state.levelPreview) return;
      const delta = pointOf(event).y - drag.startY;
      if (!drag.moved && Math.abs(delta) < game().config.levelSelect.dragThreshold) return;
      drag.moved = true;
      movedRef.current = true;
      const next = Math.max(0, Math.min(game().getLevelScrollMax(), drag.startScroll - delta));
      const live = game().state.levelScroll || 0;
      if (next !== live) actions.scrollLevelList(next - live);
    }
    function onUp() {
      dragRef.current = null;
      if (!movedRef.current) return;
      const token = tokenRef.current;
      window.setTimeout(function () { if (tokenRef.current === token) movedRef.current = false; }, 0);
    }
    function onWheel(event) {
      if (game().state.levelPreview) return;
      let delta = event.deltaY || event.deltaX || 0;
      const geo = game().config.levelSelect;
      if (event.deltaMode === 1) delta *= geo.rowHeight;
      else if (event.deltaMode === 2) delta *= game().getLevelListViewport().h;
      else delta *= geo.scrollWheelStep / 100;
      if (!delta) return;
      event.preventDefault();
      actions.scrollLevelList(delta);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    node.addEventListener("wheel", onWheel, { passive: false });
    return function () {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      node.removeEventListener("wheel", onWheel);
    };
  }, []);
  const scrollMax = game().getLevelScrollMax();
  const scroll = snapshot.levelScroll || 0;
  const thumbHeight = scrollMax > 0 ? Math.max(34, viewport.h * viewport.h / (levels.length * ui.rowHeight)) : viewport.h;
  const thumbY = scrollMax > 0 ? viewport.y + (scroll / scrollMax) * (viewport.h - thumbHeight) : viewport.y;
  const trackX = viewport.x + viewport.w - ui.scrollbarWidth - ui.scrollbarGap;
  const range = game().getVisibleLevelRange();
  const preview = snapshot.levelPreview ? levels.filter(function (level) { return level.id === snapshot.levelPreview; })[0] : null;
  return (
    <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .94)" stroke="rgba(153, 205, 218, .18)" />
      <Badge x={105} y={68} w={150} label="MISSION SELECT" color={c.cyan} />
      <Text x={W / 2} y={112} size={25} bold align="center" color={c.yellow}>选择关卡</Text>
      <Text x={W / 2} y={135} size={12} align="center" color={c.muted}>所有关卡已开放 · 点击行开战，点 ? 看详情</Text>
      <Rect rect={viewport} radius={14} fill="rgba(13, 34, 46, .92)" stroke="rgba(153, 205, 218, .16)" />
      <div className="meta-clip" ref={listRef} style={{ left: viewport.x, top: viewport.y, width: viewport.w, height: viewport.h }} onPointerDown={function (event) {
        if (game().state.levelPreview) return;
        const rect = event.currentTarget.getBoundingClientRect();
        tokenRef.current += 1;
        movedRef.current = false;
        dragRef.current = { startY: (event.clientY - rect.top) * (event.currentTarget.offsetHeight / (rect.height || 1)), startScroll: game().state.levelScroll || 0, moved: false };
      }}>
        {levels.map(function (level, index) {
          if (index < range.start || index >= range.end) return null;
          const rect = game().getLevelRowRect(index);
          const local = { x: rect.x - viewport.x, y: rect.y - viewport.y, w: rect.w, h: rect.h };
          const info = game().getLevelInfoRect(index);
          const infoLocal = { x: info.x - viewport.x, y: info.y - viewport.y, w: info.w, h: info.h };
          const unlocked = game().isLevelUnlocked(level.id);
          const completed = game().isLevelCompleted(level.id);
          const cy = local.y + local.h / 2;
          return (
            <div key={level.id}>
              <button type="button" className="meta-clear" style={{ left: local.x, top: local.y, width: local.w, height: local.h }} onClick={function () { if (!movedRef.current) actions.startLevel(level.id); }} />
              {completed ? <Rect rect={{ x: local.x + 2, y: local.y + 10, w: 4, h: local.h - 20 }} radius={2} fill={c.green} /> : null}
              <Text x={local.x + 26} y={cy + 6} size={18} bold align="center" color={unlocked ? (completed ? c.green : c.cyan) : "#667985"}>{level.id < 10 ? "0" + level.id : "" + level.id}</Text>
              <Text x={local.x + 54} y={cy + 5} size={14} bold color={unlocked ? c.text : "#71828b"}>{level.name}</Text>
              <button type="button" className="meta-clear" style={{ left: infoLocal.x, top: infoLocal.y, width: infoLocal.w, height: infoLocal.h, borderRadius: infoLocal.w / 2 }} onClick={function (event) { event.stopPropagation(); if (!movedRef.current) actions.openLevelPreview(level.id); }} />
              <Dot x={infoLocal.x + infoLocal.w / 2} y={infoLocal.y + infoLocal.h / 2} r={infoLocal.w / 2} fill="rgba(13, 34, 46, .92)" stroke={unlocked ? "rgba(104, 216, 255, .5)" : "rgba(153, 205, 218, .22)"} />
              <Text x={infoLocal.x + infoLocal.w / 2} y={infoLocal.y + infoLocal.h / 2 + 5} size={13} bold align="center" color={unlocked ? c.cyan : "#667985"}>?</Text>
              {!unlocked ? <Text x={local.x + local.w - 16} y={cy + 4} size={10} bold align="right" color="#7e8d94">未解锁</Text> : completed ? <Text x={local.x + local.w - 16} y={cy + 4} size={10} bold align="right" color={c.green}>已通关</Text> : <Text x={local.x + local.w - 18} y={cy + 6} size={18} bold align="center" color={c.cyan}>›</Text>}
              {index < levels.length - 1 ? <Rect rect={{ x: local.x + 16, y: local.y + local.h - 0.5, w: local.w - 32, h: 1 }} radius={0.5} fill="rgba(153, 205, 218, .14)" /> : null}
            </div>
          );
        })}
      </div>
      {scrollMax > 0 ? <Rect rect={{ x: trackX, y: viewport.y, w: ui.scrollbarWidth, h: viewport.h }} radius={2} fill="rgba(153, 205, 218, .1)" /> : null}
      {scrollMax > 0 ? <Rect rect={{ x: trackX, y: thumbY, w: ui.scrollbarWidth, h: thumbHeight }} radius={2} fill="rgba(104, 216, 255, .5)" /> : null}
      <Btn rect={{ x: W / 2 - 72, y: ui.backY, w: 144, h: ui.backHeight }} label="返回首页" color="#4b7180" onClick={function () { actions.backToMenu(); }} />
      {preview ? <LevelBrief snapshot={snapshot} level={preview} /> : null}
      <Banner snapshot={snapshot} />
    </Stage>
  );
}

function LoginScreen(props) {
  const ui = game().config.accountUI;
  const login = ui.login;
  const register = props.snapshot.accountMode === "register";
  const fields = useState({ username: "", password: "" });
  const c = colors(props.snapshot);
  const W = width();
  const offline = props.snapshot.accountStatus === "offline";
  return (
    <Stage width={props.snapshot.viewWidth} height={props.snapshot.viewHeight}>
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .96)" stroke="rgba(153, 205, 218, .22)" />
      <Badge x={105} y={70} w={150} label="ACCOUNT ACCESS" color={c.cyan} />
      <Text x={W / 2} y={118} size={25} bold align="center" color={c.yellow}>{register ? "注册账户" : "登录账户"}</Text>
      <Text x={W / 2} y={144} size={11} align="center" color={c.muted}>{offline ? "未连接数据库 · 战斗仍可进行，成绩不会保存" : "登录后关卡进度与资源会保存到本机数据库"}</Text>
      <Text x={login.userName.x} y={login.userName.y - 8} size={11} bold color={c.cyan}>用户名</Text>
      <input className="meta-field" style={{ left: login.userName.x, top: login.userName.y, width: login.userName.w, height: login.userName.h, lineHeight: login.userName.h + "px" }} placeholder="点击输入用户名" maxLength={16} value={fields[0].username} onChange={function (event) { fields[1]({ username: event.target.value, password: fields[0].password }); }} />
      <Text x={login.password.x} y={login.password.y - 8} size={11} bold color={c.cyan}>密码</Text>
      <input className="meta-field" type="password" style={{ left: login.password.x, top: login.password.y, width: login.password.w, height: login.password.h, lineHeight: login.password.h + "px" }} placeholder="点击输入密码" maxLength={64} value={fields[0].password} onChange={function (event) { fields[1]({ username: fields[0].username, password: event.target.value }); }} />
      <Text x={W / 2} y={332} size={11} bold align="center" color={c.red}>{props.snapshot.accountError}</Text>
      <Btn rect={login.submit} label={register ? "注册并登录" : "登录"} color={c.green} onClick={function () { if (props.snapshot.accountBusy) return; (register ? actions.register : actions.login)(fields[0].username, fields[0].password); }} />
      <Btn rect={login.switchMode} label={register ? "已有账户？去登录" : "没有账户？去注册"} color="#4b7180" onClick={function () { actions.setAccountMode(register ? "login" : "register"); }} />
      <Text x={W / 2} y={458} size={10} align="center" color={c.muted}>用户名 2–16 个中文 / 字母 / 数字 / 下划线</Text>
      <Text x={W / 2} y={474} size={10} align="center" color={c.muted}>密码至少 6 位 · 表单项在画布上的输入浮层中填写</Text>
      <Btn rect={ui.back} label="返回首页" color="#4b7180" onClick={function () { actions.backToMenu(); }} />
    </Stage>
  );
}

function DeleteDialog(props) {
  const password = useState("");
  const error = useState("");
  const busy = useState(false);
  function submit() {
    if (password[0].length < ((game().config.accounts && game().config.accounts.passwordMin) || 6)) {
      error[1]("密码至少 6 位");
      return;
    }
    error[1]("");
    busy[1](true);
    actions.removeAccount(password[0]).then(function (result) {
      busy[1](false);
      if (result && result.ok) return;
      error[1]((result && result.error) || (game().accounts.state && game().accounts.state.error) || "删除失败");
    });
  }
  return createPortal(
    <div className="account-dialog-backdrop">
      <div className="account-dialog-card">
        <h2>删除账户</h2>
        <p className="account-dialog-note">删除后该账户的关卡进度与资源会一并清除，且不可恢复。请输入密码确认。</p>
        <label className="account-dialog-row"><span>密码</span><input type="password" maxLength={64} value={password[0]} onChange={function (event) { password[1](event.target.value); }} /></label>
        <p className="account-dialog-error">{error[0]}</p>
        <div className="account-dialog-actions">
          <button type="button" onClick={props.onClose}>取消</button>
          <button type="button" className="primary" disabled={busy[0]} onClick={submit}>确定</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AccountScreen(props) {
  const ui = game().config.accountUI;
  const box = ui.account;
  const snapshot = props.snapshot;
  const c = colors(snapshot);
  const W = width();
  const removing = useState(false);
  const view = game().getAccountResourceRows();
  const records = (snapshot.records || []).slice(-(game().config.accounts.maxRecords || 5));
  const created = snapshot.account && snapshot.account.createdAt ? String(snapshot.account.createdAt).slice(0, 10) : "—";
  const totals = snapshot.totals || { wins: 0, attempts: 0 };
  return (
    <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .96)" stroke="rgba(153, 205, 218, .22)" />
      <Badge x={120} y={70} w={120} label="ACCOUNT" color={c.cyan} />
      <Text x={W / 2} y={118} size={25} bold align="center" color={c.yellow}>账户中心</Text>
      <Panel rect={{ x: 38, y: box.cardY, w: 284, h: box.cardHeight }} radius={14} fill="rgba(17, 47, 62, .94)" stroke="rgba(104, 216, 255, .22)" />
      <Text x={54} y={box.cardY + 30} size={20} bold>{snapshot.username || "未登录"}</Text>
      <Text x={54} y={box.cardY + 50} size={11} color={c.muted}>{"注册于 " + created}</Text>
      <Text x={54} y={box.cardY + 68} size={11} color={c.cyan}>{"通关 " + snapshot.completedCount + " / " + game().config.levels.length + "   ·   累计通关 " + totals.wins + " 次   ·   尝试 " + totals.attempts + " 次"}</Text>
      <Text x={44} y={box.resourceY - 6} size={12} bold color={c.cyan}>资源</Text>
      <Flat rect={box.resourcePager.prev} radius={6} fill="rgba(38, 56, 66, .90)" stroke="rgba(153, 205, 218, .24)" label="‹" size={13} baseline={14} color={view.page > 0 ? c.cyan : c.muted} onClick={function () { actions.setAccountResourcePage(-1); }} />
      <Flat rect={box.resourcePager.next} radius={6} fill="rgba(38, 56, 66, .90)" stroke="rgba(153, 205, 218, .24)" label="›" size={13} baseline={14} color={view.page < view.pages - 1 ? c.cyan : c.muted} onClick={function () { actions.setAccountResourcePage(1); }} />
      <Text x={272} y={box.resourceY - 6} size={9} align="center" color={c.muted}>{(view.page + 1) + "/" + view.pages}</Text>
      <Panel rect={{ x: 38, y: box.resourceY, w: 284, h: box.resourceHeight }} radius={14} fill="rgba(13, 34, 46, .92)" stroke="rgba(153, 205, 218, .16)" />
      {view.items.map(function (item, index) {
        const column = index % 4;
        const line = Math.floor(index / 4);
        const x = 48 + column * 72;
        const y = box.resourceY + 18 + line * 24;
        return (
          <div key={item.id || index}>
            <Dot x={x - 7} y={y - 4} r={4} fill={item.color} stroke="rgba(255, 255, 255, .24)" />
            <Text x={x} y={y} size={9} color={c.muted}>{String(item.name).slice(0, 7)}</Text>
            <Text x={x} y={y + 12} size={11} bold color={item.color}>{String(item.amount)}</Text>
          </div>
        );
      })}
      <Text x={44} y={box.recordY - 12} size={12} bold color={c.cyan}>关卡记录</Text>
      {!records.length ? <Text x={44} y={box.recordY + 8} size={11} color={c.muted}>暂无记录 · 通关一局后会自动出现在这里</Text> : records.map(function (row, index) {
        const level = game().config.levels.filter(function (item) { return item.id === row.levelId; })[0];
        const y = box.recordY + 8 + index * box.recordStep;
        return (
          <div key={row.levelId + "-" + index}>
            <Text x={44} y={y} size={11} bold color={row.completed ? c.green : c.muted}>{pad2(row.levelId)}</Text>
            <Text x={70} y={y} size={11} color={c.text}>{level ? level.name : "关卡 " + row.levelId}</Text>
            <Text x={322} y={y} size={10} align="right" color={c.muted}>{recordSummary(row)}</Text>
          </div>
        );
      })}
      {snapshot.accountNotice ? <Text x={W / 2} y={508} size={10} align="center" color={c.green}>{snapshot.accountNotice}</Text> : null}
      <Btn rect={box.importButton} label="导入旧进度" color="#4b7180" onClick={function () { actions.importLegacy(); }} />
      <Btn rect={box.logoutButton} label="注销登录" color="#4b7180" onClick={function () { actions.logout(); }} />
      <Btn rect={box.deleteButton} label="删除账户" color={c.red} onClick={function () { removing[1](true); }} />
      <Btn rect={ui.back} label="返回首页" color="#4b7180" onClick={function () { actions.backToMenu(); }} />
      {removing[0] ? <DeleteDialog onClose={function () { removing[1](false); }} /> : null}
    </Stage>
  );
}

function AttributesScreen(props) {
  const ui = game().config.attributesUI;
  const c = colors(props.snapshot);
  const W = width();
  const view = game().attributes.get();
  const stats = [
    { label: "攻击力", value: String(Math.round(view.attack)), color: c.cyan },
    { label: "冷却缩减", value: percent(view.cooldownReduction), color: c.cyan },
    { label: "防线血量", value: String(view.wallMaxHp), color: c.green },
    { label: "暴击率", value: percent(view.critRate), color: c.yellow },
    { label: "暴击伤害", value: percent(view.critDamage), color: c.yellow },
    { label: "负面时间", value: percent(view.statusDurationMultiplier), color: c.purple }
  ];
  const elementIds = (ui.elementOrder || Object.keys(game().config.elements)).filter(function (id) { return !!game().config.elements[id]; });
  const traitRow1 = [];
  const traitRow2 = [];
  if (view.wallBlockCharges) traitRow1.push("格挡 " + view.wallBlockCharges + " 次/局");
  if (view.eliteDamage) traitRow1.push("首领 +" + percent(view.eliteDamage));
  if (view.debuffDamage) traitRow1.push("负面 +" + percent(view.debuffDamage));
  if (view.rifleDamage) traitRow2.push("枪械 +" + percent(view.rifleDamage));
  if (view.lowWallDamage) traitRow2.push("低血 +" + percent(view.lowWallDamage));
  return (
    <Stage width={props.snapshot.viewWidth} height={props.snapshot.viewHeight}>
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .96)" stroke="rgba(153, 205, 218, .22)" />
      <Badge x={102} y={70} w={156} label="SURVIVOR  ATTRIBUTES" color={c.cyan} />
      <Text x={W / 2} y={ui.titleY} size={25} bold align="center" color={c.yellow}>角色属性</Text>
      <Text x={W / 2} y={ui.subtitleY} size={11} align="center" color={c.muted}>基础属性 + 装备 / 城墙 / 宝石加成 · 攻击力与元素攻击力为数值</Text>
      {[0, 1, 2].map(function (row) {
        return [0, 1].map(function (column) {
          const item = stats[row + column * 3];
          const x = ui.statX[column];
          const y = ui.statY[row];
          return (
            <div key={item.label}>
              <Text x={x} y={y} size={10} color={c.muted}>{item.label}</Text>
              <Text x={x} y={y + 20} size={18} bold color={item.color}>{item.value}</Text>
            </div>
          );
        });
      })}
      <Text x={44} y={ui.elementTitleY} size={12} bold color={c.cyan}>元素攻击力</Text>
      {elementIds.map(function (id, index) {
        const info = game().config.elements[id];
        const x = ui.elementX[index % 3];
        const y = ui.elementY[Math.floor(index / 3)];
        return (
          <div key={id}>
            <Dot x={x} y={y + 4} r={4} fill={info.color} stroke="rgba(255, 255, 255, .24)" />
            <Text x={x + 10} y={y + 8} size={10}>{info.name + "系"}</Text>
            <Text x={x + 10} y={y + 24} size={15} bold color={info.color}>{String(Math.round(view.elementAttack[id]))}</Text>
          </div>
        );
      })}
      {[traitRow1, traitRow2].map(function (row, index) {
        if (!row.length) return null;
        return <Text key={index} x={W / 2} y={ui.gemTraitY + index * 12} size={8} align="center" color={c.cyan}>{(index === 0 ? "宝石特效 · " : "") + row.join(" · ")}</Text>;
      })}
      {view.lowWallDamage ? <Text x={W / 2} y={ui.gemTraitNoteY} size={8} align="center" color={c.muted}>{"低血增伤在防线血量低于 " + Math.round((game().config.gems.lowWallHpThreshold || 0.35) * 100) + "% 时生效"}</Text> : null}
      <Text x={W / 2} y={ui.noteY} size={9} align="center" color={c.muted}>攻击与元素加成对直接命中与持续伤害生效</Text>
      <Text x={W / 2} y={ui.noteY + 16} size={9} align="center" color={c.muted}>攻击 / 元素无上限 · 装备、城墙与宝石加成生效</Text>
      <Text x={W / 2} y={ui.noteY + 32} size={9} align="center" color={c.muted}>暴击仅作用于步枪</Text>
      <Btn rect={ui.back} label="返回角色" color="#4b7180" onClick={function () { actions.backToCharacter(); }} />
    </Stage>
  );
}

function EquipmentScreen(props) {
  const snapshot = props.snapshot;
  const ui = game().config.equipmentUI;
  const c = colors(snapshot);
  const W = width();
  const slots = game().equipment.getSlots();
  const stateReady = ready(snapshot);
  const bagCount = game().equipment.getBag().length;
  const message = snapshot.equipmentError || snapshot.equipmentNotice || "材料：金币 + 部位专属图纸 · 关卡奖励产出";
  return (
    <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .96)" stroke="rgba(153, 205, 218, .22)" />
      <Badge x={101} y={70} w={158} label="LOADOUT  ·  EQUIPMENT" color={c.yellow} />
      <Text x={W / 2} y={ui.titleY} size={25} bold align="center" color={c.yellow}>装备强化</Text>
      <Text x={W / 2} y={ui.subtitleY} size={11} align="center" color={c.muted}>六部位 · 攻击与元素加成随等级提升</Text>
      {stateReady ? <Text x={44} y={ui.resourceY} size={10} bold color={c.yellow}>{"金币 " + (resources().coin || 0)}</Text> : <Text x={44} y={ui.resourceY} size={10} color={c.muted}>登录后可查看与强化装备</Text>}
      {stateReady ? <Text x={316} y={ui.resourceY} size={10} align="right" color={c.muted}>图纸按部位</Text> : null}
      {slots.map(function (slot, index) {
        const card = game().getEquipmentCardRect(index);
        const button = game().getEquipmentUpgradeRect(index);
        const cost = slot.nextCost;
        const label = !stateReady ? "未登录" : (!slot.level ? "未获取" : (slot.maxed ? "已满级" : (snapshot.equipmentBusySlot === slot.id ? "强化中…" : "强化")));
        const enabled = stateReady && !!slot.level && !slot.maxed && !snapshot.equipmentBusy;
        const coinNeed = cost ? Math.round(cost.coin || 0) : 0;
        const blueprintNeed = cost ? Math.round(cost[slot.blueprintId] || 0) : 0;
        return (
          <div key={slot.id}>
            <Rect rect={card} radius={12} fill="rgba(13, 34, 46, .94)" stroke={slot.color} />
            <Dot x={card.x + 16} y={card.y + 18} r={5} fill={slot.color} stroke="rgba(255, 255, 255, .24)" />
            <Text x={card.x + 28} y={card.y + 22} size={14} bold>{slot.name}</Text>
            <Text x={card.x + card.w - 10} y={card.y + 21} size={10} bold align="right" color={slot.level ? c.cyan : c.muted}>{slot.level ? "Lv." + slot.level + " / " + slot.maxLevel : (stateReady ? "未获取" : "未登录")}</Text>
            <Text x={card.x + 12} y={card.y + 44} size={11}>{"攻击 +" + slot.attackBonus}</Text>
            <Text x={card.x + card.w - 12} y={card.y + 44} size={11} bold align="right" color={slot.elementColor}>{(slot.elementName || "—") + " +" + slot.elementBonus}</Text>
            {slot.level && cost && !slot.maxed ? <Text x={card.x + 12} y={card.y + 64} size={8} color={slot.coin >= coinNeed ? c.green : c.red}>{"金币 " + slot.coin + "/" + coinNeed}</Text> : null}
            {slot.level && cost && !slot.maxed ? <Text x={card.x + 12} y={card.y + 76} size={8} color={slot.blueprint >= blueprintNeed ? c.green : c.red}>{"图纸 " + slot.blueprint + "/" + blueprintNeed}</Text> : null}
            {slot.level && slot.maxed ? <Text x={card.x + 12} y={card.y + 72} size={9} bold color={c.yellow}>已满级</Text> : null}
            {!(slot.level && cost && !slot.maxed) && !(slot.level && slot.maxed) ? <Text x={card.x + 12} y={card.y + 72} size={9} color={c.muted}>{stateReady ? "同步中" : "请先登录账户"}</Text> : null}
            <Flat rect={button} radius={7} fill={enabled ? (slot.affordable ? c.green : c.yellow) : "rgba(38, 56, 66, .9)"} stroke={enabled ? "rgba(255, 255, 255, .2)" : "rgba(153, 205, 218, .16)"} label={label} size={10} baseline={14} color={enabled ? "#071217" : c.muted} onClick={enabled ? function () { actions.upgradeEquipment(slot.id); } : undefined} />
          </div>
        );
      })}
      <Text x={W / 2} y={ui.noteY} size={9} align="center" color={snapshot.equipmentError ? c.red : (snapshot.equipmentNotice ? c.green : c.muted)}>{clip(message, 34)}</Text>
      <Btn rect={ui.bag} label={bagCount ? "装备背包 · " + bagCount : "装备背包"} color="#4b7180" onClick={function () { actions.openEquipmentBag(); }} />
      <Btn rect={ui.back} label="返回属性" color="#4b7180" onClick={function () { actions.backToCharacter(); }} />
    </Stage>
  );
}

function EquipmentBagScreen(props) {
  const snapshot = props.snapshot;
  const ui = game().config.equipmentBagUI;
  const c = colors(snapshot);
  const W = width();
  const stateReady = ready(snapshot);
  const view = game().equipment.getBagPart(snapshot.equipmentBagPart);
  const message = snapshot.equipmentBagError || snapshot.equipmentBagNotice || "掉落装备会进入背包，同部位同元素可以重复持有";
  const summary = view.name + " Lv." + view.level + " · 当前 " + (view.equippedName || "未装备") + " · 背包 " + view.total + " 件";
  return (
    <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .96)" stroke="rgba(153, 205, 218, .22)" />
      <Badge x={105} y={70} w={150} label="EQUIPMENT  ·  BAG" color={c.cyan} />
      <Text x={W / 2} y={ui.titleY} size={25} bold align="center" color={c.yellow}>装备背包</Text>
      <Text x={W / 2} y={ui.subtitleY} size={11} align="center" color={c.muted}>换装只改元素 · 强化等级保留在部位</Text>
      {game().config.equipment.slots.map(function (slot, index) {
        const rect = game().getEquipmentBagTabRect(index);
        const active = slot.id === view.partId;
        return <Flat key={slot.id} rect={rect} radius={8} fill={active ? "rgba(104, 216, 255, .22)" : "rgba(13, 34, 46, .9)"} stroke={active ? c.cyan : "rgba(153, 205, 218, .18)"} label={slot.short} size={12} baseline={18} color={active ? c.text : c.muted} onClick={function () { actions.selectEquipmentBagPart(slot.id); }} />;
      })}
      <Text x={34} y={ui.summaryY} size={11} color={stateReady ? c.text : c.muted}>{stateReady ? summary : "登录后可查看装备背包"}</Text>
      {view.rows.map(function (row, index) {
        const rect = game().getEquipmentBagRowRect(index);
        const button = game().getEquipmentBagButtonRect(index);
        const dim = !row.count && !row.equipped;
        const enabled = stateReady && !snapshot.equipmentBagBusy && row.count > 0 && !row.equipped;
        const label = row.equipped ? "已装备" : (row.count ? (snapshot.equipmentBagBusy ? "换装中…" : "装备") : "—");
        return (
          <div key={row.element}>
            <Rect rect={rect} radius={10} fill={row.equipped ? "rgba(27, 63, 78, .96)" : "rgba(13, 34, 46, .88)"} stroke={row.equipped ? "rgba(99, 230, 160, .36)" : "rgba(153, 205, 218, .14)"} />
            <Dot x={rect.x + 16} y={rect.y + rect.h / 2} r={5} fill={dim ? "rgba(154, 176, 188, .4)" : row.color} />
            <Text x={rect.x + 30} y={rect.y + rect.h / 2 + 4} size={12} bold color={dim ? "rgba(154, 176, 188, .55)" : row.color}>{row.name}</Text>
            <Text x={rect.x + 170} y={rect.y + rect.h / 2 + 4} size={11} color={dim ? "rgba(154, 176, 188, .55)" : c.text}>{"×" + row.count}</Text>
            <Flat rect={button} radius={7} fill={enabled ? c.cyan : "rgba(38, 56, 66, .9)"} stroke={enabled ? "rgba(255, 255, 255, .2)" : "rgba(153, 205, 218, .16)"} label={label} size={10} baseline={18} color={enabled ? "#071217" : c.muted} onClick={enabled ? function () { actions.equipBagItem(row.itemId); } : undefined} />
          </div>
        );
      })}
      <Text x={W / 2} y={ui.noteY} size={9} align="center" color={snapshot.equipmentBagError ? c.red : (snapshot.equipmentBagNotice ? c.green : c.muted)}>{clip(message, 30)}</Text>
      <Btn rect={ui.back} label="返回装备" color="#4b7180" onClick={function () { actions.backToEquipment(); }} />
    </Stage>
  );
}

function WallScreen(props) {
  const snapshot = props.snapshot;
  const ui = game().config.wallUI;
  const c = colors(snapshot);
  const W = width();
  const view = game().wall.getView();
  const stateReady = snapshot.accountStatus === "ready" && view.ready;
  const bt = view.breakthrough;
  const next = bt.atLevel;
  const busy = snapshot.wallBusy;
  const rare = stateReady && !view.maxed && bt.required;
  const material = rare ? "rareEarth" : "steel";
  const main = ui.mainCard;
  const card = ui.actionCard;
  const progress = view.maxed ? 1 : (next ? clamp((view.level - (next - game().config.wall.breakthroughStep)) / game().config.wall.breakthroughStep, 0, 1) : 1);
  const progressText = view.maxed ? "已达到最高等级" : (bt.required ? "已达到 Lv." + next + " 突破节点" : "距离 Lv." + next + " 突破还差 " + Math.max(0, next - view.level) + " 级");
  const desc = !stateReady ? "登录后查看城墙材料" : (view.maxed ? "城墙已达到最高等级" : (rare ? "Lv." + bt.atLevel + " 突破 · 突破无属性加成" : "Lv." + view.level + " → " + (view.level + 1) + " · 血量 +" + view.hpPerLevel));
  const hint = !stateReady ? "材料：钢材 + 稀土" : (view.maxed ? "钢材与稀土不再消耗" : (rare ? "突破只解锁后续等级，不增加血量" : "每次强化提高 " + view.hpPerLevel + " 防线血量"));
  let costLabel = "材料数量登录后显示";
  let costColor = c.muted;
  if (stateReady && view.maxed) { costLabel = "已满级"; costColor = c.yellow; }
  else if (stateReady && rare) { costLabel = "稀土 " + view.rareEarth + "/" + bt.cost; costColor = view.rareEarth >= bt.cost ? c.green : c.red; }
  else if (stateReady) { costLabel = "钢材 " + view.steel + "/" + view.nextSteelCost; costColor = view.steel >= view.nextSteelCost ? c.green : c.red; }
  const button = game().getWallActionButtonRect();
  let label = "未登录";
  let enabled = false;
  if (!stateReady) label = "未登录";
  else if (view.maxed) label = "已满级";
  else if (rare) { label = busy && snapshot.wallAction === "breakthrough" ? "突破中…" : "突破"; enabled = view.canBreakthrough && !busy; }
  else { label = busy && snapshot.wallAction === "level" ? "强化中…" : "强化"; enabled = view.canLevel && !busy; }
  let fill = "rgba(38, 56, 66, .9)";
  if (enabled) fill = rare ? (view.rareEarth >= bt.cost ? "#f2c14e" : "#d0a940") : (view.steel >= view.nextSteelCost ? c.green : c.yellow);
  const message = snapshot.wallError || snapshot.wallNotice || (rare ? "突破后继续用钢材强化 · 关卡奖励产出" : "材料：钢材 + 稀土 · 关卡奖励产出");
  return (
    <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .96)" stroke="rgba(153, 205, 218, .22)" />
      <Badge x={107} y={70} w={146} label="DEFENSE  ·  WALL" color={c.cyan} />
      <Text x={W / 2} y={ui.titleY} size={25} bold align="center" color={c.yellow}>城墙材料</Text>
      <Text x={W / 2} y={ui.subtitleY} size={11} align="center" color={c.muted}>钢材升级血量 · 每 10 级消耗稀土突破</Text>
      {stateReady ? <MaterialLabel kind="steel" label={"钢材 " + view.steel} x={48} y={ui.resourceY} color="#c8d6dd" /> : <Text x={44} y={ui.resourceY} size={10} color={c.muted}>登录后可查看与强化城墙</Text>}
      {stateReady ? <MaterialLabel kind="rareEarth" label={"稀土 " + view.rareEarth} x={316} y={ui.resourceY} color="#f2c14e" align="right" /> : null}
      <Panel rect={main} radius={14} fill="rgba(17, 47, 62, .94)" stroke="rgba(104, 216, 255, .22)" />
      <Text x={main.x + 16} y={main.y + 22} size={10} color={c.muted}>防线等级</Text>
      <Text x={main.x + 16} y={main.y + 47} size={21} bold color={stateReady ? c.cyan : c.muted}>{stateReady ? "Lv." + view.level + " / " + view.maxLevel : "未登录"}</Text>
      <Text x={main.x + 150} y={main.y + 22} size={10} color={c.muted}>防线血量</Text>
      <Text x={main.x + 150} y={main.y + 46} size={18} bold color={c.green}>{stateReady ? String(view.maxHp) : "1000"}</Text>
      <Rect rect={{ x: main.x + 16, y: main.y + 64, w: main.w - 32, h: 8 }} radius={4} fill="rgba(5, 16, 23, .9)" />
      <Rect rect={{ x: main.x + 16, y: main.y + 64, w: (main.w - 32) * progress, h: 8 }} radius={4} fill={c.cyan} />
      <Text x={main.x + 16} y={main.y + 92} size={9} color={bt.required ? c.yellow : c.muted}>{stateReady ? progressText : "登录后显示城墙进度"}</Text>
      <Panel rect={card} radius={14} fill="rgba(13, 34, 46, .94)" stroke={rare ? "rgba(242, 193, 78, .44)" : "rgba(200, 214, 221, .32)"} />
      <MaterialMark kind={material} x={card.x + 40} y={card.y + 48} size={44} />
      <Text x={card.x + 72} y={card.y + 34} size={14} bold>{rare ? "稀土突破" : "钢材强化"}</Text>
      <Text x={card.x + 72} y={card.y + 56} size={10} color={c.muted}>{desc}</Text>
      <Text x={card.x + 72} y={card.y + 76} size={9} color={c.muted}>{hint}</Text>
      <MaterialLabel kind={material} label={costLabel} x={card.x + 72} y={card.y + 99} color={costColor} />
      <Flat rect={button} radius={9} fill={fill} stroke={enabled ? "rgba(255, 255, 255, .2)" : "rgba(153, 205, 218, .16)"} onClick={enabled ? function () { actions.upgradeWall(rare ? "breakthrough" : "level"); } : undefined} />
      {stateReady ? <MaterialMark kind={material} x={button.x + 22} y={button.y + 17} size={16} /> : null}
      <Text x={button.x + button.w / 2 + (stateReady ? 8 : 0)} y={button.y + 22} size={11} bold align="center" color={enabled ? "#071217" : c.muted}>{label}</Text>
      <Text x={W / 2} y={ui.noteY} size={9} align="center" color={snapshot.wallError ? c.red : (snapshot.wallNotice ? c.green : c.muted)}>{clip(message, 34)}</Text>
      <Btn rect={ui.back} label="返回角色" color="#4b7180" onClick={function () { actions.backToCharacter(); }} />
    </Stage>
  );
}

function SkillProgressScreen(props) {
  const snapshot = props.snapshot;
  const ui = game().config.skillProgressUI;
  const c = colors(snapshot);
  const W = width();
  const stateReady = ready(snapshot);
  const view = game().getSkillProgressRows();
  const owned = resources();
  const note = snapshot.skillError || snapshot.skillNotice || (stateReady ? "技能伤害与冷却只作用于对应核心技能" : "未登录时不会发送强化请求");
  return (
    <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .96)" stroke="rgba(153, 205, 218, .22)" />
      <Flat rect={ui.back} radius={9} fill="rgba(38, 56, 66, .90)" stroke="rgba(153, 205, 218, .28)" label="‹ 角色" size={10} baseline={18} color={c.text} onClick={function () { actions.backToCharacter(); }} />
      <Text x={W / 2} y={ui.titleY} size={25} bold align="center" color={c.yellow}>技能强化</Text>
      <Text x={W / 2} y={ui.subtitleY} size={11} align="center" color={stateReady ? c.muted : c.yellow}>{stateReady ? "账户等级 1–31 · 局内词条等级独立" : "登录后保存技能等级"}</Text>
      {view.items.map(function (skill, index) {
        const rect = game().getSkillProgressCardRect(index);
        const action = game().getSkillProgressButtonRect(index);
        const blueprint = owned[skill.blueprintId] || 0;
        const cost = skill.nextCost || {};
        const maxed = skill.level >= skill.maxLevel;
        const affordable = !cost.coin || ((owned.coin || 0) >= cost.coin && blueprint >= (cost[skill.blueprintId] || 0));
        const skillBusy = snapshot.skillBusy && snapshot.skillBusyId === skill.skillId;
        const enabled = stateReady && !snapshot.skillBusy && !maxed && affordable;
        let nextName = "全部节点已解锁";
        for (let node = 0; node < skill.milestones.length; node += 1) {
          if (!skill.milestones[node].unlocked) { nextName = "下一节点 Lv." + skill.milestones[node].level + " · " + skill.milestones[node].name; break; }
        }
        const label = skillBusy ? "强化中" : maxed ? "已满级" : !stateReady ? "未登录" : !affordable ? "材料不足" : "强化";
        return (
          <div key={skill.skillId}>
            <Rect rect={rect} radius={10} fill="rgba(13, 34, 46, .95)" stroke={skill.color} />
            <SkillMark id={skill.skillId} x={rect.x + 24} y={rect.y + 30} size={28} color={skill.color} />
            <Text x={rect.x + 45} y={rect.y + 18} size={12} bold>{skill.name}</Text>
            <Text x={rect.x + rect.w - 10} y={rect.y + 34} size={9} bold align="right" color={skill.color}>{"Lv." + skill.level + " / " + skill.maxLevel}</Text>
            <Text x={rect.x + 10} y={rect.y + 47} size={8} color={c.muted}>{"伤害 +" + Math.round(skill.damageBonus * 100) + "% · 冷却 −" + Math.round(skill.cooldownReduction * 100) + "%"}</Text>
            <Text x={rect.x + 10} y={rect.y + 61} size={8} color={c.cyan}>{clip(nextName, 24)}</Text>
            <Text x={rect.x + 10} y={rect.y + 75} size={8} color={maxed ? c.green : c.muted}>{maxed ? "已达最高等级" : "金币 " + (cost.coin || 0) + " · 图纸 " + (blueprint || 0) + "/" + (cost[skill.blueprintId] || 0)}</Text>
            <Flat rect={action} radius={8} fill={enabled ? skill.color : "rgba(38, 56, 66, .90)"} stroke={enabled ? "rgba(255, 255, 255, .24)" : "rgba(153, 205, 218, .16)"} label={label} size={9} baseline={18} color={enabled ? "#071217" : c.muted} onClick={enabled ? function () { actions.upgradeSkill(skill.skillId); } : undefined} />
          </div>
        );
      })}
      <Pager snapshot={snapshot} rect={game().getSkillProgressPagerRect("prev")} label="‹" enabled={view.page > 0} color={c.purple} onClick={function () { actions.setSkillProgressPage(-1); }} />
      <Pager snapshot={snapshot} rect={game().getSkillProgressPagerRect("next")} label="›" enabled={view.page < view.pages - 1} color={c.purple} onClick={function () { actions.setSkillProgressPage(1); }} />
      <Text x={W / 2} y={ui.noteY} size={9} align="center" color={c.muted}>{(view.page + 1) + " / " + view.pages}</Text>
      <Text x={W / 2} y={548} size={9} align="center" color={snapshot.skillError ? c.red : snapshot.skillNotice ? c.green : c.muted}>{clip(note, 34)}</Text>
    </Stage>
  );
}

function CharacterScreen(props) {
  const snapshot = props.snapshot;
  const ui = game().config.characterUI;
  const c = colors(snapshot);
  const W = width();
  const stateReady = ready(snapshot);
  const busy = snapshot.gemBusy;
  const part = snapshot.characterPart || "arm";
  const tab = snapshot.characterTab === "equipment" || snapshot.characterTab === "resource" ? snapshot.characterTab : "gem";
  const slots = game().equipment.getSlots();
  const backRect = game().getCharacterHeaderRect("back");
  const attrRect = game().getCharacterHeaderRect("attributes");
  const subtitle = snapshot.gemError || snapshot.gemNotice || (stateReady ? "六件装备 · 点击方块查看宝石槽位" : (snapshot.statusNote || "正在连接账户服务…"));
  const wallView = game().wall.getView();
  const owned = resources();
  const actionsInfo = [
    { key: "skill", name: "技能强化", sub: stateReady ? "12 项技能" : "未登录", color: c.purple, run: function () { actions.openSkillProgress(); } },
    { key: "equip", name: "装备强化", sub: stateReady ? "金币 " + (owned.coin || 0) : "未登录", color: c.yellow, run: function () { actions.openEquipment(); } },
    { key: "wall", name: "城墙强化", sub: stateReady ? "Lv." + wallView.level + " · 钢材 " + (owned.steel || 0) : "未登录", color: c.cyan, run: function () { actions.openWall(); } }
  ];
  return (
    <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .96)" stroke="rgba(153, 205, 218, .22)" />
      <Flat rect={backRect} radius={9} fill="rgba(38, 56, 66, .90)" stroke="rgba(153, 205, 218, .28)" label="‹ 首页" size={10} baseline={18} color={c.text} onClick={function () { actions.backToMenu(); }} />
      <Badge x={ui.badge.x} y={ui.badge.y} w={ui.badge.w} label="CHARACTER  ·  LOADOUT" color={c.cyan} />
      <Flat rect={attrRect} radius={9} fill="rgba(104, 216, 255, .16)" stroke={c.cyan} label="属性" size={11} baseline={18} color={c.text} onClick={function () { actions.openAttributes(); }} />
      <Text x={W / 2} y={ui.titleY} size={25} bold align="center" color={c.yellow}>角色</Text>
      <Text x={W / 2} y={ui.subtitleY} size={11} align="center" color={snapshot.gemError ? c.red : (snapshot.gemNotice ? c.green : c.muted)}>{clip(subtitle, 30)}</Text>
      {slots.map(function (slot, index) {
        const rect = game().getCharacterSlotRect(index);
        const info = game().getCharacterSlotInfoRect(index);
        const active = slot.id === part;
        const ownedSlot = !!slot.level;
        return (
          <div key={slot.id}>
            <Flat rect={rect} radius={10} fill={active ? "rgba(20, 52, 68, .98)" : "rgba(13, 34, 46, .94)"} stroke={active ? slot.color : (ownedSlot ? "rgba(153, 205, 218, .28)" : "rgba(153, 205, 218, .12)")} onClick={function () { actions.openCharacterGems(slot.id); }} />
            <Glyph kind={slot.id} x={rect.x + rect.w / 2} y={rect.y + 32} size={30} color={ownedSlot ? (slot.elementColor || slot.color) : "rgba(90, 116, 130, .60)"} />
            <Text x={rect.x + 6} y={rect.y + 12} size={9} bold color={ownedSlot ? c.text : c.muted}>{slot.name}</Text>
            {ownedSlot ? <Dot x={rect.x + rect.w - 8} y={rect.y + 9} r={3.5} fill={slot.elementColor} stroke="rgba(255, 255, 255, .30)" /> : null}
            <Text x={rect.x + rect.w / 2} y={rect.y + rect.h - 6} size={9} bold align="center" color={ownedSlot ? c.cyan : c.muted}>{ownedSlot ? "Lv." + slot.level : (stateReady ? "未获取" : "未登录")}</Text>
            {ownedSlot ? <Text x={info.x} y={info.y + 18} size={9} bold color={slot.elementColor}>{slot.elementName + "系"}</Text> : <Text x={info.x} y={info.y + 18} size={9} color={c.muted}>未获取</Text>}
            {ownedSlot ? <Text x={info.x} y={info.y + 34} size={9}>{"攻击 +" + slot.attackBonus}</Text> : <Text x={info.x} y={info.y + 34} size={8} color={c.muted}>{stateReady ? "强化后解锁" : "登录后同步"}</Text>}
            {ownedSlot ? <Text x={info.x} y={info.y + 50} size={9} color={slot.elementColor}>{"元素 +" + slot.elementBonus}</Text> : null}
          </div>
        );
      })}
      {actionsInfo.map(function (item) {
        const rect = game().getCharacterActionRect(item.key);
        return (
          <div key={item.key}>
            <Flat rect={rect} radius={10} fill="rgba(13, 34, 46, .94)" stroke={item.color} onClick={item.run} />
            <Text x={rect.x + rect.w / 2} y={rect.y + 15} size={12} bold align="center">{item.name}</Text>
            <Text x={rect.x + rect.w / 2} y={rect.y + 28} size={8} align="center" color={c.muted}>{clip(item.sub, 16)}</Text>
          </div>
        );
      })}
      <Text x={34} y={ui.bagTitleY} size={12} bold color={c.cyan}>{"背包 · " + (tab === "gem" ? "宝石" : tab === "equipment" ? "装备" : "资源")}</Text>
      <CharacterBag snapshot={snapshot} tab={tab} />
      {["宝石", "装备", "资源"].map(function (label, index) {
        const key = ["gem", "equipment", "resource"][index];
        const rect = game().getCharacterTabRect(index);
        const active = tab === key;
        return <Flat key={key} rect={rect} radius={10} fill={active ? "rgba(104, 216, 255, .24)" : "rgba(13, 34, 46, .92)"} stroke={active ? c.cyan : "rgba(153, 205, 218, .18)"} label={label} size={13} baseline={24} color={active ? c.text : c.muted} onClick={function () { actions.setCharacterTab(key); }} />;
      })}
      {snapshot.characterGems ? <GemSocket snapshot={snapshot} /> : null}
      {snapshot.characterEquipItem ? <EquipDetail snapshot={snapshot} /> : null}
      {snapshot.characterGemDetail ? <GemDetail snapshot={snapshot} /> : null}
      {snapshot.characterResourceDetail ? <ResourceDetail snapshot={snapshot} /> : null}
      {snapshot.gemSynthesisOpen ? <GemSynthesis snapshot={snapshot} /> : null}
    </Stage>
  );
}

function CharacterBag(props) {
  const snapshot = props.snapshot;
  const ui = game().config.characterUI;
  const c = colors(snapshot);
  const stateReady = ready(snapshot);
  const tab = props.tab;
  if (tab === "gem") {
    const view = game().getCharacterGemRows();
    const summary = game().getGemSynthesisSummary();
    const actionRect = game().getCharacterBagActionRect();
    const synthEnabled = stateReady && !snapshot.gemBusy && summary.recipes > 0;
    const synthLabel = !stateReady ? "未登录" : (summary.recipes ? "一键合成" : "暂无可合成");
    const note = snapshot.gemError || snapshot.gemNotice || (stateReady ? "已镶嵌宝石才提供属性 · 一键合成会先确认" : "登录后可镶嵌、锁定与合成宝石");
    return (
      <div>
        <Pager snapshot={snapshot} rect={game().getCharacterGemPagerRect("prev")} label="‹" enabled={view.page > 0} color={c.cyan} onClick={function () { actions.setCharacterGemPage(-1); }} />
        <Pager snapshot={snapshot} rect={game().getCharacterGemPagerRect("next")} label="›" enabled={view.page < view.pages - 1} color={c.cyan} onClick={function () { actions.setCharacterGemPage(1); }} />
        <Text x={226} y={ui.bagTitleY - 2} size={9} align="center" color={c.muted}>{(view.page + 1) + "/" + view.pages}</Text>
        <Flat rect={actionRect} radius={7} fill={synthEnabled ? c.green : "rgba(38, 56, 66, .90)"} stroke={synthEnabled ? "rgba(255, 255, 255, .24)" : "rgba(153, 205, 218, .16)"} label={synthLabel} size={9} baseline={14} color={synthEnabled ? "#071217" : c.muted} onClick={synthEnabled ? function () { actions.openGemSynthesis(); } : undefined} />
        {!view.total ? <Text x={ui.gemCells.x + 8} y={ui.gemCells.y + 26} size={9} color={c.muted}>{stateReady ? "暂无未镶嵌宝石 · 关卡奖励会掉落宝石" : "登录后显示宝石背包"}</Text> : null}
        {view.items.slice(0, ui.gemCells.columns * ui.gemCells.rows).map(function (gem, index) {
          const rect = game().getCharacterGemCellRect(index);
          const lock = game().getCharacterGemLockRect(index);
          const part = partInfo(gem.partId);
          return (
            <div key={gem.id}>
              <Flat rect={rect} radius={8} fill="rgba(13, 34, 46, .92)" stroke={gem.color} onClick={function () { if (stateReady && !snapshot.gemBusy) actions.openCharacterGemDetail(gem.id); }} />
              <GemMark x={rect.x + rect.w / 2} y={rect.y + 20} size={15} color={gem.color} />
              <Text x={rect.x + rect.w / 2} y={rect.y + 33} size={7} align="center">{String(gem.affix.name).slice(0, 5)}</Text>
              <Text x={rect.x + rect.w / 2} y={rect.y + 41} size={7} bold align="center" color={gem.color}>{affixValue(gem.affix)}</Text>
              <Text x={rect.x + 5} y={rect.y + 10} size={7} bold color={part.color}>{part.short}</Text>
              <Flat rect={lock} radius={4} fill={gem.locked ? "rgba(255, 209, 102, .22)" : "rgba(26, 57, 70, .90)"} stroke={gem.locked ? "rgba(255, 209, 102, .58)" : "rgba(153, 205, 218, .26)"} label={gem.locked ? "🔒" : "锁"} size={gem.locked ? 8 : 7} baseline={11} color={gem.locked ? c.yellow : c.muted} onClick={function () { if (stateReady && !snapshot.gemBusy) actions.toggleGemLock(gem.id); }} />
            </div>
          );
        })}
        <Text x={width() / 2} y={ui.statusY} size={8} align="center" color={snapshot.gemError ? c.red : (snapshot.gemNotice ? c.green : c.muted)}>{clip(note, 34)}</Text>
      </div>
    );
  }
  if (tab === "equipment") {
    const view = game().getCharacterEquipRows();
    const note = snapshot.equipmentBagError || snapshot.equipmentBagNotice || (stateReady ? "点击装备查看详情 · 替换只改元素" : "登录后可替换装备");
    return (
      <div>
        <Pager snapshot={snapshot} rect={game().getCharacterEquipPagerRect("prev")} label="‹" enabled={view.page > 0} color={c.cyan} onClick={function () { actions.setCharacterEquipPage(-1); }} />
        <Pager snapshot={snapshot} rect={game().getCharacterEquipPagerRect("next")} label="›" enabled={view.page < view.pages - 1} color={c.cyan} onClick={function () { actions.setCharacterEquipPage(1); }} />
        <Text x={226} y={ui.bagTitleY - 2} size={9} align="center" color={c.muted}>{(view.page + 1) + "/" + view.pages}</Text>
        {!view.total ? <Text x={ui.equipCells.x + 8} y={ui.equipCells.y + 26} size={9} color={c.muted}>{stateReady ? "暂无装备 · 关卡奖励会掉落" : "登录后显示装备背包"}</Text> : null}
        {view.items.map(function (item, index) {
          const rect = game().getCharacterEquipCellRect(index);
          return (
            <div key={item.id}>
              <Flat rect={rect} radius={8} fill="rgba(13, 34, 46, .92)" stroke={item.equipped ? c.green : item.elementColor} onClick={function () { actions.openCharacterEquip(item.id); }} />
              <Glyph kind={item.slotId} x={rect.x + rect.w / 2} y={rect.y + 20} size={18} color={item.elementColor} />
              <Text x={rect.x + 5} y={rect.y + 10} size={7} bold color={item.partColor}>{item.partShort}</Text>
              {item.equipped ? <Dot x={rect.x + rect.w - 7} y={rect.y + 7} r={3} fill={c.green} stroke="rgba(255, 255, 255, .30)" /> : null}
              <Text x={rect.x + rect.w / 2} y={rect.y + rect.h - 5} size={8} bold align="center" color={item.elementColor}>{item.elementName}</Text>
            </div>
          );
        })}
        <Text x={width() / 2} y={ui.statusY} size={8} align="center" color={snapshot.equipmentBagError ? c.red : (snapshot.equipmentBagNotice ? c.green : c.muted)}>{clip(note, 34)}</Text>
      </div>
    );
  }
  const resourceView = game().getCharacterResourceRows();
  const resourceList = game().getCharacterResources();
  const capacity = ui.resourceCells.columns * ui.resourceCells.rows;
  const note = resourceView.total > capacity ? "共 " + resourceView.total + " 项 · 第 " + (resourceView.page + 1) + "/" + resourceView.pages + " 页" : "资源由关卡奖励产出";
  return (
    <div>
      <Pager snapshot={snapshot} rect={game().getCharacterResourcePagerRect("prev")} label="‹" enabled={resourceView.page > 0} color={c.cyan} onClick={function () { actions.setCharacterResourcePage(-1); }} />
      <Pager snapshot={snapshot} rect={game().getCharacterResourcePagerRect("next")} label="›" enabled={resourceView.page < resourceView.pages - 1} color={c.cyan} onClick={function () { actions.setCharacterResourcePage(1); }} />
      <Text x={226} y={ui.bagTitleY - 2} size={9} align="center" color={c.muted}>{(resourceView.page + 1) + "/" + resourceView.pages}</Text>
      {!resourceList.length ? <Text x={ui.resourceCells.x + 8} y={ui.resourceCells.y + 26} size={9} color={c.muted}>{stateReady ? "暂无资源 · 关卡奖励会产出资源" : "登录后显示资源"}</Text> : null}
      {resourceView.items.slice(0, capacity).map(function (item, index) {
        const rect = game().getCharacterResourceCellRect(index);
        return (
          <div key={item.id}>
            <Flat rect={rect} radius={8} fill="rgba(13, 34, 46, .92)" stroke="rgba(153, 205, 218, .18)" onClick={function () { actions.openCharacterResource(item.id); }} />
            <ResourceMark id={item.id} x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 - 4} size={26} color={item.color} />
            <Text x={rect.x + rect.w - 5} y={rect.y + rect.h - 5} size={10} bold align="right" color={item.color}>{String(item.amount)}</Text>
          </div>
        );
      })}
      <Text x={width() / 2} y={ui.statusY} size={8} align="center" color={c.muted}>{note}</Text>
    </div>
  );
}

function GemSocket(props) {
  const snapshot = props.snapshot;
  const ui = game().config.characterUI;
  const c = colors(snapshot);
  const W = width();
  const stateReady = ready(snapshot);
  const busy = snapshot.gemBusy;
  const part = game().gems.getPart(snapshot.characterGems);
  const slot = game().equipment.getSlot(snapshot.characterGems);
  const replaceGem = game().getCharacterGemReplace();
  const box = game().getCharacterGemPanel();
  const subtitle = stateReady
    ? (replaceGem ? replaceGem.qualityName + " " + replaceGem.affix.text + " · " + part.socketedCount + " / " + part.capacity : "Lv." + (slot ? slot.level : 0) + (slot && slot.elementName ? " · " + slot.elementName + "系" : "") + " · " + part.socketedCount + " / " + part.capacity)
    : (snapshot.statusNote || "正在连接账户服务…");
  const note = replaceGem ? "选择要替换的宝石 · 点关闭取消替换" : (snapshot.gemError || snapshot.gemNotice || "已镶嵌宝石才提供属性 · 锁定不影响镶嵌");
  const close = game().getCharacterGemCloseRect();
  const rows = [];
  for (let index = 0; index < ui.gemRows.rows; index += 1) rows.push(index);
  return (
    <Pop onClose={function () { actions.closeCharacterGems(); }}>
      <Panel rect={box} radius={20} fill="rgba(10, 35, 49, .98)" stroke="rgba(153, 205, 218, .24)" />
      <Badge x={W / 2 - 70} y={box.y + 14} w={140} label="GEM  ·  SOCKETS" color={replaceGem ? c.yellow : c.green} />
      <Text x={W / 2} y={ui.gemPanelTitleY} size={22} bold align="center" color={c.yellow}>{part.name + (replaceGem ? " · 替换宝石" : " · 宝石槽位")}</Text>
      <Text x={W / 2} y={ui.gemPanelSubtitleY} size={10} align="center" color={replaceGem ? replaceGem.color : c.muted}>{subtitle}</Text>
      {rows.map(function (index) {
        const row = game().getCharacterGemSlotRowRect(index);
        const gem = part.sockets[index];
        const button = game().getCharacterGemUnsocketRect(index);
        if (!gem) {
          return (
            <div key={index}>
              <Rect rect={row} radius={10} fill="rgba(7, 20, 28, .62)" stroke="rgba(153, 205, 218, .18)" />
              <Text x={row.x + 20} y={row.y + 26} size={17} bold align="center" color={c.muted}>+</Text>
              <Text x={row.x + 36} y={row.y + 18} size={10} bold color={c.muted}>{"空槽 " + (index + 1)}</Text>
              <Text x={row.x + 36} y={row.y + 33} size={9} color="rgba(154, 176, 188, .70)">{replaceGem ? "点关闭取消替换后可镶嵌" : "在下方宝石背包点击宝石即可镶嵌"}</Text>
            </div>
          );
        }
        const enabled = stateReady && !busy;
        const label = replaceGem ? "替换" : busy ? "处理中" : !stateReady ? "未登录" : "卸下";
        const tint = replaceGem ? c.yellow : c.cyan;
        return (
          <div key={gem.id}>
            <Rect rect={row} radius={10} fill="rgba(13, 34, 46, .96)" stroke={replaceGem ? "rgba(255, 209, 102, .52)" : gem.color} />
            <GemMark x={row.x + 20} y={row.y + 19} size={18} color={gem.color} />
            <Text x={row.x + 36} y={row.y + 16} size={11} bold color={gem.color}>{gem.qualityName + " 宝石"}</Text>
            {gem.locked ? <Text x={row.x + 110} y={row.y + 16} size={10} align="center" color={c.yellow}>🔒</Text> : null}
            <Text x={row.x + 36} y={row.y + 32} size={10}>{clip(gem.affix.text, 18)}</Text>
            <Flat rect={button} radius={8} fill={enabled ? tint : "rgba(38, 56, 66, .90)"} stroke={enabled ? "rgba(255, 255, 255, .24)" : "rgba(153, 205, 218, .16)"} label={label} size={10} baseline={16} color={enabled ? "#071217" : c.muted} onClick={enabled ? function () { if (replaceGem) actions.replaceCharacterGem(replaceGem.id, index); else actions.unsocketGem(gem.id); } : undefined} />
          </div>
        );
      })}
      <Text x={W / 2} y={ui.gemPanelNoteY} size={9} align="center" color={replaceGem ? c.yellow : (snapshot.gemError ? c.red : (snapshot.gemNotice ? c.green : c.muted))}>{clip(note, 34)}</Text>
      <Flat rect={close} radius={10} fill="rgba(38, 56, 66, .94)" stroke="rgba(153, 205, 218, .24)" label="关闭" size={12} baseline={22} color={c.text} onClick={function () { actions.closeCharacterGems(); }} />
    </Pop>
  );
}

function GemDetail(props) {
  const snapshot = props.snapshot;
  const ui = game().config.characterUI;
  const c = colors(snapshot);
  const W = width();
  const detail = game().getCharacterGemDetail();
  if (!detail) return null;
  const gem = detail.gem;
  const plan = detail.plan;
  const part = detail.part;
  const box = ui.gemDetail.panel;
  const info = partInfo(gem.partId);
  const stateReady = ready(snapshot);
  const busy = snapshot.gemBusy;
  const stateText = plan.ok ? (plan.mode === "replace" ? "可直接替换同词条宝石" : plan.mode === "pick" ? "槽位已满 · 需选择替换" : "可镶嵌到空槽") : (plan.mode === "blocked" ? "同词条宝石需更高品质" : "不可镶嵌");
  const hint = stateReady ? (plan.mode === "place" ? "镶嵌后立即生效 · 卸下会回到背包" : plan.message) : (snapshot.statusNote || "正在连接账户服务…");
  const socket = game().getCharacterGemDetailSocketRect();
  const close = game().getCharacterGemDetailCloseRect();
  const enabled = stateReady && !busy && plan.ok;
  const label = !stateReady ? "未登录" : busy ? "处理中" : plan.mode === "replace" ? "替换镶嵌" : plan.mode === "pick" ? "选择替换" : "镶嵌";
  return (
    <Pop onClose={function () { actions.closeCharacterGemDetail(); }}>
      <Panel rect={box} radius={20} fill="rgba(10, 35, 49, .98)" stroke="rgba(153, 205, 218, .24)" />
      <Badge x={W / 2 - 58} y={box.y + 14} w={116} label="GEM  ·  DETAIL" color={gem.color} />
      <Text x={W / 2} y={ui.gemDetail.titleY} size={21} bold align="center" color={c.yellow}>宝石详情</Text>
      <GemMark x={box.x + 44} y={ui.gemDetail.iconY} size={32} color={gem.color} />
      <Text x={box.x + 72} y={ui.gemDetail.iconY - 4} size={13} bold color={gem.color}>{gem.qualityName + " 宝石"}</Text>
      <Text x={box.x + 72} y={ui.gemDetail.iconY + 16} size={11} bold>{clip(gem.affix.text, 16)}</Text>
      <Text x={box.x + 16} y={ui.gemDetail.lineY[0]} size={10} color={c.muted}>{"部位 · " + info.name + (gem.locked ? " · 已锁定" : "")}</Text>
      <Text x={box.x + 16} y={ui.gemDetail.lineY[1]} size={10} color={plan.ok ? c.green : c.yellow}>{"槽位 · " + part.socketedCount + " / " + part.capacity + " · " + stateText}</Text>
      <Text x={W / 2} y={ui.gemDetail.hintY} size={9} align="center" color={plan.ok ? c.muted : c.yellow}>{clip(hint, 30)}</Text>
      <Flat rect={socket} radius={10} fill={enabled ? c.cyan : "rgba(38, 56, 66, .90)"} stroke={enabled ? "rgba(255, 255, 255, .28)" : "rgba(153, 205, 218, .16)"} label={label} size={12} baseline={22} color={enabled ? "#071217" : c.muted} onClick={enabled ? function () { actions.socketCharacterGem(gem.id); } : undefined} />
      <Flat rect={close} radius={10} fill="rgba(38, 56, 66, .94)" stroke="rgba(153, 205, 218, .24)" label="关闭" size={12} baseline={22} color={c.text} onClick={function () { actions.closeCharacterGemDetail(); }} />
    </Pop>
  );
}

function EquipDetail(props) {
  const snapshot = props.snapshot;
  const ui = game().config.characterUI;
  const c = colors(snapshot);
  const W = width();
  const item = game().getCharacterEquipDetail();
  if (!item) return null;
  const box = ui.equipDetail.panel;
  const stateReady = ready(snapshot);
  const busy = snapshot.equipmentBagBusy;
  const hint = snapshot.equipmentBagError || snapshot.equipmentBagNotice || (stateReady ? "" : (snapshot.statusNote || "正在连接账户服务…"));
  const replace = game().getCharacterEquipReplaceRect();
  const close = game().getCharacterEquipCloseRect();
  const enabled = stateReady && !busy && !item.equipped;
  const label = !stateReady ? "未登录" : (item.equipped ? "已装备" : busy ? "替换中" : "替换");
  return (
    <Pop onClose={function () { actions.closeCharacterEquip(); }}>
      <Panel rect={box} radius={20} fill="rgba(10, 35, 49, .98)" stroke="rgba(153, 205, 218, .24)" />
      <Badge x={W / 2 - 64} y={box.y + 14} w={128} label="EQUIPMENT  ·  DETAIL" color={item.elementColor} />
      <Text x={W / 2} y={ui.equipDetail.titleY} size={21} bold align="center" color={c.yellow}>装备详情</Text>
      <Glyph kind={item.slotId} x={box.x + 44} y={ui.equipDetail.iconY} size={34} color={item.elementColor} />
      <Text x={box.x + 74} y={ui.equipDetail.iconY - 4} size={13} bold color={item.elementColor}>{item.partName + " · " + item.elementName + "系"}</Text>
      <Text x={box.x + 74} y={ui.equipDetail.iconY + 16} size={11} bold color={c.cyan}>{item.level ? "Lv." + item.level : "未获取"}</Text>
      <Text x={box.x + 16} y={ui.equipDetail.lineY[0]} size={10} color={item.equipped ? c.green : c.muted}>{"状态 · " + (item.equipped ? "当前装备" : "可替换")}</Text>
      <Text x={box.x + 16} y={ui.equipDetail.lineY[1]} size={10} color={c.muted}>替换只改元素 · 等级保留在部位</Text>
      <Text x={W / 2} y={ui.equipDetail.hintY} size={9} align="center" color={snapshot.equipmentBagError ? c.red : (snapshot.equipmentBagNotice ? c.green : c.muted)}>{clip(hint, 30)}</Text>
      <Flat rect={replace} radius={10} fill={enabled ? c.cyan : "rgba(38, 56, 66, .90)"} stroke={enabled ? "rgba(255, 255, 255, .28)" : "rgba(153, 205, 218, .16)"} label={label} size={12} baseline={22} color={enabled ? "#071217" : c.muted} onClick={enabled ? function () { actions.replaceCharacterEquipment(item.id); } : undefined} />
      <Flat rect={close} radius={10} fill="rgba(38, 56, 66, .94)" stroke="rgba(153, 205, 218, .24)" label="关闭" size={12} baseline={22} color={c.text} onClick={function () { actions.closeCharacterEquip(); }} />
    </Pop>
  );
}

function ResourceDetail(props) {
  const detail = game().getCharacterResourceDetail();
  if (!detail) return null;
  const ui = game().config.resourceDetailUI;
  const box = ui.panel;
  const c = colors(props.snapshot);
  const W = width();
  const close = game().getCharacterResourceDetailCloseRect();
  const labels = ["描述", "用途", "获取"];
  const values = [detail.description, detail.usage, detail.source];
  return (
    <Pop onClose={function () { actions.closeCharacterResource(); }}>
      <Panel rect={box} radius={20} fill="rgba(10, 35, 49, .98)" stroke="rgba(153, 205, 218, .24)" />
      <Badge x={W / 2 - 78} y={box.y + 14} w={156} label="RESOURCE  ·  STORAGE" color={detail.color} />
      <Text x={W / 2} y={ui.titleY} size={22} bold align="center" color={c.yellow}>资源信息</Text>
      <ResourceMark id={detail.id} x={ui.iconX} y={ui.iconY} size={ui.iconSize} color={detail.color} />
      <Text x={ui.infoX} y={ui.nameY} size={16} bold color={detail.color}>{detail.name}</Text>
      <Text x={ui.infoX} y={ui.amountY} size={11} bold>{"库存 " + detail.amount}</Text>
      <div className="meta-line" style={{ left: box.x + 16, top: ui.dividerY, width: box.w - 32, background: "rgba(153, 205, 218, .18)" }} />
      {labels.map(function (label, index) {
        return (
          <div key={label}>
            <Text x={box.x + 16} y={ui.sectionLabelY[index]} size={10} bold color={c.cyan}>{label}</Text>
            <WrapText text={values[index] || "暂无资料。"} x={box.x + 16} y={ui.sectionTextY[index]} maxWidth={box.w - 32} lineHeight={14} size={10} color={index === 0 ? c.text : c.muted} />
          </div>
        );
      })}
      <Flat rect={close} radius={10} fill="rgba(38, 56, 66, .94)" stroke="rgba(153, 205, 218, .24)" label="关闭" size={12} baseline={22} color={c.text} onClick={function () { actions.closeCharacterResource(); }} />
    </Pop>
  );
}

function GemSynthesis(props) {
  const ui = game().config.gemSynthesisUI;
  const c = colors(props.snapshot);
  const W = width();
  const stateReady = ready(props.snapshot);
  const busy = props.snapshot.gemBusy;
  const plan = game().getGemSynthesisPlan();
  const page = game().getGemSynthesisPage();
  const pages = game().getGemSynthesisPageCount();
  const focus = game().gems.findGem(props.snapshot.gemSynthesisFocus);
  const rows = [];
  for (let index = 0; index < ui.rows; index += 1) rows.push(index);
  const confirm = game().getGemSynthesisConfirmRect();
  const cancel = game().getGemSynthesisCancelRect();
  const enabled = stateReady && !busy && plan.length > 0;
  return (
    <Pop shade="rgba(3, 9, 13, .78)">
      <Panel rect={{ x: ui.panelX, y: ui.panelY, w: ui.panelWidth, h: ui.panelHeight }} radius={20} fill="rgba(10, 35, 49, .98)" stroke="rgba(153, 205, 218, .24)" />
      <Badge x={W / 2 - 77} y={ui.panelY + 14} w={154} label="SYNTHESIS  ·  GEMS" color={c.purple} />
      <Text x={W / 2} y={ui.titleY} size={24} bold align="center" color={c.yellow}>一键合成</Text>
      <Text x={W / 2} y={ui.subtitleY} size={10} align="center" color={c.muted}>{plan.length ? "共 " + plan.length + " 组 · 确认后全部合成" : "当前没有可合成的宝石"}</Text>
      {!plan.length ? <Text x={W / 2} y={250} size={10} align="center" color={c.muted}>锁定或已镶嵌的宝石不会参与合成</Text> : null}
      {rows.map(function (row) {
        const recipe = plan[page * ui.rows + row];
        if (!recipe) return null;
        const rect = game().getGemSynthesisRowRect(row);
        return (
          <div key={recipe.partId + "-" + recipe.quality + "-" + row}>
            <Rect rect={rect} radius={9} fill="rgba(13, 34, 46, .94)" stroke={recipe.color} />
            <Text x={rect.x + 8} y={rect.y + 20} size={10} bold color={recipe.partColor}>{recipe.partShort + " · " + recipe.qualityShort}</Text>
            {recipe.gems.map(function (gem, gemIndex) {
              const gemRect = game().getGemSynthesisGemRect(row, gemIndex);
              const marked = focus && focus.id === gem.id;
              return (
                <div key={gem.id}>
                  <button type="button" className="meta-clear" style={{ left: gemRect.x, top: gemRect.y, width: gemRect.w, height: gemRect.h }} onClick={function () { actions.focusGemSynthesis(gem.id); }} />
                  <GemMark x={gemRect.x + gemRect.w / 2} y={gemRect.y + gemRect.h / 2} size={ui.gemSize} color={gem.color} />
                  {marked ? <Rect rect={gemRect} radius={5} stroke={c.yellow} /> : null}
                </div>
              );
            })}
            <Text x={rect.x + 166} y={rect.y + 21} size={11} bold color={recipe.resultColor}>{"→ " + recipe.resultShort}</Text>
            <Text x={rect.x + 8} y={rect.y + 46} size={9} color={c.muted}>{"5 颗" + recipe.qualityName + " → 1 颗" + recipe.resultName}</Text>
          </div>
        );
      })}
      <Pager snapshot={props.snapshot} rect={game().getGemSynthesisPrevRect()} label="‹" enabled={page > 0} color={c.cyan} onClick={function () { actions.setGemSynthesisPage(-1); }} />
      <Pager snapshot={props.snapshot} rect={game().getGemSynthesisNextRect()} label="›" enabled={page < pages - 1} color={c.cyan} onClick={function () { actions.setGemSynthesisPage(1); }} />
      <Text x={190} y={ui.pagerNext.y + 15} size={9} align="right" color={c.muted}>{(page + 1) + " / " + pages}</Text>
      <Text x={ui.listX} y={ui.detailY} size={9} bold color={c.cyan}>词条预览</Text>
      {focus ? <Text x={ui.listX} y={ui.detailSubY} size={11} bold color={focus.color}>{focus.qualityName + " · " + focus.affix.text}</Text> : <Text x={ui.listX} y={ui.detailSubY} size={10} color={c.muted}>点击任意宝石查看词条</Text>}
      <Flat rect={confirm} radius={8} fill={enabled ? c.green : "rgba(38, 56, 66, .9)"} stroke={enabled ? "rgba(255, 255, 255, .28)" : "rgba(153, 205, 218, .16)"} label={busy && props.snapshot.gemAction === "synthesize" ? "合成中…" : "确定"} size={11} baseline={20} color={enabled ? "#071217" : c.muted} onClick={enabled ? function () { actions.synthesizeAllGems(); } : undefined} />
      <Flat rect={cancel} radius={8} fill="rgba(38, 56, 66, .9)" stroke="rgba(153, 205, 218, .24)" label="取消" size={11} baseline={20} color={c.text} onClick={function () { actions.closeGemSynthesis(); }} />
      {props.snapshot.gemError ? <Text x={W / 2} y={ui.panelY + ui.panelHeight - 10} size={9} align="center" color={c.red}>{clip(props.snapshot.gemError, 30)}</Text> : null}
    </Pop>
  );
}

function zombieExtra(enemy) {
  const ranged = enemy.ranged;
  if (ranged) {
    const action = ranged.action || "投掷";
    const pattern = ranged.salvo > 1 ? ranged.interval + "秒×" + ranged.salvo + (ranged.shot === "waterColumn" ? "水柱" : action) : "每 " + ranged.interval + " 秒" + action + "一次";
    return (enemy.flying ? "远程飞行单位" : "远程单位") + "   ·   " + pattern + "，距防线 " + ranged.standoff + " 像素" + (enemy.flying ? "处悬停" : "处停下");
  }
  if (enemy.flying) return "飞行单位   ·   免疫装甲车、燃油弹等贴地技能，龙卷风例外";
  if (enemy.armorCharges) return "装甲 " + enemy.armorCharges + " 层   ·   可抵挡等量的伤害与负面状态";
  if (enemy.wallExplosionDamage) return "撞线爆炸 " + enemy.wallExplosionDamage + " 点   ·   低血移速 ×" + enemy.speedBoostMultiplier;
  if (enemy.blocksProjectiles) return "阻挡弹道   ·   步枪、干冰弹、温压弹与压缩气刃无法穿过";
  if (enemy.rageHpRatio) return "狂暴冲锋   ·   生命低于 " + Math.round(enemy.rageHpRatio * 100) + "% 时持续 " + enemy.rageDuration + " 秒，移速 ×" + (enemy.rageSpeedMultiplier || 1) + "，结束后停顿 " + enemy.rageRecoveryDuration + " 秒";
  if (enemy.freezeHealPerSecond) return "冻结时生命回复 " + enemy.freezeHealPerSecond + " 点 / 秒   ·   受重伤压制";
  if (enemy.regenPerSecond) return "生命回复 " + enemy.regenPerSecond + " 点 / 秒" + (enemy.regenBelowHpRatio ? "   ·   仅在生命低于 " + Math.round(enemy.regenBelowHpRatio * 100) + "% 时生效" : "   ·   持续生效，受重伤压制");
  return "";
}

function TraitBlock(props) {
  const traits = game().getCodexEnemyTraits(props.enemy);
  const rows = [["属性克制", traits.elements], ["状态抗性", traits.status], ["召唤", traits.summons]];
  const nodes = [];
  let y = 516;
  rows.forEach(function (row) {
    if (!row[1].length) return;
    nodes.push(<Text key={row[0]} x={44} y={y} size={10} bold color={props.color}>{row[0]}</Text>);
    let x = 96;
    let line = y;
    row[1].forEach(function (item, index) {
      const itemWidth = measureWidth(item.text, fontCss(10, true));
      if (x > 96 && x + itemWidth > 334) { line += 12; x = 44; }
      nodes.push(<Text key={row[0] + index + item.text} x={x} y={line} size={10} bold color={item.color}>{item.text}</Text>);
      x += itemWidth + 12;
    });
    y = line + 12;
  });
  return nodes;
}

function ZombieCodexScreen(props) {
  const snapshot = props.snapshot;
  const c = colors(snapshot);
  const W = width();
  const categories = [{ id: "minion", label: "小怪", color: c.green }, { id: "elite", label: "精英", color: c.yellow }, { id: "boss", label: "首领", color: c.red }];
  const selectedCategory = categories.filter(function (category) { return category.id === snapshot.zombieCodexCategory; })[0] || categories[0];
  const ids = game().getCodexEnemyIds(selectedCategory.id);
  const pages = Math.max(1, Math.ceil(ids.length / 4));
  const page = clamp(snapshot.codexPage || 0, 0, pages - 1);
  const selected = snapshot.selectedZombieCodexId ? game().config.enemies[snapshot.selectedZombieCodexId] : null;
  const showDetail = selected && (selected.codexCategory || "minion") === selectedCategory.id;
  return (
    <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
      <Panel rect={{ x: 14, y: 36, w: W - 28, h: 568 }} radius={20} fill="rgba(10, 35, 49, .97)" stroke="rgba(153, 205, 218, .22)" />
      <Badge x={91} y={50} w={178} label="FIELD GUIDE  ·  ENEMIES" color={c.cyan} />
      <Text x={W / 2} y={95} size={23} bold align="center" color={c.yellow}>僵尸图鉴</Text>
      {categories.map(function (category, index) {
        const active = selectedCategory.id === category.id;
        return <Flat key={category.id} rect={{ x: 22 + index * 106, y: 107, w: 102, h: 31 }} radius={10} fill={active ? "rgba(49, 105, 125, .95)" : "rgba(13, 29, 39, .9)"} stroke={active ? category.color : "rgba(153,205,218,.18)"} label={category.label} size={11} baseline={20} color={active ? c.text : c.muted} onClick={function () { actions.setZombieCategory(category.id); }} />;
      })}
      {showDetail ? (
        <div>
          <Panel rect={{ x: 26, y: 148, w: 308, h: 400 }} radius={16} fill="rgba(17, 47, 62, .94)" stroke="rgba(104,216,255,.22)" />
          <EnemyMark id={snapshot.selectedZombieCodexId} enemy={selected} x={40} y={153} w={280} h={152} detail />
          <Text x={W / 2} y={330} size={20} bold align="center">{selected.name}</Text>
          <Text x={44} y={353} size={11} bold color={c.cyan}>{"生命 " + selected.hp + "   ·   移速 " + selected.speed + " / 秒"}</Text>
          <Text x={44} y={374} size={10} bold color={c.cyan}>{(selected.ranged ? (selected.ranged.action || "投掷") + "伤害 " + selected.ranged.damage + (selected.ranged.salvo > 1 ? " × " + selected.ranged.salvo : "") : "城墙伤害 " + selected.damage) + "   ·   击杀经验 " + selected.xp + "   ·   半径 " + selected.radius}</Text>
          {zombieExtra(selected) ? <Text x={44} y={392} size={10} bold color={c.purple}>{zombieExtra(selected)}</Text> : null}
          <Text x={44} y={404} size={11} bold color={c.yellow}>单位特征</Text>
          <WrapText text={selected.description || "详细资料待补充。"} x={44} y={422} maxWidth={272} lineHeight={13} size={11} color={c.text} />
          <Text x={44} y={465} size={11} bold color={c.yellow}>应对建议</Text>
          <WrapText text={selected.tactics || "暂无应对建议。"} x={44} y={482} maxWidth={272} lineHeight={12} size={10} color={c.muted} />
          <TraitBlock enemy={selected} color={c.yellow} />
          <Btn rect={{ x: W / 2 - 82, y: 558, w: 164, h: 38 }} label="返回图鉴列表" color={c.cyan} onClick={function () { actions.selectZombie(null); }} />
        </div>
      ) : (
        <div>
          {ids.slice(page * 4, page * 4 + 4).map(function (id, index) {
            const enemy = game().config.enemies[id];
            const x = 26 + (index % 2) * 160;
            const y = 155 + Math.floor(index / 2) * 160;
            return (
              <div key={id}>
                <Flat rect={{ x: x, y: y, w: 148, h: 148 }} radius={16} fill="rgba(17, 47, 62, .94)" stroke="rgba(104,216,255,.3)" onClick={function () { actions.selectZombie(id); }} />
                <EnemyMark id={id} enemy={enemy} x={x + 5} y={y + 5} w={138} h={112} />
                <Text x={x + 74} y={y + 136} size={13} bold align="center">{enemy.name}</Text>
              </div>
            );
          })}
          {!ids.length ? <Text x={W / 2} y={300} size={13} align="center" color={c.muted}>该类别暂无收录单位。</Text> : null}
          {pages > 1 ? <Btn rect={{ x: 94, y: 521, w: 54, h: 31 }} label="‹" color={c.cyan} onClick={function () { actions.setCodexPage(Math.max(0, page - 1)); }} /> : null}
          {pages > 1 ? <Text x={W / 2} y={542} size={11} bold align="center">{(page + 1) + " / " + pages}</Text> : null}
          {pages > 1 ? <Btn rect={{ x: 212, y: 521, w: 54, h: 31 }} label="›" color={c.cyan} onClick={function () { actions.setCodexPage(Math.min(pages - 1, page + 1)); }} /> : null}
          <Btn rect={{ x: W / 2 - 72, y: 561, w: 144, h: 36 }} label="返回首页" color="#4b7180" onClick={function () { actions.backToMenu(); }} />
        </div>
      )}
    </Stage>
  );
}

function skillGroupColor(group, c) { return group.id === "rifle" ? c.cyan : c.purple; }
function skillElement(group) {
  const info = group && group.element ? (game().config.elements || {})[group.element] : null;
  if (!info) return null;
  return { name: info.name + "属性", color: info.color, note: group.elementNote || info.detail || "" };
}
function skillGlyphColor(group, c) {
  const element = skillElement(group);
  return element && element.color ? element.color : skillGroupColor(group, c);
}
function skillHasProgress(group) {
  if (!group) return false;
  if (group.id === "rifle") return !!game().rifleProgress;
  return (game().config.skillProgress.order || []).indexOf(group.id) >= 0 && !!game().skillProgress;
}
function skillProgressOf(group) {
  let progress = null;
  if ((game().config.skillProgress.order || []).indexOf(group.id) >= 0 && game().skillProgress) progress = game().skillProgress.getView(group.id);
  if (group.id === "rifle" && game().rifleProgress) progress = game().rifleProgress.getView();
  return progress;
}
function requirementNames(trait) {
  const names = [];
  (trait.requires || []).forEach(function (id) {
    const found = (game().config.skillTraits || []).filter(function (item) { return item.id === id; })[0];
    if (found) names.push(found.name);
  });
  return names.join(" · ");
}

function SkillLevelPanel(props) {
  const group = props.group;
  const ui = game().config.skillCodexUI.levelPanel;
  const c = colors(props.snapshot);
  const W = width();
  const progress = skillProgressOf(group);
  if (!progress) return null;
  const color = skillGroupColor(group, c);
  const unlocked = progress.milestones.filter(function (node) { return node.unlocked; }).length;
  const stats = [
    { label: "技能伤害", value: "+" + Math.round(progress.damageBonus * 100) + "%" },
    { label: "冷却缩减", value: "−" + Math.round(progress.cooldownReduction * 100) + "%" },
    { label: "暴击加成", value: "+" + (progress.critBonus * 100).toFixed(1) + "%" },
    { label: "下一节点", value: progress.nextMilestone ? "Lv." + progress.nextMilestone : "全部解锁" }
  ];
  return (
    <Pop shade="rgba(3, 9, 13, .84)">
      <Panel rect={ui.panel} radius={20} fill="rgba(7, 24, 34, .995)" stroke="rgba(104, 216, 255, .36)" />
      <Text x={W / 2} y={ui.titleY} size={21} bold align="center" color={c.yellow}>技能等级节点</Text>
      <Text x={W / 2} y={ui.subtitleY} size={10} align="center" color={c.muted}>账户成长数值与全部高级节点</Text>
      <Flat rect={ui.close} radius={8} fill="rgba(9, 26, 36, .9)" stroke="rgba(153, 205, 218, .28)" label="×" size={15} baseline={18} color={c.text} onClick={function () { actions.setSkillCodexLevelPanel(false); }} />
      <SkillMark id={group.id} x={44} y={ui.skillNameY - 6} size={24} color={color} />
      <Text x={64} y={ui.skillNameY} size={16} bold>{group.name}</Text>
      <Text x={320} y={ui.skillNameY} size={12} bold align="right" color={color}>{"Lv." + progress.level + " / " + progress.maxLevel}</Text>
      {stats.map(function (stat, index) {
        const rect = game().getSkillCodexLevelStatRect(index);
        return (
          <div key={stat.label}>
            <Rect rect={rect} radius={9} fill="rgba(17, 47, 62, .86)" stroke="rgba(153, 205, 218, .18)" />
            <Text x={rect.x + 10} y={rect.y + 15} size={9} color={c.muted}>{stat.label}</Text>
            <Text x={rect.x + rect.w - 10} y={rect.y + 32} size={15} bold align="right" color={index === 3 ? c.cyan : color}>{stat.value}</Text>
          </div>
        );
      })}
      <Text x={30} y={ui.sectionY} size={13} bold color={c.yellow}>等级节点</Text>
      <Text x={330} y={ui.sectionY} size={10} bold align="right" color={c.green}>{"已解锁 " + unlocked + " / " + progress.milestones.length}</Text>
      {progress.milestones.map(function (node, index) {
        const rect = game().getSkillCodexLevelNodeRect(index);
        return (
          <div key={node.level}>
            <Rect rect={rect} radius={9} fill={node.unlocked ? "rgba(16, 49, 48, .94)" : "rgba(15, 28, 38, .90)"} stroke={node.unlocked ? "rgba(99, 230, 160, .32)" : "rgba(153, 205, 218, .14)"} />
            <Rect rect={{ x: rect.x + 8, y: rect.y + 8, w: 48, h: 29 }} radius={7} fill={node.unlocked ? "rgba(28, 92, 70, .9)" : "rgba(24, 39, 49, .92)"} stroke={node.unlocked ? "rgba(99, 230, 160, .5)" : "rgba(153, 205, 218, .18)"} />
            <Text x={rect.x + 32} y={rect.y + 27} size={10} bold align="center" color={node.unlocked ? c.green : c.muted}>{"Lv." + node.level}</Text>
            <Text x={rect.x + 66} y={rect.y + 16} size={10} bold color={node.unlocked ? c.text : "rgba(204, 224, 233, .5)"}>{node.name}</Text>
            <Text x={rect.x + rect.w - 10} y={rect.y + 16} size={9} bold align="right" color={node.unlocked ? c.green : c.yellow}>{node.unlocked ? "已解锁" : "未解锁"}</Text>
            <WrapText text={node.detail || "效果待补充。"} x={rect.x + 66} y={rect.y + 30} maxWidth={rect.w - 78} lineHeight={8} size={8} color={node.unlocked ? "rgba(204, 224, 233, .7)" : "rgba(204, 224, 233, .4)"} />
          </div>
        );
      })}
      <Flat rect={ui.footer} radius={10} fill="rgba(24, 58, 75, .96)" stroke="rgba(104, 216, 255, .48)" label="关闭" size={12} baseline={22} color={c.cyan} onClick={function () { actions.setSkillCodexLevelPanel(false); }} />
    </Pop>
  );
}

function SkillRequirementPanel(props) {
  const ui = game().config.skillCodexUI.requirementPanel;
  const c = colors(props.snapshot);
  const W = width();
  let superTrait = null;
  (props.group.traits || []).forEach(function (trait) { if (trait.id === props.snapshot.skillCodexRequirementTraitId) superTrait = trait; });
  if (!superTrait) return null;
  const requirements = [];
  (superTrait.requires || []).forEach(function (id) {
    const found = (game().config.skillTraits || []).filter(function (trait) { return trait.id === id; })[0];
    if (found) requirements.push(found);
  });
  return (
    <Pop shade="rgba(3, 9, 13, .84)">
      <Panel rect={ui.panel} radius={20} fill="rgba(7, 24, 34, .995)" stroke="rgba(255, 184, 77, .46)" />
      <Text x={W / 2} y={ui.titleY} size={21} bold align="center" color="#ffb84d">超级词条前置</Text>
      <Text x={W / 2} y={ui.subtitleY} size={10} align="center" color={c.muted}>需同时拥有以下词条（各至少 1 级）</Text>
      <Flat rect={ui.close} radius={8} fill="rgba(9, 26, 36, .9)" stroke="rgba(255, 184, 77, .34)" label="×" size={15} baseline={18} color={c.text} onClick={function () { actions.setSkillRequirement(null); }} />
      <SkillMark id={props.group.id} x={42} y={174} size={20} color="#ffb84d" />
      <Text x={60} y={180} size={14} bold>{superTrait.name}</Text>
      <Text x={330} y={180} size={9} bold align="right" color="#ffb84d">超级 · 一次性</Text>
      {requirements.map(function (trait, index) {
        const rect = game().getSkillCodexRequirementRowRect(index);
        const rare = trait.rarity === "稀有" || trait.rarity === "史诗";
        return (
          <div key={trait.id}>
            <Rect rect={rect} radius={10} fill={rare ? "#263352" : "#163b4d"} stroke={rare ? "rgba(201, 161, 255, .34)" : "rgba(104, 216, 255, .24)"} />
            <Text x={rect.x + 18} y={rect.y + 20} size={12} bold align="center" color={rare ? c.purple : c.cyan}>{String(index + 1)}</Text>
            <Text x={rect.x + 36} y={rect.y + 19} size={12} bold>{trait.name}</Text>
            <Text x={rect.x + rect.w - 12} y={rect.y + 19} size={9} bold align="right" color={rare ? c.purple : c.green}>{(trait.rarity || "普通") + " · 最高 Lv." + trait.max}</Text>
            <WrapText text={trait.desc || ""} x={rect.x + 14} y={rect.y + 41} maxWidth={rect.w - 28} lineHeight={12} size={10} color={c.muted} />
            <WrapText text={trait.detail || ""} x={rect.x + 14} y={rect.y + 66} maxWidth={rect.w - 28} lineHeight={9} size={8} color="rgba(204, 224, 233, .62)" />
          </div>
        );
      })}
      <Flat rect={ui.footer} radius={10} fill="rgba(74, 51, 23, .96)" stroke="rgba(255, 184, 77, .5)" label="关闭" size={12} baseline={22} color="#ffd9a0" onClick={function () { actions.setSkillRequirement(null); }} />
    </Pop>
  );
}

function SkillCodexScreen(props) {
  const snapshot = props.snapshot;
  const c = colors(snapshot);
  const ui = game().config.skillCodexUI;
  const W = width();
  const groups = game().getSkillGroups ? game().getSkillGroups() : [];
  const selected = snapshot.selectedSkillCodexId ? groups.filter(function (group) { return group.id === snapshot.selectedSkillCodexId; })[0] : null;
  if (!selected) {
    const pages = Math.max(1, Math.ceil(groups.length / ui.cards.perPage));
    const page = clamp(snapshot.codexPage || 0, 0, pages - 1);
    const pageGroups = groups.slice(page * ui.cards.perPage, page * ui.cards.perPage + ui.cards.perPage);
    return (
      <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
        <Panel rect={{ x: 14, y: 36, w: W - 28, h: 568 }} radius={20} fill="rgba(10, 35, 49, .97)" stroke="rgba(153, 205, 218, .22)" />
        <Badge x={91} y={50} w={178} label="FIELD GUIDE  ·  SKILLS" color={c.purple} />
        <Text x={W / 2} y={95} size={23} bold align="center" color={c.yellow}>技能图鉴</Text>
        <Text x={W / 2} y={126} size={11} align="center" color={c.muted}>{"选择技能查看介绍与专属词条 · 每局最多装备 " + game().config.maxSkillSlots + " 个"}</Text>
        {pageGroups.map(function (group, index) {
          const rect = game().getSkillCodexCardRect(index);
          const element = skillElement(group);
          return (
            <div key={group.id}>
              <Flat rect={rect} radius={16} fill="rgba(17, 47, 62, .94)" stroke="rgba(153,205,218,.3)" onClick={function () { actions.selectSkillCodex(group.id); }} />
              <SkillMark id={group.id} x={rect.x + ui.icon.centerX} y={rect.y + ui.icon.centerY} size={ui.icon.size} color={skillGlyphColor(group, c)} />
              <Text x={rect.x + rect.w / 2} y={rect.y + ui.nameY} size={14} bold align="center">{group.name}</Text>
              {element ? <Text x={rect.x + rect.w / 2} y={rect.y + ui.subY} size={10} bold align="center" color={element.color}>{element.name}</Text> : null}
            </div>
          );
        })}
        {!groups.length ? <Text x={W / 2} y={300} size={13} align="center" color={c.muted}>暂无技能收录。</Text> : null}
        {pages > 1 ? <Btn rect={ui.pager.prev} label="‹" color={c.cyan} onClick={function () { actions.setCodexPage(Math.max(0, page - 1)); }} /> : null}
        {pages > 1 ? <Text x={W / 2} y={542} size={11} bold align="center">{(page + 1) + " / " + pages}</Text> : null}
        {pages > 1 ? <Btn rect={ui.pager.next} label="›" color={c.cyan} onClick={function () { actions.setCodexPage(Math.min(pages - 1, page + 1)); }} /> : null}
        <Btn rect={{ x: W / 2 - 72, y: 561, w: 144, h: 36 }} label="返回首页" color="#4b7180" onClick={function () { actions.backToMenu(); }} />
      </Stage>
    );
  }
  const color = skillGroupColor(selected, c);
  const implemented = !selected.status || selected.status === "已实装";
  const isCore = (game().config.skillProgress.order || []).indexOf(selected.id) >= 0;
  const progress = skillProgressOf(selected);
  const element = skillElement(selected);
  const elementWidth = element ? 22 + element.name.length * 11 : 0;
  const owned = resources();
  const accountState = { rifleBusy: snapshot.rifleBusy, skillError: snapshot.skillError };
  let affordable = false;
  let cost = {};
  let blueprint = 0;
  let nextNode = null;
  if (progress) {
    cost = progress.nextCost || {};
    blueprint = owned[progress.blueprintId] || 0;
    affordable = !cost.coin || ((owned.coin || 0) >= cost.coin && blueprint >= (cost[progress.blueprintId] || 0));
    for (let index = 0; index < progress.milestones.length; index += 1) if (!progress.milestones[index].unlocked) { nextNode = progress.milestones[index]; break; }
  }
  const upgradeEnabled = ready(snapshot) && !accountState.rifleBusy && affordable;
  const traits = selected.traits || [];
  const perPage = progress ? 2 : 3;
  const pages = Math.max(1, Math.ceil(traits.length / perPage));
  const page = clamp(snapshot.codexPage || 0, 0, pages - 1);
  const slice = traits.slice(page * perPage, page * perPage + perPage);
  return (
    <Stage width={snapshot.viewWidth} height={snapshot.viewHeight}>
      <Panel rect={{ x: 14, y: 36, w: W - 28, h: 568 }} radius={20} fill="rgba(10, 35, 49, .97)" stroke="rgba(153, 205, 218, .22)" />
      <Badge x={91} y={50} w={178} label="FIELD GUIDE  ·  SKILLS" color={c.purple} />
      <Text x={W / 2} y={95} size={23} bold align="center" color={c.yellow}>技能图鉴</Text>
      <Panel rect={{ x: 24, y: 130, w: 312, h: 112 }} radius={16} fill="rgba(17, 47, 62, .94)" stroke="rgba(153,205,218,.28)" />
      {selected.id === "rifle" || isCore ? <SkillMark id={selected.id} x={52} y={182} size={34} color={color} /> : <Text x={52} y={182} size={27} bold align="center" color={color}>{selected.icon}</Text>}
      <Text x={82} y={160} size={17} bold>{selected.name}</Text>
      <Text x={320} y={160} size={10} bold align="right" color={implemented ? c.green : c.yellow}>{selected.status || ""}</Text>
      <WrapText text={selected.detail || "技能说明待补充。"} x={82} y={182} maxWidth={238} lineHeight={13} size={10} color={c.muted} />
      {element ? <Badge x={40} y={216} w={elementWidth} label={element.name} color={element.color} /> : null}
      {element ? <Text x={48 + elementWidth} y={230} size={10} color={c.muted}>{element.note}</Text> : null}
      {progress ? (
        <div>
          <Panel rect={ui.progress.panel} radius={12} fill="rgba(28, 39, 68, .94)" stroke="rgba(201, 161, 255, .32)" />
          <Text x={38} y={ui.progress.levelY} size={12} bold color={color}>{"步枪成长 · Lv." + progress.level + " / ∞"}</Text>
          <Text x={38} y={ui.progress.bonusY} size={9}>伤害 +5 / 级 · 6 个步枪成长节点</Text>
          <Text x={38} y={ui.progress.nodeY} size={9} bold color={accountState.skillError ? c.red : c.cyan}>{accountState.skillError || (nextNode ? "下一节点 Lv." + nextNode.level + " · " + nextNode.name : "全部高级节点已解锁")}</Text>
          <Text x={38} y={ui.progress.costY} size={9} color={c.muted}>{"金币 " + (cost.coin || 0) + " · 图纸 " + blueprint + "/" + (cost[progress.blueprintId] || 0)}</Text>
          <Flat rect={game().getSkillCodexProgressActionRect()} radius={8} fill={upgradeEnabled ? color : "rgba(38, 56, 66, .90)"} stroke={upgradeEnabled ? "rgba(255,255,255,.24)" : "rgba(153,205,218,.16)"} label={accountState.rifleBusy ? "强化中" : !ready(snapshot) ? "未登录" : !affordable ? "材料不足" : "强化"} size={9} baseline={18} color={upgradeEnabled ? "#071217" : c.muted} onClick={upgradeEnabled ? function () { actions.upgradeRifle(); } : undefined} />
          <Flat rect={game().getSkillCodexNodesActionRect()} radius={8} fill="rgba(24, 58, 75, .96)" stroke="rgba(104, 216, 255, .48)" label="等级节点" size={9} baseline={16} color={c.cyan} onClick={function () { actions.setSkillRequirement(null); actions.setSkillCodexLevelPanel(true); }} />
        </div>
      ) : null}
      <Text x={40} y={progress ? 358 : 268} size={13} bold color={c.yellow}>专属词条</Text>
      {slice.map(function (trait, index) {
        const card = game().getSkillCodexTraitCardRect(index, !!progress);
        const isSuper = trait.super || trait.rarity === "超级";
        const rare = trait.rarity === "稀有" || trait.rarity === "史诗";
        const accent = isSuper ? "#ffb84d" : rare ? c.purple : c.cyan;
        return (
          <div key={trait.id || trait.name}>
            <Rect rect={{ x: card.x, y: card.y, w: 308, h: 68 }} radius={12} fill={isSuper ? "#4a3317" : rare ? "#263352" : "#163b4d"} stroke={isSuper ? "rgba(255,184,77,.7)" : rare ? "rgba(201,161,255,.34)" : "rgba(104,216,255,.24)"} />
            {isSuper ? <button type="button" className="meta-clear" style={{ left: card.x, top: card.y, width: 308, height: 68 }} onClick={function () { actions.setSkillCodexLevelPanel(false); actions.setSkillRequirement(trait.id); }} /> : null}
            <SkillMark id={selected.id} x={card.x + 24} y={card.y + 32} size={18} color={accent} />
            <Text x={card.x + 46} y={card.y + 24} size={13} bold>{trait.name}</Text>
            {isSuper ? <Badge x={card.x + 196} y={card.y + 8} w={100} label="超级 · 查看前置" color="#ffb84d" /> : <Text x={card.x + 294} y={card.y + 22} size={9} bold align="right" color={rare ? c.purple : c.green}>{trait.rarity + " · 最高 Lv." + trait.max}</Text>}
            <WrapText text={trait.desc || trait.detail || ""} x={card.x + 46} y={card.y + 42} maxWidth={244} lineHeight={11} size={10} color={isSuper ? "#ffe4b8" : c.muted} />
            {isSuper ? <WrapText text={"前置：" + requirementNames(trait)} x={card.x + 46} y={card.y + 60} maxWidth={244} lineHeight={9} size={8} color="#ffd9a0" /> : null}
          </div>
        );
      })}
      {!traits.length ? <Text x={W / 2} y={336} size={12} align="center" color={c.muted}>该技能暂无专属词条。</Text> : null}
      {pages > 1 ? <Btn rect={{ x: 94, y: 521, w: 54, h: 31 }} label="‹" color={color} onClick={function () { actions.setCodexPage(Math.max(0, page - 1)); }} /> : null}
      {pages > 1 ? <Text x={W / 2} y={542} size={11} bold align="center">{(page + 1) + " / " + pages}</Text> : null}
      {pages > 1 ? <Btn rect={{ x: 212, y: 521, w: 54, h: 31 }} label="›" color={color} onClick={function () { actions.setCodexPage(Math.min(pages - 1, page + 1)); }} /> : null}
      <Btn rect={{ x: W / 2 - 82, y: 561, w: 164, h: 36 }} label="返回技能列表" color={color} onClick={function () { actions.clearSkillCodexSelection(); }} />
      {snapshot.skillCodexLevelPanel ? <SkillLevelPanel snapshot={snapshot} group={selected} /> : snapshot.skillCodexRequirementTraitId ? <SkillRequirementPanel snapshot={snapshot} group={selected} /> : null}
    </Stage>
  );
}

export function MetaRoot(props) {
  const snapshot = props.snapshot;
  if (!snapshot || snapshot.shell !== "react" || !game() || !game().reactOwnsScreen(snapshot.screen)) return null;
  if (snapshot.screen === "menu") return <MenuScreen snapshot={snapshot} />;
  if (snapshot.screen === "levelSelect") return <LevelSelectScreen snapshot={snapshot} />;
  if (snapshot.screen === "login") return <LoginScreen snapshot={snapshot} />;
  if (snapshot.screen === "account") return <AccountScreen snapshot={snapshot} />;
  if (snapshot.screen === "attributes") return <AttributesScreen snapshot={snapshot} />;
  if (snapshot.screen === "wall") return <WallScreen snapshot={snapshot} />;
  if (snapshot.screen === "equipment") return <EquipmentScreen snapshot={snapshot} />;
  if (snapshot.screen === "equipmentBag") return <EquipmentBagScreen snapshot={snapshot} />;
  if (snapshot.screen === "skillProgress") return <SkillProgressScreen snapshot={snapshot} />;
  if (snapshot.screen === "character") return <CharacterScreen snapshot={snapshot} />;
  if (snapshot.screen === "zombieCodex") return <ZombieCodexScreen snapshot={snapshot} />;
  if (snapshot.screen === "skillCodex") return <SkillCodexScreen snapshot={snapshot} />;
  return null;
}
