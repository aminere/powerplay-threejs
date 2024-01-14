import { SkinnedMesh, Vector3 } from "three";
import { ICellAddr } from "./UnitUtils";

export enum UnitType {
    Worker,
    NPC
}

export interface IUnit {
    id: number;
    desiredPosValid: boolean;
    desiredPos: Vector3;
    targetCell: ICellAddr;
    obj: SkinnedMesh;
    coords: ICellAddr;
    isMoving: boolean;
    isColliding: boolean;
    collidable: boolean;
    type: UnitType;
}

