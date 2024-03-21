import { Vector2 } from "three";

export interface ISerializedCell {
    index: number;
    roadTile?: number;
    resource?: string;
    unitCount?: number;
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

