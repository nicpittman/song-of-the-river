/**
 * The river in cross-section: a drawn bank profile with today's water in a
 * pale wash, tomorrow's level as a dashed line, and, on a morning the river
 * has changed, yesterday's level as a faint dotted line. Used large at the top
 * of the leaf and tiny in the day line.
 */

import type { RiverView, WaterLevel } from '../../game/adventure/model';

const ORDER: WaterLevel[] = ['low', 'middle', 'high'];

let clipCount = 0;

interface Size {
  width: number;
  height: number;
  /** The tiny day-line mark leaves out the ticks and yesterday's line. */
  tiny: boolean;
}

/** Height of a level's line, as a fraction of the drawing from the top. */
function levelFraction(level: WaterLevel): number {
  if (level === 'high') return 0.3;
  if (level === 'middle') return 0.52;
  return 0.72;
}

/** Where the water stood yesterday, inferred from the trend on a morning it changed. */
export function yesterdayLevel(river: RiverView): WaterLevel {
  const i = ORDER.indexOf(river.level);
  if (river.trend === 'falling') return ORDER[Math.min(2, i + 1)];
  if (river.trend === 'rising') return ORDER[Math.max(0, i - 1)];
  return river.level;
}

export function riverSection(river: RiverView, size: Size): string {
  const { width: w, height: hgt, tiny } = size;
  const id = `nb-xs-${++clipCount}`;
  // The bank profile: steep upper banks easing into a wide flat bed.
  const top = hgt * 0.08;
  const bed = hgt * 0.92;
  const profile =
    `M0 ${top} C ${w * 0.16} ${top} ${w * 0.18} ${bed * 0.62} ${w * 0.3} ${bed * 0.86} ` +
    `C ${w * 0.38} ${bed} ${w * 0.62} ${bed} ${w * 0.7} ${bed * 0.86} ` +
    `C ${w * 0.82} ${bed * 0.62} ${w * 0.84} ${top} ${w} ${top}`;
  const y = (level: WaterLevel): number => levelFraction(level) * hgt;
  const today = y(river.level);
  const tomorrow = y(river.tomorrow);

  const parts: string[] = [];
  // The channel is above the U-shaped bed. Closing underneath it paints the banks instead.
  parts.push(`<clipPath id="${id}"><path d="${profile} L ${w} 0 L 0 0 Z"/></clipPath>`);
  parts.push(`<rect class="xs-water" x="0" y="${today}" width="${w}" height="${hgt - today}" clip-path="url(#${id})"/>`);
  parts.push(`<line class="xs-line" x1="0" x2="${w}" y1="${today}" y2="${today}" clip-path="url(#${id})"/>`);
  if (river.tomorrow !== river.level) {
    parts.push(`<line class="xs-tomorrow" x1="${w * 0.12}" x2="${w * 0.88}" y1="${tomorrow}" y2="${tomorrow}"/>`);
  }
  if (!tiny && river.shifted) {
    const before = y(yesterdayLevel(river));
    parts.push(`<line class="xs-yesterday" x1="${w * 0.06}" x2="${w * 0.94}" y1="${before}" y2="${before}"/>`);
    // A small arrow from yesterday's line to today's.
    const ax = w * 0.5;
    const dir = today > before ? 1 : -1;
    parts.push(
      `<path class="xs-arrow" d="M${ax} ${before + dir * 2} L ${ax} ${today - dir * 3} M ${ax - 2.6} ${today - dir * 5.6} L ${ax} ${today - dir * 3} L ${ax + 2.6} ${today - dir * 5.6}"/>`,
    );
  }
  parts.push(`<path class="xs-bank" d="${profile}"/>`);
  if (!tiny) {
    // Grass on the two shoulders and three quiet level ticks at the right edge.
    parts.push(
      `<path class="xs-grass" d="M${w * 0.03} ${top} l1.5 -3 M${w * 0.07} ${top} l-1 -3.4 M${w * 0.93} ${top} l1.2 -3 M${w * 0.97} ${top} l-1.4 -3.2"/>`,
    );
    for (const level of ORDER) {
      const ly = y(level);
      parts.push(`<line class="xs-tick" x1="${w - 6}" x2="${w}" y1="${ly}" y2="${ly}"/>`);
    }
  }
  return (
    `<svg class="nb-xs${tiny ? ' is-tiny' : ''}" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" aria-hidden="true">` +
    parts.join('') +
    '</svg>'
  );
}
