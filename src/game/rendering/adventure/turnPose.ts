/** One planted pivot image bridges either horizontal direction change. */
export class TurnPose {
  static readonly duration = 0.26;
  private facing: 1 | -1 | null = null;
  private left = 0;

  step(facing: 1 | -1, dt: number, immediate: boolean): void {
    this.left = Math.max(0, this.left - dt);
    if (immediate || this.facing === null) this.left = 0;
    else if (facing !== this.facing) this.left = TurnPose.duration;
    this.facing = facing;
  }

  get active(): boolean {
    return this.left > 0;
  }
}
