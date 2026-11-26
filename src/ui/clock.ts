/**
 * The annual timer: a small paper tab hanging from the top edge of the
 * screen, like a bookmark. It reads, from left to right, as a sentence:
 * the season's mark, its name, and which day of it this is. Under that a
 * single pen line stands for the year, in four quarters with a small gap
 * between them: time already passed is a solid line, time to come is dotted,
 * a ring marks the present, and a pale wash in the season's tint lies under
 * today (or, without days, under the whole season).
 *
 * In expedition play a season is three days, and the line is ticked into days.
 * In the free-play valley HUD time runs continuously and no days are shown.
 * The clock works this out from where it is mounted (inside `.hud` or not);
 * `setDays` overrides that.
 *
 * Per frame only the elapsed dashes, the ring and (rarely) the wash move.
 */

import type { Season } from '../game/world/types';
import { SEASON_NAMES, clamp, h, svgEl } from './dom';
import { seasonMark } from './sketches';

/** Days in a season in expedition play. */
const EXPEDITION_DAYS = 3;
/** The year line's drawing width in SVG units (= CSS px), and the gap between quarters. */
const LINE_W = 216;
const GAP = 10;
const SEG = (LINE_W - 3 * GAP) / 4;
const MID = 7;
const WASHES = ['blossom', 'leaf', 'straw', 'river'] as const;
/** Where in its season a day falls, in words: a season of three days reads early, mid, late. */
function partOf(day: number, days: number): string {
  const f = days <= 1 ? 0.5 : (day - 1) / (days - 1);
  return f < 1 / 3 ? 'Early' : f > 2 / 3 ? 'Late' : 'Mid';
}

export class SeasonClock {
  readonly el: HTMLElement;
  private readonly mark: HTMLElement;
  private readonly seasonText: HTMLElement;
  private readonly whenText: HTMLElement;
  private readonly line: SVGSVGElement;
  private readonly wash: SVGRectElement;
  private readonly ticks: SVGPathElement;
  private readonly elapsed: SVGPathElement[] = [];
  private readonly future: SVGPathElement[] = [];
  private readonly bead: SVGCircleElement;

  private season: Season | -1 = -1;
  private year = 0;
  private years: number | null = null;
  private progress = -1;
  /** Undefined: decide by where the clock is mounted. */
  private daysOverride: number | null | undefined = undefined;
  private dayOverride: number | null = null;
  private days: number | null = EXPEDITION_DAYS;
  private drawn = { when: '', name: '', washX: -1, washW: -1, label: '' };

  constructor() {
    this.mark = h('span', 'clock-mark');
    this.seasonText = h('span', 'clock-season');
    this.whenText = h('span', 'clock-when sr-caps');

    this.line = svgEl('svg', { class: 'clock-line', viewBox: `0 0 ${LINE_W} 14`, width: LINE_W, height: 14, 'aria-hidden': 'true' });
    this.wash = svgEl('rect', { class: 'clock-wash', y: 2.5, height: 9, rx: 1.5 });
    this.ticks = svgEl('path', { class: 'clock-ticks' });
    this.line.append(this.wash);
    for (let i = 0; i < 4; i++) {
      const x0 = i * (SEG + GAP);
      const d = `M${x0.toFixed(2)} ${MID}H${(x0 + SEG).toFixed(2)}`;
      const f = svgEl('path', { class: 'clock-future', d });
      this.future.push(f);
      this.line.append(f);
    }
    this.line.append(this.ticks);
    for (let i = 0; i < 4; i++) {
      const x0 = i * (SEG + GAP);
      const p = svgEl('path', { class: 'clock-past', d: `M${x0.toFixed(2)} ${MID}H${(x0 + SEG).toFixed(2)}`, pathLength: 1 });
      p.style.strokeDasharray = '0 1';
      this.elapsed.push(p);
      this.line.append(p);
    }
    this.bead = svgEl('circle', { class: 'clock-bead', cx: 0, cy: MID, r: 3.2 });
    this.line.append(this.bead);

    const tab = h('div', 'clock-tab', null, [
      h('div', 'clock-head', null, [this.mark, this.seasonText, this.whenText]),
      this.line as unknown as Node,
    ]);
    this.el = h('div', 'clock', { role: 'img' }, [tab]);
  }

  /** Call once the element is in the document. */
  mount(): void {
    this.rebuild();
  }

  /** In expedition play, how many days a season has; null for continuous time. Undefined returns to the default. */
  setDays(perSeason: number | null | undefined): void {
    this.daysOverride = perSeason;
    this.rebuild();
  }

  /** The day within the season (1-based), when the game knows it better than the year fraction does; null derives it. */
  setDay(day: number | null): void {
    this.dayOverride = day;
    this.draw();
  }

  setLabel(season: Season, year: number, years: number | null): void {
    if (season === this.season && year === this.year && years === this.years) return;
    const turned = this.season !== -1 && season !== this.season;
    if (season !== this.season) {
      this.mark.innerHTML = seasonMark(season, 18);
      this.el.dataset.season = String(season);
      this.wash.style.fill = `var(--wash-${WASHES[season]})`;
    }
    this.season = season;
    this.year = year;
    this.years = years;
    if (turned) this.turn();
    this.draw();
  }

  setProgress(p: number): void {
    p = clamp(p, 0, 1);
    if (Math.abs(p - this.progress) < 0.0002) return;
    this.progress = p;
    this.draw();
  }

  /** Re-reads where the clock is mounted (which decides whether days are shown) and redraws the ticks. */
  rebuild(): void {
    this.days = this.daysOverride !== undefined ? this.daysOverride : this.el.closest('.hud') ? null : EXPEDITION_DAYS;
    this.el.classList.toggle('has-days', this.days !== null);
    const ticks: string[] = [];
    if (this.days) {
      for (let i = 0; i < 4; i++) {
        for (let k = 1; k < this.days; k++) {
          const x = i * (SEG + GAP) + (SEG * k) / this.days;
          ticks.push(`M${x.toFixed(2)} ${MID - 3}V${MID + 3}`);
        }
      }
    }
    this.ticks.setAttribute('d', ticks.join(''));
    this.drawn.washX = -1;
    this.drawn.when = '';
    this.drawn.name = '';
    this.draw();
  }

  private draw(): void {
    const p = Math.max(0, this.progress);
    const quarter = Math.min(3, Math.floor(p * 4));
    const within = p * 4 - quarter;
    for (let i = 0; i < 4; i++) {
      const f = i < quarter ? 1 : i > quarter ? 0 : within;
      this.elapsed[i].style.strokeDasharray = `${f.toFixed(4)} 1`;
      // The quarter we are in is drawn in full ink; the rest of the year more faintly.
      this.future[i].classList.toggle('is-now', i === quarter);
    }
    const x = quarter * (SEG + GAP) + within * SEG;
    this.bead.setAttribute('cx', x.toFixed(2));

    const season = this.season === -1 ? quarter : this.season;
    let day: number | null = null;
    let washX = season * (SEG + GAP);
    let washW = SEG;
    if (this.days) {
      day = this.dayOverride ?? Math.min(this.days, Math.floor(within * this.days) + 1);
      washW = SEG / this.days;
      washX += (day - 1) * washW;
    }
    if (washX !== this.drawn.washX || washW !== this.drawn.washW) {
      this.drawn.washX = washX;
      this.drawn.washW = washW;
      this.wash.setAttribute('x', (washX - 1).toFixed(2));
      this.wash.setAttribute('width', Math.max(0, washW + 2).toFixed(2));
    }

    // The words: "Early spring · Year 1" in expedition play (early, mid or late
    // in the season, never a countdown), "Year 1 of 2" or "Year 1" in the valley.
    // Before the first snapshot sets it the year reads 0: never shown, the first year is Year 1.
    const year = Math.max(1, this.year);
    const yearWords = this.years ? `Year ${year} of ${this.years}` : `Year ${year}`;
    const season0 = SEASON_NAMES[season] ?? 'Spring';
    const name = day !== null && this.days ? `${partOf(day, this.days)} ${season0.toLowerCase()}` : season0;
    if (name !== this.drawn.name) {
      this.drawn.name = name;
      this.seasonText.textContent = name;
    }
    const when = yearWords;
    if (when !== this.drawn.when) {
      this.drawn.when = when;
      this.whenText.textContent = when;
    }
    const label = `${name}. ${yearWords}.`;
    if (label !== this.drawn.label) {
      this.drawn.label = label;
      this.el.setAttribute('aria-label', label);
    }
  }

  /** A new season: its name and mark ink in again. */
  private turn(): void {
    this.el.classList.remove('is-turning');
    void this.el.offsetWidth;
    this.el.classList.add('is-turning');
    window.setTimeout(() => this.el.classList.remove('is-turning'), 1400);
  }
}
