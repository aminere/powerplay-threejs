
import * as THREE from 'three';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class Meshes {
    private static _loader = new GLTFLoader();
    private static _cache = new Map<string, THREE.Mesh[]>();

    public static async load(path: string) {
        const cached = Meshes._cache.get(path);
        if (cached) {
            console.log(`returning cached meshes for ${path}`);
            return Promise.resolve(cached.map(mesh => mesh.clone()));
        }
        return new Promise<THREE.Mesh[]>((resolve, reject) => {            
            Meshes._loader.load(
                path,
                gltf => {
                    const meshes = new Array<THREE.Mesh>();
                    gltf.scene.traverse(child => {
                        if ((child as THREE.Mesh).isMesh) {
                            meshes.push(child as THREE.Mesh);
                        }
                    });
                    Meshes._cache.set(path, meshes);
                    resolve(meshes.map(mesh => mesh.clone()));
                },
                undefined,
                error => {
                    console.error(error);
                    reject(error);
                });
        })
    }
}

