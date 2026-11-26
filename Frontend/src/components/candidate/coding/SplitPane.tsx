import React, { useRef, useState, useCallback } from "react";

interface SplitPaneProps {
  direction: "horizontal" | "vertical";
  initialPercent?: number;
  minPercent?: number;
  maxPercent?: number;
  first: React.ReactNode;
  second: React.ReactNode;
}

export default function SplitPane({
  direction,
  initialPercent = 45,
  minPercent = 22,
  maxPercent = 78,
  first,
  second,
}: SplitPaneProps) {
  const [percent, setPercent] = useState(initialPercent);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const raw =
        direction === "horizontal"
          ? ((clientX - rect.left) / rect.width) * 100
          : ((clientY - rect.top) / rect.height) * 100;
      const clamped = Math.max(minPercent, Math.min(maxPercent, raw));
      setPercent(clamped);
    },
    [direction, minPercent, maxPercent]
  );

  const onMouseDown = () => {
    draggingRef.current = true;
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) updateFromPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 3;
    if (
      (direction === "horizontal" && e.key === "ArrowLeft") ||
      (direction === "vertical" && e.key === "ArrowUp")
    ) {
      e.preventDefault();
      setPercent((p) => Math.max(minPercent, p - step));
    } else if (
      (direction === "horizontal" && e.key === "ArrowRight") ||
      (direction === "vertical" && e.key === "ArrowDown")
    ) {
      e.preventDefault();
      setPercent((p) => Math.min(maxPercent, p + step));
    }
  };

  const isHorizontal = direction === "horizontal";

  return (
    <div
      ref={containerRef}
      className={`coding-split-container ${isHorizontal ? "is-horizontal" : "is-vertical"}`}
      style={{
        display: "flex",
        flexDirection: isHorizontal ? "row" : "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          [isHorizontal ? "width" : "height"]: `${percent}%`,
          minWidth: 0,
          minHeight: 0,
          overflow: "auto",
        }}
      >
        {first}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation={isHorizontal ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={minPercent}
        aria-valuemax={maxPercent}
        aria-label="Resize panel"
        onMouseDown={onMouseDown}
        onKeyDown={onKeyDown}
        className={`coding-split-gutter ${isHorizontal ? "gutter-h" : "gutter-v"}`}
        style={{
          flexShrink: 0,
          background: "#e2e8f0",
          cursor: isHorizontal ? "col-resize" : "row-resize",
          [isHorizontal ? "width" : "height"]: "6px",
        }}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: "auto",
        }}
      >
        {second}
      </div>
    </div>
  );
}
