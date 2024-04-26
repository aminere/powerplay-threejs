import { Box3, Object3D, Quaternion, Vector2, Vector3 } from "three"
import { GameUtils } from "../GameUtils";
import { State, StateMachine } from "../fsm/StateMachine";
import { engineState } from "../../engine/EngineState";
import { Fadeout } from "../components/Fadeout";
import { IUnitAddr, computeUnitAddr, getCellFromAddr, makeUnitAddr } from "./UnitAddr";
import { cmdFogRemoveCircle, evtUnitKilled } from "../../Events";
import { ICell } from "../GameTypes";
import { UnitType } from "../GameDefinitions";
import { utils } from "../../engine/Utils";
import { UnitUtils } from "./UnitUtils";
import { TankState } from "./states/TankState";
import { unitMotion } from "./UnitMotion";

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
    velocity: Vector3;
    acceleration: Vector3;
    arriving: boolean;
    lastKnownFlowfield: IUnitFlowfieldInfo | null;
    targetCell: IUnitAddr;
    visual: Object3D;
    coords: IUnitAddr;
    motionId: number;
    motionCommandId: number;
    lastCompletedMotionCommandId: number;
    isColliding: boolean;
    isAlive: boolean;
    isIdle: boolean;
    collidable: boolean;
    type: UnitType;
    fsm: StateMachine<IUnit>;
    lookAt: Quaternion;
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
    onCollidedWhileMoving: (unit: IUnit) => void;
}

export class Unit implements IUnit {
    public get acceleration() { return this._acceleration; }
    public get velocity() { return this._velocity; }    
    public get arriving() { return this._arriving; }
    public get lastKnownFlowfield() { return this._lastKnownFlowfield; }
    public get targetCell() { return this._targetCell; }
    public get visual() { return this._visual; }    
    public get coords() { return this._coords; }
    public get motionId() { return this._motionId; }
    public get motionCommandId() { return this._motionCommandId; }
    public get lastCompletedMotionCommandId() { return this._lastCompletedMotionCommandId; }
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
    public get fsm() { return this._fsm; }   
    public get boundingBox() { return this._boundingBox; }

    public set arriving(value: boolean) { 
        this._arriving = value; 
        if (value) {
            console.assert(this._motionCommandId > 0, "unit is arriving without a motion command");
            this._lastCompletedMotionCommandId = this._motionCommandId;
        }
    }

    public set motionId(value: number) { this._motionId = value; }

    public set motionCommandId(value: number) { 
        if (value === 0 && this._motionCommandId > 0) {
            this._lastCompletedMotionCommandId = this._motionCommandId;
        }
        this._motionCommandId = value; 
    }

    public set isColliding(value: boolean) { this._isColliding = value; }
    public set isIdle(value: boolean) { this._isIdle = value; }
    public set collidable(value: boolean) { this._collidable = value; }    
    public set lastKnownFlowfield(value: IUnitFlowfieldInfo | null) { this._lastKnownFlowfield = value; }

    private _acceleration = new Vector3();
    private _velocity = new Vector3();
    private _arriving = false;
    private _lastKnownFlowfield: IUnitFlowfieldInfo | null = null;
    private _targetCell = makeUnitAddr();
    private _visual: Object3D;
    private _coords = makeUnitAddr();
    private _motionId = 0;
    private _lastCompletedMotionCommandId = 0;
    private _motionCommandId = 0;
    private _isColliding = false;
    private _isAlive = true;
    private _isIdle = true;
    private _collidable = true;
    private _type: UnitType = "worker";
    private _health = 1;
    private _attackers: IUnit[] = [];
    private _unitsInRange: Array<[IUnit, number]> = [];
    private _boundingBox: Box3;

    private _lookAt = new Quaternion();
    private _fsm: StateMachine<IUnit>;
    private _id: number;    

    constructor(props: IUnitProps, id: number) {
        this._visual = props.visual;
        this._type = props.type;
        this._id = id;
        this._fsm = new StateMachine<IUnit>({ states: props.states, owner: this });
        this._boundingBox = props.boundingBox;

        GameUtils.worldToMap(this._visual.position, this._coords.mapCoords);
        computeUnitAddr(this._coords.mapCoords, this._coords);
        UnitUtils.applyElevation(this._coords, this._visual.position);
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

            const cell = getCellFromAddr(this._coords);
            const unitIndex = cell.units!.indexOf(this);
            console.assert(unitIndex >= 0, `unit ${this.id} not found in cell`);
            utils.fastDelete(cell.units!, unitIndex);
            evtUnitKilled.post(this);
        }
    }

    public onDeath() {
        const fadeDuration = 1;
        engineState.setComponent(this._visual, new Fadeout({ duration: fadeDuration }));
        setTimeout(() => {
            if (!UnitUtils.isEnemy(this)) {
                cmdFogRemoveCircle.post({ mapCoords: this._coords.mapCoords, radius: 10 });
            }
        }, fadeDuration * 1000);
    }

    public onMove(_bindSkeleton: boolean) {}
    public onMoveCommand() {
        const tankState = this.fsm.getState(TankState);
        if (tankState) {
            tankState.stopAttack();
        }
    }
    public onArrived() {}
    public onArriving() {}
    public onColliding() {}
    public onReachedBuilding(_cell: ICell) {}
    public onCollidedWhileMoving(neighbor: IUnit) {
        // if other unit was part of my motion, stop
        if (neighbor.lastCompletedMotionCommandId === this.motionCommandId) {
            unitMotion.endMotion(this);
        }
    }
}

