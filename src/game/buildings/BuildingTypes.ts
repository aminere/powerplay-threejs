
import { Object3D, Vector2, Vector3 } from "three";
import { ResourceType, RawResourceType, ProductType } from "../GameDefinitions";
import { IUnitAddr } from "../unit/UnitAddr";

export const BuildingTypes = [
    "hq",
    "mine",
    "factory",
    "assembly"
] as const;

export type BuildingType = typeof BuildingTypes[number];

export enum FactoryState {
    idle,
    processing
}

export interface IFactoryState {
    input: RawResourceType | ResourceType;
    output: ResourceType;

    inputReserve: number;
    inputAccepFrequency: number;
    inputTimer: number;
    state: FactoryState;
    outputCell: IUnitAddr;
    timer: number;
}

export interface IAssemblyState {
    inputs: Array<RawResourceType | ResourceType>;
    output: ProductType;
}

export interface IMineState {
    resourceCells: Vector2[];
    currentResourceCell: number;
    active: boolean;
    depleted: boolean;
    outputCell: IUnitAddr;    
    timer: number;
}

export type TBuildingState = IFactoryState | IAssemblyState | IMineState;

export interface IBuildingInstance {
    id: string;
    buildingType: BuildingType;    
    visual: Object3D;
    mapCoords: Vector2;
    state: TBuildingState | null;
    deleted: boolean;
}

export const buildingSizes: Record<BuildingType, Vector3> = {
    "hq": new Vector3(10, 4, 5),
    "mine": new Vector3(2, 1, 2),
    "factory": new Vector3(3, 1.5, 3),
    "assembly": new Vector3(4, 2, 4)
};

