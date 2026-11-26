import { describe, expect, it } from 'vitest';
import { Wardrobe } from './wardrobe';
import { TurnPose } from './turnPose';
import { Container, Sprite, Texture } from 'pixi.js';
import type { ArtLibrary } from '../art';
import type { SceneFigure } from '../../adventure/model';
import { FigureView, type FigureFx } from './figure';
import { newFrame, type Stage } from './frame';

describe('illustrated turns', () => {
  it('starts facing either direction without playing a turn', () => {
    for (const facing of [-1, 1] as const) {
      const turn = new TurnPose();
      turn.step(facing, 1 / 60, false);
      expect(turn.active).toBe(false);
    }
  });

  it('holds one pivot for either direction change, then resumes without retriggering', () => {
    const turn = new TurnPose();
    turn.step(1, 0, false);
    for (const facing of [-1, 1] as const) {
      turn.step(facing, 1 / 60, false);
      expect(turn.active).toBe(true);
      turn.step(facing, 0.1, false);
      expect(turn.active).toBe(true);
      turn.step(facing, TurnPose.duration, false);
      expect(turn.active).toBe(false);
      turn.step(facing, 1 / 60, false);
      expect(turn.active).toBe(false);
    }
  });

  it('finishes a rapid reversal and cancels immediately for reduced motion or ineligible poses', () => {
    const turn = new TurnPose();
    turn.step(1, 0, false);
    turn.step(-1, 0, false);
    turn.step(1, 0.08, false);
    expect(turn.active).toBe(true);
    turn.step(1, 0.3, false);
    expect(turn.active).toBe(false);
    turn.step(-1, 0, false);
    turn.step(-1, 0, true);
    expect(turn.active).toBe(false);
    turn.step(1, 0, true);
    expect(turn.active).toBe(false);
    turn.step(1, 0.01, false);
    expect(turn.active).toBe(false);
  });
});

describe('friends wearing the turn frame', () => {
  it.each(['sora', 'ren', 'mina', 'aki', 'yui', 'haru'])('keeps %s’s illustrated identity for seated and missing work poses', (who) => {
    const art = { has: (id: string) => id === `${who}-idle-0` } as ArtLibrary;
    const wardrobe = new Wardrobe(who, art, false);
    for (const pose of ['sit', 'idle', 'tend', 'forage', 'build', 'track', 'talk', 'look', 'walk', 'carry', 'fish', 'wave'] as const) {
      const outfit = wardrobe.outfit(pose);
      expect(outfit.painted, pose).toBe(false);
      expect(outfit.ids).toEqual([`${who}-idle-0`]);
    }
  });
  const make = (who: string, withTurn = true) => {
    const ids = new Set([`${who}-idle-0`, ...(withTurn ? [`${who}-turn-0`] : [])]);
    const art = {
      has: (id: string) => ids.has(id),
      get: (id: string) => ({ id, texture: id.endsWith('-turn-0') ? Texture.EMPTY : Texture.WHITE,
        width: 96, height: 88, anchor: [30 / 96, 80 / 88],
        attachments: id === 'yui-turn-0' ? { lantern: { offset: [-4, -16] } } : undefined }),
    } as unknown as ArtLibrary;
    const stage: Stage = { ground: new Container(), water: new Container(), sorted: new Container(), glow: new Container(), ink: new Container() };
    const view = new FigureView(who, who, 'friend', art, stage);
    const fig: SceneFigure = { id: who, role: 'friend', look: who, at: { x: 100, y: 100 },
      facing: 1, pose: 'talk', action: 0, pack: 'plain', item: null, visible: true, selected: false };
    const frame = { ...newFrame(), dt: 1 / 60, right: 500, bottom: 500, night: 1 };
    const fx = { dust: { emit: () => {} }, sparks: { emit: () => {} } } as unknown as FigureFx;
    return { view, fig, frame, fx, stage, body: view.root.children[0] as Sprite };
  };

  it.each(['sora', 'ren', 'mina', 'aki', 'yui', 'haru'])('shows %s at full width, with fixed feet, in either turn', (who) => {
    const { view, fig, frame, fx, stage, body } = make(who);
    view.update(fig, frame, fx);
    expect(view.root.alpha).toBe(1);
    expect(body.texture).toBe(Texture.WHITE);
    for (const facing of [-1, 1] as const) {
      fig.facing = facing;
      view.update(fig, frame, fx);
      expect(body.texture).toBe(Texture.EMPTY);
      expect(view.root.scale.x).toBe(1);
      expect(body.anchor.x).toBe(30 / 96);
      expect(body.anchor.y).toBe(80 / 88);
      expect(view.root.y).toBe(100);
      expect(view.root.children[1]!.visible).toBe(false);
      if (who === 'yui') {
        const lamp = stage.glow.children[1]!;
        expect(lamp.x).toBe(96);
        expect(lamp.y).toBe(84);
      }
      frame.dt = TurnPose.duration + .01;
      view.update(fig, frame, fx);
      expect(body.texture).toBe(Texture.WHITE);
      expect(view.root.scale.x).toBe(facing);
      expect(view.root.children[1]!.visible).toBe(true);
      frame.dt = 1 / 60;
    }
    view.destroy();
  });

  it('changes direction immediately with reduced motion and supports art libraries without pivot images', () => {
    for (const withTurn of [true, false]) {
      const { view, fig, frame, fx, body } = make('sora', withTurn);
      frame.reduced = true;
      view.update(fig, frame, fx);
      fig.facing = -1;
      view.update(fig, frame, fx);
      expect(body.texture).toBe(Texture.WHITE);
      expect(view.root.scale.x).toBe(-1);
      view.destroy();
    }
  });

  it.each(['sit', 'fish', 'forage', 'build', 'track'] as const)('uses the turn illustration when changing direction from %s', (pose) => {
    const { view, fig, frame, fx, body } = make('sora');
    fig.pose = pose;
    view.update(fig, frame, fx);
    fig.facing = -1;
    view.update(fig, frame, fx);
    expect(view.root.alpha).toBe(1);
    expect(body.texture).toBe(Texture.EMPTY);
    view.destroy();
  });
});


it('keeps ordinary villagers in one illustrated identity when walking, standing and turning',()=>{
  const ids=new Set(['villager-idle-0','villager-turn-0',...Array.from({length:4},(_,i)=>`villager-walk-${i}`)]);
  const wardrobe=new Wardrobe('villager-b',{has:(id:string)=>ids.has(id)} as ArtLibrary,true);
  expect(wardrobe.stand?.ids).toEqual(['villager-idle-0']);
  expect(wardrobe.turn?.ids).toEqual(['villager-turn-0']);
  expect(wardrobe.outfit('walk').ids).toHaveLength(4);
  expect(wardrobe.outfit('talk').painted).toBe(false);
});
