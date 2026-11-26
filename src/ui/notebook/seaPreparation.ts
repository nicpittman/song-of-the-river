/** One practical next step, kept on the existing planning page. */
import type { Activity, AdventureView, StructureKind } from '../../game/adventure/model';
import { SEA_PROVISIONS } from '../../game/adventure/progression';

export function seaPreparation(view: AdventureView): { label: string; place?: string; activity?: Activity; build?: StructureKind } | null {
  if (view.mode === 'free' || view.region !== 2 || view.voyage !== 'preparing') return null;
  const found = (id: string) => view.journal.some((entry) => entry.id === id && entry.found);
  const built = (kind: StructureKind) => view.structures.some((s) => s.id === kind && s.status === 'built');
  if (!view.places.some((p) => p.id === 'kawagiri' && !p.rumour) && !built('dock') && !built('boat')) return { label: 'Explore Shiobashi Bridge →', place: 'shiobashi', activity: 'explore' };
  if (view.friends.every((p) => p.base === 2 && p.lodging !== undefined) && !built('boat')) return { label: 'Carry our packs to Kawagiri →', place: 'kawagiri', activity: 'visit' };
  if (!found('boat-ledger') && !found('boatyard-moulds')) return { label: 'Look for boat plans at Funaya Boatyard →', place: 'funaya', activity: 'investigate' };
  if (!built('dock') && !built('boat')) return { label: view.structures.some(s => s.id === 'dock' && s.status === 'building') ? 'Choose builders for the dock →' : 'Prepare a dock for the boat →', build: 'dock' };
  if (!built('boat')) return { label: view.structures.some(s => s.id === 'boat' && s.status === 'building') ? 'Help restore the boat →' : 'Restore Grandfather’s boat →', build: 'boat' };
  if (!found('mended-sail') && !found('loft-sail')) return { label: 'Ask about a sail at Takayuka →', place: 'takayuka', activity: 'visit' };
  if (!found('tide-marks') && !found('tide-song')) return { label: 'Read the tide at Kawaguchi →', place: 'kawaguchi', activity: 'investigate' };
  if (view.provisions < SEA_PROVISIONS) return { label: `Pack ${SEA_PROVISIONS} provisions for the sea →`, place: 'kawaguchi', activity: 'fish' };
  return null;
}
