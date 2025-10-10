
import { FrontSide, Mesh, Object3D } from "three";
import { GLTFLoader, FBXLoader } from "three/examples/jsm/Addons.js";
import { utils } from "../Utils";
import { evtAssetLoaded } from "../../Events";

class Meshes {
    private _gltfLoader = new GLTFLoader();
    private _fbxLoader = new FBXLoader();
    private _cache = new Map<string, Mesh[]>();
    private _loading = new Map<string, Promise<Mesh[]>>();

    // fails if not in cache
    public loadImmediate(path: string) {
        return this._cache.get(path)!;
    }

    public load(path: string) {
        const cached = this._cache.get(path);
        if (cached) {
            // console.log(`returning cached meshes for ${path}`);
            return Promise.resolve(cached);
        }

        const inProgress = this._loading.get(path);
        if (inProgress) {
            // console.log(`returning in-progress meshes for ${path}`);
            return inProgress;
        }

        const promise = this.loadScene(path)
            .then(root => {
                const meshes = root.getObjectsByProperty("isMesh", true) as Mesh[];
                for (const mesh of meshes) {
                    const material = mesh.material;
                    if (Array.isArray(material)) {
                        for (const mat of material) {
                            mat.side = FrontSide;
                        }
                    } else {
                        material.side = FrontSide;
                    }
                }
                this._cache.set(path, meshes);
                this._loading.delete(path);
                evtAssetLoaded.post(path);
                return meshes;
            })
            .catch(error => {
                console.error(error);
                this._loading.delete(path);
                return [];
            });

        this._loading.set(path, promise);
        return promise;
    }

    private loadScene(path: string) {
        const ext = path.split(".").pop()?.toLowerCase();
        const basePath = utils.getBasePath();
        const fullPath = `${basePath}${path}`;
        switch (ext) {
            case "fbx":
                return new Promise<Object3D>((resolve, reject) => {
                    this._fbxLoader.load(
                        fullPath,
                        root => resolve(root),
                        undefined,
                        error => reject(error));
                })

            case "glb":
            case "gltf":
                return new Promise<Object3D>((resolve, reject) => {
                    this._gltfLoader.load(
                        fullPath,
                        gltf => resolve(gltf.scene),
                        undefined,
                        error => reject(error));
                })

            default:
                return Promise.reject(`unknown file type: ${ext}`);
        }
    }
}

export const meshes = new Meshes();

