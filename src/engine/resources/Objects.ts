import { Object3D, ObjectLoader } from "three";

class Objects {
    private _loader = new ObjectLoader();
    private _cache = new Map<string, Object3D>();
    private _loading = new Map<string, Promise<Object3D>>();

    public async load(path: string) {
        const cached = this._cache.get(path);
        if (cached) {
            // console.log(`returning cached object for ${path}`);
            return cached;
        }

        const inProgress = this._loading.get(path);
        if (inProgress) {
            // console.log(`returning in-progress object for ${path}`);
            return inProgress;
        }

        const promise = this._loader.loadAsync(path)
            .then(obj => {
                this._cache.set(path, obj);
                this._loading.delete(path);                
                return obj;
            });
        this._loading.set(path, promise);
        return promise;
    }
}

export const objects = new Objects();

