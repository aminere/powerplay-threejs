import { State } from "../../fsm/StateMachine";
import { IUnit } from "../Unit";
import { LoopOnce, Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Vector3 } from "three";
import { engine } from "../../../engine/Engine";
import gsap from "gsap";
import { time } from "../../../engine/core/Time";
import { unitAnimation } from "../UnitAnimation";
import { unitMotion } from "../UnitMotion";
import { ICharacterUnit } from "../CharacterUnit";

enum NpcStep {
    Idle,
    Follow,
    Attack
}

enum AttackStep {
    Draw,
    Shoot
}

const vision = 5;

interface IArrow {
    obj: Object3D;    
    tween: gsap.core.Tween | null;
    progress: number;
    startPos: Vector3;
}

const targetPos = new Vector3();
export class ArcherNPCState extends State<IUnit> {

    private _step = NpcStep.Idle;
    private _attackStep = AttackStep.Draw;
    private _target: IUnit | null = null;
    private _idleTimer = -1;
    private _arrows = new Array<IArrow>();

    override update(unit: ICharacterUnit): void {

        switch (this._step) {
            case NpcStep.Idle: {
                this._idleTimer -= time.deltaTime;
                if (this._idleTimer > 0) {                    
                    break;
                }
                // const target = npcUtils.findTarget(unit, vision);
                // if (target) {
                //     target.attackers.push(unit);
                //     this._target = target;                    
                //     this.attack(unit);
                // }
            }
                break;

            case NpcStep.Follow: {
                const target = this._target!;                

                if (target.isAlive) {
                    if (!target.coords.mapCoords.equals(unit.targetCell.mapCoords)) {
                        this.follow(unit, target);
                    } else {
                        const dist = target.visual.position.distanceTo(unit.visual.position);
                        if (dist < vision) {
                            if (unit.motionId > 0) {
                                unitMotion.endMotion(unit);    
                            }
                            this.attack(unit);
                        }
                    }
                } else {
                    this.goToIdle(unit);
                }
            }
                break;

            case NpcStep.Attack: {
                const target = this._target!;
                if (target.isAlive) {
                    const dist = target.visual.position.distanceTo(unit.visual.position);
                    const inRange = dist < vision + 1;
                    if (inRange) {
                        unitMotion.updateRotation(unit, unit.visual.position, target.visual.position);

                        switch (this._attackStep) {
                            case AttackStep.Draw: {                               
                                if (!unit.animation.action.isRunning()) {
                                    this._attackStep = AttackStep.Shoot;                                    

                                    let arrow = this._arrows.find(a => a.tween === null);
                                    if (!arrow) {
                                        const arrowMesh = new Mesh(new SphereGeometry(.05), new MeshBasicMaterial({ color: 0x000000 }));
                                        arrow = { obj: arrowMesh, tween: null, progress: 0, startPos: new Vector3() };
                                        this._arrows.push(arrow);
                                    }
                                    
                                    const hand = unit.skeleton?.skeleton.getBoneByName("HandL")!;
                                    hand?.getWorldPosition(arrow.obj.position);
                                    arrow.obj.position.applyMatrix4(unit.visual.matrixWorld);                                    
                                    engine.scene!.add(arrow.obj);
                                    arrow.progress = 0;
                                    arrow.startPos.copy(arrow.obj.position);
                                    arrow.tween = gsap.to(arrow, {
                                        progress: 1,
                                        duration: arrow.startPos.distanceTo(target.visual.position) / 8,
                                        onUpdate: () => {
                                            targetPos.copy(target.visual.position).setY(target.visual.position.y + 1.4);
                                            arrow!.obj.position.lerpVectors(arrow!.startPos, targetPos, arrow!.progress);
                                        },
                                        onComplete: () => {
                                            arrow!.tween = null;
                                            arrow!.obj.removeFromParent();
                                            if (this._target?.isAlive) {
                                                this._target.setHitpoints(this._target.hitpoints - 0.5);
                                            }
                                        }
                                    });                                    

                                    unitAnimation.setAnimation(unit, "arrow-shoot", { 
                                        transitionDuration: .1,
                                        destAnimLoopMode: "Once"
                                    });
                                } else {
                                    console.assert(unit.animation.action.loop === LoopOnce);
                                }
                            }
                            break;

                            case AttackStep.Shoot: {
                                if (!unit.animation.action.isRunning()) {    
                                    this._attackStep = AttackStep.Draw;
                                    unitAnimation.setAnimation(unit, "arrow-draw", {
                                        transitionDuration: .1, 
                                        destAnimLoopMode: "Once" 
                                    });                                    
                                } else {
                                    console.assert(unit.animation.action.loop === LoopOnce);
                                }
                            }
                            break;
                        }                        

                    } else {
                        this.follow(unit, target);
                    }
                } else {
                    this.goToIdle(unit);
                }
            }
        }
    }

    private follow(_unit: IUnit, _target: IUnit) {
        console.assert(false, "Not implemented");
        // if (flowField.compute(target.coords.mapCoords)) {
        //     switch (this._step) {
        //         case NpcStep.Attack: {
        //             unitUtils.moveTo(unit, target.coords.mapCoords, false);
        //             unitUtils.setAnimation(unit, "run", {
        //                 transitionDuration: .3,
        //                 scheduleCommonAnim: true
        //             });
        //         }
        //             break;

        //         default:
        //             unitUtils.moveTo(unit, target.coords.mapCoords);
        //             break;
        //     }
        // }

        // this._step = NpcStep.Follow;
    }

    private goToIdle(unit: ICharacterUnit) {
        const transitionDuration = .3;
        if (unit.motionId > 0) {
            unitMotion.endMotion(unit);    
        }
        unitAnimation.setAnimation(unit, "idle", {
            transitionDuration,
            scheduleCommonAnim: true
        });
        
        this._target = null;
        this._step = NpcStep.Idle;
        this._idleTimer = transitionDuration; 
    }

    private attack(unit: ICharacterUnit) {
        this._attackStep = AttackStep.Draw;
        this._step = NpcStep.Attack;
        unitAnimation.setAnimation(unit, "arrow-draw", { transitionDuration: 1, destAnimLoopMode: "Once" });        
    }
}

