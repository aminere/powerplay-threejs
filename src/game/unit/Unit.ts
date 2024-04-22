import { Box3, Object3D, Quaternion, Vector2, Vector3 } from "three"
import { GameUtils } from "../GameUtils";
import { State, StateMachine } from "../fsm/StateMachine";
import { engineState } from "../../engine/EngineState";
import { Fadeout } from "../components/Fadeout";
import { IUnitAddr, computeUnitAddr, makeUnitAddr } from "./UnitAddr";
import { cmdFogRemoveCircle } from "../../Events";
import { ICell } from "../GameTypes";
import { UnitType } from "../GameDefinitions";

export interface IUnitProps {
    visual: Object3D;
    boundingBox: Box3;
    type: UnitType;
    speed?: number;
    states: State<IUnit>[];
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
    mesh: Object3D;
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
    unitsInRange: Array<[IUnit, number]>;
    boundingBox: Box3;

    setHealth(value: number): void;
    onDeath(): void;
    onMove: (bindSkeleton: boolean) => void;
    onMoveCommand: () => void;
    onArrived: () => void;
    onArriving: () => void;
    onColliding: () => void;
    onReachedBuilding: (cell: ICell) => void;
    onCollidedWithMotionNeighbor: (unit: IUnit) => void;
}

export class Unit implements IUnit {
    public get desiredPosValid() { return this._desiredPosValid; }
    public get desiredPos() { return this._desiredPos; }
    public get velocity() { return this._velocity; }    
    public get arriving() { return this._arriving; }
    public get lastKnownFlowfield() { return this._lastKnownFlowfield; }
    public get targetCell() { return this._targetCell; }
    public get mesh() { return this._visual; }    
    public get coords() { return this._coords; }
    public get motionId() { return this._motionId; }
    public get lastCompletedMotionId() { return this._lastCompletedMotionId; }
    public get isColliding() { return this._isColliding; }
    public get isAlive() { return this._isAlive; }
    public get isIdle() { return this._isIdle; }
    public get collidable() { return this._collidable; }
    public get type() { return this._type; }
    public get id() { return this._id; }  
    public get health() { return this._health; }  
    public get attackers() { return this._attackers; }
    
    public get unitsInRange() { return this._unitsInRange; }

    public get lookAt() { return this._lookAt; }
    public get rotation() { return this._rotation; }    
    public get fsm() { return this._fsm; }   
    public get speedFactor() { return this._speedFactor; }
    public get boundingBox() { return this._boundingBox; }

    public set desiredPosValid(value: boolean) { this._desiredPosValid = value; }
    public set arriving(value: boolean) { this._arriving = value; }
    public set motionId(value: number) { 
        if (value === 0 && this._motionId > 0) {
            this._lastCompletedMotionId = this._motionId;
        }
        this._motionId = value;
    }    

    public set isColliding(value: boolean) { this._isColliding = value; }
    public set isIdle(value: boolean) { this._isIdle = value; }
    public set collidable(value: boolean) { this._collidable = value; }    
    public set lastKnownFlowfield(value: IUnitFlowfieldInfo | null) { this._lastKnownFlowfield = value; }

    private _desiredPosValid = false;
    private _desiredPos = new Vector3();
    private _velocity = new Vector3();
    protected _arriving = false;
    private _lastKnownFlowfield: IUnitFlowfieldInfo | null = null;
    private _targetCell = makeUnitAddr();
    private _visual: Object3D;
    private _coords = makeUnitAddr();
    protected _motionId = 0;
    private _lastCompletedMotionId = 0;
    protected _isColliding = false;
    protected _isAlive = true;
    private _isIdle = true;
    protected _collidable = true;
    private _type: UnitType = "worker";
    protected _health = 1;
    private _attackers: IUnit[] = [];
    private _unitsInRange: Array<[IUnit, number]> = [];
    private _boundingBox: Box3;

    private _lookAt = new Quaternion();
    private _rotation = new Quaternion();
    private _fsm: StateMachine<IUnit>;
    private _id: number;    
    private _speedFactor: number;

    constructor(props: IUnitProps, id: number) {
        this._visual = props.visual;
        this._type = props.type;
        this._id = id;
        this._fsm = new StateMachine<IUnit>({ states: props.states, owner: this });
        this._speedFactor = props.speed ?? 1;
        this._boundingBox = props.boundingBox;

        GameUtils.worldToMap(this._visual.position, this._coords.mapCoords);
        computeUnitAddr(this._coords.mapCoords, this._coords);
        // console.log(`unit ${this._id} created at ${this._coords.mapCoords.x},${this._coords.mapCoords.y}`);

        const cell = GameUtils.getCell(this._coords.mapCoords)!;
        console.assert(cell, `unit ${this._id} created at invalid position ${this._coords.mapCoords.x},${this._coords.mapCoords.y}`);
        if (cell.units) {
            cell.units.push(this);
        } else {
            cell.units = [this];
        }        
    }

    public setHealth(value: number) {
        this._health = value;
        if (value <= 0 && this._isAlive) {
            this._fsm.switchState(null);
            this._isAlive = false;
            this._collidable = false;
            this._motionId = 0;
            this._isColliding = false;
            this.onDeath();
        }
    }

    public onDeath() {
        const fadeDuration = 1;
        engineState.setComponent(this._visual, new Fadeout({ duration: fadeDuration }));
        setTimeout(() => {
            if (!this._type.startsWith("enemy")) {
                cmdFogRemoveCircle.post({ mapCoords: this._coords.mapCoords, radius: 10 });
            }
        }, fadeDuration * 1000);
    }

    public onMove(_bindSkeleton: boolean) {}
    public onMoveCommand() {}
    public onArrived() {}
    public onArriving() {}
    public onColliding() {}
    public onReachedBuilding(_cell: ICell) {}
    public onCollidedWithMotionNeighbor(_unit: IUnit) {}
}

