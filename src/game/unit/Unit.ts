import { Box3, Object3D, Vector3 } from "three"
import { GameUtils } from "../GameUtils";
import { State, StateMachine } from "../fsm/StateMachine";
import { engineState } from "../../engine/EngineState";
import { Fadeout } from "../components/Fadeout";
import { computeUnitAddr, getCellFromAddr, makeUnitAddr } from "./UnitAddr";
import { cmdFogRemoveCircle, evtUnitKilled, evtUnitStateChanged } from "../../Events";
import { ICell } from "../GameTypes";
import { UnitType } from "../GameDefinitions";
import { utils } from "../../engine/Utils";
import { UnitUtils } from "./UnitUtils";
import { unitMotion } from "./UnitMotion";
import { unitConfig } from "../config/UnitConfig";
import { IUnit, IUnitFlowfieldInfo, UnitState } from "./IUnit";

export interface IUnitProps {
    visual: Object3D;
    boundingBox: Box3;
    type: UnitType;
    speed?: number;
    states: State<IUnit>[];
}


export class Unit implements IUnit {
    public get acceleration() { return this._acceleration; }
    public get velocity() { return this._velocity; }
    public get arriving() { return this._arriving; }
    public get lastKnownFlowfield() { return this._lastKnownFlowfield; }
    public get targetCell() { return this._targetCell; }
    public get visual() { return this._visual; }
    public get angle() { return this._angle; }
    public get coords() { return this._coords; }
    public get motionId() { return this._motionId; }
    public get motionCommandId() { return this._motionCommandId; }
    public get motionTime() { return this._motionTime; }
    public get lastCompletedMotionCommandId() { return this._lastCompletedMotionCommandId; }
    public get collidingWith() { return this._collidingWith; }
    public get isAlive() { return this._state === UnitState.Alive; }
    public get state() { return this._state; }
    public get isIdle() { return this._isIdle; }
    public get collidable() { return this._collidable; }
    public get type() { return this._type; }
    public get hitpoints() { return this._hitpoints; }
    public get attackers() { return this._attackers; }

    public get unitsInRange() { return this._unitsInRange; }

    public get fsm() { return this._fsm; }
    public get boundingBox() { return this._boundingBox; }

    public set arriving(value: boolean) {
        this._arriving = value;
        if (value) {
            this.onArriving();
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
    public set motionTime(value: number) { this._motionTime = value; }

    public set isIdle(value: boolean) { this._isIdle = value; }
    public set collidable(value: boolean) { this._collidable = value; }
    public set lastKnownFlowfield(value: IUnitFlowfieldInfo | null) { this._lastKnownFlowfield = value; }
    public set angle(value: number) { this._angle = value; }
    public set state(state: UnitState) { this._state = state; }

    private _acceleration = new Vector3();
    private _velocity = new Vector3();
    private _arriving = false;
    private _lastKnownFlowfield: IUnitFlowfieldInfo | null = null;
    private _targetCell = makeUnitAddr();
    private _visual: Object3D;
    private _angle = 0;
    private _coords = makeUnitAddr();
    private _motionId = 0;
    private _lastCompletedMotionCommandId = 0;
    private _motionCommandId = 0;
    private _motionTime = 0;
    private _collidingWith: IUnit[] = [];
    protected _state = UnitState.Alive;
    private _isIdle = true;
    private _collidable = true;
    private _type: UnitType = "worker";
    private _hitpoints = 1;
    private _attackers: IUnit[] = [];
    private _unitsInRange: Array<[IUnit, number]> = [];
    private _boundingBox: Box3;
    protected _tween: gsap.core.Tween | null = null;

    private _fsm: StateMachine<IUnit>;

    constructor(props: IUnitProps) {
        this._visual = props.visual;
        this._type = props.type;
        this._fsm = new StateMachine<IUnit>({ states: props.states, owner: this });
        this._boundingBox = props.boundingBox;

        const { hitpoints } = unitConfig[this._type];
        this._hitpoints = hitpoints;

        GameUtils.worldToMap(this._visual.position, this._coords.mapCoords);
        computeUnitAddr(this._coords.mapCoords, this._coords);
        // console.log(`unit ${this._id} created at ${this._coords.mapCoords.x},${this._coords.mapCoords.y}`);

        const cell = GameUtils.getCell(this._coords.mapCoords)!;
        console.assert(cell, `unit ${this._type} created at invalid position ${this._coords.mapCoords.x},${this._coords.mapCoords.y}`);
        if (cell.units) {
            cell.units.push(this);
        } else {
            cell.units = [this];
        }
    }

    public setHitpoints(value: number) {
        this._hitpoints = value;
        if (value <= 0) {
            switch (this._state) {
                case UnitState.Alive: {
                    this._state = UnitState.Dying;
                    if (this._motionId > 0) {
                        unitMotion.endMotion(this);
                    }

                    this._fsm.switchState(null);
                    this._collidable = false;
                    this._collidingWith.length = 0;
                    this.onDeath();

                    const cell = getCellFromAddr(this._coords);
                    const unitIndex = cell.units!.indexOf(this);
                    console.assert(unitIndex >= 0, `unit ${this.type} not found in cell`);
                    utils.fastDelete(cell.units!, unitIndex);
                    evtUnitKilled.post(this);
                }
                    break;
            }
            return;
        }

        evtUnitStateChanged.post(this);
    }

    public onDeath() {
        const fadeDuration = 1;
        engineState.setComponent(this._visual, new Fadeout({ duration: fadeDuration }));
        this._tween = utils.postpone(fadeDuration, () => {
            this._tween = null;
            this._state = UnitState.Dead;
            engineState.removeObject(this._visual);
            if (!UnitUtils.isEnemy(this)) {
                const { range } = unitConfig[this.type];
                cmdFogRemoveCircle.post({ mapCoords: this._coords.mapCoords, radius: range.vision });
            }
        });
    }

    public onMove(_bindSkeleton: boolean) { }
    public clearAction() { }
    public onArrived() { }
    public onArriving() { }
    public onColliding() { }
    public onReachedBuilding(_cell: ICell) { }

    public onReachedResource(_cell: ICell) { }

    public onCollidedWhileMoving(neighbor: IUnit) {
        // if other unit was part of my motion, stop
        if (neighbor.lastCompletedMotionCommandId === this.motionCommandId) {
            unitMotion.endMotion(this);
        }
    }

    public dispose() {
        this._fsm.dispose();

        if (this._tween) {
            this._tween.kill();
            this._tween = null;
        }        
    }
}

