import { Axis, ICell, IConveyor, IRawResource, RailTip } from "./GameTypes";
import { Object3D, Vector2, Vector3 } from "three";
import { IUnit } from "./unit/IUnit";

export class Cell implements ICell {

    constructor(id: string) {
        this.id = id;
    }

    public id: string;
    public viewCount = -1;
    
    public rail?: {        
        axis: Axis;        
        tip: RailTip;
        worldPos: Vector3;
        mapCoords: Vector2;
        endCell?: ICell;
        neighbors?: {
            [key in Axis]: {
                [direction: string]: ICell;
            }
        };
        obj?: Object3D;
    };    

    public get buildingId() { return this._buildingId; }
    public set buildingId(value: string | undefined) { 
        this._buildingId = value;       

        const empty = (() => {
            if (this._buildingId) { 
                return false;
            } else if (this._resource) {
                return false;
            } else {
                return true;
            }
        })();

        this._isEmpty = empty;
        this.setWalkable(empty);
    }

    public get resource() { return this._resource; }
    public set resource(value: IRawResource | undefined) {
        this._resource = value;
        const empty = value === undefined;
        this._isEmpty = empty;
        this.setWalkable(empty);
    }    

    public get conveyor() { return this._conveyor; }
    public set conveyor(value: IConveyor | undefined) {
        this._conveyor = value;
        const empty = value === undefined;
        this._isEmpty = empty;
        this.setWalkable(empty);
    }

    public get roadTile() { return this._roadTile; }
    public set roadTile(value: number | undefined) {
        this._roadTile = value;
        const empty = value === undefined;
        this._isEmpty = empty;
    }

    public get units() { return this._units; }
    public set units(value: IUnit[] | undefined) { 
        console.assert(value !== undefined);
        this._units = value; 
    }

    public get isEmpty() { return this._isEmpty; }
    public get isWalkable() { return this._isWalkable; }
    public get hasUnits() { return this._units !== undefined && this._units.length > 0; }
    public get flowFieldCost() { return this._flowFieldCost; }

    private _isEmpty = true;
    private _isWalkable = true;
    private _flowFieldCost = 1;
    private _buildingId: string | undefined = undefined;
    private _resource: IRawResource | undefined = undefined;
    private _conveyor: IConveyor | undefined = undefined;
    private _roadTile: number | undefined = undefined;
    private _units: IUnit[] | undefined = undefined;    

    private setWalkable(value: boolean) {
        this._isWalkable = value;
        this._flowFieldCost = value ? 1 : 0xffff;
    }
}

