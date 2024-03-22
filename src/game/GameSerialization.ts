import { Vector2 } from "three";
import { IConveyorConfig } from "./GameTypes";

export interface ISerializedCell {
    index: number;
    roadTile?: number;
    resource?: string;
    unitCount?: number;
    conveyor?: IConveyorConfig;
}

export interface ISerializedElevation {
    vertexIndex: number;
    height: number;
}

export interface ISerializedSector {
    key: string;
    cells: ISerializedCell[];
    elevation: ISerializedElevation[];
}

export interface ISerializedGameMap {
    size: number;
    sectors: ISerializedSector[];
    buildings: Record<string, Vector2[]>;
}

