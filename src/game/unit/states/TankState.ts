import { MathUtils, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { time } from "../../../engine/core/Time";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { UnitSearch } from "../UnitSearch";
import { UnitUtils } from "../UnitUtils";
import { GameUtils } from "../../GameUtils";
import { mathUtils } from "../../MathUtils";
import { utils } from "../../../engine/Utils";
import { objects } from "../../../engine/resources/Objects";
import { engineState } from "../../../engine/EngineState";
import { NPCState } from "./NPCState";
import { config } from "../../config/config";
import { unitMotion } from "../UnitMotion";
import { AutoDestroy } from "../../components/AutoDestroy";
import gsap from "gsap";
import { GameMapState } from "../../components/GameMapState";
import { Rocket } from "../../components/Rocket";
import { MeleeAttackState } from "./MeleeAttackState";
import { IVehicleUnit } from "../VehicleUnit";

const shootRange = 15;
const attackDelay = .8;
const attackFrequency = 1;
const { separations } = config.steering;
const { unitScale } = config.game;
const headOffset = unitScale;

enum TankStep {
    Idle,
    Follow,
    Attack
}

const localPos = new Vector3();
const localRotation = new Quaternion();
const matrix = new Matrix4();
const targetPos = new Vector3();
const cannonOffset = new Vector3(0, 0.12, 1.38);

function aimCannon(cannon: Object3D, target: Vector3) {
    const damping = 0.25;
    cannon.parent!.worldToLocal(localPos.copy(target));
    localPos.y = 0; // keep cannon parallel to the ground
    const localMatrix = matrix.lookAt(GameUtils.vec3.zero, localPos.negate(), GameUtils.vec3.up);
    localRotation.setFromRotationMatrix(localMatrix);
    mathUtils.smoothDampQuat(cannon.quaternion, localRotation, damping, time.deltaTime);
}

function resetCannon(cannon: Object3D) {
    const damping = 0.25;
    localRotation.identity();
    mathUtils.smoothDampQuat(cannon.quaternion, localRotation, damping, time.deltaTime);
}

export class TankState extends State<IVehicleUnit> {

    private _search = new UnitSearch();
    private _target: IUnit | null = null;
    private _step = TankStep.Idle;
    private _attackTimer = 0;
    private _cannon!: Object3D;
    private _cannonRotator!: Object3D;

    override enter(unit: IUnit) {
        console.log(`TankState enter`);
        this._cannon = unit.visual.getObjectByName("cannon")!;
        const cannonRoot = utils.createObject(unit.visual, "cannon-root");
        cannonRoot.position.copy(this._cannon.position);
        this._cannonRotator = utils.createObject(unit.visual, "cannon-rotator");
        cannonRoot.add(this._cannonRotator);
        this._cannonRotator.attach(this._cannon);
    }

    override exit(_unit: IUnit) {
        console.log(`TankState exit`);
    }

    override update(unit: IVehicleUnit) {

        const target = this._target;
        if (!target) {
            resetCannon(this._cannonRotator);

            const newTarget = this._search.find(unit, shootRange, other => {
                if (UnitUtils.isEnemy(unit)) {
                    return !UnitUtils.isEnemy(other);
                } else {
                    return UnitUtils.isEnemy(other);
                }
            });
            if (newTarget) {
                this._target = newTarget;
            }
            return;
        }

        if (!target.isAlive || (this._step === TankStep.Attack && UnitUtils.isOutOfRange(unit, target, shootRange))) {
            this.stopAttack(unit);
            this._search.reset();
            return;
        }

        switch (this._step) {
            case TankStep.Idle: {
                resetCannon(this._cannonRotator);
                const isMoving = unit.motionId > 0;
                if (!isMoving) {
                    this._step = TankStep.Attack;
                    this._attackTimer = attackDelay;
                    unit.isIdle = false;
                }
            }
                break;

            case TankStep.Follow: {
                if (!UnitUtils.isOutOfRange(unit, target!, shootRange - 1)) {
                    if (unit.motionId > 0) {
                        unitMotion.endMotion(unit);
                    }
                    this._step = TankStep.Attack;
                    this._attackTimer = attackDelay;
                    unit.isIdle = false;
                }
            }
                break;

            case TankStep.Attack: {
                aimCannon(this._cannonRotator, target.visual.position);

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
                    if (UnitUtils.isWorker(target)) {
                        const worker = target as ICharacterUnit;
                        if (worker.isIdle && worker.motionId === 0 && !worker.resource) {
                            const meleeState = worker.fsm.switchState(MeleeAttackState);                            
                            unitMotion.moveUnit(worker, unit.coords.mapCoords);
                            meleeState.attackTarget(unit);
                        }
                    }
                } else {
                    const enemy = target as ICharacterUnit;
                    if (enemy.isIdle && enemy.motionId === 0) {
                        const npcState = enemy!.fsm.getState(NPCState);
                        console.assert(npcState);
                        npcState?.attackTarget(enemy, unit);
                    }
                }                

                const _rocket = objects.loadImmediate("/prefabs/rocket.json")!;
                const rocket = utils.instantiate(_rocket);

                const rocketComponent = utils.getComponent(Rocket, rocket)!;
                rocketComponent.state.shooter = unit;

                const { projectiles } = GameMapState.instance.layers;
                rocket.position.copy(cannonOffset);
                this._cannon.add(rocket);
                rocket.updateMatrixWorld();
                projectiles.attach(rocket);
                targetPos.copy(target.visual.position).addScaledVector(target.visual.up, headOffset);
                const toTarget = targetPos.sub(rocket.position).normalize();
                rocket.quaternion.setFromUnitVectors(GameUtils.vec3.forward, toTarget);

                const _explosion = objects.loadImmediate("/prefabs/tank-shot.json")!;
                const explosion = utils.instantiate(_explosion);
                explosion.position.set(0, .12, 1.48);
                explosion.scale.setScalar(.6);
                this._cannon.add(explosion);
                explosion.updateMatrixWorld();
                unit.coords.sector.layers.fx.attach(explosion);
                engineState.setComponent(explosion, new AutoDestroy({ delay: 1.5 }));

                // recoil
                gsap.to(this._cannon.position, {
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

    public stopAttack(unit: IUnit) {
        this._step = TankStep.Idle;
        this._target = null;
        unit.isIdle = true;
    }

    public followTarget(target: IUnit) {
        this._target = target;
        this._step = TankStep.Follow;
    }
}

