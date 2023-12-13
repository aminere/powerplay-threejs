import { Object3D, ObjectLoader } from "three";

class Objects {
    private _loader = new ObjectLoader();
    private _cache = new Map<string, Object3D>();

    public async load(path: string) {
        const cached = this._cache.get(path);
        if (cached) {
            console.log(`returning cached object for ${path}`);
            return cached;
        }
        const obj = await this._loader.loadAsync(path);
        this._cache.set(path, obj);
        return obj;
    }
}

export const objects = new Objects();

