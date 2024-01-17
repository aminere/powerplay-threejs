import { Quaternion, SkinnedMesh, Vector3 } from "three";
import { ICellAddr } from "./UnitUtils";
import { StateMachine } from "../fsm/StateMachine";

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
    isAlive: boolean;
    isIdle: boolean;
    collidable: boolean;
    type: UnitType;
    fsm: StateMachine<IUnit>;
    lookAt: Quaternion;
    rotationVelocity: number;
    rotation: Quaternion;
    health: number;
    attackers: IUnit[];
    animation: string;
}

