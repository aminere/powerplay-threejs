
import { SkinnedMesh, Vector2 } from "three";
import { IUniqueSkeleton, skeletonPool } from "../animation/SkeletonPool";
import { Unit } from "./Unit";
import { RawResourceType } from "../GameDefinitions";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { Fadeout } from "../components/Fadeout";
import { cmdFogRemoveCircle, evtUnitStateChanged } from "../../Events";
import { unitAnimation } from "./UnitAnimation";
import { utils } from "../../engine/Utils";
import { ICell, ICarriedResource } from "../GameTypes";
import { GameMapState } from "../components/GameMapState";
import { IDepotState } from "../buildings/BuildingTypes";
import { SoldierState } from "./states/SoldierState";
import { unitMotion } from "./UnitMotion";
import { getCellFromAddr } from "./UnitAddr";
import { UnitUtils } from "./UnitUtils";
import { Workers } from "./Workers";
import { Depots } from "../buildings/Depots";
import { Factories } from "../buildings/Factories";
import { Incubators } from "../buildings/Incubators";
import { MiningState } from "./states/MiningState";
import { ICharacterUnit, ICharacterUnitProps, IUnitAnim } from "./ICharacterUnit";
import { IUnit } from "./IUnit";
import { GameUtils } from "../GameUtils";
import { NPCState } from "./states/NPCState";


export class CharacterUnit extends Unit implements ICharacterUnit {
    public get animation() { return this._animation; }
    public get skeleton() { return this._skeleton; }
    public get skinnedMesh() { return this._skinnedMesh; }
    public get muzzleFlashTimer() { return this._muzzleFlashTimer; }
    public get resource() { return this._resource; }
    public get targetBuilding() { return this._targetBuilding; }

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
        evtUnitStateChanged.post(this);
    }

    public get boundingBox() { return this._skinnedMesh.boundingBox; }

    private _animation: IUnitAnim;
    private _skeleton: IUniqueSkeleton | null = null;
    private _skinnedMesh: SkinnedMesh;
    private _muzzleFlashTimer = 0;
    private _resource: ICarriedResource | null = null;
    private _targetBuilding: Vector2 | null = null;

    constructor(props: ICharacterUnitProps, id: number) {
        super({ ...props, boundingBox: props.visual.boundingBox }, id);
        this._animation = props.animation;
        this._skinnedMesh = props.visual;
    }

    public clearResource() {
        this.resource = null;
        this._targetBuilding = null;
    }

    public override setHitpoints(value: number): void {
        if (value <= 0) {            
            engineState.removeComponent(this.visual, UnitCollisionAnim);
            this.resource = null;
        }
        super.setHitpoints(value);
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

    public override clearAction() {
        this._targetBuilding = null;       

        const soldierState = this.fsm.getState(SoldierState);
        if (soldierState) {
            soldierState.stopAttack(this);
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
            unitAnimation.setAnimation(this, "idle", { transitionDuration: .3, scheduleCommonAnim: true })
        }
    }

    public override onColliding() {
        if (this.motionId === 0) {
            const collisionAnim = utils.getComponent(UnitCollisionAnim, this.visual);
            if (collisionAnim) {
                collisionAnim.reset();
            } else {
                engineState.setComponent(this.visual, new UnitCollisionAnim({ unit: this }));
            }
        }

        const npcState = this.fsm.getState(NPCState);
        if (npcState) {
            npcState.onColliding(this);
        }
    }

    public override onReachedBuilding(cell: ICell) {

        const instance = GameMapState.instance.buildings.get(cell.building!)!;
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
                    if (Depots.tryDepositResource(instance, this.resource.type)) {
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
            }

            const wasDeposited = this.resource === null;
            if (wasDeposited) {
                // go grab another one from the source
                const validSource = (() => {
                    const sourceBuilding = GameUtils.getCell(sourceCell)?.building;
                    if (sourceBuilding) {
                        const sourceInstance = GameMapState.instance.buildings.get(sourceBuilding)!;
                        return sourceInstance.id !== instance.id;
                    }
                    return true;
                })();
                
                if (validSource) {
                    this._targetBuilding = this.targetCell.mapCoords.clone();
                    unitMotion.moveUnit(this, sourceCell);
                }                

            } else {

                if (instance.buildingType === "depot") {
                    // if the depot is of a different type than the carried resource, pick from it (discard the carried resource)
                    const state = instance.state as IDepotState;
                    if (state.amount > 0 && state.type !== this.resource!.type) {
                        console.assert(state.type !== null);
                        Workers.pickResource(this, state.type!, this.targetCell.mapCoords);
                        Depots.removeResource(instance);
                    }
                }
            }

        } else {

            switch (instance.buildingType) {
                case "depot": {
                    const state = instance.state as IDepotState;
                    if (state.amount > 0) {
                        console.assert(state.type !== null);
                        Workers.pickResource(this, state.type!, this.targetCell.mapCoords);
                        Depots.removeResource(instance);

                        if (this._targetBuilding) {
                            unitMotion.moveUnit(this, this._targetBuilding);
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

