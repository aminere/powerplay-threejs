import { Font, FontLoader  } from "three/examples/jsm/Addons.js";
import { utils } from "../Utils";
import { evtAssetLoaded } from "../../Events";

class _3DFonts {
    private _loader = new FontLoader();
    private _cache = new Map<string, Font>();
    private _loading = new Map<string, Promise<Font>>();

    loadImmediate(fontName: string) {
        const cached = this._cache.get(fontName);
        return cached;
    }

    async load(fontName: string) {
        const cached = this._cache.get(fontName);
        if (cached) {
            return cached;
        }

        const inProgress = this._loading.get(fontName);
        if (inProgress) {
            return inProgress;
        }

        const promise = new Promise<Font>(resolve => {
            const basePath = utils.getBasePath();
            const fullPath = `${basePath}fonts/${fontName}.json`;
            this._loader.load(fullPath, (font) => {
                this._cache.set(fontName, font);
                this._loading.delete(fontName);
                evtAssetLoaded.post(fontName);
                resolve(font);
            });
        });

        this._loading.set(fontName, promise);
        return promise;
    }
}

export const _3dFonts = new _3DFonts();

