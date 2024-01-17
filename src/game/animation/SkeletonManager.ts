import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { objects } from "../../engine/Objects";
import { Matrix4, Object3D, Skeleton, SkinnedMesh } from "three";
import { engineState } from "../../engine/EngineState";
import { Animator } from "../../engine/components/Animator";
import { engine } from "../../engine/Engine";
import { utils } from "../../engine/Utils";
import { IUnit } from "../unit/IUnit";

const identity = new Matrix4();
class SkeletonManager {

    private _skeletons = new Map<string, {
        skeleton: Skeleton;
        armature: Object3D;
    }>();

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
            }));
            this._skeletons.set(animation.name, { skeleton, armature });
            return skinnedMesh;
        });

        const skeletons = utils.createObject(engine.scene!, "Skeletons");
        skinnedMeshes.forEach((skinnedMesh, i) => {
            const rootBone = skinnedMesh.skeleton.bones[0];
            const armature = rootBone.parent!;
            armature.name = `${armature.name}-${props.animations[i].name}`;
            skeletons.add(armature);
        });

        const rootBone0 = skinnedMeshes[0].skeleton.bones[0];
        const armature0 = rootBone0.parent!;
        return {
            sharedSkinnedMesh: skinnedMeshes[0],
            baseRotation: armature0.quaternion.clone()
        };
    }

    public applySkeleton(animation: string, unit: IUnit) {
        const skeleton = this._skeletons.get(animation);
        if (!skeleton) {
            return;
        }
        
        const target = unit.obj;
        if (target.skeleton !== skeleton.skeleton) {
            console.assert(unit.animation !== animation);
            unit.animation = animation;
            target.bind(skeleton.skeleton, identity);
        } else {
            console.assert(unit.animation === animation);
        }
    }
}

export const skeletonManager = new SkeletonManager();

