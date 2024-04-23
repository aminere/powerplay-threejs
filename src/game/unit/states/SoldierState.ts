import { MathUtils, Quaternion, Vector3 } from "three";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../CharacterUnit";
import { IUnit } from "../Unit";
import { unitAnimation } from "../UnitAnimation";
import { UnitMotion } from "../UnitMotion";
import { UnitSearch } from "../UnitSearch";
import { GameUtils } from "../../GameUtils";
import { time } from "../../../engine/core/Time";
import { UnitUtils } from "../UnitUtils";

const shootRange = 4;
const hitFrequency = .5;
const damage = .1;
const targetPos = new Vector3();
const targetRotation = new Quaternion().setFromAxisAngle(GameUtils.vec3.up, MathUtils.degToRad(12));

export class SoldierState extends State<ICharacterUnit> {

    private _search = new UnitSearch();
    private _target: IUnit | null = null;
    private _hitTimer = 0;

    override enter(_unit: IUnit) {
        console.log(`SoldierState enter`);
    }    
    override exit(unit: IUnit) {
        console.log(`SoldierState exit`);
        unit.isIdle = true;
    }

    override update(unit: ICharacterUnit) {

        const target = this._target;
        if (target) {
            if (!target.isAlive || UnitUtils.isOutOfRange(unit, target, shootRange)) {
                this.stopAttack(unit);
                this._search.reset();
                this._target = null;
            } else {
                const isMoving = unit.motionId > 0;
                if (!isMoving) {
                    if (unit.isIdle) {
                        unit.isIdle = false;
                        unitAnimation.setAnimation(unit, "shoot", { transitionDuration: .3, scheduleCommonAnim: true });
                    } else {
                        // rotate to target
                        targetPos.subVectors(target!.visual.position, unit.visual.position);
                        targetPos.applyQuaternion(targetRotation);
                        targetPos.add(unit.visual.position);
                        UnitMotion.updateRotation(unit, unit.visual.position, targetPos);

                        // attack
                        if (this._hitTimer < 0) {
                            target!.setHealth(target!.health - damage);
                            this._hitTimer = hitFrequency;
                        } else {
                            this._hitTimer -= time.deltaTime;
                        }
                    }
                }
            }
        } else {
            const newTarget = this._search.find(unit, shootRange, UnitUtils.isEnemy);
            if (newTarget) {
                this._target = newTarget;
            }
        }
    }

    public stopAttack(unit: ICharacterUnit) {
        unit.isIdle = true;
        const isMoving = unit.motionId > 0;
        if (!isMoving) {
            unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
        }
    }
}

