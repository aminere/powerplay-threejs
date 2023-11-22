import { Box2, Vector2 } from "three";
import { Action, ICell, ISector } from "../GameTypes";

export interface IGameMapState {
    sectors: Map<string, ISector>;
    bounds?: Box2;
    action: Action | null;
    initialDragAxis?: "x" | "z";
    previousRoad: Vector2[];
    previousRail: ICell[];
}

export class GameMapState {
    public set instance(value: IGameMapState) { this._instance = value; }

    public get sectors() { return this._instance.sectors; }
    public get bounds() { return this._instance.bounds; }    
    public get action() { return this._instance.action; }   
    public get initialDragAxis() { return this._instance.initialDragAxis; }
    public get previousRoad() { return this._instance.previousRoad; }
    public get previousRail() { return this._instance.previousRail; }

    public set bounds(value: Box2 | undefined) { this._instance.bounds = value; }  
    public set action(value: Action | null) { this._instance.action = value; }    
    public set initialDragAxis(value: "x" | "z" | undefined) { this._instance.initialDragAxis = value; }
    
    private _instance!: IGameMapState;
}

export const gameMapState = new GameMapState();

