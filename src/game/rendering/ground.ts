/**
 * The ground. One full-landscape quad whose fragment shader composes the
 * terrain materials, riverbanks, flowing water, the player's paths, snow and
 * the seasonal colour grade. Doing this per pixel is what makes the valley a
 * continuous painting: there are no tiles, patches or sprites with edges.
 *
 * Seasons do not switch; they travel. `wave` sweeps a front down the valley
 * from the mountains, and each pixel blends from the outgoing season's look
 * to the incoming one as the front passes it.
 */

import { BufferImageSource, Mesh, MeshGeometry, Shader, Texture } from 'pixi.js';
import type { Connection } from '../world/connections';
import type { River } from '../world/river';
import { WATER_OFFSET } from '../world/river';
import { bakeLevels } from './waterLevels';
import { groundMaps, groundNoise } from './groundBake';
import type { BoardDef, LaneDef, Season } from '../world/types';
import type { ArtLibrary } from './art';
import {
  ALTITUDE_SCALE,
  bakePlains,
  type DataMap,
  type Extent,
  pathStep,
  WATER_RANGE,
  bakeWater,
  paintPaths,
} from './fields';

/** How each season dresses the ground. */
interface SeasonLook {
  tint: [number, number, number];
  saturation: number;
  /** 0 = bare ground, 1 = full winter. */
  snow: number;
  /** Leaf litter on woodland floors. */
  litter: number;
  water: [number, number, number];
}

export const SEASON_LOOKS: Record<Season, SeasonLook> = {
  // Spring and summer lean toward sage rather than a hot yellow-green, so buildings and trees sit in the grass.
  0: { tint: [0.97, 1.0, 0.95], saturation: 0.9, snow: 0.16, litter: 0, water: [0.94, 1.04, 1.06] },
  1: { tint: [0.97, 1.0, 0.94], saturation: 0.92, snow: 0, litter: 0, water: [1, 1.02, 1] },
  2: { tint: [1.1, 0.99, 0.79], saturation: 1.05, snow: 0, litter: 1, water: [0.9, 0.95, 0.96] },
  // Under the snow the grass is dry and straw-coloured; the snow itself brings the cool blues.
  3: { tint: [1.0, 0.94, 0.8], saturation: 0.82, snow: 1, litter: 0.2, water: [0.7, 0.88, 0.98] },
};

const VERTEX = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out vec2 vWorld;
out vec2 vMap;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vWorld = aPosition;
  vMap = aUV;
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vWorld;
in vec2 vMap;
out vec4 finalColor;

uniform sampler2D uMeadow;
uniform sampler2D uWoodland;
uniform sampler2D uWetland;
uniform sampler2D uRocky;
uniform sampler2D uOrchard;
uniform sampler2D uBank;
uniform sampler2D uScree;
uniform sampler2D uWater;
uniform sampler2D uNoise;
uniform sampler2D uTerrainA;
uniform sampler2D uTerrainB;
uniform sampler2D uWaterMap;
uniform sampler2D uPathMap;
uniform sampler2D uRelief;
uniform sampler2D uCanopy;

uniform float uTime;
uniform float uReverse;
uniform float uWave;       // position of the seasonal front, 0 (mountains) .. 1 (river mouth), >1.3 when settled
uniform vec2 uSpan;        // world y of the top of the landscape, and its height
uniform float uSnowAlt;
uniform float uHigh;       // 0..1: how far the river stands above its middle level today (eased)
uniform float uLow;        // 0..1: how far below it
uniform float uSeaY;       // world y of the shoreline; far below the map if the valley has no sea
uniform vec2 uLightStep;  // map-space step toward the light (upper left)
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec4 uLookA;       // saturation, snow, litter, flood (px)
uniform vec4 uLookB;
uniform vec2 uFloodA;      // which flood to read from the canopy map: (spring melt, autumn rains)
uniform vec2 uFloodB;
uniform vec3 uWaterTintA;
uniform vec3 uWaterTintB;

const float TILE = 420.0;

// Two samples at unrelated scales, cross-faded by slow noise, hide the repeat of a tiling material.
vec3 material(sampler2D tex, vec2 uv, float m) {
  return mix(texture(tex, uv).rgb, texture(tex, uv * 0.618 + vec2(0.37, 0.11)).rgb, m);
}

void main() {
  vec3 macro = texture(uNoise, vWorld / 1500.0).rgb;
  vec3 meso = texture(uNoise, vWorld / 340.0 + 0.31).rgb;
  float fine = texture(uNoise, vWorld / 84.0 + 0.57).r;
  vec2 uv = vWorld / TILE;
  float m = smoothstep(0.35, 0.65, macro.g);

  // How far the incoming season has reached this pixel.
  float along = (vWorld.y - uSpan.x) / uSpan.y + (meso.r - 0.5) * 0.09;
  along = mix(along, 1.0 - along, uReverse);
  float t = smoothstep(0.0, 0.1, uWave - along);
  vec4 look = mix(uLookA, uLookB, t);
  vec3 tint = mix(uTintA, uTintB, t);

  // ── Terrain ──────────────────────────────────────────────────────────
  vec3 ta = texture(uTerrainA, vMap).rgb;
  vec3 tb = texture(uTerrainB, vMap).rgb;
  float jitter = (meso.g - 0.5) * 0.7 + (macro.b - 0.5) * 0.3 + (fine - 0.5) * 0.22;
  float wOrchard = smoothstep(0.3, 0.62, tb.r + jitter);
  float wWetland = smoothstep(0.3, 0.62, ta.g + jitter);
  float wWood = smoothstep(0.26, 0.6, ta.r + jitter);
  float wRock = smoothstep(0.28, 0.62, ta.b + jitter);
  // Scree feathers out into the grass over a wide, broken margin rather than ending in a hard island.
  float wScree = smoothstep(0.24, 0.72, tb.b + jitter * 1.1);

  // A material whose weight is zero here leaves the colour exactly as it is, so its lookups are skipped.
  // The tests leave out the fine grain of the jitter (at most 0.11 either way) and allow a little more,
  // so they reach a pixel or two beyond the material's own edge: a lookup made where the one next door
  // was skipped can choose the wrong level of detail, so every pixel that shows a material samples it
  // alongside its neighbours.
  float broad = (meso.g - 0.5) * 0.7 + (macro.b - 0.5) * 0.3;
  vec3 col = material(uMeadow, uv, m);
  if (tb.r + broad > 0.16) col = mix(col, material(uOrchard, uv, m), wOrchard * 0.8);
  if (ta.g + broad > 0.16) col = mix(col, material(uWetland, uv, m) * vec3(1.16, 1.2, 1.02), wWetland * 0.8);
  vec3 woodland = material(uWoodland, uv, m) * vec3(0.84, 0.9, 0.8);
  col = mix(col, woodland, wWood * 0.92);
  if (ta.b + broad > 0.14) col = mix(col, material(uRocky, uv, m), wRock * 0.9);

  // Under trees the ground is shaded, mossy and bare of grass. Not in a yard or on a path, though:
  // that ground is open to the sky (trees are cleared from routes), and a building is seated
  // by its own contact shadow instead, which a dark mossy pool round its walls would muddy.
  // A building's canopy reaches a little beyond its yard, so look a few steps round as well.
  // uLightStep is nine world pixels toward the upper left; this is one world pixel in map space.
  vec2 px = uLightStep / -9.0;
  float nearby = texture(uPathMap, vMap).r;
  nearby = max(nearby, texture(uPathMap, vMap + vec2(0.0, -30.0) * px).r);
  nearby = max(nearby, texture(uPathMap, vMap + vec2(-30.0, 8.0) * px).r);
  nearby = max(nearby, texture(uPathMap, vMap + vec2(30.0, 8.0) * px).r);
  float open = smoothstep(0.03, 0.22, nearby);
  float canopy = texture(uCanopy, vMap).r * (1.0 - open);
  col = mix(col, woodland * vec3(0.9, 0.92, 0.84), canopy * 0.45) * (1.0 - 0.2 * canopy);

  // Painted light and shade across the meadow, so large areas never sit flat.
  col *= 0.88 + 0.24 * macro.r;
  col = mix(col, col * vec3(1.08, 1.03, 0.86), smoothstep(0.45, 0.8, macro.b) * 0.5);

  // ── The player's routes ──────────────────────────────────────────────
  vec3 pm = texture(uPathMap, vMap).rgb;
  // A corridor is a band of deep undergrowth, darker and richer than the meadow it crosses.
  float corridor = smoothstep(0.3, 0.7, pm.g + jitter * 0.5);
  col = mix(col, woodland * vec3(0.6, 0.76, 0.54), corridor * 0.9);
  // An old river bed is marked in red and blue together; take it out of both so it is not drawn as a path or a track.
  float bed = smoothstep(0.3, 0.6, min(pm.r, pm.b) + (fine - 0.5) * 0.3 + (meso.b - 0.5) * 0.16);
  float track = smoothstep(0.4, 0.7, pm.b + (fine - 0.5) * 0.5) * (1.0 - bed);
  float path = smoothstep(0.42, 0.66, pm.r + (fine - 0.5) * 0.26 + (meso.b - 0.5) * 0.14) * (1.0 - bed);

  // ── Riverbank ────────────────────────────────────────────────────────
  vec4 wm = texture(uWaterMap, vMap);
  float sd = (wm.r - 0.5) * ${(WATER_RANGE * 2).toFixed(1)};
  // The waterline wanders: broad pools and narrows, then finer nibbles along the bank.
  float edge = sd - look.w + (macro.g - 0.5) * 30.0 + (meso.b - 0.5) * 14.0 + (fine - 0.5) * 4.0;
  // Today's level (see waterLevels.ts): raised bars stand clear of the water when the river is low.
  vec4 cm = texture(uCanopy, vMap);
  float lift = cm.a * 2.0 - 1.0;
  edge += uLow * smoothstep(0.0, 1.0, max(0.0, -lift + (macro.g - 0.5) * 0.5 + (meso.b - 0.5) * 0.3)) * 80.0 + uLow * 3.0 - uHigh * 3.0;
  // When the river is high it takes the water meadows: the flood spreads out from
  // the lowest ground as the season's front arrives, and draws back when it passes.
  vec2 plains = cm.gb;
  float low = mix(dot(plains, uFloodA), dot(plains, uFloodB), t);
  float floodEdge = (0.44 - low + (meso.b - 0.5) * 0.2 + (fine - 0.5) * 0.06) * 110.0;
  float flooded = step(floodEdge, edge) * step(floodEdge, 3.0);
  edge = min(edge, floodEdge);
  // The day's own high water runs into the low places it reaches (an old channel, a pond's
  // margin) as part of the river: the same water, deepening toward the middle, no sheet.
  // Shallow (a narrow channel, not the main river's depth), and fading out where it meets the
  // main river so the river's own shallows and margins run on unbroken across the join.
  float spill = min(max(0.0, lift), 0.68) * smoothstep(-26.0, 14.0, sd);
  float levelEdge = (0.44 - uHigh * spill + (meso.b - 0.5) * 0.12 + (fine - 0.5) * 0.04) * 110.0;
  edge = min(edge, levelEdge);
  // Gravel and sand along the water, widening into bars here and there.
  float bar = smoothstep(0.52, 0.8, macro.b + meso.r * 0.35);
  // At low water the river draws back and leaves a wider shore of pebbles and gravel bars behind it.
  float lowWater = max(0.0, -look.w) * (2.4 + 2.0 * bar);
  // A bar the low river leaves bare is all gravel, not grass.
  lowWater += uLow * smoothstep(0.0, 0.3, -lift) * 90.0;
  float bankReach = 20.0 + 16.0 * meso.r + 44.0 * bar + lowWater;
  float bank = (1.0 - smoothstep(1.0, bankReach, edge)) * (1.0 - wScree * 0.7);
  // Only near the water (whose bed below is painted from the bank colour too), with a margin for the
  // grain in the waterline, for the same reason as the materials above.
  vec3 bankCol = vec3(0.0);
  if (edge < bankReach + 10.0) {
    bankCol = material(uBank, uv * 1.15, m);
    col = mix(col, bankCol, bank * 0.78);
  }
  // Toward the sea the land ends in a broad beach (painted below, after the seasonal grade).
  float coast = smoothstep(uSeaY - 260.0, uSeaY - 90.0, vWorld.y);
  float beach = coast * (1.0 - smoothstep(30.0, 120.0 + 60.0 * meso.r, edge));
  // Behind the strand the dunes: sand that the grass takes over in patches, thinning inland.
  // (The water map only measures a short way from the shore, so the dunes are placed by height above the shoreline.)
  float dunes = smoothstep(uSeaY - 330.0 + (meso.g - 0.5) * 120.0, uSeaY - 210.0 + (meso.g - 0.5) * 60.0, vWorld.y);
  beach = max(beach, dunes * smoothstep(0.3, 0.62, meso.b * 0.55 + fine * 0.15 + dunes * 0.45));
  // Toward the coast the light is paler and the grass thinner and greyer: salt wind and a big sky.
  float salt = smoothstep(uSeaY - 1700.0, uSeaY - 250.0, vWorld.y);
  col = mix(col, mix(vec3(dot(col, vec3(0.3, 0.55, 0.15))), col, 0.72) * 1.07 + vec3(0.02, 0.02, 0.03), salt * 0.6);

  // ── Seasonal grade ───────────────────────────────────────────────────
  col = mix(col, col * vec3(1.3, 0.86, 0.56), look.z * (wWood + corridor * 0.6) * (0.35 + 0.4 * meso.g));
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, look.x) * tint;

  // Sand keeps its own colour through the year, like trodden earth; it only darkens where it is wet.
  col = mix(col, vec3(0.9, 0.83, 0.66) * (0.9 + 0.16 * fine) * (1.0 - 0.18 * smoothstep(26.0, 2.0, edge)), beach * 0.94);

  // A dry river bed: pale, pebbly gravel lying a little below the meadow, darker along its edges.
  // Two unrelated scales of speckle, so the pebbles never line up into a pattern.
  // A bar the low river leaves bare: the same pale pebbly gravel as a dry bed, thinning into the grass at its edge.
  float shingle = uLow * smoothstep(0.0, 0.9, -lift + (meso.r - 0.5) * 0.5 + (fine - 0.5) * 0.2) * smoothstep(-1.0, 6.0, edge);
  if (bed > 0.0 || shingle > 0.0) {
    float pebble = texture(uNoise, vWorld / 37.0 + 0.21).r * 0.6 + texture(uNoise, vWorld.yx / 13.0).g * 0.4;
    vec3 gravel = mix(vec3(0.74, 0.71, 0.62), vec3(0.88, 0.85, 0.74), smoothstep(0.35, 0.65, pebble)) * (0.9 + 0.16 * meso.r);
    col = mix(col, gravel, bed * 0.9);
    col = mix(col, gravel * (1.0 - 0.12 * smoothstep(18.0, 2.0, edge)), shingle * 0.9);
  }
  col *=1.0 - 0.22 * smoothstep(0.12, 0.3, min(pm.r, pm.b)) * (1.0 - bed);

  // Trodden ground: pale earth that keeps its colour while the grass around it turns with the year.
  // Needed only on a route, or for the trodden lines through snow. The test is on the path map alone,
  // which reaches a little beyond the trodden ground, so that every pixel that uses the earth samples it
  // alongside its neighbours (a lookup skipped next door would upset the texture's choice of detail).
  vec3 earth = vec3(0.0);
  if (pm.r > 0.0 || pm.b > 0.0 || look.y > 0.0) {
    earth = material(uBank, uv * 1.4, m);
    earth = mix(vec3(0.8, 0.69, 0.5), earth * vec3(1.3, 1.16, 0.94), 0.55) * (0.94 + 0.12 * meso.r);
    // It does stand in the season's light, though, at half strength, like the cottages in their yards;
    // otherwise an autumn lane reads grey against the gold around it.
    earth *= mix(vec3(1.0), tint, 0.5);
  }
  col = mix(col, earth, path * 0.95);
  // A faint darker lip where grass overhangs the path edge.
  col *= 1.0 - 0.16 * smoothstep(0.2, 0.42, pm.r) * (1.0 - path);
  col = mix(col, earth * vec3(0.86, 0.84, 0.8), track * 0.7);
  float worn = max(path, track);

  // Bare rock keeps its own colour through the year, and falls into shadow toward the water.
  if (tb.b + broad * 1.1 > 0.09) {
    vec3 scree = material(uScree, uv * 1.2, m);
    // Warm, pale stone (it sits with the painted boulders), only a little darker by the water.
    scree = mix(vec3(dot(scree, vec3(0.333))), scree, 0.6) * vec3(1.06, 1.02, 0.92) + vec3(0.05, 0.04, 0.02);
    col = mix(col, scree * (1.0 - 0.15 * smoothstep(46.0, 2.0, edge)), wScree * 0.78);
  }

  // ── Snow ─────────────────────────────────────────────────────────────
  vec2 relief = texture(uRelief, vMap).rg;
  float lightV = relief.r * 2.0 - 1.0;
  // (The ice in the water below uses this too.)
  float patchy = meso.g * 0.45 + fine * 0.1 + macro.r * 0.45;
  // With no snow in either season, none of this changes the colour.
  if (look.y > 0.0) {
    float alt = tb.g * ${ALTITUDE_SCALE.toFixed(2)};
    float high = smoothstep(uSnowAlt - 0.1, uSnowAlt + 0.03, alt);
    // Lowland snow lies thin, and the ground shows through: dry grass along the water,
    // needle litter under the trees, rock on steep and stony ground, the line of a corridor.
    float steep = smoothstep(0.25, 0.7, abs(lightV));
    // Snow carries on under the trees (in their shade, not bared), so trunks stand in it rather than on dark islands.
    float thaw = smoothstep(52.0, 4.0, edge) * 0.5 + 0.1 * wWood + 0.1 * canopy + 0.3 * wRock + 0.12 * wScree + 0.12 * steep + 0.32 * corridor;
    // Coverage varies across the valley: deep in sheltered hollows, thin where the wind scours open ground.
    float scour = (macro.b - 0.5) * 0.4 + (macro.g - 0.5) * 0.2;
    float cover = look.y * (0.8 + 0.5 * high - thaw - scour);
    float depthS = cover - patchy;
    float snow = smoothstep(0.0, 0.18, depthS);
    // Where the snow gives out, the ground is still frosted and pale.
    col = mix(col, mix(col, vec3(0.78, 0.8, 0.84), 0.45), look.y * smoothstep(-0.2, 0.02, depthS) * (1.0 - snow));
    // Drifts: the snow surface rises and falls, lit warm where it faces the sun (upper left), blue where it turns away.
    float driftLit = texture(uNoise, (vWorld - vec2(30.0, 30.0)) / 340.0 + 0.31).b;
    float facing = clamp((meso.b - driftLit) * 3.2 + 0.5, 0.0, 1.0);
    float sunlit = smoothstep(0.15, 0.85, facing * 0.6 + macro.r * 0.25 + 0.12 + (fine - 0.5) * 0.08);
    vec3 snowCol = mix(vec3(0.74, 0.8, 0.91), vec3(0.99, 0.975, 0.94), sunlit);
    // Snow lying thin at its margin, and in the shade of the trees, is bluer.
    snowCol = mix(snowCol, vec3(0.7, 0.77, 0.89), 0.5 * (1.0 - smoothstep(0.04, 0.2, depthS)));
    // Under the canopy the snow lies in blue-grey shade, deepest at the heart of a wood: the forest's occlusion.
    snowCol = mix(snowCol, vec3(0.56, 0.63, 0.77), smoothstep(0.05, 0.8, canopy) * 0.75);
    // Routes stay readable in snow: trodden down to the earth, a warm line through the drifts.
    vec3 trodden = mix(earth * vec3(0.82, 0.8, 0.8), vec3(0.76, 0.78, 0.84), 0.35);
    // Only the trodden core of a route stays open; snow drifts over its soft edges, and over
    // the shoulder of a yard, so a cottage stands in snow rather than on a ring of mud.
    float wornSnow = max(smoothstep(0.55, 0.8, pm.r + (fine - 0.5) * 0.26), track);
    snowCol = mix(snowCol, trodden, wornSnow * 0.75);
    col = mix(col, snowCol, snow * mix(0.97, 0.75, wornSnow));
  }

  // ── Relief ───────────────────────────────────────────────────────────
  // Layered-paper landforms: terrace edges lit toward the sun, shadowed away from it.
  // Shade is blue-grey, as on the sprites' cast shadows; on snow it is stronger, as snow shows it best.
  col = mix(col, col * vec3(0.64, 0.7, 0.8), max(0.0, -lightV) * mix(0.66 + 0.24 * look.y, 0.23, coast));
  col += vec3(1.0, 0.95, 0.8) * max(0.0, lightV) * 0.17;
  col = mix(col, col * vec3(1.08, 1.07, 1.0) + 0.012, relief.g * 0.6);

  // Wet margin at the waterline.
  col *= 1.0 - mix(0.22, 0.10, coast) * smoothstep(7.0, 0.0, edge) * step(0.0, edge);

  // ── Swash on the swash ──
  // At the coast each wave runs a thin sheet up the sand and draws back, slowly, at its own
  // time along the shore. The sand it leaves is darker for a while; its leading edge is a
  // broken line of paper-white foam that is brightest as it climbs and fades as it recedes.
  float swash = smoothstep(uSeaY - 190.0, uSeaY - 40.0, vWorld.y) * step(-0.5, edge) * (1.0 - step(44.0, edge));
  if (swash > 0.0) {
    float cyc = uTime * 0.42 + vWorld.x * 0.0031 + (macro.g - 0.5) * 5.0;
    float up = 0.5 + 0.5 * sin(cyc);
    float climbing = 0.5 + 0.5 * cos(cyc);
    float reach = 3.0 + 28.0 * up * (0.7 + 0.6 * meso.r);
    float film = smoothstep(reach + 0.5, reach - 2.5, edge);
    float lip = smoothstep(reach + 2.6, reach, edge) * smoothstep(reach - 4.5, reach - 1.0, edge);
    float broken = smoothstep(0.38, 0.62, texture(uNoise, vec2(vWorld.x / 70.0, vWorld.y / 34.0) + vec2(uTime * 0.012, 0.0)).r + fine * 0.2);
    // Wet sand: up to the highest reach, darkest where the water has just been.
    col *= 1.0 - swash * (0.07 * smoothstep(38.0, 6.0, edge) + 0.02 * film);
    // The thin sheet of water itself: a cool, faint glaze.
    col = mix(col, col * vec3(0.97, 1.02, 1.04) + vec3(0.06, 0.08, 0.09), swash * film * 0.4);
    col = mix(col, vec3(0.97, 0.97, 0.94), swash * lip * broken * (0.12 + 0.20 * climbing));
  }

  // ── Water ────────────────────────────────────────────────────────────
  if (edge < 3.0) {
    vec2 dir = wm.gb * 2.0 - 1.0;
    // Shallows and fords stay pale however far from the bank: the bed is close under the surface.
    // Flood water over a meadow is a still, shallow sheet: the grass shows through it.
    float depth = clamp(-edge / 42.0, 0.0, 1.0) * wm.a * mix(1.0, 0.3, flooded);
    // Two-phase flow map: the texture slides along the current, and each phase
    // fades out before it has stretched, so the motion never visibly resets.
    float phase = uTime * 0.085;
    float p0 = fract(phase);
    float p1 = fract(phase + 0.5);
    vec2 wuv = vWorld / 330.0;
    vec2 flow = dir * 0.5;
    vec3 w0 = texture(uWater, wuv - flow * p0).rgb;
    vec3 w1 = texture(uWater, wuv + vec2(0.43, 0.27) - flow * p1).rgb;
    vec3 water = mix(w0, w1, abs(p0 - 0.5) * 2.0);
    float glint = dot(water, vec3(0.333));

    // The river is the richest thing in the frame: pale jade over the shallows, deepening
    // through teal to a cool blue down the channel, rather than one flat turquoise.
    vec3 deep = water * vec3(0.4, 0.66, 0.84);
    vec3 mid = water * vec3(0.66, 0.92, 0.94);
    vec3 shallow = water * vec3(1.0, 1.12, 1.0) + vec3(0.05, 0.07, 0.03);
    vec3 wc = mix(mix(shallow, mid, smoothstep(0.0, 0.35, depth)), deep, smoothstep(0.3, 1.0, depth)) * mix(uWaterTintA, uWaterTintB, t);
    // Winter water stays a deep, readable blue-teal against the snow; only a little greyer.
    wc = mix(vec3(dot(wc, vec3(0.3, 0.5, 0.2))), wc, mix(0.94, 0.82, look.y));
    // Sky glints on the ripples, brightest where the water is deep and dark enough to show them.
    wc += vec3(0.92, 0.97, 1.0) * smoothstep(0.64, 0.86, glint) * (0.12 + 0.12 * depth);

    // Current lines: long pale and dark threads that run with the banks and drift downstream.
    float thread = texture(uNoise, vec2(sd / 52.0 + meso.r * 0.5, dot(vWorld, vec2(0.0011, 0.0024)) - uTime * 0.03)).b;
    wc += vec3(0.85, 0.95, 1.0) * smoothstep(0.6, 0.78, thread) * 0.13 * (0.4 + depth);
    wc *= 1.0 - 0.14 * smoothstep(0.44, 0.26, thread);

    // The river lies below its banks: the bank on the sunward side shades the water beside it.
    float sdLit = (texture(uWaterMap, vMap + uLightStep).r - 0.5) * ${(WATER_RANGE * 2).toFixed(1)};
    float bankShade = smoothstep(1.5, 11.0, sdLit - sd) * smoothstep(-30.0, -3.0, edge);
    wc *= mix(vec3(1.0), vec3(0.56, 0.66, 0.8), bankShade * (0.25 + 0.6 * wScree));

    // Shallows are clear: the bed shows through near the bank.
    float body = smoothstep(3.0, -4.0, edge);
    // ── Open sea ──
    // The river's water texture has broad light and dark in it that tiles every few
    // hundred pixels; on a wide sheet of water that shows as bands and seams. The sea
    // is therefore painted from the seamless noise instead: small wind ripples and
    // glints drifting slowly, over colour that deepens away from the shore in large soft patches.
    float sea = smoothstep(uSeaY - 160.0, uSeaY + 300.0, vWorld.y);
    if (sea > 0.0) {
      float out_ = max(0.0, vWorld.y - uSeaY + (macro.g - 0.5) * 90.0);
      // One tile of the noise spans these many world pixels; its finest grain is about 1/32 of that.
      vec2 drift = vec2(uTime * 2.2, uTime * 1.1);
      float r1 = texture(uNoise, (vWorld + drift) / vec2(520.0, 230.0)).r;
      float r2 = texture(uNoise, (vWorld - drift * 0.7) / vec2(380.0, 170.0) + 0.37).g;
      float r3 = texture(uNoise, (vWorld + drift * 0.4) / vec2(900.0, 420.0) + 0.71).b;
      float wavelet = r1 * 0.45 + r2 * 0.35 + r3 * 0.2;
      vec3 ripple = vec3(0.1, 0.14, 0.15) * (wavelet - 0.5) + vec3(0.75, 0.88, 0.95) * smoothstep(0.66, 0.8, wavelet) * 0.22;
      float far = smoothstep(40.0, 900.0, out_);
      vec3 seaCol = mix(vec3(0.3, 0.6, 0.62), vec3(0.17, 0.4, 0.55), far);
      seaCol = mix(seaCol, seaCol * vec3(0.92, 1.0, 1.06), smoothstep(0.35, 0.7, macro.b));
      seaCol *= 0.94 + 0.12 * macro.r;
      seaCol = (seaCol + ripple) * mix(uWaterTintA, uWaterTintB, t);
      seaCol = mix(vec3(dot(seaCol, vec3(0.3, 0.5, 0.2))), seaCol, mix(0.96, 0.84, look.y));
      // Long, soft swell lines of varying length: each line has its own breaks along its length.
      float swellPhase = (out_ + (macro.r - 0.5) * 160.0) / 210.0 - uTime * 0.035;
      float lineIndex = floor(swellPhase);
      float crest = smoothstep(0.42, 0.5, fract(swellPhase)) * smoothstep(0.58, 0.5, fract(swellPhase));
      float lengthMask = smoothstep(0.45, 0.7, texture(uNoise, vec2(vWorld.x / 1300.0 + lineIndex * 0.37, lineIndex * 0.19)).g);
      seaCol += vec3(0.85, 0.93, 0.98) * crest * lengthMask * 0.15 * smoothstep(60.0, 240.0, out_);
      // The trough behind each crest is a touch darker, so the swell reads as a shape, not a stripe.
      float trough = smoothstep(0.5, 0.62, fract(swellPhase)) * smoothstep(0.78, 0.62, fract(swellPhase));
      seaCol *= 1.0 - trough * lengthMask * 0.05 * smoothstep(60.0, 240.0, out_);
      // Foam belongs to the beach: a few broken lines that follow the shore itself and roll in.
      float shoreDist = -edge;
      float roll = sin(shoreDist * 0.11 + uTime * 1.1 + meso.g * 2.5);
      float surf = smoothstep(0.82, 0.99, roll) * smoothstep(58.0, 6.0, shoreDist) * smoothstep(0.32, 0.6, meso.r + fine * 0.3);
      seaCol = mix(seaCol, vec3(0.95, 0.98, 1.0), surf * 0.55);
      wc = mix(wc, seaCol, sea);
    }

    vec3 bed = mix(col, bankCol * vec3(0.9, 1.0, 0.96), 0.6) * vec3(0.74, 0.94, 0.94);
    col = mix(col, mix(bed, wc, clamp(0.42 + depth * 3.0, 0.0, 1.0)), body);

    // A broken line of foam where the water laps the bank.
    float lap = smoothstep(-9.0, -2.0, edge) * smoothstep(2.0, -1.5, edge);
    float ripple = texture(uNoise, vWorld / 60.0 - dir * uTime * 0.05).g;
    col = mix(col, vec3(0.93, 0.97, 0.98), lap * smoothstep(0.42, 0.7, ripple) * (0.5 + 0.5 * wScree));

    // Winter rims the banks with ice.
    // Pale ice only in the still margins; open water down the middle.
    float ice = look.y * smoothstep(0.75, 1.0, look.y) * smoothstep(-12.0, -2.0, edge) * smoothstep(0.3, 0.6, patchy + 0.25) * (1.0 - wm.a * 0.4);
    col = mix(col, vec3(0.84, 0.9, 0.95), ice * 0.75 * body);
    col = mix(col, vec3(0.95, 0.97, 0.99), look.y * smoothstep(-3.5, -1.5, edge) * smoothstep(0.5, -1.0, edge) * 0.5);
  }

  // The northern ground dissolves irregularly into the foothills.
  float land = smoothstep(-210.0 + (meso.r - 0.5) * 85.0, 140.0, vWorld.y);
  // A gravel-and-earth apron grounds the stream; showing only water makes
  // an isolated ribbon over the mountain. Taper the whole head into its ravine.
  float bankApron = 1.0 - smoothstep(12.0, 50.0, edge + (meso.g - 0.5) * 9.0);
  // The visible stream emerges beneath the illustrated falls. Its hidden
  // upstream geometry still feeds the river without floating over the mountains.
  float sourceReveal = smoothstep(-35.0, 95.0, vWorld.y);
  float channel = 1.0 - smoothstep(-2.0, 18.0, edge);
  float sourceWater = bankApron * smoothstep(-10.0, 85.0, vWorld.y);
  float opacity = max(land * (1.0 - channel * (1.0 - sourceReveal)), sourceWater * sourceReveal);
  finalColor = vec4(col * opacity, opacity);
}`;

const YARD_BUILDINGS = new Set(['cottage', 'timber-cottage', 'farmhouse', 'watermill', 'shed', 'shrine']);

/** Water meadows flood with the spring melt and the autumn rains; these pick the matching channel of the map. */
const floodOf = (season: Season): Float32Array => new Float32Array([season === 0 ? 1 : 0, season === 2 ? 1 : 0]);

const dataTexture = (map: DataMap, repeat = false): Texture => {
  const source = new BufferImageSource({
    resource: map.data,
    width: map.width,
    height: map.height,
    format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'linear',
    addressMode: repeat ? 'repeat' : 'clamp-to-edge',
  });
  return new Texture({ source });
};

/** The noise tile is the same for every valley: uploaded once and kept for the life of the page. */
let noiseTexture: Texture | null = null;
const sharedNoise = (): Texture => (noiseTexture ??= dataTexture(groundNoise(), true));

export class Ground {
  readonly mesh: Mesh<MeshGeometry, Shader>;
  private readonly pathCanvas: HTMLCanvasElement;
  private readonly pathTexture: Texture;
  private readonly pathPixels: Uint8Array;
  private readonly uniforms: Record<string, unknown>;
  private readonly waterPixels: Uint8Array;
  private readonly waterTexture: Texture;
  /** The canopy map, whose spare channels carry the water meadows. */
  private readonly canopy: DataMap;
  private readonly canopyTexture: Texture;
  /** The baked terrain, relief and so on: this valley's own, freed with it (see `destroy`). */
  private readonly maps: Texture[];
  private readonly geometry: MeshGeometry;
  /** Worn earth under and in front of each building, so it stands in a yard rather than on grass. */
  private readonly yards: LaneDef[];
  private from: Season;
  private to: Season;

  constructor(
    private readonly board: BoardDef,
    private readonly river: River,
    private readonly extent: Extent,
    art: ArtLibrary,
    season: Season,
    /** Where trees and buildings stand, for ground shade (see bakeCanopy). */
    canopy: DataMap,
  ) {
    // Baked once per valley, or ahead of time in a worker while the title shows (see groundBake.ts).
    const maps = groundMaps(board, river, extent);
    const water = maps.water;
    this.waterPixels = water.data;
    this.waterTexture = dataTexture(water);
    this.canopy = canopy;
    bakePlains(board, river, extent, canopy);
    bakeLevels(river, extent, canopy);
    this.canopyTexture = dataTexture(canopy);
    this.yards = board.sprites
      .filter((sprite) => YARD_BUILDINGS.has(sprite.asset))
      .map((sprite) => {
        const look = art.get(sprite.asset);
        const span = look.width * (sprite.scale ?? 1);
        // A building is anchored at its front corner; seen at a slant, its footprint lies
        // behind that, about a tenth of its width up the screen, centred across the image.
        const x = sprite.x + (0.5 - look.anchor[0]) * span * (sprite.flip ? -1 : 1);
        const y = sprite.y - span * 0.1;
        const reach = span * 0.18;
        // The yard's worn heart stays under the walls; only its soft shoulder shows,
        // feathering out into the grass a little way round the building.
        return { width: span * 0.6, points: [{ x: x - reach, y: y - 3 }, { x: x + reach, y: y + 3 }] };
      });
    this.pathCanvas = document.createElement('canvas');
    this.pathCanvas.width = Math.ceil(extent.width / pathStep(extent));
    this.pathCanvas.height = Math.ceil(extent.height / pathStep(extent));
    // The canvas is only a drawing surface: its pixels are copied into a plain
    // buffer texture, which uploads identically on every browser and GPU.
    this.pathPixels = new Uint8Array(this.pathCanvas.width * this.pathCanvas.height * 4);
    this.pathTexture = dataTexture({ data: this.pathPixels, width: this.pathCanvas.width, height: this.pathCanvas.height });
    this.setConnections([]);

    const terrainA = dataTexture(maps.terrainA);
    const terrainB = dataTexture(maps.terrainB);
    const relief = dataTexture(maps.relief);
    this.maps = [terrainA, terrainB, relief, this.waterTexture, this.canopyTexture, this.pathTexture];

    this.from = this.to = season;
    const look = SEASON_LOOKS[season];
    const pack = (s: Season): Float32Array => {
      const l = SEASON_LOOKS[s];
      return new Float32Array([l.saturation, l.snow, l.litter, WATER_OFFSET[s]]);
    };
    const shader = Shader.from({
      gl: { vertex: VERTEX, fragment: FRAGMENT },
      resources: {
        uMeadow: art.get('meadow').texture.source,
        uWoodland: art.get('woodland-floor').texture.source,
        uWetland: art.get('wetland-ground').texture.source,
        uRocky: art.get('mountain-foothill').texture.source,
        uOrchard: art.get('orchard-ground').texture.source,
        uBank: art.get('riverbank-ground').texture.source,
        uScree: art.get('rocky-ground').texture.source,
        uWater: art.get('calm-water').texture.source,
        uNoise: sharedNoise().source,
        uTerrainA: terrainA.source,
        uTerrainB: terrainB.source,
        uWaterMap: this.waterTexture.source,
        uRelief: relief.source,
        uCanopy: this.canopyTexture.source,
        uPathMap: this.pathTexture.source,
        ground: {
          uTime: { value: 0, type: 'f32' },
          uWave: { value: 2, type: 'f32' },
          uReverse: { value: season < 2 ? 1 : 0, type: 'f32' },
          uSpan: { value: new Float32Array([extent.y, extent.height]), type: 'vec2<f32>' },
          uSnowAlt: { value: board.snowAltitude, type: 'f32' },
          uSeaY: { value: board.sea?.y ?? 1e7, type: 'f32' },
          uHigh: { value: 0, type: 'f32' },
          uLow: { value: 0, type: 'f32' },
          uLightStep: { value: new Float32Array([-9 / extent.width, -9 / extent.height]), type: 'vec2<f32>' },
          uTintA: { value: new Float32Array(look.tint), type: 'vec3<f32>' },
          uTintB: { value: new Float32Array(look.tint), type: 'vec3<f32>' },
          uLookA: { value: pack(season), type: 'vec4<f32>' },
          uLookB: { value: pack(season), type: 'vec4<f32>' },
          uFloodA: { value: floodOf(season), type: 'vec2<f32>' },
          uFloodB: { value: floodOf(season), type: 'vec2<f32>' },
          uWaterTintA: { value: new Float32Array(look.water), type: 'vec3<f32>' },
          uWaterTintB: { value: new Float32Array(look.water), type: 'vec3<f32>' },
        },
      },
    });
    this.uniforms = (shader.resources.ground as { uniforms: Record<string, unknown> }).uniforms;

    const { x, y, width, height } = extent;
    const geometry = (this.geometry = new MeshGeometry({
      positions: new Float32Array([x, y, x + width, y, x + width, y + height, x, y + height]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    }));
    this.mesh = new Mesh({ geometry, shader });
  }

  /**
   * Frees this valley's maps on the GPU (some tens of megabytes). Destroying the mesh does not,
   * as it does not own them. The shared noise tile and the art library's materials are kept.
   */
  destroy(): void {
    if (!this.mesh.destroyed) this.mesh.destroy();
    for (const texture of this.maps) texture.destroy(true);
    this.geometry.destroy();
  }

  /** Redraws the path map after the player's connections change. */
  setConnections(connections: readonly Connection[]): void {
    // Old river beds show as strips of pale gravel until the player lets the water back in.
    const beds = this.river.beds.map((bed) => ({ width: bed.widths[0]! * 1.5, points: bed.line.points.filter((_, i) => i % 3 === 0) }));
    paintPaths(this.pathCanvas, this.extent, connections, [...this.board.lanes, ...this.yards], beds);
    const { width, height } = this.pathCanvas;
    this.pathPixels.set(this.pathCanvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data);
    this.pathTexture.source.update();
  }

  /**
   * Call when the river itself has changed (the player opened an old bed):
   * redraws where the water runs and which meadows it can still flood.
   */
  refreshRiver(): void {
    this.waterPixels.set(bakeWater(this.river, this.board, this.extent).data);
    this.waterTexture.source.update();
    bakePlains(this.board, this.river, this.extent, this.canopy);
    bakeLevels(this.river, this.extent, this.canopy);
    this.canopyTexture.source.update();
  }

  /** Starts a transition: the ground will blend from `from` to `to` as `wave` advances. */
  setSeasons(from: Season, to: Season): void {
    this.from = from;
    this.to = to;
    this.uniforms.uReverse = to < 2 ? 1 : 0;
    const set = (suffix: 'A' | 'B', season: Season): void => {
      const look = SEASON_LOOKS[season];
      (this.uniforms[`uTint${suffix}`] as Float32Array).set(look.tint);
      (this.uniforms[`uLook${suffix}`] as Float32Array).set([look.saturation, look.snow, look.litter, WATER_OFFSET[season]]);
      (this.uniforms[`uWaterTint${suffix}`] as Float32Array).set(look.water);
      (this.uniforms[`uFlood${suffix}`] as Float32Array).set(floodOf(season));
    };
    set('A', from);
    set('B', to);
  }

  get seasons(): [Season, Season] {
    return [this.from, this.to];
  }

  /** `wave`: 0 at the mountains, 1 at the river mouth; pass 2 when no transition is running. */
  update(time: number, wave: number): void {
    this.uniforms.uTime = time;
    this.uniforms.uWave = wave;
  }

  /**
   * Today's river level, -1 (low) .. 0 (middle) .. 1 (high), eased by the
   * caller: low places fill and bars surface gradually as it moves.
   */
  setLevel(level: number): void {
    this.uniforms.uHigh = Math.max(0, level);
    this.uniforms.uLow = Math.max(0, -level);
  }

  /** The landscape position (0 top .. 1 bottom) used to time per-sprite seasonal changes. */
  alongOf(y: number): number {
    return (y - this.extent.y) / this.extent.height;
  }

  get boardDef(): BoardDef {
    return this.board;
  }
}
