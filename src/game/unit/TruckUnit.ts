
import { Object3D } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { config } from "../config";
import { IUnit, IUnitProps, Unit } from "./Unit";

interface ITruckResources {
    type: RawResourceType | ResourceType;
    amount: number;
    root: Object3D;
}

export interface ITruckUnit extends IUnit {
    resources: ITruckResources | null;    
}

const { truckScale } = config.game;

export class TruckUnit extends Unit implements ITruckUnit {    
    public get resources(): ITruckResources | null { return this._resources; }
    public set resources(value: ITruckResources | null) { this._resources = value; }

    private _resources: ITruckResources | null = null;
    
    constructor(props: IUnitProps, id: number) {
        super(props, id);
        props.mesh.scale.multiplyScalar(truckScale);
    }
}

