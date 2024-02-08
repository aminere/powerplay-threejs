
import { Texture, TextureLoader } from "three";

class Textures {
    private _loader = new TextureLoader();
    private _cache = new Map<string, Texture>();
    public load(path: string) {
        const cached = this._cache.get(path);
        if (cached) {
            console.log(`returning cached texture for ${path}`);
            return cached;
        }
        const texture = this._loader.load(path);
        this._cache.set(path, texture);
        return texture;
    }
}

export const textures = new Textures();

