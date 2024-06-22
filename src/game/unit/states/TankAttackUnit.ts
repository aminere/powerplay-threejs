import { MathUtils, Vector3 } from "three";
import { unitConfig } from "../../config/UnitConfig";
import { config } from "../../config/config";
import { State } from "../../fsm/StateMachine";
import { IUnit } from "../IUnit";
import { ITankUnit } from "../TankUnit";
import { unitMotion } from "../UnitMotion";
import { UnitUtils } from "../UnitUtils";
import { IVehicleUnit } from "../VehicleUnit";
import { IdleTank } from "./IdleTank";
import gsap from "gsap";
import { time } from "../../../engine/core/Time";
import { ICharacterUnit } from "../ICharacterUnit";
import { MeleeAttackState } from "./MeleeAttackState";
import { AttackUnit } from "./AttackUnit";
import { objects } from "../../../engine/resources/Objects";
import { utils } from "../../../engine/Utils";
import { Rocket } from "../../components/Rocket";
import { GameMapState } from "../../components/GameMapState";
import { GameUtils } from "../../GameUtils";
import { engineState } from "../../../engine/EngineState";
import { AutoDestroy } from "../../components/AutoDestroy";

enum AttackStep {
    Idle,
    Approach,
    Attack
}

const attackDelay = .8;
const attackFrequency = 1;
const { separations } = config.steering;
const targetPos = new Vector3();
const cannonOffset = new Vector3(0, 0.12, 1.38);
const { unitScale } = config.game;
const headOffset = unitScale;

export class TankAttackUnit extends State<ITankUnit> {

    private _target: IUnit | null = null;
    private _step = AttackStep.Idle;
    private _attackTimer = 0;

    override update(unit: ITankUnit) {
        const target = this._target;
        if (!target || !target.isAlive) {
            if (unit.motionId > 0) {
                unitMotion.endMotion(unit);
            }
            unit.isIdle = true;
            this._step = AttackStep.Idle;
            this._target = null;
            unit.fsm.switchState(IdleTank);
            return;
        }

        const { range } = unitConfig[unit.type];
        switch (this._step) {
            case AttackStep.Idle: {
                if (UnitUtils.isOutOfRange(unit, target, range.attack)) {
                    unitMotion.moveUnit(unit, target.coords.mapCoords);
                    this._step = AttackStep.Approach;
                } else {
                    this.startAttack(unit);
                }
            }
                break;

            case AttackStep.Approach: {
                if (!UnitUtils.isOutOfRange(unit, target!, range.attack - 1)) {
                    if (unit.motionId > 0) {
                        unitMotion.endMotion(unit);
                    }
                    this.startAttack(unit);
                }
            }
                break;

            case AttackStep.Attack: {
                unit.aimCannon(target.visual.position);

                const separation = separations[unit.type] + separations[target!.type];
                const tooClose = unit.visual.position.distanceTo(target!.visual.position) < separation * 1.5;
                if (tooClose) {
                    // can't shoot if too close
                    break;
                }

                if (this._attackTimer > 0) {
                    this._attackTimer -= time.deltaTime;
                    break;
                }

                // get the attacked unit to defend itself
                if (UnitUtils.isEnemy(unit)) {
                    switch (target.type) {
                        case "worker": {
                            const worker = target as ICharacterUnit;
                            if (worker.isIdle && worker.motionId === 0 && !worker.resource) {
                                unitMotion.moveUnit(worker, unit.coords.mapCoords);
                                const meleeState = worker.fsm.getState(MeleeAttackState) ?? worker.fsm.switchState(MeleeAttackState);
                                meleeState.setTarget(unit);
                            }
                        }
                            break;

                        case "tank": {
                            const attack = target.fsm.getState(TankAttackUnit) ?? target.fsm.switchState(TankAttackUnit);
                            attack.setTarget(unit);
                        }
                    }
                } else {
                    switch (target.type) {
                        case "enemy-tank": {
                            const attack = target.fsm.getState(TankAttackUnit) ?? target.fsm.switchState(TankAttackUnit);
                            attack.setTarget(unit);
                        }
                            break;

                        case "enemy-melee": {
                            const enemy = target as ICharacterUnit;
                            if (enemy.isIdle && enemy.motionId === 0) {
                                const attack = enemy!.fsm.getState(AttackUnit) ?? enemy!.fsm.switchState(AttackUnit);
                                attack.setTarget(unit);
                            }
                        }
                            break;
                    }
                }

                const _rocket = objects.loadImmediate("/prefabs/rocket.json")!;
                const rocket = utils.instantiate(_rocket);

                const rocketComponent = utils.getComponent(Rocket, rocket)!;
                rocketComponent.state.shooter = unit;
                rocketComponent.state.damage = unitConfig[unit.type].damage;

                const { projectiles } = GameMapState.instance.layers;
                rocket.position.copy(cannonOffset);
                unit.cannon.add(rocket);
                projectiles.attach(rocket);
                targetPos.copy(target.visual.position).addScaledVector(target.visual.up, headOffset);
                const toTarget = targetPos.sub(rocket.position).normalize();
                rocket.quaternion.setFromUnitVectors(GameUtils.vec3.forward, toTarget);

                const _explosion = objects.loadImmediate("/prefabs/tank-shot.json")!;
                const explosion = utils.instantiate(_explosion);
                explosion.position.copy(cannonOffset);
                explosion.scale.setScalar(.4);
                unit.cannon.add(explosion);
                unit.coords.sector.layers.fx.attach(explosion);
                engineState.setComponent(explosion, new AutoDestroy({ delay: 1.5 }));

                // recoil
                gsap.to(unit.cannon.position, {
                    duration: MathUtils.randFloat(.05, .08),
                    z: `-=.15`,
                    yoyo: true,
                    repeat: 3,
                    ease: "bounce.inOut"
                });

                this._attackTimer = attackFrequency;
            }
                break;
        }
    }

    public setTarget(target: IUnit) {
        if (this._target?.isAlive) {
            return;
        }
        this._target = target;
    }

    public startAttack(unit: IVehicleUnit) {
        if (this._step === AttackStep.Attack) {
            console.assert(false);
            return;
        }
        if (unit.motionId > 0) {
            unitMotion.endMotion(unit);
        }
        this._step = AttackStep.Attack;
        this._attackTimer = attackDelay;
        unit.isIdle = false;
    }
}

