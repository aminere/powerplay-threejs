import { SkinnedMesh, Vector3 } from "three";
import { ICellAddr } from "./UnitUtils";

export interface IUnit {
    desiredPosValid: boolean;
    desiredPos: Vector3;
    targetCell: ICellAddr;
    obj: SkinnedMesh;
    coords: ICellAddr;
    isMoving: boolean;
    isColliding: boolean;
}

