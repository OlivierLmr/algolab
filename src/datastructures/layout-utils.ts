/**
 * Compute where a line from (fromX, fromY) toward a rectangle's center
 * intersects the rectangle boundary. Used to terminate arrows at box edges.
 */
export function rectEdgeIntersection(
  fromX: number, fromY: number,
  rectX: number, rectY: number, rectW: number, rectH: number,
): { x: number; y: number } {
  const cx = rectX + rectW / 2
  const cy = rectY + rectH / 2
  const dx = fromX - cx
  const dy = fromY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scaleX = dx !== 0 ? (rectW / 2) / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? (rectH / 2) / Math.abs(dy) : Infinity
  const scale = Math.min(scaleX, scaleY)
  return { x: cx + dx * scale, y: cy + dy * scale }
}
