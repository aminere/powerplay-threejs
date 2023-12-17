import { Object3D, Vector2 } from "three";
import { BezierPath } from "./BezierPath";

export type RailTip = "start" | "end";

export interface ICell {
    roadTile?: number;
    building?: THREE.Object3D;
    resource?: THREE.Object3D;
    rail?: {        
        axis: Axis;        
        tip: RailTip;
        worldPos: THREE.Vector3;
        mapCoords: Vector2;
        endCell?: ICell;
        neighbors?: {
            [key in Axis]: {
                [direction: string]: ICell;
            }
        };
        obj?: THREE.Object3D;        
    };
    
    unit?: THREE.Object3D;
}

export interface ISector {
    cells: ICell[];
    layers: {
        buildings: Object3D;
        resources: Object3D;
        terrain: Object3D;        
    };
    textureData: {
        terrain: Uint8Array;
        highlight: Uint8Array;
    };
}

export interface IRail {    
    curve?: BezierPath;
    rotation: number;
}

export type Axis = "x" | "z";

export const Actions = [
    "elevation", 
    "terrain",
    "road", 
    "building", 
    "rail", 
    "belt",
    "unit",
    "car",
    "train",
    "mineral",
    "tree"
] as const;
export type Action = typeof Actions[number];

export type UIType = "gamemap";

export const TileTypes = [
    "sand", 
    "grass",
    "rock"
] as const;

export type TileType = typeof TileTypes[number];

export interface ISerializedCell {
    index: number;
    roadTile?: number;
    // resource?: string;
    // building?: string;
    // rail TODO
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
    sectors: ISerializedSector[];
}

