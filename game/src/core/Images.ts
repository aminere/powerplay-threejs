
export class Images {    

    public static get(path: string) {
        return Images.preloads[path];
    }

    public static preload(paths: string[]) {
        return Promise.all(paths.map(path => {
            console.log(`preloading '${path}'`);
            const image = Images.get(path);       
            if (image) {
                return Promise.resolve(image);
            }
            return new Promise<HTMLImageElement | null>(resolve => {
                const image = new Image();
                image.src = path;
                image.onload = () => {
                    Images.preloads[path] = image;
                    resolve(image);
                };
                image.onerror = () => {
                    console.log(`preloading '${path}' Failed`);
                    resolve(null);
                };
            });
        }));
    }

    private static readonly preloads: {[path: string]: HTMLImageElement} = {};
}
