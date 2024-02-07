import { Font, FontLoader  } from "three/examples/jsm/Addons.js";

class _3DFonts {
    private _loader = new FontLoader();
    private _cache = new Map<string, Font>();
    private _loading = new Map<string, Promise<Font>>();

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
            this._loader.load(`fonts/${fontName}.json`, (font) => {
                this._cache.set(fontName, font);
                this._loading.delete(fontName);
                resolve(font);
            });
        });

        this._loading.set(fontName, promise);
        return promise;
    }
}

export const _3dFonts = new _3DFonts();

