
import { AnimationAction, SkinnedMesh } from "three";
import { IUniqueSkeleton, skeletonPool } from "../animation/SkeletonPool";
import { IUnit, Unit } from "./Unit";
import { CharacterType } from "../GameDefinitions";
import { State } from "../fsm/StateMachine";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { Fadeout } from "../components/Fadeout";
import { cmdFogRemoveCircle } from "../../Events";
import { unitAnimation } from "./UnitAnimation";
import { utils } from "../../engine/Utils";
import { MiningState } from "./states/MiningState";
import { ICell, IResource } from "../GameTypes";
import { pickResource } from "./update/WorkerUpdate";
import { GameMapState } from "../components/GameMapState";
import { IFactoryState } from "../buildings/BuildingTypes";
import { SoldierState } from "./states/SoldierState";
import { UnitMotion } from "./UnitMotion";
import { getCellFromAddr } from "./UnitAddr";

interface IUnitAnim {
    name: string;
    action: AnimationAction;
}

export interface ICharacterUnit extends IUnit {
    skinnedMesh: SkinnedMesh;
    animation: IUnitAnim;
    skeleton: IUniqueSkeleton | null;
    muzzleFlashTimer: number;
    resource: IResource | null;
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
    public get health() { return this._health; }
    public get muzzleFlashTimer() { return this._muzzleFlashTimer; }
    public get resource() { return this._resource; }

    public set muzzleFlashTimer(value: number) { this._muzzleFlashTimer = value; }
    public set skeleton(value: IUniqueSkeleton | null) { this._skeleton = value; }   

    public set resource(value: IResource | null) { 
        if (value === this._resource) {
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
    private _resource: IResource | null = null;

    constructor(props: ICharacterUnitProps, id: number) {
        super({ ...props, boundingBox: props.visual.boundingBox }, id);
        this._animation = props.animation;
        this._skinnedMesh = props.visual;
    }

    public override setHealth(value: number): void {
        if (value <= 0) {            
            engineState.removeComponent(this.mesh, UnitCollisionAnim);
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
            engineState.setComponent(this.mesh, new Fadeout({ duration: fadeDuration }));
            setTimeout(() => {
                skeletonPool.releaseSkeleton(this);
                if (!this.type.startsWith("enemy")) {
                    cmdFogRemoveCircle.post({ mapCoords: this.coords.mapCoords, radius: 10 });
                }
            }, fadeDuration * 1000);
        }, 2000); // wait for the death anim to play a bit
    }

    public override onMove(bindSkeleton: boolean) {
        engineState.removeComponent(this.mesh, UnitCollisionAnim);
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
        const collisionAnim = utils.getComponent(UnitCollisionAnim, this.mesh);
        if (collisionAnim) {
            collisionAnim.reset();
        } else {
            engineState.setComponent(this.mesh, new UnitCollisionAnim({ unit: this }));
        }
    }

    public override onReachedBuilding(cell: ICell) {

        if (this.resource) {
            const buildingInstance = GameMapState.instance.buildings.get(cell.building!.instanceId)!;
            if (buildingInstance.buildingType === "factory") {
                const state = buildingInstance.state as IFactoryState;
                if (state.input === this.resource.type) {
                    state.inputReserve++;
                    this.resource = null;
                }
            }
        }
        
        const miningState = this.fsm.getState(MiningState)!;
        if (miningState) {
            miningState.onReachedFactory(this);
        } else {
            if (cell.pickableResource) {
                if (cell.pickableResource.type === this.resource?.type) {
                    // do nothing, this resource is already carried
                } else {
                    pickResource(this, cell.pickableResource.type);
                    cell.pickableResource.visual.removeFromParent();
                    cell.pickableResource = undefined;
                }
            }
            this.onArrived();
        }        
    }

    public override onCollidedWithMotionNeighbor(neighbor: IUnit) {
        // if other unit was part of my motion, stop
        if (neighbor.lastCompletedMotionId === this.motionId) {
            const isMining = (() => {
                if (this.fsm.getState(MiningState)) {
                    return true;
                }
                const targetCell = getCellFromAddr(this.targetCell);
                if (targetCell.resource) {
                    return true;
                }
            })();
            
            if (isMining || this.resource) {
                 // keep going
            } else {
                UnitMotion.endMotion(this);
                this.onArrived();
            }
        }
    }
}

