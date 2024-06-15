import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { unitAnimation } from "../UnitAnimation";
import { UnitSearch } from "../UnitSearch";
import { UnitUtils } from "../UnitUtils";
import { config } from "../../config/config";
import { MathUtils, Mesh, Vector3 } from "three";
import { GameMapState } from "../../components/GameMapState";
import { objects } from "../../../engine/resources/Objects";
import { utils } from "../../../engine/Utils";
import { GameUtils } from "../../GameUtils";
import { NPCState } from "./NPCState";
import { Rocket } from "../../components/Rocket";

const { unitScale } = config.game;
const headOffset = unitScale;
const targetPos = new Vector3();

export class SoldierState extends State<ICharacterUnit> {

    private _search = new UnitSearch();
    private _target: IUnit | null = null;
    private _loopConsumed = false;

    override enter(_unit: IUnit) {
        console.log(`SoldierState enter`);
    }
    override exit(unit: IUnit) {
        console.log(`SoldierState exit`);
        unit.isIdle = true;
    }

    override update(unit: ICharacterUnit) {

        const weaponType = unit.resource?.type! as "ak47" | "rpg";
        const {
            range,
            anim,
            animSpeed,
            shootEventTime,
            damage
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
                                const enemy = target as ICharacterUnit;
                                if (enemy.isIdle && enemy.motionId === 0) {
                                    const npcState = enemy!.fsm.getState(NPCState);
                                    console.assert(npcState);
                                    npcState?.attackTarget(enemy, unit);
                                }

                                switch (weaponType) {
                                    case "rpg": {
                                        const _rocket = objects.loadImmediate("/prefabs/rocket.json")!;
                                        const rocket = utils.instantiate(_rocket);
                                        const rocketComponent = utils.getComponent(Rocket, rocket)!;
                                        rocketComponent.state.shooter = unit;
                                        rocketComponent.state.damage = config.combat.rpg.damage;

                                        const { projectiles } = GameMapState.instance.layers;
                                        projectiles.add(rocket);

                                        const rocketSlot = unit.resource!.visual.getObjectByName("rocketSlot") as Mesh;
                                        rocketSlot.getWorldPosition(rocket.position);

                                        targetPos.copy(target.visual.position).addScaledVector(target.visual.up, headOffset);
                                        const toTarget = targetPos.sub(rocket.position).normalize();
                                        rocket.quaternion.setFromUnitVectors(GameUtils.vec3.forward, toTarget);
                                    }
                                        break;

                                    case "ak47": {
                                        const visual = unit.resource!.visual;
                                        const muzzleFlash = visual.getObjectByName("muzzle-flash")!;
                                        muzzleFlash.visible = true;
                                        utils.postpone(MathUtils.randFloat(.05, .2), () => muzzleFlash.visible = false);

                                        target.setHitpoints(target.hitpoints - damage);
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

