import { State } from "../../fsm/StateMachine";
import { time } from "../../../engine/core/Time";
import { unitMotion } from "../UnitMotion";
import { ICharacterUnit } from "../CharacterUnit";
import { IUnit } from "../Unit";
import { spiralFind } from "../UnitSearch";
import { UnitUtils } from "../UnitUtils";
import { unitAnimation } from "../UnitAnimation";
import { MathUtils, Quaternion, Vector3 } from "three";
import { GameUtils } from "../../GameUtils";

enum NpcStep {
    Idle,
    Follow,
    Attack
}

const vision = 4;
const hitFrequency = .5;
const damage = .1;
const targetPos = new Vector3();
const targetRotation = new Quaternion().setFromAxisAngle(GameUtils.vec3.up, MathUtils.degToRad(60));

export class NPCState extends State<ICharacterUnit> {

    private _target: IUnit | null = null;
    private _hitTimer = 1;
    private _step = NpcStep.Idle;

    override update(unit: ICharacterUnit): void {

        const target = this._target;
        if (target) {
            if (!target.isAlive) {
                this._target = null;
                unit.isIdle = true;
                this._step = NpcStep.Idle;
                unitAnimation.setAnimation(unit, "idle", { transitionDuration: .2, scheduleCommonAnim: true })
            }
        }

        switch (this._step) {
            case NpcStep.Idle: {
                const newTarget = spiralFind(unit, vision, other => !UnitUtils.isEnemy(other));
                if (newTarget) {
                    this._target = newTarget;
                    this._step = NpcStep.Follow;
                    unit.isIdle = false;
                    unitMotion.moveUnit(unit, newTarget.coords.mapCoords);
                }
            }
            break;

            case NpcStep.Attack: {

                if (UnitUtils.isOutOfRange(unit, target!, 1)) {
                    
                    this._step = NpcStep.Follow;
                    unitMotion.moveUnit(unit, target!.coords.mapCoords, false);
                    unitAnimation.setAnimation(unit, "run", { transitionDuration: .2, scheduleCommonAnim: true });

                } else {

                    targetPos.subVectors(target!.visual.position, unit.visual.position);
                    targetPos.applyQuaternion(targetRotation);
                    targetPos.add(unit.visual.position);
                    unitMotion.updateRotation(unit, unit.visual.position, targetPos);
                    if (this._hitTimer < 0) {
                        target!.setHitpoints(target!.hitpoints - damage);
                        this._hitTimer = hitFrequency;                    
                    } else {
                        this._hitTimer -= time.deltaTime;                
                    }
                }
            }
            break;
        }
    }    

    public onReachedTarget(unit: ICharacterUnit) {
        const target = this._target;
        if (target?.isAlive) {
            if (target.coords.mapCoords.equals(unit.targetCell.mapCoords)) {
                // target didn't move since last detection, so start attacking
                unitMotion.endMotion(unit);
                this._step = NpcStep.Attack;
                unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
            } else {
                // keep following
                unitMotion.moveUnit(unit, target.coords.mapCoords);
            }
        } else {
            unitMotion.endMotion(unit);
            this._target = null;
            unit.isIdle = true;
            this._step = NpcStep.Idle;
        }
    }
}

