import type { AdventureView } from '../../game/adventure/model';

/** One rule for the closed valley, Today footer and keyboard shortcut. */
export function morningStatus(view: AdventureView): { ready: boolean; label: string; action: string } | null {
  if (view.phase !== 'morning' || view.voyage !== 'preparing' || view.placing) return null;
  const ready = view.structures.some(site => site.status === 'building' && !!site.builders?.length) || view.plans.length > 0 || view.friends.some((person) => person.status === 'resting' || person.status === 'building');
  return { ready, label: 'Morning · Day not started', action: ready ? 'Begin the day · E' : 'Plan today · E' };
}

export function dayNotice(view: AdventureView): { label: string; action: string } | null {
  return morningStatus(view) ?? (view.phase === 'day' && view.paused && !view.placing && view.voyage === 'preparing'
    ? { label: 'Day paused', action: 'Resume · Space' } : null);
}
