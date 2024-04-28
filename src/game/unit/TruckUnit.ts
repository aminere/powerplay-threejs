
import { Object3D } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { IUnit, Unit } from "./Unit";

interface ITruckResources {
    type: RawResourceType | ResourceType;
    amount: number;
    root: Object3D;
}

export interface ITruckUnit extends IUnit {
    resources: ITruckResources | null;    
}

export class TruckUnit extends Unit implements ITruckUnit {    
    public get resources(): ITruckResources | null { return this._resources; }
    public set resources(value: ITruckResources | null) { 
        if (value === this._resources) {
            return;
        }
        if (this._resources) {
            this._resources.root.removeFromParent();
        }
        this._resources = value; 
    }

    private _resources: ITruckResources | null = null;

    public override setHealth(value: number): void {
        if (value <= 0) {
            this.resources = null;
        }
        super.setHealth(value);
    }
}

