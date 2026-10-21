export class MessageHandlers {
    constructor(channel) {
        this.channel = channel;
        this.handlers = [];
    }
    add(event, handler) {
        const code = this.channel.code(event);
        if (this.handlers[code] !== undefined) {
            throw new Error(`"${event}" already has a handler; remove it with the function its onMessage returned first`);
        }
        this.handlers[code] = handler;
        return () => {
            if (this.handlers[code] === handler) {
                this.handlers[code] = undefined;
            }
        };
    }
    get(code) {
        return this.handlers[code];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFuZGxlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zaGFyZWQvbmV0d29ya2luZy9oYW5kbGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFNQSxNQUFNLE9BQU8sZUFBZTtJQUczQixZQUFvQyxPQUF3QjtRQUF4QixZQUFPLEdBQVAsT0FBTyxDQUFpQjtRQUYzQyxhQUFRLEdBQStCLEVBQUUsQ0FBQztJQUVJLENBQUM7SUFHekQsR0FBRyxDQUFDLEtBQWEsRUFBRSxPQUFnQjtRQUN6QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV0QyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDdkMsTUFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssbUZBQW1GLENBQUMsQ0FBQztRQUMvRyxDQUFDO1FBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUM7UUFFOUIsT0FBTyxHQUFHLEVBQUU7WUFDWCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssT0FBTyxFQUFFLENBQUM7Z0JBQ3JDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDO1lBQ2pDLENBQUM7UUFDRixDQUFDLENBQUM7SUFDSCxDQUFDO0lBRU0sR0FBRyxDQUFDLElBQVk7UUFDdEIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVCLENBQUM7Q0FDRCJ9