
import { Euler, MathUtils, Matrix4, Quaternion, SkinnedMesh, Vector3 } from "three";
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
import { time } from "../../engine/core/Time";
import { MiningState } from "./MiningState";
import { unitUtils } from "./UnitUtils";
import { ICell } from "../GameTypes";

const pickedItemOffset = new Matrix4().makeTranslation(-.5, 0, 0);
const pickedAk47Offset = new Matrix4().compose(
    new Vector3(),
    new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(-158), MathUtils.degToRad(61), MathUtils.degToRad(-76))),
    new Vector3(1, 1, 1).multiplyScalar(1.5)
);

const pickedItemlocalToSkeleton = new Matrix4();

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

    public override updateResource() {
        if (!this.resource) {
            return;
        }

        // attach the resource to the unit
        const visual = this.resource.visual;
        const skeleton = unitAnimation.getSkeleton(this);

        switch (this.resource.type) {
            case "ak47": {
                const parent = skeleton.getObjectByName("HandR")!;
                pickedItemlocalToSkeleton.multiplyMatrices(parent.matrixWorld, pickedAk47Offset);

                const muzzleFlash = visual.getObjectByName("muzzle-flash");
                if (muzzleFlash) {
                    if (this.animation.name === "shoot") {
                        if (this._muzzleFlashTimer < 0) {
                            this._muzzleFlashTimer = MathUtils.randFloat(.05, .2);
                            muzzleFlash.visible = !muzzleFlash.visible;
                        } else {
                            this._muzzleFlashTimer -= time.deltaTime;
                        }
                    } else {
                        muzzleFlash.visible = false;
                    }
                }
            }
                break;
            default: {
                const parent = skeleton.getObjectByName("Spine2")!;
                pickedItemlocalToSkeleton.multiplyMatrices(parent.matrixWorld, pickedItemOffset);
            }
        }

        visual.matrix.multiplyMatrices(this.mesh.matrixWorld, pickedItemlocalToSkeleton);
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

