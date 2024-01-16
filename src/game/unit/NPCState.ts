import { engineState } from "../../engine/EngineState";
import { Flock } from "../components/Flock";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";
import { flowField } from "../pathfinding/Flowfield";
import { pools } from "../../engine/Pools";
import { time } from "../../engine/Time";

enum NpcStep {
    Idle,
    Follow,
    Attack
}


export class NPCState extends State<IUnit> {

    private _step = NpcStep.Idle;
    private _target?: IUnit;
    private _attackTimer = -1;
    private _attackStarted = false;
    private _hitTimer = 1;

    override enter(_unit: IUnit) {
    }

    override update(unit: IUnit): void {

        const flock = engineState.getComponents(Flock)[0];
        switch (this._step) {
            case NpcStep.Idle: {                   
                const vision = flock.component.props.npcVision;
                const units = flock.component.state!.units;
                for (const target of units) {
                    if (target.type === unit.type) {
                        continue;
                    }
                    if (!target.isAlive) {
                        continue;
                    }
                    const dist = target.obj.position.distanceTo(unit.obj.position);
                    if (dist < vision) {
                        this._target = target;
                        this.follow(unit, target);
                        break;
                    }
                }        
            }
            break;

            case NpcStep.Follow: {
                if (!this._target!.coords.mapCoords.equals(unit.targetCell.mapCoords)) {
                    this.follow(unit, this._target!);
                } else {
                    const dist = this._target!.obj.position.distanceTo(unit.obj.position);                
                    if (dist < flock.component.props.separation + .2) {
                        unit.isMoving = false;
                        this._attackTimer = 0.2;
                        this._attackStarted = false;
                        this._step = NpcStep.Attack;
                    }
                }
            }
            break;

            case NpcStep.Attack: {
                const dist = this._target!.obj.position.distanceTo(unit.obj.position);
                const inRange = dist < flock.component.props.separation + .4;
                if (inRange) {
                    if (!this._attackStarted) {
                        this._attackTimer -= time.deltaTime;
                        if (this._attackTimer < 0) {
                            this._attackStarted = true;
                            this._hitTimer = 1 - .2;
                            unitUtils.skeletonManager.applySkeleton("attack", unit.obj);
                        }
                    } else {
                        unitUtils.updateRotation(unit, unit.obj.position, this._target!.obj.position);                        
                        this._hitTimer -= time.deltaTime;
                        if (this._hitTimer < 0) {       
                            // TODO hit feedback                     
                            this._hitTimer = .5;
                            this._target!.health -= 0.5;
                            if (!this._target!.isAlive) {
                                this._step = NpcStep.Idle;
                                unitUtils.skeletonManager.applySkeleton("idle", unit.obj);
                            }
                        }
                    }
                    
                } else {
                    this.follow(unit, this._target!);
                }
            }
        }
    }

    private follow(unit: IUnit, target: IUnit) {
        this._step = NpcStep.Follow;
        const [sectorCoords, localCoords] = pools.vec2.get(2);
        if (flowField.compute(target.coords.mapCoords, sectorCoords, localCoords)) {
            unitUtils.moveTo(unit, target.coords.mapCoords);
        }
    }
}

