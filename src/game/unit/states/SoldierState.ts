import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { unitAnimation } from "../UnitAnimation";
import { UnitSearch } from "../UnitSearch";
import { UnitUtils } from "../UnitUtils";
import { config } from "../../config/config";
import { Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Vector3 } from "three";
import { GameMapState } from "../../components/GameMapState";
import { NPCState } from "./NPCState";
import gsap from "gsap";
import { objects } from "../../../engine/resources/Objects";
import { utils } from "../../../engine/Utils";
import { InstancedParticles } from "../../../engine/components/particles/InstancedParticles";

const targetPos = new Vector3();

interface IRocket {
    obj: Object3D;
    tween: gsap.core.Tween | null;
    progress: number;
    startPos: Vector3;
}

export class SoldierState extends State<ICharacterUnit> {

    private _search = new UnitSearch();
    private _target: IUnit | null = null;
    private _rocket: IRocket | null = null;
    private _loopConsumed = false;

    override enter(_unit: IUnit) {
        console.log(`SoldierState enter`);
    }
    override exit(unit: IUnit) {
        console.log(`SoldierState exit`);
        unit.isIdle = true;

        if (this._rocket) {
            this._rocket.tween?.kill();
            this._rocket.obj.removeFromParent();
            this._rocket = null;
        }
    }

    override update(unit: ICharacterUnit) {

        const weaponType = unit.resource?.type! as "ak47" | "rpg";
        const {
            damage,
            range,
            anim,
            animSpeed,
            shootEventTime
        } = config.combat[weaponType];

        const target = this._target;
        if (target) {
            if (!target.isAlive || UnitUtils.isOutOfRange(unit, target, range)) {
                this.stopAttack(unit);
                this._search.reset();
                this._target = null;
            } else {
                const isMoving = unit.motionId > 0;
                if (!isMoving) {
                    if (unit.isIdle) {
                        unit.isIdle = false;
                        unitAnimation.setAnimation(unit, anim, {
                            transitionDuration: .3,
                            scheduleCommonAnim: weaponType === "ak47",
                            destAnimSpeed: animSpeed,
                        });

                    } else {
                        UnitUtils.rotateToTarget(unit, target!);

                        if (!this._loopConsumed) {
                            if (unit.animation.action.time > shootEventTime) {
                                this._loopConsumed = true;

                                // shoot
                                // const enemy = target as ICharacterUnit;
                                // if (enemy.isIdle && enemy.motionId === 0) {
                                //     const npcState = enemy!.fsm.getState(NPCState);
                                //     console.assert(npcState);
                                //     npcState?.attackTarget(enemy, unit);
                                // }

                                switch (weaponType) {
                                    case "rpg": {
                                        if (!this._rocket) {
                                            const _rocketMesh = objects.loadImmediate("/prefabs/rocket.json")!;
                                            const rocketMesh = utils.instantiate(_rocketMesh);
                                            const rocket: IRocket = { obj: rocketMesh, tween: null, progress: 0, startPos: new Vector3() };
                                            this._rocket = rocket;
                                            const { projectiles } = GameMapState.instance.layers;
                                            projectiles.add(rocketMesh);
                                        } else {
                                            this._rocket.progress = 0;
                                            this._rocket!.obj.visible = true;
                                            const particlesOwner = this._rocket!.obj.getObjectByName("Particles")!;
                                            const particles = utils.getComponent(InstancedParticles, particlesOwner)!;
                                            particles.state.isEmitting = true;
                                        }
                                        const rocketSlot = unit.resource!.visual.getObjectByName("rocket") as Mesh;
                                        rocketSlot.getWorldPosition(this._rocket.startPos);
                                        this._rocket.obj.position.copy(this._rocket.startPos);

                                        this._rocket.tween?.kill();
                                        this._rocket.tween = gsap.to(this._rocket, {
                                            progress: 1,
                                            duration: this._rocket.startPos.distanceTo(target.visual.position) / 8,
                                            onUpdate: () => {
                                                targetPos.copy(target.visual.position).setY(target.visual.position.y + 1.4);
                                                this._rocket?.obj.position.lerpVectors(this._rocket.startPos, targetPos, this._rocket.progress);
                                            },
                                            onComplete: () => {
                                                this._rocket!.tween = null;
                                                this._rocket!.obj.visible = false;
                                                const particlesOwner = this._rocket!.obj.getObjectByName("Particles")!;
                                                const particles = utils.getComponent(InstancedParticles, particlesOwner)!;
                                                particles.state.isEmitting = false;
                                                if (target.isAlive) {
                                                    target!.setHitpoints(target!.hitpoints - damage);
                                                }
                                            }
                                        });
                                    }
                                        break;
                                }
                            }
                        } else {
                            if (unit.animation.action.time < shootEventTime) {
                                this._loopConsumed = false;
                            }
                        }
                    }
                }
            }
        } else {
            const newTarget = this._search.find(unit, range, UnitUtils.isEnemy);
            if (newTarget) {
                this._target = newTarget;
            }
        }
    }

    public attackTarget(target: IUnit) {
        this._target = target;
    }

    public stopAttack(unit: ICharacterUnit) {
        unit.isIdle = true;
        const isMoving = unit.motionId > 0;
        if (!isMoving) {
            unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
        }
    }
}

