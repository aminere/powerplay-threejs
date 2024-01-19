import { AnimationAction, Quaternion, SkinnedMesh, Vector3 } from "three";
import { ICellAddr } from "./UnitUtils";
import { StateMachine } from "../fsm/StateMachine";
import { IUniqueSkeleton } from "../animation/SkeletonPool";

export enum UnitType {
    Worker,
    NPC
}

export interface IUnitAnim {
    name: string;
    action: AnimationAction;
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
    animation: IUnitAnim | null;
    skeleton: IUniqueSkeleton | null;
    unitsInRange: Array<[IUnit, number]>;
}

