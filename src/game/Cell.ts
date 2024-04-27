import { InstancedMesh } from "three";
import { ICell, IConveyor, IPickableResource, IRail, IRawResource } from "./GameTypes";
import { trees } from "./Trees";
import { IUnit } from "./unit/Unit";

export class Cell implements ICell {

    constructor(id: string) {
        this.id = id;
    }

    public id: string;
    public viewCount = -1;
    
    public get rail() { return this._rail; }
    public set rail(value: IRail | undefined) {
        this._rail = value;
        const empty = value === undefined;
        this._isEmpty = empty;
    }

    public get building() { return this._building; }
    public set building(value: string | undefined) { 
        this._building = value;       

        const empty = (() => {
            if (value) { 
                return false;
            } else if (this._resource) {
                return false;
            } else {
                return true;
            }
        })();

        this._isEmpty = empty;
        this.isWalkable = empty;
    }

    public get resource() { return this._resource; }
    public set resource(value: IRawResource | undefined) {
        if (value?.type === this._resource?.type) {
            return;
        }

        if (this._resource) {
            const { visual, instanceIndex, type } = this._resource;
            if (instanceIndex !== undefined) {
                console.assert(type === "wood");
                trees.removeTree(visual as InstancedMesh, instanceIndex);
            } else if (visual) {
                visual?.removeFromParent();
            }
        }

        this._resource = value;
        const empty = value === undefined;
        this._isEmpty = empty;
        this.isWalkable = empty;
    }    

    public get conveyor() { return this._conveyor; }
    public set conveyor(value: IConveyor | undefined) {
        this._conveyor = value;
        const empty = value === undefined;
        this._isEmpty = empty;
        this.isWalkable = empty;
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

    public get isWalkable() { return this._isWalkable; }
    public set isWalkable(value: boolean) { 
        this._isWalkable = value;
        this._flowFieldCost = value ? 1 : 0xffff;
    }

    public get pickableResource() { return this._pickableResource; }
    public set pickableResource(value: IPickableResource | undefined) {
        if (this._pickableResource) {
            this._pickableResource.visual.removeFromParent();
        }
        this._pickableResource = value;
    }

    public get isEmpty() { return this._isEmpty; }    
    public get hasUnits() { return this._units !== undefined && this._units.length > 0; }
    public get flowFieldCost() { return this._flowFieldCost; }

    private _isEmpty = true;
    private _isWalkable = true;
    private _flowFieldCost = 1;
    private _building: string | undefined = undefined;
    private _rail: IRail | undefined = undefined;
    private _resource: IRawResource | undefined = undefined;
    private _conveyor: IConveyor | undefined = undefined;
    private _roadTile: number | undefined = undefined;
    private _units: IUnit[] | undefined = undefined;
    private _pickableResource: IPickableResource | undefined = undefined;
}

