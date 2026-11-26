import type { Vec } from '../core/math';

/** Rotate a flight formation on the ground plane without rolling its illustrated birds. */
export function flockOffset(offset: Vec, heading: number): Vec {
  const angle = heading + Math.PI / 2;
  return {
    x: offset.x * Math.cos(angle) - offset.y * Math.sin(angle),
    y: offset.x * Math.sin(angle) + offset.y * Math.cos(angle),
  };
}

/** Small banking pose only: the bird illustration must never turn on its side. */
export function flockBank(previous: number, next: number): number {
  return Math.max(-0.14, Math.min(0.14, Math.atan2(Math.sin(next - previous), Math.cos(next - previous))));
}
