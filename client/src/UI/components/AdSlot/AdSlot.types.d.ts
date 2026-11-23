/** What shows banner ads: a game's platform SDK. Without `requestBannerAd`, an `AdSlot` draws nothing. */
export interface BannerAds {
	/** Fill the element with this id with a `width` × `height` banner; resolves whether one was shown. */
	requestBannerAd?(id: string, width: number, height: number): Promise<boolean>;
	/** Empty the element with this id. */
	clearBannerAd?(id?: string): Promise<void>;
}

export interface AdSlotProps {
	/** The slot element's id, which the ad network fills. Unique on the page. */
	id: string;
	/** Who shows the ad. */
	ads: BannerAds;
	/** How wide the slot is drawn, as any CSS length: the banner is zoomed to fit it. */
	width?: string;
	/** The banner's size in pixels, as the ad network serves it. */
	dimensions?: { readonly width: number; readonly height: number };
	/** Runs once the slot is on the page, instead of requesting a banner; what it returns runs when the slot goes. */
	onmount?: (element: HTMLDivElement) => void | (() => void);
}
