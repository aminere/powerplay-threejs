import { AnimationAction, Box3, Mesh, Quaternion, Vector2, Vector3 } from "three";
import { StateMachine } from "../fsm/StateMachine";
import { IUnitAddr } from "./UnitAddr";
import { ICell, IResource } from "../GameTypes";
import { UnitType } from "../GameDefinitions";

export interface IUnitAnim {
    name: string;
    action: AnimationAction;
}

export interface IUnitFlowfieldInfo {
    cellIndex: number;
    sectorCoords: Vector2;
}

export interface IUnit {
    id: number;
    desiredPosValid: boolean;
    desiredPos: Vector3;
    velocity: Vector3;
    arriving: boolean;
    speedFactor: number;
    lastKnownFlowfield: IUnitFlowfieldInfo | null;
    targetCell: IUnitAddr;
    mesh: Mesh;
    coords: IUnitAddr;
    motionId: number;
    lastCompletedMotionId: number;
    isColliding: boolean;
    isAlive: boolean;
    isIdle: boolean;
    collidable: boolean;
    type: UnitType;
    fsm: StateMachine<IUnit>;
    lookAt: Quaternion;
    rotation: Quaternion;
    health: number;
    attackers: IUnit[];
    unitsInRange: Array<[IUnit, number]>;
    resource: IResource | null;
    boundingBox: Box3;

    onMove: (bindSkeleton: boolean) => void;
    onSteer: () => void;
    onArrive: () => void;
    onColliding: () => void;
    updateResource: () => void;
    onReachedTarget: (cell: ICell) => void;
}

