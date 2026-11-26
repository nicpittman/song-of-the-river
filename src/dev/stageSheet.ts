/**
 * Contact sheet of every explorer frame (`stage.html?sheet`): one row per
 * explorer, poses left to right, on a meadow-coloured ground so the paint can
 * be judged against the valley's own colours. `&zoom=` sets the magnification.
 */

import { paintExplorer } from '../game/rendering/placeholders/explorers';
import { EXPLORER_CANVAS, EXPLORER_IDS, FRAME_COUNT, type FramePose } from '../game/rendering/placeholders/explorerRig';

export function showSheet(zoom: number, poses: readonly FramePose[]): void {
  const { width: W, height: H } = EXPLORER_CANVAS;
  const columns = poses.reduce((n, pose) => n + FRAME_COUNT[pose], 0);
  const cell = W * 0.62;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((columns * cell + 120) * zoom);
  canvas.height = Math.ceil((EXPLORER_IDS.length * (H + 6) + 40) * zoom);
  canvas.style.cssText = 'position:fixed;left:0;top:0;background:#a3a865';
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#a7ab69';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(zoom, zoom);
  ctx.font = "600 12px 'Cormorant Garamond', Georgia, serif";
  ctx.fillStyle = '#24362e';
  let x = 70;
  for (const pose of poses) {
    ctx.fillText(pose, x + 10, 16);
    x += FRAME_COUNT[pose] * cell;
  }
  EXPLORER_IDS.forEach((who, row) => {
    const y = 26 + row * (H + 6);
    ctx.fillStyle = '#24362e';
    ctx.fillText(who, 8, y + H * 0.7);
    let col = 0;
    for (const pose of poses) {
      for (let f = 0; f < FRAME_COUNT[pose]; f++) {
        const frame = paintExplorer(who, pose, f);
        ctx.drawImage(frame.canvas, 60 + col * cell - W * 0.2, y, W, H);
        col++;
      }
    }
  });
  document.body.appendChild(canvas);
}
