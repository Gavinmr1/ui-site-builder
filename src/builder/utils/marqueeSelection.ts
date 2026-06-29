/**
 * Marquee Selection Utilities
 * Handles drag-box selection of nodes on the canvas
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function getSelectionRect(box: SelectionBox): Rect {
  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const width = Math.abs(box.endX - box.startX);
  const height = Math.abs(box.endY - box.startY);
  return { x, y, width, height };
}

export function toRelativePoint(
  clientX: number,
  clientY: number,
  element: HTMLElement
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function rectsIntersect(rect1: Rect, rect2: Rect): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect1.x > rect2.x + rect2.width ||
    rect1.y + rect1.height < rect2.y ||
    rect1.y > rect2.y + rect2.height
  );
}

export function getNodesBoundingBox(elements: HTMLElement[]): Rect | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    minX = Math.min(minX, rect.left);
    minY = Math.min(minY, rect.top);
    maxX = Math.max(maxX, rect.right);
    maxY = Math.max(maxY, rect.bottom);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function collectIntersectingNodeIds(
  canvasElement: HTMLElement,
  selectionRect: Rect
): string[] {
  const canvasRect = canvasElement.getBoundingClientRect();
  const nodeElements = canvasElement.querySelectorAll<HTMLElement>('[data-node-id]');
  const selectedNodeIds: string[] = [];

  nodeElements.forEach((el) => {
    const nodeId = el.getAttribute('data-node-id');
    if (!nodeId) return;

    const nodeRect = el.getBoundingClientRect();
    const relativeRect: Rect = {
      x: nodeRect.left - canvasRect.left,
      y: nodeRect.top - canvasRect.top,
      width: nodeRect.width,
      height: nodeRect.height,
    };

    if (rectsIntersect(selectionRect, relativeRect)) {
      selectedNodeIds.push(nodeId);
    }
  });

  return selectedNodeIds;
}
