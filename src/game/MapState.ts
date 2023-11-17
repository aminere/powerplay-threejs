
import { Box2, Object3D } from "three";
import { ISector } from "./GameTypes";

export class MapState {
    public get sectors() { return this._sectors; }
    public get bounds() { return this._bounds; }
    public set bounds(value: Box2 | undefined) { this._bounds = value; }
    public get root() { return this._root; }
    public set root(value: Object3D) { this._root = value; }

    private _sectors = new Map<string, ISector>();
    private _bounds?: Box2;
    private _root: Object3D;

    constructor(root: Object3D) {
        this._root = root;
    }
}

let instance: MapState | null = null;
export function getMapState() {    
    return instance!;
}

export function createMapState(root: Object3D) {
    console.assert(!instance);
    instance = new MapState(root);
}

export function destroyMapState() {
    console.assert(instance);
    instance = null;
}
