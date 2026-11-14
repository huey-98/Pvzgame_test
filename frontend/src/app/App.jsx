import { useEffect } from "react";
import { GameCanvas } from "../game/GameCanvas.jsx";
import { useUiSnapshot } from "../game/stage.jsx";
import { MetaRoot } from "../features/MetaScreens.jsx";

export default function App() {
  const snapshot = useUiSnapshot();
  useEffect(function () {
    const node = document.getElementById("start-hint");
    if (!node || !window.Game || !window.Game.reactOwnsScreen) return;
    node.style.display = window.Game.reactOwnsScreen(snapshot.screen) ? "none" : "";
  }, [snapshot.screen]);
  return (
    <main id="app-layout">
      <section id="game-shell">
        <GameCanvas />
        <MetaRoot snapshot={snapshot} />
        <div id="start-hint">点击画面开始 · 战斗中点击调整方向 · 升级时点击卡片</div>
      </section>
    </main>
  );
}
