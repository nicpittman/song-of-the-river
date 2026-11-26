/** Integrated wind, so changing gusts never multiply the age of the scene. */
export function rainMotion(time: number, day: number, strength: number): { offset: number; slope: number } {
  const base = 3 + 5 * strength, phase = day * .5, frequency = .17, scale = 6 / 280;
  return {
    offset: scale * (base * time + 3 / frequency * (Math.cos(phase) - Math.cos(frequency * time + phase))),
    slope: scale * (base + 3 * Math.sin(frequency * time + phase)),
  };
}
