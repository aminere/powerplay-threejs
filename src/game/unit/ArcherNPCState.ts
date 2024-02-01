import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";
import { npcUtils } from "./NPCUtils";
import { LoopOnce, Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Vector3 } from "three";
import { engine } from "../../engine/Engine";
import gsap from "gsap";
import { pools } from "../../engine/Pools";
import { flowField } from "../pathfinding/Flowfield";
import { time } from "../../engine/Time";
import { utils } from "../../engine/Utils";

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

    override update(unit: IUnit): void {

        switch (this._step) {
            case NpcStep.Idle: {
                this._idleTimer -= time.deltaTime;
                if (this._idleTimer > 0) {                    
                    break;
                }
                const target = npcUtils.findTarget(unit, vision);
                if (target) {
                    target.attackers.push(unit);
                    this._target = target;                    
                    this.attack(unit);
                }
            }
                break;

            case NpcStep.Follow: {
                const target = this._target!;
                if (target.isAlive) {
                    if (!target.coords.mapCoords.equals(unit.targetCell.mapCoords)) {
                        this.follow(unit, target);
                    } else {
                        const dist = target.obj.position.distanceTo(unit.obj.position);
                        if (dist < vision) {
                            unit.isMoving = false;
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
                    const dist = target.obj.position.distanceTo(unit.obj.position);
                    const inRange = dist < vision + 1;
                    if (inRange) {
                        unitUtils.updateRotation(unit, unit.obj.position, target.obj.position);

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
                                    arrow.obj.position.applyMatrix4(unit.obj.matrixWorld);                                    
                                    engine.scene!.add(arrow.obj);
                                    arrow.progress = 0;
                                    arrow.startPos.copy(arrow.obj.position);
                                    arrow.tween = gsap.to(arrow, {
                                        progress: 1,
                                        duration: arrow.startPos.distanceTo(target.obj.position) / 8,
                                        onUpdate: () => {
                                            targetPos.copy(target.obj.position).setY(target.obj.position.y + 1.4);
                                            arrow!.obj.position.lerpVectors(arrow!.startPos, targetPos, arrow!.progress);
                                        },
                                        onComplete: () => {
                                            arrow!.tween = null;
                                            arrow!.obj.removeFromParent();
                                            target.health -= 0.5;
                                            if (this._target && !this._target.isAlive) {
                                                this.goToIdle(unit);
                                            }
                                        }
                                    });

                                    unitUtils.setAnimation(unit, "arrow-shoot", { 
                                        transitionDuration: .1,
                                        destAnimLoopMode: "Once"
                                    });
                                } else {
                                    if (unit.animation.action.loop !== LoopOnce) {
                                        debugger;
                                        console.assert(false);
                                        this.attack(unit);
                                    }
                                }
                            }
                            break;

                            case AttackStep.Shoot: {
                                if (!unit.animation.action.isRunning()) {    
                                    this._attackStep = AttackStep.Draw;
                                    unitUtils.setAnimation(unit, "arrow-draw", {
                                        transitionDuration: .1, 
                                        destAnimLoopMode: "Once" 
                                    });
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

    private follow(unit: IUnit, target: IUnit) {
        const [sectorCoords, localCoords] = pools.vec2.get(2);
        if (flowField.compute(target.coords.mapCoords, sectorCoords, localCoords)) {
            switch (this._step) {
                case NpcStep.Attack: {
                    unitUtils.moveTo(unit, target.coords.mapCoords, false);
                    unitUtils.setAnimation(unit, "run", {
                        transitionDuration: .3,
                        scheduleCommonAnim: true
                    });
                }
                    break;

                default:
                    unitUtils.moveTo(unit, target.coords.mapCoords);
                    break;
            }
        }

        this._step = NpcStep.Follow;
    }

    private goToIdle(unit: IUnit) {
        const target = this._target!;
        const transitionDuration = .3;
        unitUtils.setAnimation(unit, "idle", {
            transitionDuration,
            scheduleCommonAnim: true
        });
        const index = target.attackers.indexOf(unit);
        if (index !== -1) {
            utils.fastDelete(target.attackers, index);
        }
        this._target = null;
        unit.isMoving = false;
        this._step = NpcStep.Idle;
        this._idleTimer = transitionDuration; 
    }

    private attack(unit: IUnit) {
        this._attackStep = AttackStep.Draw;
        this._step = NpcStep.Attack;
        unitUtils.setAnimation(unit, "arrow-draw", { transitionDuration: 1, destAnimLoopMode: "Once" });
    }
}

