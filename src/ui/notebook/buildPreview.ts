import { workRate } from '../../game/adventure/construction';
import type { AdventureView, StructureView } from '../../game/adventure/model';

/** The same friends who will help when Begin fills the unassigned camp places. */
export function buildPreview(view: AdventureView, project: StructureView): string {
  if (project.status !== 'building') return '';
  const eligible = view.friends.filter(person => project.builders?.includes(person.id));
  const working = eligible.filter(person => person.status === 'building' || view.phase === 'morning' && person.status === 'home');
  if (!working.length) return eligible.length ? 'Choose a companion below to build today.' : 'No one can reach this site from their camp today.';
  const contribution = working.reduce((sum, person) => sum + workRate(person.id), 0);
  const names = working.map(person => person.name).join(' and ');
  const days = Math.ceil(project.workRemaining / contribution);
  return days <= 1 ? `${names} can finish it today.` : `${names} · about ${days} days with these hands.`;
}
