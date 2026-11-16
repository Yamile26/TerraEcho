/** Pure audio-clock timeline. React draws state but never defines musical time. */
export class AudioTimeline {
  private origin = 0;
  private next = 0;
  private offset = 0;
  private running = false;
  constructor(
    readonly steps: number,
    readonly secondsPerStep: number,
    readonly clock: () => number,
  ) {
    if (
      !Number.isInteger(steps) ||
      steps < 1 ||
      !Number.isFinite(secondsPerStep) ||
      secondsPerStep <= 0
    )
      throw new Error("Invalid audio timeline");
  }
  start(step = 0) {
    this.offset = Math.max(0, Math.min(this.steps - 1, Math.floor(step)));
    this.origin = this.clock() + 0.04;
    this.next = this.offset;
    this.running = true;
  }
  position() {
    return Math.min(
      this.steps - 1,
      this.offset +
        Math.max(
          0,
          Math.floor((this.clock() - this.origin) / this.secondsPerStep),
        ),
    );
  }
  pause() {
    const p = this.position();
    this.running = false;
    return p;
  }
  get ended() {
    return (
      this.running &&
      this.clock() >=
        this.origin + (this.steps - this.offset) * this.secondsPerStep
    );
  }
  tick(schedule: (index: number, delay: number) => void, lookAhead = 0.12) {
    if (!this.running) return;
    const now = this.clock();
    while (this.next < this.steps) {
      const at = this.origin + (this.next - this.offset) * this.secondsPerStep;
      if (at > now + lookAhead) break;
      // After a suspended tab, skip expired notes instead of playing a burst.
      if (at + this.secondsPerStep > now)
        schedule(this.next, Math.max(0, at - now));
      this.next++;
    }
  }
}
