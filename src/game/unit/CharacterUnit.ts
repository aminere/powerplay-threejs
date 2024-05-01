
import { AnimationAction, SkinnedMesh } from "three";
import { IUniqueSkeleton, skeletonPool } from "../animation/SkeletonPool";
import { IUnit, Unit } from "./Unit";
import { CharacterType, RawResourceType } from "../GameDefinitions";
import { State } from "../fsm/StateMachine";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { Fadeout } from "../components/Fadeout";
import { cmdFogRemoveCircle } from "../../Events";
import { unitAnimation } from "./UnitAnimation";
import { utils } from "../../engine/Utils";
import { MiningState } from "./states/MiningState";
import { ICell, ICarriedResource } from "../GameTypes";
import { GameMapState } from "../components/GameMapState";
import { IDepotState, IFactoryState } from "../buildings/BuildingTypes";
import { SoldierState } from "./states/SoldierState";
import { unitMotion } from "./UnitMotion";
import { getCellFromAddr } from "./UnitAddr";
import { UnitUtils } from "./UnitUtils";
import { Workers } from "./Workers";
import { Depots } from "../buildings/Depots";
import { Factories } from "../buildings/Factories";
import { Incubators } from "../buildings/Incubators";

interface IUnitAnim {
    name: string;
    action: AnimationAction;
}

export interface ICharacterUnit extends IUnit {
    skinnedMesh: SkinnedMesh;
    animation: IUnitAnim;
    skeleton: IUniqueSkeleton | null;
    muzzleFlashTimer: number;
    resource: ICarriedResource | null;
}

export interface ICharacterUnitProps {
    visual: SkinnedMesh;    
    type: CharacterType;
    speed?: number;
    states: State<ICharacterUnit>[];
    animation: IUnitAnim;
}

export class CharacterUnit extends Unit implements ICharacterUnit {
    public get animation() { return this._animation; }
    public get skeleton() { return this._skeleton; }
    public get skinnedMesh() { return this._skinnedMesh; }
    public get muzzleFlashTimer() { return this._muzzleFlashTimer; }
    public get resource() { return this._resource; }

    public set muzzleFlashTimer(value: number) { this._muzzleFlashTimer = value; }
    public set skeleton(value: IUniqueSkeleton | null) { this._skeleton = value; }   

    public set resource(value: ICarriedResource | null) { 
        if (value?.type === this._resource?.type) {
            return;
        }
        if (this._resource) {
            this._resource.visual.removeFromParent();
        }
        this._resource = value;
    }

    public get boundingBox() { return this._skinnedMesh.boundingBox; }

    private _animation: IUnitAnim;
    private _skeleton: IUniqueSkeleton | null = null;
    private _skinnedMesh: SkinnedMesh;
    private _muzzleFlashTimer = 0;
    private _resource: ICarriedResource | null = null;

    constructor(props: ICharacterUnitProps, id: number) {
        super({ ...props, boundingBox: props.visual.boundingBox }, id);
        this._animation = props.animation;
        this._skinnedMesh = props.visual;
    }

    public override setHealth(value: number): void {
        if (value <= 0) {            
            engineState.removeComponent(this.visual, UnitCollisionAnim);
            this.resource = null;
        }
        super.setHealth(value);
    }

    public override onDeath() {
        unitAnimation.setAnimation(this, "death", {
            transitionDuration: 1,
            destAnimLoopMode: "Once"
        });
        setTimeout(() => {
            const fadeDuration = 1;
            engineState.setComponent(this.visual, new Fadeout({ duration: fadeDuration }));
            setTimeout(() => {
                skeletonPool.releaseSkeleton(this);
                if (!UnitUtils.isEnemy(this)) {
                    cmdFogRemoveCircle.post({ mapCoords: this.coords.mapCoords, radius: 10 });
                }
            }, fadeDuration * 1000);
        }, 2000); // wait for the death anim to play a bit
    }

    public override onMove(bindSkeleton: boolean) {
        engineState.removeComponent(this.visual, UnitCollisionAnim);
        if (bindSkeleton) {
            unitAnimation.setAnimation(this, "run");
        }
    }

    public override onMoveCommand() {
        const isMining = this.fsm.getState(MiningState) !== null;
        if (isMining) {
            this.fsm.switchState(null);
        } else {
            const soldierState = this.fsm.getState(SoldierState);
            if (soldierState) {
                soldierState.stopAttack(this);
            }
        }
    }

    public override onArrived() {
        if (this.isIdle) {
            unitAnimation.setAnimation(this, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
        }
    }
    
    public override onArriving() {
        if (this.isIdle) {
            unitAnimation.setAnimation(this, "idle", { transitionDuration: .3, scheduleCommonAnim: true })
        }
    }

    public override onColliding() {
        const collisionAnim = utils.getComponent(UnitCollisionAnim, this.visual);
        if (collisionAnim) {
            collisionAnim.reset();
        } else {
            engineState.setComponent(this.visual, new UnitCollisionAnim({ unit: this }));
        }
    }

    public override onReachedBuilding(cell: ICell) {

        if (this.resource) {
            const instance = GameMapState.instance.buildings.get(cell.building!)!;
            switch (instance.buildingType) {
                case "factory": {
                    if (Factories.tryDepositResource(instance, this.resource.type)) {
                        this.resource = null;
                    }
                }
                    break;

                case "depot": {
                    if (Depots.tryDepositResource(instance, this.resource.type)) {
                        this.resource = null;
                    } else {
                        const state = instance.state as IDepotState;
                        if (state.type !== this.resource.type) {
                            if (state.amount > 0) {
                                Workers.pickResource(this, state.type);
                                Depots.removeResource(instance);
                            }
                        }
                    }
                }
                    break;

                case "incubator": {
                    if (Incubators.tryDepositResource(instance, this.resource.type as RawResourceType)) {
                        this.resource = null;
                    }
                }
                break;
            }

            const miningState = this.fsm.getState(MiningState)!;
            if (miningState) {
                const wasDeposited = this.resource === null;
                if (wasDeposited) {
                    miningState.onReachedBuilding(this);
                } else {
                    miningState.goToFactoryOrDepot(this, this.resource!.type);
                }
            } else {
                this.onArrived();
            }

        } else {
            const buildingInstance = GameMapState.instance.buildings.get(cell.building!)!;
            switch (buildingInstance.buildingType) {
                case "depot": {
                    const state = buildingInstance.state as IDepotState;
                    if (state.amount > 0) {
                        Workers.pickResource(this, state.type);
                        Depots.removeResource(buildingInstance);
                    }
                }
                break;
            }
            this.onArrived();
        }
    }

    public override onCollidedWhileMoving(neighbor: IUnit) {
        // if other unit was part of my motion, stop
        if (neighbor.lastCompletedMotionCommandId === this.motionCommandId) {

            const isMining = (() => {
                if (this.fsm.getState(MiningState)) {
                    return true;
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

            unitMotion.endMotion(this);
            this.onArrived();
        }
    }
}

