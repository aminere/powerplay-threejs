import { Vector2 } from "three";
import { IUnit } from "../unit/IUnit";
import { IBuildingInstance } from "../GameTypes";

export class FlockState {

    public static get instance() { return this._instance!; }
    private static _instance: FlockState | null = null;      

    public selectedUnits: IUnit[] = [];
    public selectionStart: Vector2 = new Vector2();
    public touchPressed: boolean = false;
    public spawnUnitRequest: IBuildingInstance | null = null;

    constructor() {
        FlockState._instance = this;
    }

    public dispose() {
        FlockState._instance = null;
    }
}

