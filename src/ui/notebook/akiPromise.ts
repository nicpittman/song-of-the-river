import type { AdventureView } from '../../game/adventure/model';

/** Keep the carpenter's promise visible even before the way south has been surveyed. */
export function akiPromise(view: AdventureView): { line: string; action: string } | null {
  if (view.mode !== 'journey' || view.region !== 1 || view.departure?.prepared || !view.journal.some(entry => entry.id === 'aki-meeting' && entry.found)) return null;
  const work = view.structures.find(site => ['cottage', 'bridge'].includes(site.id) && site.status === 'building');
  return work ? {
    line: `${work.name} is taking shape. Finish it to keep Aki’s promise to Mio; then he’ll come with us.`,
    action: 'Choose builders →',
  } : {
    line: 'We said we’d help Aki build a cottage or footbridge in Mio. Once it’s finished, he’ll come with us towards the sea.',
    action: 'Choose something to build →',
  };
}
