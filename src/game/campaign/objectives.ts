/** Explaining wishes: what is still needed, and why a journey has not been made. */

import { describeClosure } from '../simulation/conditions';
import type { Simulation } from '../simulation/simulation';
import { placeById } from '../world/terrain';
import { type ObjectiveDef, SEASON_NAMES } from '../world/types';

/** One sentence on why an ungranted wish has not been met. */
export function explainShortfall(sim: Simulation, objective: ObjectiveDef): string {
  const journey = sim.board.journeys.find((j) => j.id === objective.journey)!;
  const from = placeById(sim.board, journey.from).name;
  const to = placeById(sim.board, journey.to).name;
  const season = SEASON_NAMES[objective.season].toLowerCase();
  const outlook = sim.outlook(objective);

  if (!outlook.joined) return `Nothing yet joins ${from} and ${to}.`;
  if (outlook.closure) {
    const why = describeClosure(outlook.closure);
    return `Between ${from} and ${to} in ${season}: ${why.charAt(0).toLowerCase()}${why.slice(1)}`;
  }
  return `Only ${sim.progress(objective)} of ${objective.count} made the journey in ${season}.`;
}
