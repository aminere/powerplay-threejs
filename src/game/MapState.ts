
import { Box2 } from "three";
import { IGameMapState } from "./components/GameMapState";

export class MapState {
    public get sectors() { return this._props.sectors; }
    public get bounds() { return this._props.bounds; }
    public set bounds(value: Box2 | undefined) { this._props.bounds = value; }  
    public get action() { return this._props.action; }      
    
    private _props: IGameMapState;

    constructor(props: IGameMapState) {
        this._props = props;
    }
}

let instance: MapState | null = null;
export function getMapState() {    
    return instance!;
}

export function createMapState(props: IGameMapState) {
    console.assert(!instance);
    instance = new MapState(props);
}

export function destroyMapState() {
    console.assert(instance);
    instance = null;
}

