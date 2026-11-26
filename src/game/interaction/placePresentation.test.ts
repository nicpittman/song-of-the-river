import { describe, expect, it } from 'vitest';
import { seseragi } from '../world/boards/seseragi';
import { connectionTypeFor } from '../world/connections';
import { placePresentation } from './placePresentation';

const place = (id: string) => seseragi.places.find((p) => p.id === id)!;

describe('place guidance matches the valley rules', () => {
  it('identifies both Fuchi and the lower reach as river places, without suggesting footpaths', () => {
    for (const p of seseragi.places.filter((p) => p.kind === 'water')) {
      expect(placePresentation(p).role).toContain('Fish');
      expect(placePresentation(p).hint).toContain('river');
      expect(connectionTypeFor(p, place('seseragi'))).toBeNull();
    }
  });
  it('explains bird refuges as resting places rather than missing land destinations', () => {
    const p = place('sagi');
    expect(placePresentation(p).role).toContain('Birds');
    expect(placePresentation(p).hint).toContain('flight range');
    expect(p.links).toEqual([]);
  });
  it('explains the two kinds of route accepted by the high meadow', () => {
    const p = place('hanano');
    expect(placePresentation(p).role).toContain('Deer & people');
    expect(connectionTypeFor(p, place('kamimori'))).toBe('corridor');
    expect(connectionTypeFor(p, place('seseragi'))).toBe('path');
  });
});
