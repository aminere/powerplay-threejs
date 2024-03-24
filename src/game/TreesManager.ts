import { BufferGeometry } from "three";
import { meshes } from "../engine/resources/Meshes";

const trees = [
    "palm-high",
    // "palm-round",
    "palm-big",
    "palm"
];

class TreesManager {

    public get geometries() { return this._geometries; }
    public get trees() { return trees; }

    private _geometries: BufferGeometry[] = [];

    public async preload() {
        if (this._geometries.length > 0) {
            return;
        }
        const treeMeshes = await Promise.all(trees.map(s => meshes.load(`/models/trees/${s}.fbx`)));
        this._geometries = treeMeshes.map(m => m[0].geometry);
    }
}

export const treesManager = new TreesManager();

