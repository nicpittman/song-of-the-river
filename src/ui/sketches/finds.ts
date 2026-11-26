/**
 * Discoveries: every find in `content.ts` (`FINDS`), drawn as the thing
 * itself rather than a generic icon. The drawings live in one file per
 * journal category: birds; creatures and fish; plants; curiosities (views,
 * moments, stones and shells); keepsakes; the people met; and the signs and
 * finds of the hunt (tracks, a sett, a shed antler, Haru herself); and the
 * finds of the later places and seasons (plums, Tomi's plots, the mill pool, the bay).
 */

import { BIRDS } from './finds-birds';
import { CREATURES } from './finds-creatures';
import { CURIOSITIES } from './finds-curiosities';
import { KEEPSAKES } from './finds-keepsakes';
import { ENCOUNTERS } from './finds-people';
import { PLANTS } from './finds-plants';
import { SEASONAL } from './finds-seasons';
import { SIGNS } from './finds-signs';
import { SIGHTED } from './finds-sightings';
import type { Drawing } from './pen';

export const FINDS: Record<string, Drawing> = { ...BIRDS, ...CREATURES, ...PLANTS, ...CURIOSITIES, ...KEEPSAKES, ...ENCOUNTERS, ...SIGNS, ...SEASONAL, ...SIGHTED };
