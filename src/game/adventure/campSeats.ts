import type { Vec } from '../core/math';

export interface CampOrigin extends Vec { seats?: readonly Vec[] }

/** A clear gap round the fire, with three people on either side. */
export const CAMP_SEATS: readonly Vec[] = [
  { x: -62, y: -28 }, { x: 62, y: -28 },
  { x: -76, y: 22 }, { x: 76, y: 22 },
  { x: -48, y: 60 }, { x: 48, y: 60 },
];

export function seat(fire: CampOrigin, index: number): Vec {
  const arranged = fire.seats?.[index % CAMP_SEATS.length];
  if (arranged) return { x: arranged.x, y: arranged.y };
  const offset = CAMP_SEATS[index % CAMP_SEATS.length]!;
  return { x: fire.x + offset.x, y: fire.y + offset.y };
}
