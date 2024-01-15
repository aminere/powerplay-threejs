import { engineState } from "../../engine/EngineState";
import { Flock } from "../components/Flock";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";
import { GameUtils } from "../GameUtils";
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

    override enter(_unit: IUnit) {
    }

    override update(unit: IUnit): void {

        switch (this._step) {
            case NpcStep.Idle: {
                const flock = engineState.getComponents(Flock)[0];   
                const vision = flock.component.props.npcVision;
                const units = flock.component.state!.units;
                for (const target of units) {
                    if (target.type === unit.type) {
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
                    if (dist < 1) {
                        unit.isMoving = false;
                        this._attackTimer = 0.2;
                        this._attackStarted = false;
                        // unitUtils.skeletonManager.applySkeleton("idle", unit.obj);
                        this._step = NpcStep.Attack;
                    }
                }
            }
            break;

            case NpcStep.Attack: {
                const dist = this._target!.obj.position.distanceTo(unit.obj.position);
                const inRange = dist < 2;
                if (inRange) {
                    if (!this._attackStarted) {
                        this._attackTimer -= time.deltaTime;
                        if (this._attackTimer < 0) {
                            this._attackStarted = true;
                            unitUtils.skeletonManager.applySkeleton("attack", unit.obj);
                        }
                    } else {
                        // keep attacking
                        console.log("attack");
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

