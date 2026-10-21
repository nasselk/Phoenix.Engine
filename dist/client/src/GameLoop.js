import { Loop } from "../../shared/utils/Loop";
import { createTimings, toRate } from "../../shared/utils/perfStats";
export class GameLoop extends Loop {
    constructor(config) {
        super("frame", "Game Loop", config?.FPS ?? Infinity, config?.speed ?? 1);
        this.stats = {
            FPS: 0,
            low99: 0,
            frames: {
                global: createTimings(),
                cpu: createTimings(),
                gpu: createTimings(),
            },
        };
    }
    get maxFrameRate() {
        return this.maxRate;
    }
    set maxFrameRate(value) {
        this.maxRate = value;
    }
    get frameID() {
        return this.id;
    }
    schedule(run) {
        this.next = requestAnimationFrame(run);
    }
    cancel() {
        if (this.next !== undefined) {
            cancelAnimationFrame(this.next);
        }
        this.next = undefined;
    }
    measure(now) {
        const { stats, samples } = this;
        stats.FPS = samples.rate(now);
        stats.low99 = toRate(samples.measureIntervals(stats.frames.global).p99);
        samples.measureExecution(stats.frames.cpu);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2FtZUxvb3AuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9jbGllbnQvc3JjL0dhbWVMb29wLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFnQixNQUFNLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQWtCbkYsTUFBTSxPQUFPLFFBQVMsU0FBUSxJQUF3QjtJQUtyRCxZQUFtQixNQUFnQztRQUNsRCxLQUFLLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsR0FBRyxJQUFJLFFBQVEsRUFBRSxNQUFNLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRXpFLElBQUksQ0FBQyxLQUFLLEdBQUc7WUFDWixHQUFHLEVBQUUsQ0FBQztZQUNOLEtBQUssRUFBRSxDQUFDO1lBQ1IsTUFBTSxFQUFFO2dCQUNQLE1BQU0sRUFBRSxhQUFhLEVBQUU7Z0JBQ3ZCLEdBQUcsRUFBRSxhQUFhLEVBQUU7Z0JBQ3BCLEdBQUcsRUFBRSxhQUFhLEVBQUU7YUFDcEI7U0FDRCxDQUFDO0lBQ0gsQ0FBQztJQUdELElBQVcsWUFBWTtRQUN0QixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDckIsQ0FBQztJQUVELElBQVcsWUFBWSxDQUFDLEtBQWE7UUFDcEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFDdEIsQ0FBQztJQUVELElBQVcsT0FBTztRQUNqQixPQUFPLElBQUksQ0FBQyxFQUFFLENBQUM7SUFDaEIsQ0FBQztJQUVTLFFBQVEsQ0FBQyxHQUEwQjtRQUM1QyxJQUFJLENBQUMsSUFBSSxHQUFHLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFUyxNQUFNO1FBQ2YsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzdCLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUM7SUFDdkIsQ0FBQztJQUVTLE9BQU8sQ0FBQyxHQUFXO1FBQzVCLE1BQU0sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBRWhDLEtBQUssQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM5QixLQUFLLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUV4RSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM1QyxDQUFDO0NBQ0QifQ==