import { expect, it, vi } from 'vitest';
import { Board, mapNameLines } from './board';
import type { AdventureView } from '../../game/adventure/model';

it('wraps coastal names without changing names in the other reaches', () => {
  expect(mapNameLines({ region: 2, name: 'Funaya Boatyard' })).toEqual(['Funaya', 'Boatyard']);
  expect(mapNameLines({ region: 2, name: 'Todai Lighthouse' })).toEqual(['Todai', 'Lighthouse']);
  expect(mapNameLines({ region: 2, name: 'East marsh' })).toEqual(['East marsh']);
  expect(mapNameLines({ region: 1, name: 'Kitsuneyama Shrine' })).toEqual(['Kitsuneyama Shrine']);
});

it('reveals a coastal destination horizontally as well as vertically at closer zoom', () => {
  const scrollTo = vi.fn();
  const board = Object.assign(Object.create(Board.prototype), {
    view: { canTravel: false, chart: { width: 2400 } }, inner: { clientWidth: 900 },
    el: { clientHeight: 500, clientWidth: 450, scrollLeft: 0, scrollTop: 50, scrollTo },
    sections: [{ slice: { top: 4500, bottom: 6800 }, el: { offsetTop: 0, offsetHeight: 862.5 } }],
  }) as Board;
  board.reveal({ x: 2000, y: 5780 }, false);
  expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 525, behavior: 'auto' }));
});

it('keeps labels and trails untouched during stationary minimap updates', () => {
  const layout = vi.fn(), layoutTokens = vi.fn();
  const token = { owner: 'at-sora', at: { x: 500, y: 1000 }, el: { style: {}, setAttribute: vi.fn() } };
  const section = { slice: { top: 0, bottom: 2500 }, tokens: [token] };
  const board = Object.assign(Object.create(Board.prototype), { sections: [section], layout, layoutTokens }) as Board;
  const view = { friends: [{ id: 'sora', status: 'out', at: { x: 500, y: 1000 }, statusLine: 'Walking home' }], chart: { width: 2400 } } as AdventureView;
  for (let i = 0; i < 20; i++) board.updatePositions(view);
  expect(layout).not.toHaveBeenCalled();
  expect(layoutTokens).not.toHaveBeenCalled();
  view.friends[0]!.at = { x: 505, y: 1001 };
  board.updatePositions(view);
  expect(layoutTokens).toHaveBeenCalledOnce();
  expect(layout).not.toHaveBeenCalled();
  expect(token.at).toEqual(view.friends[0]!.at);
});
