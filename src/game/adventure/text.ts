/** Small helpers for writing player-facing lines. */

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** "two"; numbers past twelve stay as figures. */
export function numberWord(n: number): string {
  return NUMBERS[n] ?? String(n);
}

/** "Fuchi", "Fuchi and Hanano", "Fuchi, Hanano and Taki", with the first letter raised. */
export function sentence(items: readonly string[]): string {
  const text = items.length <= 1 ? items[0] ?? '' : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
