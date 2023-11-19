
import { Box2 } from "three";
import { GameMapProps } from "./components/GameMapProps";

export class MapState {
    public get sectors() { return this._props.sectors; }
    public get bounds() { return this._props.bounds; }
    public set bounds(value: Box2 | undefined) { this._props.bounds = value; }        
    
    private _props: GameMapProps;

    constructor(props: GameMapProps) {
        this._props = props;
    }
}

let instance: MapState | null = null;
export function getMapState() {    
    return instance!;
}

export function createMapState(props: GameMapProps) {
    console.assert(!instance);
    instance = new MapState(props);
}

export function destroyMapState() {
    console.assert(instance);
    instance = null;
}

