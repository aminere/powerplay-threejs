import { MathUtils, Matrix4, Object3D, Quaternion, Vector2, Vector3 } from "three";
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
import { unitConfig } from "../../config/UnitConfig";
import gsap from "gsap";
import { NPCState } from "./NPCState";
import { config } from "../../config/config";
import { unitMotion } from "../UnitMotion";

const shootRange = 10;
const splashRadius = 1;
const attackDelay = .8;
const attackFrequency = 1;
const { separations } = config.steering;

enum TankStep {
    Idle,
    Follow,
    Attack
}

const localPos = new Vector3();
const localRotation = new Quaternion();
const matrix = new Matrix4();
const cellCoords = new Vector2();
const sectorCoords = new Vector2();
const cannonOffset = new Vector3(0, 0.12, 1.48);
const smokePosition = new Vector3();

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

export class TankState extends State<ICharacterUnit> {

    private _search = new UnitSearch();
    private _target: IUnit | null = null;
    private _step = TankStep.Idle;
    private _attackTimer = 0;
    private _cannon!: Object3D;
    private _cannonRotator!: Object3D;
    private _muzzleFlash!: Object3D;
    private _tweens: gsap.core.Tween[] = [];

    override enter(unit: IUnit) {
        console.log(`TankState enter`);
        this._cannon = unit.visual.getObjectByName("cannon")!;
        const cannonRoot = utils.createObject(unit.visual, "cannon-root");
        cannonRoot.position.copy(this._cannon.position);
        this._cannonRotator = utils.createObject(unit.visual, "cannon-rotator");
        cannonRoot.add(this._cannonRotator);
        this._cannonRotator.attach(this._cannon);

        const flash = objects.loadImmediate("/prefabs/muzzle-flash.json")!;
        this._muzzleFlash = flash.clone();
        this._muzzleFlash.quaternion.identity();
        this._muzzleFlash.position.copy(cannonOffset);
        this._cannon.add(this._muzzleFlash);
        this._muzzleFlash.visible = false;
    }
    override exit(_unit: IUnit) {
        console.log(`TankState exit`);
    }

    override update(unit: ICharacterUnit) {

        const target = this._target;
        if (target) {
            if (!target.isAlive || (this._step === TankStep.Attack && UnitUtils.isOutOfRange(unit, target, shootRange))) {
                this.stopAttack();
                this._search.reset();
            } else {
                switch (this._step) {
                    case TankStep.Idle: {
                        resetCannon(this._cannonRotator);
                        const isMoving = unit.motionId > 0;
                        if (!isMoving) {
                            this._step = TankStep.Attack;
                            this._attackTimer = attackDelay;
                        }
                    }
                        break;

                    case TankStep.Follow: {
                        if (!UnitUtils.isOutOfRange(unit, target!, shootRange - 1)) {
                            unitMotion.endMotion(unit);
                            this._step = TankStep.Attack;
                            this._attackTimer = attackDelay;
                        }
                    }
                    break;

                    case TankStep.Attack: {
                        aimCannon(this._cannonRotator, target.visual.position);

                        const separation = separations[unit.type] + separations[target!.type];
                        const tooClose = unit.visual.position.distanceTo(target!.visual.position) < separation * 1.5;
                        if (tooClose) {                            
                            // can't shoot if too close

                        } else {
                            if (this._attackTimer < 0) {
                                const { mapCoords } = target.coords;

                                let unitCount = 0;
                                smokePosition.set(0, 0, 0);
                                const damage = unitConfig[unit.type].damage;
                                for (let y = mapCoords.y - splashRadius; y <= mapCoords.y + splashRadius; y++) {
                                    for (let x = mapCoords.x - splashRadius; x <= mapCoords.x + splashRadius; x++) {
                                        cellCoords.set(x, y);
                                        const units = GameUtils.getCell(cellCoords)?.units;
                                        if (units) {
                                            for (const enemy of units) {
                                                if (UnitUtils.isEnemy(enemy)) {
                                                    enemy.setHitpoints(enemy!.hitpoints - damage);
                                                    smokePosition.add(enemy.visual.position);
                                                    unitCount++;

                                                    if (enemy.isAlive) {
                                                        const _enemy = enemy as ICharacterUnit;
                                                        if (enemy.isIdle && enemy.motionId === 0) {
                                                            const npcState = enemy!.fsm.getState(NPCState);
                                                            console.assert(npcState);
                                                            npcState?.attackTarget(_enemy, unit);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                // spawn smoke
                                smokePosition.divideScalar(unitCount);
                                smokePosition.x += MathUtils.randFloat(-1, 1);
                                smokePosition.z += MathUtils.randFloat(-1, 1);
                                const _smoke = objects.loadImmediate("/prefabs/smoke.json")!;
                                const smoke = utils.instantiate(_smoke);
                                smoke.position.copy(smokePosition);
                                smoke.updateMatrixWorld();
                                GameUtils.worldToMap(smokePosition, cellCoords);
                                GameUtils.getCell(cellCoords, sectorCoords);
                                const smokeSector = GameUtils.getSector(sectorCoords)!;
                                smokeSector.layers.fx.attach(smoke);
                                const smokeTween = gsap.delayedCall(2, () => {
                                    engineState.removeObject(smoke);
                                    this._tweens.splice(0, 1);
                                });
                                this._tweens.push(smokeTween);

                                this._muzzleFlash.visible = true;
                                setTimeout(() => this._muzzleFlash.visible = false, MathUtils.randInt(50, 100));

                                const _explosion = objects.loadImmediate("/prefabs/explosion.json")!;
                                const explosion = utils.instantiate(_explosion);
                                explosion.position.set(0, .12, 1.48);
                                explosion.scale.setScalar(.6);
                                this._cannon.add(explosion);
                                explosion.updateMatrixWorld();
                                const sector = unit.coords.sector;
                                sector.layers.fx.attach(explosion);

                                // recoil
                                gsap.to(this._cannon.position, {
                                    duration: MathUtils.randFloat(.05, .08),
                                    z: `-=.15`,
                                    yoyo: true,
                                    repeat: 3,
                                    ease: "bounce.inOut"
                                });

                                const tween = gsap.delayedCall(2, () => {
                                    engineState.removeObject(explosion);
                                    this._tweens.splice(0, 1);
                                });
                                this._tweens.push(tween);
                                this._attackTimer = attackFrequency;
                            } else {
                                this._attackTimer -= time.deltaTime;
                            }
                        }
                    }
                        break;
                }
            }
        } else {
            resetCannon(this._cannonRotator);
            const newTarget = this._search.find(unit, shootRange, UnitUtils.isEnemy);
            if (newTarget) {
                this._target = newTarget;
            }
        }
    }

    public stopAttack() {
        this._step = TankStep.Idle;
        this._target = null;
    }

    public followTarget(target: IUnit) {
        this._target = target;
        this._step = TankStep.Follow;
    }

    override dispose() {
        for (const tween of this._tweens) {
            tween.kill();
        }
        this._tweens.length = 0;
    }
}

