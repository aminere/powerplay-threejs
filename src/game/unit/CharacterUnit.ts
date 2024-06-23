
import { Object3D, SkinnedMesh, Vector2 } from "three";
import { IUniqueSkeleton, skeletonPool } from "../animation/SkeletonPool";
import { Unit } from "./Unit";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { Fadeout } from "../components/Fadeout";
import { cmdFogRemoveCircle, evtUnitStateChanged } from "../../Events";
import { unitAnimation } from "./UnitAnimation";
import { ICell, ICarriedResource } from "../GameTypes";
import { IDepotState } from "../buildings/BuildingTypes";
import { SoldierState } from "./states/SoldierState";
import { unitMotion } from "./UnitMotion";
import { getCellFromAddr } from "./UnitAddr";
import { UnitUtils } from "./UnitUtils";
import { Workers } from "./Workers";
import { depots } from "../buildings/Depots";
import { Factories } from "../buildings/Factories";
import { Incubators } from "../buildings/Incubators";
import { MiningState } from "./states/MiningState";
import { ICharacterUnit, ICharacterUnitProps, IUnitAnim } from "./ICharacterUnit";
import { IUnit, UnitState } from "./IUnit";
import { GameUtils } from "../GameUtils";
import { Assemblies } from "../buildings/Assemblies";
import { objects } from "../../engine/resources/Objects";
import { unitConfig } from "../config/UnitConfig";
import gsap from "gsap";
import { AttackUnit } from "./states/AttackUnit";

export class CharacterUnit extends Unit implements ICharacterUnit {
    public get animation() { return this._animation; }
    public get skeleton() { return this._skeleton; }
    public get skinnedMesh() { return this._skinnedMesh; }
    public get resource() { return this._resource; }
    public get targetBuilding() { return this._targetBuilding; }

    public set skeleton(value: IUniqueSkeleton | null) { this._skeleton = value; }

    public set resource(value: ICarriedResource | null) {
        if (value?.type === this._resource?.type) {
            return;
        }
        if (this._resource) {
            this._resource.visual.removeFromParent();           
        }

        this._resource = value;

        const soldierState = this.fsm.getState(SoldierState);
        if (soldierState) {
            this.fsm.switchState(null);
        }
        
        switch (value?.type) {
            case "ak47": {
                const _muzzleFlash = objects.loadImmediate("/prefabs/muzzle-flash.json")!;
                const muzzleFlash = _muzzleFlash.clone();
                value!.visual.add(muzzleFlash);
                muzzleFlash.visible = false;
                this.fsm.switchState(SoldierState);
            }
            break;
            case "rpg": {
                const rocket = new Object3D();
                rocket.name = "rocketSlot";
                rocket.position.set(-.55, .16, -.58);
                value!.visual.add(rocket);
                this.fsm.switchState(SoldierState);
            }
            break;
        }        

        evtUnitStateChanged.post(this);
    }

    public get boundingBox() { return this._skinnedMesh.boundingBox; }

    private _animation: IUnitAnim;
    private _skeleton: IUniqueSkeleton | null = null;
    private _skinnedMesh: SkinnedMesh;
    private _resource: ICarriedResource | null = null;
    private _targetBuilding: Vector2 | null = null;
    private _timeline: gsap.core.Timeline | null = null;

    constructor(props: ICharacterUnitProps) {
        super({ ...props, boundingBox: props.visual.boundingBox });
        this._animation = props.animation;
        this._skinnedMesh = props.visual;
    }

    public clearResource() {
        this.resource = null;
        this._targetBuilding = null;
        unitAnimation.setAnimation(this, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
    }

    public override setHitpoints(value: number): void {
        if (value <= 0) {
            engineState.removeComponent(UnitCollisionAnim, this.visual);
            this.resource = null;
        }
        super.setHitpoints(value);
    }

    public override onDeath() {
        unitAnimation.setAnimation(this, "death", {
            transitionDuration: 1,
            destAnimLoopMode: "Once"
        });

        const fadeDuration = 1;
        this._timeline = gsap.timeline()
            .to({}, { duration: 2 })
            .to({}, {
                duration: fadeDuration,
                onStart: () => {
                    engineState.setComponent(this.visual, new Fadeout({ duration: fadeDuration }));
                },
                onComplete: () => {
                    this._timeline = null;
                    this._state = UnitState.Dead;                    
                    skeletonPool.releaseSkeleton(this);
                    engineState.removeObject(this.visual);
                    if (!UnitUtils.isEnemy(this)) {
                        const { range } = unitConfig[this.type];
                        cmdFogRemoveCircle.post({ mapCoords: this.coords.mapCoords, radius: range.vision });
                    }
                }
            }, `>0`);
    }

    public override onMove(bindSkeleton: boolean) {
        engineState.removeComponent(UnitCollisionAnim, this.visual);
        if (bindSkeleton) {
            unitAnimation.setAnimation(this, "run");
        }
    }

    public override clearAction() {
        this._targetBuilding = null;

        const soldierState = this.fsm.getState(SoldierState);
        if (soldierState) {
            soldierState.stopAttack(this);
            return;
        }
        const miningState = this.fsm.getState(MiningState);
        if (miningState) {
            miningState.stopMining(this);
            return;
        }

        this.fsm.switchState(null);
    }

    public override onArrived() {
        if (this.isIdle) {
            unitAnimation.setAnimation(this, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
        }
    }

    public override onArriving() {
        if (this.isIdle) {
            unitAnimation.setAnimation(this, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
        }
    }

    public override onColliding() {
        const attack = this.fsm.getState(AttackUnit);
        if (attack) {
            attack.onColliding(this);
            return;
        }
    }

    public override onReachedBuilding(cell: ICell) {

        const instance = cell.building!;
        if (this.resource) {

            const sourceCell = this.resource.sourceCell;
            switch (instance.buildingType) {
                case "factory": {
                    if (Factories.tryDepositResource(instance, this.resource.type)) {
                        this.resource = null;
                    }
                }
                    break;

                case "depot": {
                    if (depots.tryDepositResource(instance, this.resource.type)) {
                        this.resource = null;
                    }
                }
                    break;

                case "incubator": {
                    if (Incubators.tryDepositResource(instance, this.resource.type as RawResourceType)) {
                        this.resource = null;
                    }
                }
                    break;

                case "assembly": {
                    if (Assemblies.tryDepositResource(instance, this.resource.type as ResourceType)) {
                        this.resource = null;
                    }
                }
                    break;
            }

            const wasDeposited = this.resource === null;
            if (wasDeposited) {
                // go grab another one from the source
                const validSource = (() => {
                    const sourceBuilding = GameUtils.getCell(sourceCell)?.building;
                    if (sourceBuilding) {
                        // avoid pick/deposit loop on the same building
                        return sourceBuilding.id !== instance.id;
                    }
                    return true;
                })();

                if (validSource) {
                    this._targetBuilding = this.targetCell.mapCoords.clone();
                    unitMotion.moveUnit(this, sourceCell);
                }
            }

        } else {

            switch (instance.buildingType) {
                case "depot": {
                    const pick = (type: RawResourceType | ResourceType) => {
                        Workers.pickResource(this, type, this.targetCell.mapCoords);
                        depots.removeResource(instance, type, 1);
                        if (this._targetBuilding) {
                            unitMotion.moveUnit(this, this._targetBuilding);
                        }
                    };

                    const state = instance.state as IDepotState;
                    if (state.output) {
                        pick(state.output);

                    } else {
                        // pick the first available resource
                        for (const slot of state.slots.slots) {
                            if (slot.type) {
                                console.assert(slot.amount > 0);
                                pick(slot.type);
                                break;
                            }
                        }
                    }
                }
                    break;
            }
        }

        if (this.motionId === 0) {
            this.onArrived();
        }
    }

    public override onReachedResource(cell: ICell) {

        const canPick = (() => {
            console.assert(cell.resource);
            if (cell.resource!.amount === 0) {
                return false;
            }
            if (this.resource) {
                return this.resource.type !== cell.resource!.type;
            } else {
                return true;
            }
        })();

        if (canPick) {
            this.fsm.switchState(MiningState);
        } else {
            this.onArrived();
        }
    }

    public override onCollidedWhileMoving(neighbor: IUnit) {
        // if other unit was part of my motion, stop
        if (neighbor.lastCompletedMotionCommandId === this.motionCommandId) {

            const isMining = (() => {
                if (UnitUtils.isVehicle(this)) {
                    return false;
                }
                const targetCell = getCellFromAddr(this.targetCell);
                if (targetCell.resource) {
                    return true;
                }
            })();

            if (isMining) {
                return; // keep going
            }

            const targetCell = getCellFromAddr(this.targetCell);
            if (targetCell.building) {
                return; // keep going
            }

            const attack = this.fsm.getState(AttackUnit);
            if (attack) {
                return; // keep going
            }

            unitMotion.endMotion(this);
            this.onArrived();
        }
    }

    public override dispose() {
        if (this._timeline) {
            this._timeline.kill();
            this._timeline = null;
        
        }
        super.dispose();
    }
}

