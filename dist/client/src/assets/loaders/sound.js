import { Howl } from "howler";
export class SoundLoader {
    load(source) {
        const { src, ...options } = typeof source === "string" ? { src: source } : source;
        return new Promise((resolve, reject) => {
            const howl = new Howl({
                ...options,
                src: typeof src === "string" ? [src] : [...src],
                preload: true,
                onload: () => resolve(howl),
                onloaderror: (_id, error) => {
                    howl.unload();
                    reject(new Error(`Could not load sound ${String(src)}: ${String(error)}`));
                },
            });
        });
    }
    unload(howl) {
        howl.unload();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291bmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jbGllbnQvc3JjL2Fzc2V0cy9sb2FkZXJzL3NvdW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxJQUFJLEVBQW9CLE1BQU0sUUFBUSxDQUFDO0FBVWhELE1BQU0sT0FBTyxXQUFXO0lBRWhCLElBQUksQ0FBQyxNQUFtQjtRQUM5QixNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsT0FBTyxFQUFFLEdBQUcsT0FBTyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBRWxGLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDdEMsTUFBTSxJQUFJLEdBQVMsSUFBSSxJQUFJLENBQUM7Z0JBQzNCLEdBQUcsT0FBTztnQkFDVixHQUFHLEVBQUUsT0FBTyxHQUFHLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO2dCQUMvQyxPQUFPLEVBQUUsSUFBSTtnQkFDYixNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztnQkFDM0IsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFO29CQUMzQixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBRWQsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLHdCQUF3QixNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM1RSxDQUFDO2FBQ0QsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU0sTUFBTSxDQUFDLElBQVU7UUFDdkIsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ2YsQ0FBQztDQUNEIn0=