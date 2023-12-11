
import { Mesh, Object3D } from "three";
import { GLTFLoader, FBXLoader } from "three/examples/jsm/Addons.js";

class Meshes {
    private _gltfLoader = new GLTFLoader();
    private _fbxLoader = new FBXLoader();
    private _cache = new Map<string, Mesh[]>();

    public async load(path: string) {
        const cached = this._cache.get(path);
        if (cached) {
            console.log(`returning cached meshes for ${path}`);
            return cached.map(mesh => mesh.clone());
        }
        return new Promise<Mesh[]>((resolve, reject) => {     
            const ext = path.split(".").pop()?.toLowerCase();
            if (ext === "fbx") {
                this._fbxLoader.load(
                    path,
                    root => resolve(this.extractMeshes(path, root)),
                    undefined,
                    error => {
                        console.error(error);
                        reject(error);
                    });
                return;
            } else {
                this._gltfLoader.load(
                    path,
                    gltf => resolve(this.extractMeshes(path, gltf.scene)),
                    undefined,
                    error => {
                        console.error(error);
                        reject(error);
                    });
            }
        })
    }

    private extractMeshes(path: string, root: Object3D) {
        const list: Mesh[] = [];
        root.traverse(child => {
            if ((child as Mesh).isMesh) {
                list.push(child as Mesh);
            }
        });
        this._cache.set(path, list);
        return list.map(mesh => mesh.clone() as Mesh);
    }
}

export const meshes = new Meshes();

