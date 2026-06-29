import { Suspense, lazy, useState, useRef, useEffect } from 'react';
import { Canvas } from '../canvas/Canvas';

const Sidebar = lazy(() => import('./Sidebar').then((module) => ({ default: module.Sidebar })));
const PropertiesPanel = lazy(() =>
  import('./PropertiesPanel').then((module) => ({ default: module.PropertiesPanel }))
);

const MIN_LEFT_WIDTH = 180;
const MIN_RIGHT_WIDTH = 220;
const DEFAULT_LEFT_WIDTH = 280;
const DEFAULT_RIGHT_WIDTH = 350;

export function ResizableLayout({
  onPreviewClick,
  onCodePanelToggle,
  showCodePanel,
}: {
  onPreviewClick: () => void;
  onCodePanelToggle: () => void;
  showCodePanel: boolean;
}) {
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('panel-left-width');
    return saved ? parseInt(saved) : DEFAULT_LEFT_WIDTH;
  });

  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('panel-right-width');
    return saved ? parseInt(saved) : DEFAULT_RIGHT_WIDTH;
  });

  const leftResizeRef = useRef<HTMLDivElement>(null);
  const rightResizeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLeftResizing, setIsLeftResizing] = useState(false);
  const [isRightResizing, setIsRightResizing] = useState(false);

  useEffect(() => {
    const handleResizeLeft = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      
      if (newWidth >= MIN_LEFT_WIDTH && newWidth <= 500) {
        setLeftWidth(newWidth);
        localStorage.setItem('panel-left-width', newWidth.toString());
      }
    };

    const handleResizeRight = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      
      if (newWidth >= MIN_RIGHT_WIDTH && newWidth <= 600) {
        setRightWidth(newWidth);
        localStorage.setItem('panel-right-width', newWidth.toString());
      }
    };

    const handleMouseUpLeft = () => {
      document.removeEventListener('mousemove', handleResizeLeft);
      document.removeEventListener('mouseup', handleMouseUpLeft);
      setIsLeftResizing(false);
    };

    const handleMouseUpRight = () => {
      document.removeEventListener('mousemove', handleResizeRight);
      document.removeEventListener('mouseup', handleMouseUpRight);
      setIsRightResizing(false);
    };

    const handleMouseDownLeft = () => {
      setIsLeftResizing(true);
      document.addEventListener('mousemove', handleResizeLeft);
      document.addEventListener('mouseup', handleMouseUpLeft);
    };

    const handleMouseDownRight = () => {
      setIsRightResizing(true);
      document.addEventListener('mousemove', handleResizeRight);
      document.addEventListener('mouseup', handleMouseUpRight);
    };

    const leftHandle = leftResizeRef.current;
    const rightHandle = rightResizeRef.current;

    if (leftHandle) {
      leftHandle.addEventListener('mousedown', handleMouseDownLeft);
    }
    if (rightHandle) {
      rightHandle.addEventListener('mousedown', handleMouseDownRight);
    }

    return () => {
      if (leftHandle) {
        leftHandle.removeEventListener('mousedown', handleMouseDownLeft);
      }
      if (rightHandle) {
        rightHandle.removeEventListener('mousedown', handleMouseDownRight);
      }
      document.removeEventListener('mousemove', handleResizeLeft);
      document.removeEventListener('mousemove', handleResizeRight);
      document.removeEventListener('mouseup', handleMouseUpLeft);
      document.removeEventListener('mouseup', handleMouseUpRight);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-1 overflow-hidden"
    >
      {/* Left Sidebar */}
      <div
        style={{ width: `clamp(${MIN_LEFT_WIDTH}px, 30vw, ${leftWidth}px)` }}
        className="left-sidebar min-h-0 overflow-hidden border-r border-slate-800"
      >
        <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-slate-500">Loading sidebar...</div>}>
          <Sidebar />
        </Suspense>
      </div>

      {/* Left Resize Handle */}
      <div
        ref={leftResizeRef}
        className={`w-1 shrink-0 cursor-col-resize transition-colors ${isLeftResizing ? 'bg-cyan-400' : 'bg-slate-800'}`}
      />

      {/* Canvas */}
      <div
        className="canvas-viewport min-h-0 flex-1 overflow-hidden border-r border-slate-800"
      >
        <Canvas
          onPreviewClick={onPreviewClick}
          onCodePanelToggle={onCodePanelToggle}
          showCodePanel={showCodePanel}
        />
      </div>

      {/* Right Resize Handle */}
      <div
        ref={rightResizeRef}
        className={`w-1 shrink-0 cursor-col-resize transition-colors ${isRightResizing ? 'bg-cyan-400' : 'bg-slate-800'}`}
      />

      {/* Right Properties Panel */}
      <div
        style={{ width: `clamp(${MIN_RIGHT_WIDTH}px, 34vw, ${rightWidth}px)` }}
        className="right-panel min-h-0 overflow-hidden border-l border-slate-800"
      >
        <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-slate-500">Loading properties...</div>}>
          <PropertiesPanel />
        </Suspense>
      </div>
    </div>
  );
}
