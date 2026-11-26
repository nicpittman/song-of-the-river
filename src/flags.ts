/**
 * Release switches, in one place.
 *
 * Production builds disable REVIEW_TOOLS automatically: the menu's Review panel
 * (disposable scenes, Wander included) disappears and its command does nothing.
 */
export const REVIEW_TOOLS = import.meta.env.DEV;

/** Wander stays off the menu until a Journey reaches Mio. True opens it from the start. */
export const WANDER_ALWAYS_OPEN = false;
