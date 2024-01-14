import { Vector2 } from "three";
import { engineState } from "../../engine/EngineState";
import { Flock } from "../components/Flock";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";
import { GameUtils } from "../GameUtils";

enum NpcStep {
    Idle,
    Follow,
    Attack
}

const nextMapCoords = new Vector2();
export class NPCState extends State<IUnit> {

    private _step = NpcStep.Idle;
    private _target?: IUnit;

    override enter(_unit: IUnit) {
    }

    override update(owner: IUnit): void {

        switch (this._step) {
            case NpcStep.Idle: {
                const flock = engineState.getComponents(Flock)[0];   
                const vision = flock.component.props.npcVision;
                const units = flock.component.state!.units;
                for (const unit of units) {
                    if (unit.type === owner.type) {
                        continue;
                    }
                    const dist = unit.obj.position.distanceTo(owner.obj.position);
                    if (dist < vision) {
                        this._target = unit;
                        this._step = NpcStep.Follow;
                        unitUtils.moveTo(owner, unit.coords.mapCoords);
                        break;
                    }
                }        
            }
            break;

            case NpcStep.Follow: {
                owner.desiredPosValid = false;
                GameUtils.worldToMap(owner.desiredPos, nextMapCoords);
                const isTarget = owner.targetCell.mapCoords.equals(nextMapCoords);
                if (isTarget) {
                    unitUtils.endMove(owner);                    
                    // TODO attack anim
                    unitUtils.skeletonManager.applySkeleton("idle", owner.obj);
                    this._step = NpcStep.Attack;
                }
            }
            break;

            case NpcStep.Attack: {
                // TODO
                console.log("attack");
            }
        }
    }
}

