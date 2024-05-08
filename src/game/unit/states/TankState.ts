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
import { serialization } from "../../../engine/serialization/Serialization";
import { Component } from "../../../engine/ecs/Component";
import { ComponentProps } from "../../../engine/ecs/ComponentProps";
import { engineState } from "../../../engine/EngineState";

const shootRange = 10;
const damage = .3;
const splashRadius = 1;
const attackDelay = .5;
const attackFrequency = 1;

enum TankStep {
    Idle,
    Attack
}

const localPos = new Vector3();
const localRotation = new Quaternion();
const matrix = new Matrix4();
const cellCoords = new Vector2();
const cannonOffset = new Vector3(0, 0.09, 1.8);

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

    override enter(unit: IUnit) {
        console.log(`TankState enter`);
        this._cannon = unit.visual.getObjectByName("cannon")!;
        const cannonRoot = utils.createObject(unit.visual, "cannon-root");
        cannonRoot.position.copy(this._cannon.position);
        cannonRoot.attach(this._cannon);

        objects.load("/prefabs/muzzle-flash.json").then(_flash => {
            const flash = _flash.clone();
            flash.quaternion.identity();
            flash.position.copy(cannonOffset);
            this._cannon.add(flash);
            flash.visible = false;
        });
    }    
    override exit(_unit: IUnit) {
        console.log(`TankState exit`);
    }

    override update(unit: ICharacterUnit) {

        const target = this._target;
        if (target) {
            if (!target.isAlive || UnitUtils.isOutOfRange(unit, target, shootRange)) {
                this.stopAttack();
                this._search.reset();
                this._target = null;
            } else {
                switch (this._step) {
                    case TankStep.Idle: {
                        resetCannon(this._cannon);
                        const isMoving = unit.motionId > 0;
                        if (!isMoving) {
                            this._step = TankStep.Attack;
                            this._attackTimer = attackDelay;
                        }
                    }
                    break;
        
                    case TankStep.Attack: {
                        aimCannon(this._cannon, target.visual.position);
                        if (this._attackTimer < 0) {
                            const { mapCoords } = target.coords;
                            for (let y = mapCoords.y - splashRadius; y <= mapCoords.y + splashRadius; y++) {
                                for (let x = mapCoords.x - splashRadius; x <= mapCoords.x + splashRadius; x++) {
                                    cellCoords.set(x, y);
                                    const units = GameUtils.getCell(cellCoords)?.units;
                                    if (units) {
                                        for (const unit of units) {
                                            if (UnitUtils.isEnemy(unit)) {
                                                unit.setHitpoints(unit!.hitpoints - damage);
                                            }
                                        }
                                    }
                                }
                            }

                            const muzzleFlash = this._cannon.getObjectByName("muzzle-flash")!;
                            muzzleFlash.visible = true;
                            setTimeout(() => muzzleFlash.visible = false, MathUtils.randInt(50, 100));

                            objects.load("/prefabs/tank-shot.json").then(_explosion => {
                                const explosion = _explosion.clone();
                                explosion.traverse(o => {
                                    serialization.postDeserializeObject(o);
                                    serialization.postDeserializeComponents(o);
                                    const components = o.userData.components;
                                    if (components) {
                                        for (const component of Object.values(components)) {
                                            const instance = component as Component<ComponentProps>;
                                            instance.start(o);
                                            engineState.registerComponent(instance, o);
                                        }
                                    }
                                });
                                this._cannon.add(explosion);
                                setTimeout(() => engineState.removeObject(explosion), 2000);
                            });

                            this._attackTimer = attackFrequency;
                        } else {
                            this._attackTimer -= time.deltaTime;
                        }
                    }
                    break;
                }
            }
        } else {
            resetCannon(this._cannon);
            const newTarget = this._search.find(unit, shootRange, UnitUtils.isEnemy);
            if (newTarget) {
                this._target = newTarget;
            }
        }        
    }

    public stopAttack() {
        this._step = TankStep.Idle;
    }
}

