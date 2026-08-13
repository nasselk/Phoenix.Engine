export class NetworkEvent {
	private static count: number = 0;

	public readonly encoder: number;
	public readonly minByteLength: number;
	public readonly maxByteLength: number;
	public readonly threadTransfered: boolean;
	public readonly IDLEChecks: boolean;
	public readonly maxRate: number;

	public constructor(byteLength: number | [number, number] = 0, threadTransfered: boolean = false, maxRate: number = Infinity, IDLEChecks: boolean = true) {
		this.threadTransfered = threadTransfered;
		this.encoder = NetworkEvent.count;
		this.IDLEChecks = IDLEChecks;
		this.maxRate = maxRate;

		if (Array.isArray(byteLength)) {
			this.minByteLength = byteLength[0];
			this.maxByteLength = byteLength[1];

			if (this.minByteLength > this.maxByteLength) {
				throw new RangeError("Minimum event size cannot be greater than its maximum");
			}
		} else {
			this.minByteLength = this.maxByteLength = byteLength;

			if (this.maxByteLength === Infinity) {
				this.minByteLength = 0;
			}
		}

		// +1 for the event byte encoder
		this.minByteLength++;
		this.maxByteLength++;

		NetworkEvent.count++;
	}

	public static resetEncoder(): void {
		NetworkEvent.count = 0;
	}
}
