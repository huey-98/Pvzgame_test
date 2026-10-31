import { useState } from "react";
import { Button, Empty, formatTime, Notice, Screen } from "../components/ui.jsx";
import { actions, getConfig } from "../game/actions.js";

export function LoginScreen({ snapshot }) {
  const register = snapshot.accountMode === "register";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const config = getConfig();

  function submit(event) {
    event.preventDefault();
    if (username.trim().length < config.accounts.usernameMin || username.trim().length > config.accounts.usernameMax) {
      setError("用户名需要 2 到 16 个字符");
      return;
    }
    if (password.length < config.accounts.passwordMin) {
      setError("密码至少 6 位");
      return;
    }
    setBusy(true);
    setError("");
    const task = register ? actions.register(username.trim(), password) : actions.login(username.trim(), password);
    task.then(function (result) {
      setBusy(false);
      if (!result || !result.ok) setError((result && result.error) || "操作失败");
    });
  }

  return (
    <Screen title={register ? "注册账户" : "登录账户"} subtitle={snapshot.accountStatus === "offline" ? "未连接数据库 · 战斗仍可进行，成绩不会保存" : "登录后关卡进度与资源会保存到本机数据库"} badge="ACCOUNT ACCESS" onBack={actions.backToMenu}>
      <form className="auth-form" onSubmit={submit}>
        <label><span>用户名</span><input value={username} onChange={function (event) { setUsername(event.target.value); }} maxLength={16} autoComplete="username" disabled={busy || snapshot.accountStatus === "offline"} /></label>
        <label><span>密码</span><input type="password" value={password} onChange={function (event) { setPassword(event.target.value); }} maxLength={64} autoComplete="current-password" disabled={busy || snapshot.accountStatus === "offline"} /></label>
        <Notice tone="error">{error || snapshot.accountError}</Notice>
        <Button type="submit" variant="success" disabled={busy || snapshot.accountStatus === "offline"}>{busy ? "请稍候…" : register ? "注册并登录" : "登录"}</Button>
        <Button variant="ghost" onClick={function () { setPassword(""); setError(""); actions.openLogin(!register); }}>{register ? "已有账户？去登录" : "没有账户？去注册"}</Button>
        <small>用户名 2–16 个中文 / 字母 / 数字 / 下划线 · 密码至少 6 位</small>
      </form>
    </Screen>
  );
}

export function AccountScreen({ snapshot }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resourcePage, setResourcePage] = useState(0);
  const account = snapshot.account || {};
  const resourcePages = Math.max(1, Math.ceil(snapshot.resources.length / 12));
  const resourceRows = snapshot.resources.slice(resourcePage * 12, resourcePage * 12 + 12);
  return (
    <Screen title="账户中心" subtitle="本机账户 · SQLite 持久化" badge="ACCOUNT" onBack={actions.backToMenu}>
      <div className="account-card">
        <div><strong>{account.username}</strong><small>注册于 {String(account.createdAt || "—").slice(0, 10)}</small></div>
        <p>通关 {snapshot.completedCount} / {getConfig().levels.length} · 累计通关 {snapshot.totals.wins} 次 · 尝试 {snapshot.totals.attempts} 次</p>
      </div>
      <h3 className="section-title">资源</h3>
      <div className="resource-grid">
        {resourceRows.map(function (resource) {
          return <div className="resource-cell" key={resource.id}><i style={{ background: resource.color }} /><span>{resource.name}</span><b>{resource.amount}</b></div>;
        })}
      </div>
      <div className="panel-actions">
        <Button variant="ghost" disabled={resourcePage <= 0} onClick={function () { setResourcePage(resourcePage - 1); }}>上一页</Button>
        <span>{resourcePage + 1} / {resourcePages}</span>
        <Button variant="ghost" disabled={resourcePage >= resourcePages - 1} onClick={function () { setResourcePage(resourcePage + 1); }}>下一页</Button>
      </div>
      <h3 className="section-title">关卡记录</h3>
      <div className="record-list">
        {snapshot.records.slice(-5).map(function (record) {
          const level = getConfig().levels.find(function (item) { return item.id === record.levelId; });
          return <div className="record-row" key={record.levelId}><b>{String(record.levelId).padStart(2, "0")}</b><span>{level ? level.name : "关卡 " + record.levelId}</span><small>{record.completed ? "已通关 · 最佳 " + formatTime(record.bestTime) + " · 击杀 " + (record.bestKills || 0) : "尝试 " + record.attempts + " 次"}</small></div>;
        })}
        {!snapshot.records.length ? <Empty>暂无记录 · 通关一局后会自动出现在这里</Empty> : null}
      </div>
      {snapshot.accountError ? <Notice tone="error">{snapshot.accountError}</Notice> : null}
      <div className="account-actions">
        <Button variant="ghost" onClick={actions.importLegacy}>导入旧进度</Button>
        <Button variant="ghost" onClick={actions.logout}>注销登录</Button>
        <Button variant="danger" onClick={function () { setDeleteOpen(true); setError(""); setPassword(""); }}>删除账户</Button>
      </div>
      {deleteOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card compact">
            <h2>删除账户</h2>
            <p>删除后关卡进度与资源会一并清除，且不可恢复。请输入密码确认。</p>
            <input type="password" value={password} onChange={function (event) { setPassword(event.target.value); }} placeholder="账户密码" />
            <Notice tone="error">{error}</Notice>
            <div className="modal-actions">
              <Button variant="ghost" onClick={function () { setDeleteOpen(false); }}>取消</Button>
              <Button variant="danger" onClick={function () {
                actions.removeAccount(password).then(function (result) {
                  if (result && result.ok) setDeleteOpen(false);
                  else setError((result && result.error) || "删除失败");
                });
              }}>确认删除</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Screen>
  );
}
