/**
 * A small stand-in for the rules' forecast, so the demo's planning card shows
 * believable chances and reasons. Not the real odds.
 */

import type { AdventureView, Chance, Forecast, OutingPlan } from '../../game/adventure/model';
import { CAMP } from './world';

const GIFT_REASON: Record<string, (name: string) => string> = {
  explore: (n) => `${n} loves finding new ground`,
  fish: (n) => `${n} knows this water`,
  forage: (n) => `${n} has an eye for plants`,
  investigate: (n) => `${n} looks closely`,
  visit: (n) => `${n} is good with people`,
};

export function forecastFor(view: AdventureView, plan: OutingPlan): Forecast {
  const place = view.places.find((p) => p.id === plan.place);
  const friend = view.friends.find((f) => f.id === plan.person);
  if (!place || !friend) return { problem: 'Choose a companion and a place.', chance: 'unlikely', pips: 0, reasons: [], length: '', beats: 1 };
  const distance = Math.hypot(place.at.x - CAMP.x, place.at.y - CAMP.y);
  const length = distance < 520 ? 'Back by midday' : distance < 1300 ? 'A long day' : 'Home after dark';
  const beats = distance < 520 ? 1 : distance < 1300 ? 2 : 3;
  if (place.state === 'closed') {
    return { problem: place.stateLine ?? 'Closed today.', chance: 'unlikely', pips: 0, reasons: [], length, beats };
  }
  const reasons: Forecast['reasons'] = [];
  let score = 1;
  if (place.lead) {
    reasons.push({ sign: '+', text: 'Following a lead' });
  }
  if (friend.gift === plan.activity) {
    score += 1;
    reasons.push({ sign: '+', text: GIFT_REASON[plan.activity](friend.name) });
  }
  if ((friend.practice[plan.activity] ?? 0) >= 3) {
    score += 1;
    reasons.push({ sign: '+', text: 'Practised at this' });
  }
  if (plan.activity === 'fish' && view.river.level === 'high' && (place.id === 'pool' || place.id === 'falls')) {
    score += 1;
    reasons.push({ sign: '+', text: 'High water: fish are running' });
  }
  if (plan.activity === 'fish' && view.river.level === 'high' && place.id === 'heron') {
    score -= 1;
    reasons.push({ sign: '-', text: 'Too fast for the shallows today' });
  }
  if (plan.item === 'fishing-kit' && plan.activity === 'fish') {
    score += 1;
    reasons.push({ sign: '+', text: 'The fishing kit helps' });
  }
  if ((view.weather === 'rain' || view.weather === 'mist') && plan.item !== 'rain-cape') {
    score -= 1;
    reasons.push({ sign: '-', text: view.weather === 'rain' ? 'No cape in the rain' : 'Mist on the water, no cape' });
  }
  if (plan.companion) {
    const c = view.friends.find((f) => f.id === plan.companion);
    score += 1;
    reasons.push({ sign: '+', text: `${c?.name ?? 'A friend'} along too` });
  }
  if (distance > 1300) {
    score -= 1;
    reasons.push({ sign: '-', text: 'A long way from camp' });
  }
  let chance: Chance = score <= 1 ? 'unlikely' : score === 2 ? 'even' : 'likely';
  let pips = (score <= 1 ? 1 : score === 2 ? 2 : 3) as Forecast['pips'];
  if (place.lead) {
    chance = 'certain';
    pips = 3;
  }
  return { problem: null, chance, pips, reasons: reasons.slice(0, 4), length, beats };
}
