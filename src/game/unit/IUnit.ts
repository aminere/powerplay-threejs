import { AnimationAction, Quaternion, SkinnedMesh, Vector2, Vector3 } from "three";
import { StateMachine } from "../fsm/StateMachine";
import { IUniqueSkeleton } from "../animation/SkeletonPool";
import { IUnitAddr } from "./UnitAddr";

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
    flowfieldDir: Vector2;
    targetCell: IUnitAddr;
    obj: SkinnedMesh;
    coords: IUnitAddr;
    motionId: number;
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
    animation: IUnitAnim;
    skeleton: IUniqueSkeleton | null;
    unitsInRange: Array<[IUnit, number]>;
}

