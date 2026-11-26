/** Two views of the same landscape, blended by the valley's moving seasonal front. */
import { Mesh, MeshGeometry, Shader, type Texture } from 'pixi.js';
import type { Extent } from './fields';
import type { Season } from '../world/types';
import { SEASON_FRONT_SOFTNESS } from './seasonFront';

export interface LandscapeRect { x: number; y: number; width: number; height: number }

const VERTEX = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out vec2 vUV;
out vec2 vWorld;
void main() {
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vWorld = aPosition;
  vUV = aUV;
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vUV;
in vec2 vWorld;
out vec4 finalColor;
uniform sampler2D uOutgoing;
uniform sampler2D uIncoming;
uniform vec2 uSpan;
uniform vec3 uTint;
uniform float uWave;
uniform float uReverse;
void main() {
  // A settled season costs one sample; only the narrow travelling band needs both.
  if (uWave >= 1.4) {
    vec4 colour = texture(uIncoming, vUV);
    finalColor = vec4(colour.rgb * uTint, colour.a);
    return;
  }
  float along = (vWorld.y - uSpan.x) / uSpan.y;
  along = mix(along, 1.0 - along, uReverse);
  // Broad, low-amplitude undulation keeps the melt line organic. It depends on
  // world coordinates, so overlapping pieces share exactly the same front.
  float ripple = sin(vWorld.x * 0.009) * sin(vWorld.y * 0.006) * 0.012;
  float t = smoothstep(0.0, ${SEASON_FRONT_SOFTNESS.toFixed(3)}, uWave - along + ripple);
  // Sources have matching geometry and premultiplied alpha. Mix rather than
  // overlaid transparency, which would darken edges and reveal seams underneath.
  // Both are sampled on every pixel: sampling inside a branch that changes from
  // pixel to pixel leaves the mip derivatives undefined along the front, which
  // drew a thin dark line travelling with it.
  vec4 outgoing = texture(uOutgoing, vUV);
  vec4 incoming = texture(uIncoming, vUV);
  vec4 colour = mix(outgoing, incoming, t);
  finalColor = vec4(colour.rgb * uTint, colour.a);
}`;

export class SeasonalLandscape {
  readonly mesh: Mesh<MeshGeometry, Shader>;
  private readonly shader: Shader;
  private readonly geometry: MeshGeometry;
  private readonly uniforms: { uWave: number; uReverse: number };

  constructor(texture: Texture, rect: LandscapeRect, extent: Extent, tint = 0xffffff) {
    const { x, y, width, height } = rect;
    this.geometry = new MeshGeometry({
      positions: new Float32Array([x, y, x + width, y, x + width, y + height, x, y + height]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    this.shader = Shader.from({
      gl: { vertex: VERTEX, fragment: FRAGMENT },
      resources: {
        uOutgoing: texture.source,
        uIncoming: texture.source,
        mountain: {
          uSpan: { value: new Float32Array([extent.y, extent.height]), type: 'vec2<f32>' },
          uTint: { value: new Float32Array([(tint >> 16 & 255) / 255, (tint >> 8 & 255) / 255, (tint & 255) / 255]), type: 'vec3<f32>' },
          uWave: { value: 2, type: 'f32' },
          uReverse: { value: 0, type: 'f32' },
        },
      },
    });
    this.uniforms = this.shader.resources.mountain.uniforms;
    this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader });
  }

  setTextures(outgoing: Texture, incoming: Texture): void {
    this.shader.resources.uOutgoing = outgoing.source;
    this.shader.resources.uIncoming = incoming.source;
  }

  update(wave: number, season: Season): void {
    this.uniforms.uWave = wave;
    this.uniforms.uReverse = season < 2 ? 1 : 0;
  }

  /** The parent destroys the mesh; these resources are private to this layer. */
  destroy(): void {
    this.shader.destroy();
    this.geometry.destroy(true);
  }
}
