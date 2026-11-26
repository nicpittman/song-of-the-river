/** Undo and redo for landscape edits. Each entry is a before/after copy of the player's landscape plus what the edit cost. */

import type { Landscape, Simulation } from '../simulation/simulation';

interface Edit {
  before: Landscape;
  after: Landscape;
  cost: number;
}

const LIMIT = 30;

export class History {
  private done: Edit[] = [];
  private undone: Edit[] = [];

  constructor(private readonly sim: Simulation) {}

  /** Call before an edit; returns a function to call once the edit has succeeded. */
  begin(): (cost: number) => void {
    const before = this.sim.landscape();
    return (cost) => {
      this.done.push({ before, after: this.sim.landscape(), cost });
      if (this.done.length > LIMIT) this.done.shift();
      this.undone = [];
    };
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }
  get canRedo(): boolean {
    const next = this.undone[this.undone.length - 1];
    return !!next && (this.sim.state.mode === 'free' || next.cost <= this.sim.state.marks);
  }

  undo(): boolean {
    const edit = this.done.pop();
    if (!edit) return false;
    this.sim.restore(edit.before, edit.cost);
    this.undone.push(edit);
    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    const edit = this.undone.pop()!;
    this.sim.restore(edit.after, -edit.cost);
    this.done.push(edit);
    return true;
  }
}
