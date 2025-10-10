
import { Texture, TextureLoader } from "three";
import { utils } from "../Utils";
import { evtAssetLoaded } from "../../Events";

class Textures {
    private _loader = new TextureLoader();
    private _cache = new Map<string, Texture>();
    public load(path: string) {
        const cached = this._cache.get(path);
        if (cached) {
            // console.log(`returning cached texture for ${path}`);
            return cached;
        }
        
        const basePath = utils.getBasePath();
        const fullPath = `${basePath}${path}`;

        const texture = this._loader.load(fullPath);
        this._cache.set(path, texture);
        evtAssetLoaded.post(path);
        return texture;
    }
}

export const textures = new Textures();

