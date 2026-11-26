import { describe, expect, it, vi } from 'vitest';
import { Container, Text } from 'pixi.js';
import { Places } from './places';
import { newFrame } from './frame';

describe('place lettering during zoom', () => {
  it('keeps a constant screen offset from the landmark across repeated zoom layouts', () => {
    const bounds = vi.spyOn(Text.prototype, 'getLocalBounds').mockReturnValue({ width: 200, height: 40 } as never);
    try {
      const ink = new Container();
      const places = new Places(ink);
      const f = { ...newFrame(), dt: 1 / 60, right: 5000, bottom: 5000 };
      for (const zoom of [0.4, 0.8, 1.2, 2, 0.5, 1.5, 0.4, 2]) {
        f.zoom = zoom;
        places.update([{ id: 'seseragi', name: 'Seseragi', kind: 'settlement', rumour: false, at: { x: 1000, y: 1800 }, state: 'open', lead: false, selected: false }], [], f);
        const label = ink.children.find((child) => child instanceof Text)!;
        expect((label.x - 1000) * zoom).toBeCloseTo(-84.375);
        expect(Math.abs((label.y - 1800) * zoom)).toBeLessThan(50);
      }
      ink.destroy({ children: true });
    } finally { bounds.mockRestore(); }
  });
});
