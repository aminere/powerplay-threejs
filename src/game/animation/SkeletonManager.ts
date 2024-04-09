import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { objects } from "../../engine/resources/Objects";
import { Box3, Matrix4, Object3D, Skeleton, SkinnedMesh, Vector3 } from "three";
import { engineState } from "../../engine/EngineState";
import { Animator } from "../../engine/components/Animator";
import { engine } from "../../engine/Engine";
import { utils } from "../../engine/Utils";
import { GameUtils } from "../GameUtils";

const identity = new Matrix4();
class SkeletonManager {
    
    public get sharedSkinnedMesh() { return this._sharedSkinnedMesh; }
    public get boundingBox() { return this._boundingBox; }

    private _skeletons = new Map<string, {
        skeleton: Skeleton;
        armature: Object3D;
    }>();

    private _sharedSkinnedMesh!: SkinnedMesh;
    private _boundingBox!: Box3;

    public getSkeleton(animation: string) {
        return this._skeletons.get(animation);
    }

    public async load(props: {
        skin: string;
        animations: Array<{
            name: string;
            isLooping?: boolean;
        }>;
    }) {
        const skin = await objects.load(props.skin);
        const skinnedMeshes = props.animations.map(animation => {
            const skinCopy = SkeletonUtils.clone(skin);
            const skinnedMesh = skinCopy.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
            const skeleton = skinnedMesh.skeleton;
            const rootBone = skeleton.bones[0];
            const armature = rootBone.parent!;
            const animations = utils.MakeStrArray([animation.name]);
            engineState.setComponent(armature, new Animator({ 
                animations, 
                currentAnim: 0,
                loopMode: animation.isLooping === false ? "Once" : "Repeat",
                speed: animation.name === "shoot" ? 0.5 : undefined
            }));
            this._skeletons.set(animation.name, { skeleton, armature });
            return skinnedMesh;
        });

        const skeletons = utils.createObject(engine.scene!, "Skeletons");
        skeletons.visible = false;
        skinnedMeshes.forEach((skinnedMesh, i) => {
            const rootBone = skinnedMesh.skeleton.bones[0];
            const armature = rootBone.parent!;
            armature.name = `${armature.name}-${props.animations[i].name}`;
            skeletons.add(armature);
        });

        const sharedSkinnedMesh = skinnedMeshes[0];
        const rootBone0 = skinnedMeshes[0].skeleton.bones[0];
        const armature0 = rootBone0.parent!;        
        const baseRotation = armature0.quaternion.clone();

        const headOffset = new Vector3(0, 0, 1.8);
        const boundingBox = new Box3()
            .setFromObject(sharedSkinnedMesh)
            .expandByPoint(headOffset)
            .applyMatrix4(new Matrix4().compose(GameUtils.vec3.zero, baseRotation, GameUtils.vec3.one));

        this._sharedSkinnedMesh = sharedSkinnedMesh;
        this._boundingBox = boundingBox;
    }

    public dispose() {
        this._skeletons.clear();
    }

    public applySkeleton(animation: string, target: SkinnedMesh) {
        const skeleton = this._skeletons.get(animation);
        if (!skeleton) {
            return null;
        }
        if (target.skeleton !== skeleton.skeleton) {            
            target.bind(skeleton.skeleton, identity);
        }
        const animator = utils.getComponent(Animator, skeleton.armature)!;        
        return animator.currentAction;
    }

    public applyIdleAnim(obj: SkinnedMesh) {
        const action = this.applySkeleton("idle", obj)!;
        return {
            name: "idle",
            action
        }
    }
}

export const skeletonManager = new SkeletonManager();

