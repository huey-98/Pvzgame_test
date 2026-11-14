import { useEffect, useRef, useState } from "react";
import { getUiSnapshot, refreshUiStore, startUiStore, subscribeUiStore } from "./ui-store.js";

const FACE = "Segoe UI, Microsoft YaHei";
let measureCanvas = null;
const baselineCache = new Map();

export function useUiSnapshot() {
  const [snapshot, setSnapshot] = useState(getUiSnapshot);
  useEffect(function () {
    const stop = startUiStore();
    const unsubscribe = subscribeUiStore(function () { setSnapshot(getUiSnapshot()); });
    if (window.Game) window.Game.onViewResize = function () { refreshUiStore(); };
    refreshUiStore();
    return function () {
      if (window.Game) window.Game.onViewResize = null;
      unsubscribe();
      stop();
    };
  }, []);
  return snapshot;
}

export function measureWidth(text, font) {
  if (typeof document === "undefined") return String(text || "").length * 12;
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  context.font = font;
  return context.measureText(text || "").width;
}

export function wrapLines(value, maxWidth, font) {
  const text = value || "";
  const lines = [];
  let line = "";
  for (let index = 0; index < text.length; index += 1) {
    const next = line + text.charAt(index);
    if (measureWidth(next, font) > maxWidth) {
      lines.push(line);
      line = text.charAt(index);
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export function fontCss(size, bold) {
  return (bold ? "bold " : "") + size + "px " + FACE;
}

export function baselineTop(y, size, bold) {
  return y - baselineShift(size, bold);
}

function baselineShift(size, bold) {
  const key = "lh1-" + (bold ? "b" : "n") + size;
  if (baselineCache.has(key)) return baselineCache.get(key);
  if (typeof document === "undefined") return size * 0.88;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;margin:0;padding:0;white-space:nowrap;font:" + fontCss(size, bold) + ";line-height:1;";
  probe.textContent = "国Ag";
  const mark = document.createElement("span");
  mark.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline;";
  probe.appendChild(mark);
  document.body.appendChild(probe);
  const shift = mark.getBoundingClientRect().bottom - probe.getBoundingClientRect().top;
  probe.remove();
  baselineCache.set(key, shift || size * 0.88);
  return baselineCache.get(key);
}

export function Stage(props) {
  const width = props.width || 360;
  const height = props.height || 640;
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(function () {
    const node = frameRef.current;
    if (!node) return undefined;
    function update() {
      const box = node.getBoundingClientRect();
      setScale((box.width || width) / width);
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return function () { observer.disconnect(); };
  }, [width, height]);
  return (
    <div className="meta-stage" ref={frameRef}>
      <div className="meta-scale" style={{ width: width, height: height, transform: "scale(" + scale + ")" }}>
        <div className="meta-overlay" />
        {props.children}
      </div>
    </div>
  );
}

export function Panel(props) {
  const rect = props.rect;
  return (
    <div className="meta-panel" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: props.radius == null ? 12 : props.radius, background: props.fill, borderColor: props.stroke || "transparent" }} />
  );
}

export function Rect(props) {
  const rect = props.rect;
  if (!rect) return null;
  return (
    <div className="meta-rect" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: props.radius == null ? 8 : props.radius, background: props.fill || "transparent", borderColor: props.stroke || "transparent" }} />
  );
}

export function Text(props) {
  if (props.children == null || props.children === "") return null;
  const size = props.size || 12;
  const bold = !!props.bold;
  const align = props.align || "left";
  const transform = align === "center" ? "translateX(-50%)" : align === "right" ? "translateX(-100%)" : undefined;
  return (
    <div className="meta-text" style={{ left: props.x, top: props.y - baselineShift(size, bold), transform: transform, fontSize: size, lineHeight: 1, fontWeight: bold ? 700 : 400, color: props.color || "#f4f8fb" }}>{props.children}</div>
  );
}

export function WrapText(props) {
  const size = props.size || 12;
  const lines = wrapLines(props.text, props.maxWidth, fontCss(size, props.bold));
  return lines.map(function (line, index) {
    return <Text key={index} x={props.x} y={props.y + index * props.lineHeight} size={size} bold={props.bold} color={props.color} align={props.align}>{line}</Text>;
  });
}

function AnchorLabel(props) {
  const bold = props.bold !== false;
  return (
    <span className="meta-anchor" style={{ top: props.top - baselineShift(props.size, bold), fontSize: props.size, lineHeight: 1, fontWeight: bold ? 700 : 400, color: props.color }}>{props.label}</span>
  );
}

export function Btn(props) {
  const rect = props.rect;
  if (!rect) return null;
  const color = props.color || "#68d8ff";
  return (
    <button type="button" className="meta-btn" onClick={props.onClick} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, backgroundImage: "linear-gradient(" + color + ", #2c9d91)", boxShadow: "0 0 16px " + color }}>
      <AnchorLabel top={rect.h / 2 + 5} size={15} color="#071217" label={props.label} />
    </button>
  );
}

export function Flat(props) {
  const rect = props.rect;
  if (!rect) return null;
  const clickable = typeof props.onClick === "function";
  const Tag = clickable ? "button" : "div";
  return (
    <Tag type={clickable ? "button" : undefined} className="meta-flat" onClick={props.onClick} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: props.radius == null ? 8 : props.radius, background: props.fill || "transparent", borderColor: props.stroke || "transparent" }}>
      {props.label ? <AnchorLabel top={props.baseline == null ? rect.h / 2 + 4 : props.baseline} size={props.size || 12} bold={props.bold} color={props.color || "#f4f8fb"} label={props.label} /> : null}
    </Tag>
  );
}

export function Badge(props) {
  return (
    <div className="meta-badge" style={{ left: props.x, top: props.y, width: props.w, borderColor: props.stroke || "rgba(255, 255, 255, .12)" }}>
      <AnchorLabel top={14} size={10} color={props.color || "#68d8ff"} label={props.label} />
    </div>
  );
}

export function Dot(props) {
  const radius = props.r;
  return <i className="meta-dot" style={{ left: props.x - radius, top: props.y - radius, width: radius * 2, height: radius * 2, background: props.fill || "transparent", borderColor: props.stroke || "transparent" }} />;
}

export function Icon(props) {
  const ref = useRef(null);
  useEffect(function () {
    const node = ref.current;
    if (!node) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    node.width = Math.max(1, Math.round(props.w * ratio));
    node.height = Math.max(1, Math.round(props.h * ratio));
    const context = node.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, props.w, props.h);
    try { props.draw(context); } catch (error) { context.clearRect(0, 0, props.w, props.h); }
  });
  return <canvas ref={ref} className="meta-mini" style={{ left: props.x, top: props.y, width: props.w, height: props.h }} />;
}

export function Pop(props) {
  return (
    <div className="meta-pop">
      <button type="button" className="meta-mask" style={{ background: props.shade || "rgba(3, 9, 13, .78)" }} onClick={props.onClose || function () {}} />
      {props.children}
    </div>
  );
}
