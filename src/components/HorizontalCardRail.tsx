import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

type HorizontalCardRailProps = {
  children: ReactNode;
  className: string;
  label: string;
};

type ScrollEdges = {
  atStart: boolean;
  atEnd: boolean;
};

const EDGE_TOLERANCE = 3;

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export default function HorizontalCardRail({children, className, label}: HorizontalCardRailProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartScroll = useRef(0);
  const activePointer = useRef<number | null>(null);
  const dragged = useRef(false);
  const [edges, setEdges] = useState<ScrollEdges>({atStart: true, atEnd: true});

  const updateEdges = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const next = {
      atStart: viewport.scrollLeft <= EDGE_TOLERANCE,
      atEnd: viewport.scrollLeft >= maxScroll - EDGE_TOLERANCE,
    };
    setEdges((current) => (
      current.atStart === next.atStart && current.atEnd === next.atEnd ? current : next
    ));
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const frame = window.requestAnimationFrame(updateEdges);
    const resizeObserver = new ResizeObserver(updateEdges);
    const contentObserver = new MutationObserver(updateEdges);
    resizeObserver.observe(viewport);
    contentObserver.observe(viewport, {childList: true, subtree: true});
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      contentObserver.disconnect();
    };
  }, [updateEdges]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: globalThis.WheelEvent) => {
      const maximum = viewport.scrollWidth - viewport.clientWidth;
      if (maximum <= EDGE_TOLERANCE) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const canMove = delta < 0
        ? viewport.scrollLeft > EDGE_TOLERANCE
        : viewport.scrollLeft < maximum - EDGE_TOLERANCE;
      if (!canMove) return;
      event.preventDefault();
      viewport.scrollLeft += delta;
    };
    viewport.addEventListener("wheel", handleWheel, {passive: false});
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, []);

  function move(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({
      left: direction * Math.max(240, viewport.clientWidth * 0.82),
      behavior: scrollBehavior(),
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return;
    activePointer.current = event.pointerId;
    dragStartX.current = event.clientX;
    dragStartScroll.current = viewport.scrollLeft;
    dragged.current = false;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-dragging");
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || activePointer.current !== event.pointerId) return;
    const movement = event.clientX - dragStartX.current;
    if (Math.abs(movement) > 5) dragged.current = true;
    viewport.scrollLeft = dragStartScroll.current - movement;
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || activePointer.current !== event.pointerId) return;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    activePointer.current = null;
    viewport.classList.remove("is-dragging");
    if (dragged.current) window.setTimeout(() => { dragged.current = false; }, 0);
  }

  function suppressDraggedClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!dragged.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragged.current = false;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  }

  return (
    <div className={`aos-card-rail ${edges.atStart && edges.atEnd ? "" : "scrollable"}`}>
      <button
        className="aos-card-rail-control previous"
        type="button"
        onClick={() => move(-1)}
        disabled={edges.atStart}
        aria-label={`Scroll ${label} left`}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <div
        ref={viewportRef}
        className={className}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={updateEdges}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={suppressDraggedClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
      <button
        className="aos-card-rail-control next"
        type="button"
        onClick={() => move(1)}
        disabled={edges.atEnd}
        aria-label={`Scroll ${label} right`}
      >
        <span aria-hidden="true">›</span>
      </button>
      <span className="aos-card-rail-hint">Drag, scroll, or use arrows</span>
    </div>
  );
}
