
import { Object3D, Vector2, Vector3 } from "three";
import { ResourceType, RawResourceType, ProductType } from "../GameDefinitions";

export const BuildingTypes = [
    "hq",
    "mine",
    "factory",
    "assembly"
] as const;

export type BuildingType = typeof BuildingTypes[number];

export interface IFactoryState {
    input: RawResourceType | ResourceType;
    output: ResourceType;

    active: boolean;
    inputFull: boolean;
    outputFull: boolean;
    timer: number;
}

export interface IAssemblyState {
    inputs: Array<RawResourceType | ResourceType>;
    output: ProductType;
}

export interface IMineState {
    cells: Vector2[];
    currentCell: number;
    timer: number;
    outputSlot: number;
    active: boolean;
    outputFull: boolean;
    depleted: boolean;
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
    "hq":new Vector3(10, 4, 5),
    "mine": new Vector3(2, 2, 3),
    "factory": new Vector3(2, 2, 3),
    "assembly": new Vector3(2, 2, 3)
};

