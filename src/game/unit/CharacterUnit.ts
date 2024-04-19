
import { SkinnedMesh } from "three";
import { IUniqueSkeleton, skeletonPool } from "../animation/SkeletonPool";
import { IUnitAnim } from "./IUnit";
import { Unit } from "./Unit";
import { CharacterType } from "../GameDefinitions";
import { State } from "../fsm/StateMachine";
import { ICharacterUnit } from "./ICharacterUnit";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { Fadeout } from "../components/Fadeout";
import { cmdFogRemoveCircle } from "../../Events";
import { unitAnimation } from "./UnitAnimation";
import { utils } from "../../engine/Utils";
import { MiningState } from "./MiningState";
import { unitUtils } from "./UnitUtils";
import { ICell } from "../GameTypes";

export interface ICharacterUnitProps {
    mesh: SkinnedMesh;
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
    public get arriving() { return this._arriving; }
    public get muzzleFlashTimer() { return this._muzzleFlashTimer; }

    public set muzzleFlashTimer(value: number) { this._muzzleFlashTimer = value; }
    public set skeleton(value: IUniqueSkeleton | null) { this._skeleton = value; }
    public set health(value: number) { 
        this._health = value; 
        if (value <= 0 && this._isAlive) {
            this.fsm.switchState(null);
            engineState.removeComponent(this.mesh, UnitCollisionAnim);
            this._isAlive = false;            
            this._collidable = false;
            this._motionId = 0;
            this._isColliding = false;
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
    }

    public set arriving(value: boolean) {
        this._arriving = value;
        if (value) {
            unitAnimation.setAnimation(this, "idle", { transitionDuration: .4, scheduleCommonAnim: true });
        }
    }
    
    public get boundingBox() { return this._skinnedMesh.boundingBox; }

    private _animation: IUnitAnim;
    private _skeleton: IUniqueSkeleton | null = null;    
    private _skinnedMesh: SkinnedMesh;
    private _muzzleFlashTimer = 0;

    constructor(props: ICharacterUnitProps, id: number) {
        super(props, id);
        this._animation = props.animation;
        this._skinnedMesh = props.mesh;
    }

    public override onMove(bindSkeleton: boolean) {
        engineState.removeComponent(this.mesh, UnitCollisionAnim);
        if (bindSkeleton) {
            unitAnimation.setAnimation(this, "run");
        }
    }

    public override onSteer() {
        unitAnimation.setAnimation(this, "idle", { transitionDuration: .4, scheduleCommonAnim: true });
    }

    public override onArrive() {
        super.onArrive();
        unitAnimation.setAnimation(this, "idle");
    }
    
    public override onColliding() {
        const collisionAnim = utils.getComponent(UnitCollisionAnim, this.mesh);
        if (collisionAnim) {
            collisionAnim.reset();
        } else {
            engineState.setComponent(this.mesh, new UnitCollisionAnim({ unit: this }));
        }
    }

    public override onReachedTarget(cell: ICell) {        
        const miningState = this.fsm.getState(MiningState)!;
        if (miningState) {
            miningState.onReachedTarget(this);
        } else {
            if (cell.pickableResource) {
                unitUtils.pickResource(this, cell.pickableResource.type);
                cell.pickableResource.visual.removeFromParent();
                cell.pickableResource = undefined;
            }
            this.onArrive();
        }        
    }
}

