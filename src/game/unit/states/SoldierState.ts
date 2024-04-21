import { MathUtils, Quaternion, Vector3 } from "three";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../CharacterUnit";
import { IUnit } from "../Unit";
import { unitAnimation } from "../UnitAnimation";
import { UnitMotion } from "../UnitMotion";
import { UnitSearch } from "../UnitSearch";
import { GameUtils } from "../../GameUtils";

enum SoldierStep {
    Idle,    
    Attack
}

const shootRadius = 4;
const targetPos = new Vector3();
const targetRotation = new Quaternion().setFromAxisAngle(GameUtils.vec3.up, MathUtils.degToRad(12));

export class SoldierState extends State<ICharacterUnit> {

    private _step!: SoldierStep;
    private _search = new UnitSearch();
    private _target: IUnit | null = null;

    override enter(_unit: IUnit) {      
        this._step = SoldierStep.Idle;
    }
    
    override exit(unit: IUnit) {
        unit.isIdle = true;
    }

    override update(unit: ICharacterUnit) {
        switch (this._step) {
            case SoldierStep.Idle: {
                const isMoving = unit.motionId > 0;
                if (!isMoving) {
                    const target = this._search.find(unit, shootRadius, other => {
                        const isEnemy = other.type.startsWith("enemy");
                        return isEnemy;
                    });
                    if (target) {
                        unitAnimation.setAnimation(unit, "shoot", { transitionDuration: .3, scheduleCommonAnim: true });
                        this._step = SoldierStep.Attack;
                        this._target = target;
                        unit.isIdle = false;
                    }
                } else {
                    this._search.reset();
                }
                break;
            }

            case SoldierStep.Attack: {
                targetPos.subVectors(this._target!.mesh.position, unit.mesh.position);
                targetPos.applyQuaternion(targetRotation);
                targetPos.add(unit.mesh.position);
                UnitMotion.updateRotation(unit, unit.mesh.position, targetPos);
                const dx = Math.abs(this._target!.coords.mapCoords.x - unit.coords.mapCoords.x);
                const dy = Math.abs(this._target!.coords.mapCoords.y - unit.coords.mapCoords.y);
                const outOfRange = dx > shootRadius || dy > shootRadius;
                if (outOfRange || !this._target?.isAlive) {
                    this.stopAttack(unit);
                    const isMoving = unit.motionId > 0;
                    if (!isMoving) {
                        unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
                    }
                }
                break;
            }
        }
    }

    public stopAttack(unit: IUnit) {
        this._step = SoldierStep.Idle;
        unit.isIdle = true;
    }
}

