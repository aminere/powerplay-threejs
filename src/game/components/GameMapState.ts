import { Box2 } from "three";
import { Action, ISector } from "../GameTypes";

export interface IGameMapState {
    sectors: Map<string, ISector>;
    bounds?: Box2;
    action: Action | null;
}

export class GameMapState {
    public set instance(value: IGameMapState) { this._instance = value; }

    public get sectors() { return this._instance.sectors; }
    public get bounds() { return this._instance.bounds; }
    public set bounds(value: Box2 | undefined) { this._instance.bounds = value; }  
    public get action() { return this._instance.action; }   
    public set action(value: Action | null) { this._instance.action = value; }   
    
    private _instance!: IGameMapState;
}

export const gameMapState = new GameMapState();

