import { Box3, Object3D, Vector2, Vector3 } from "three";
import { IUnitAddr } from "./UnitAddr";
import { UnitType } from "../GameDefinitions";
import { StateMachine } from "../fsm/StateMachine";
import { ICell } from "../GameTypes";

export interface IUnitFlowfieldInfo {
    cellIndex: number;
    sectorCoords: Vector2;
}

export interface IUnit {
    velocity: Vector3;
    acceleration: Vector3;
    arriving: boolean;
    lastKnownFlowfield: IUnitFlowfieldInfo | null;
    targetCell: IUnitAddr;
    visual: Object3D;
    coords: IUnitAddr;
    motionId: number;
    motionCommandId: number;
    motionTime: number;
    lastCompletedMotionCommandId: number;
    collidingWith: IUnit[];
    isAlive: boolean;
    isIdle: boolean;
    collidable: boolean;
    type: UnitType;
    fsm: StateMachine<IUnit>;
    hitpoints: number;
    unitsInRange: Array<[IUnit, number]>;
    boundingBox: Box3;

    setHitpoints: (value: number) => void;
    clearAction: () => void;
    onDeath: () => void;
    onMove: (bindSkeleton: boolean) => void;
    onArrived: () => void;
    onArriving: () => void;
    onColliding: () => void;
    onReachedBuilding: (cell: ICell) => void;
    onReachedResource: (cell: ICell) => void;
    onCollidedWhileMoving: (unit: IUnit) => void;
    dispose: () => void;
}

