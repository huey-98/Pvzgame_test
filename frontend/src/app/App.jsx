import { GameCanvas } from "../game/GameCanvas.jsx";

export default function App() {
  return (
    <main id="app-layout">
      <section id="game-shell">
        <GameCanvas />
        <div id="start-hint">点击画面开始 · 战斗中点击调整方向 · 升级时点击卡片</div>
      </section>
    </main>
  );
}
