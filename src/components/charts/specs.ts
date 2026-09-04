/**
 * The mark specs every chart in Pulse is drawn to.
 *
 *   bars     ≤ 24px thick, 4px rounded data-end, square at the baseline
 *   lines    2px, round caps and joins
 *   markers  r ≥ 4 with a 2px ring in the surface colour
 *   grid     1px solid, one step off the surface, never dashed
 *   gaps     2px of surface between touching marks
 *   box      the svg's width/height is the whole footprint — no chart sets
 *            overflow-visible, so a label with nowhere to go is placed
 *            somewhere else rather than painted over the card holding it
 *
 * They live apart from `chartkit` because that file is a client module, and a
 * number imported from a client module by a server component does not arrive as a
 * number — it arrives as a client reference that throws when used. A server-rendered
 * sparkline that read LINE_WIDTH from there emitted `d="MNaN…"` and drew nothing.
 * Plain constants belong in a plain module both sides can import.
 */

export const BAR_MAX = 24;
export const BAR_RADIUS = 4;
export const LINE_WIDTH = 2;
export const MARKER_RADIUS = 4.5;
export const SURFACE_GAP = 2;
