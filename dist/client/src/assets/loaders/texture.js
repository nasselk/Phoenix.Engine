import { TextureLoader as ThreeTextureLoader } from "three";
import { applyRequestOptions } from "./request";
export class TextureLoader {
    constructor(manager, options = {}) {
        this.loader = new ThreeTextureLoader(manager);
        applyRequestOptions(this.loader, options);
    }
    load(url) {
        return this.loader.loadAsync(url);
    }
    unload(texture) {
        texture.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL2NsaWVudC9zcmMvYXNzZXRzL2xvYWRlcnMvdGV4dHVyZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQXFDLGFBQWEsSUFBSSxrQkFBa0IsRUFBRSxNQUFNLE9BQU8sQ0FBQztBQUUvRixPQUFPLEVBQUUsbUJBQW1CLEVBQXVCLE1BQU0sV0FBVyxDQUFDO0FBRXJFLE1BQU0sT0FBTyxhQUFhO0lBR3pCLFlBQW1CLE9BQXVCLEVBQUUsT0FBTyxHQUFtQixFQUFFO1FBQ3ZFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU5QyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFTSxJQUFJLENBQUMsR0FBVztRQUN0QixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFHTSxNQUFNLENBQUMsT0FBZ0I7UUFDN0IsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ25CLENBQUM7Q0FDRCJ9