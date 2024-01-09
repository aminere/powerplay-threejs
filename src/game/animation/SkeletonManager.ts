import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { objects } from "../../engine/Objects";
import { Matrix4, Quaternion, Skeleton, SkinnedMesh } from "three";
import { engineState } from "../../engine/EngineState";
import { Animator } from "../../engine/components/Animator";
import { engine } from "../../engine/Engine";

interface ISkeletonManagerProps {
    skin: string;
    animations: string[];
    currentAnim: string;
}

const identity = new Matrix4();
export class SkeletonManager {

    private _skeletons = new Map<string, Skeleton>();

    public async load(props: ISkeletonManagerProps) {
        const mesh = await objects.load(props.skin);
        const skinnedMeshes = props.animations.map(animation => {
            const model = SkeletonUtils.clone(mesh);
            const skinnedMesh = model.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
            const skeleton = skinnedMesh.skeleton;
            const rootBone = skeleton.bones[0];
            engineState.setComponent(rootBone, new Animator({ animations: [animation], currentAnim: animation }));
            this._skeletons.set(animation, skeleton);
            return skinnedMesh;
        });

        const rootBone = skinnedMeshes[0].skeleton.bones[0];
        const baseRotation = new Quaternion().copy(rootBone.parent!.quaternion);

        for (const skinnedMesh of skinnedMeshes) {
            const rootBone = skinnedMesh.skeleton.bones[0];
            engine.scene!.add(rootBone);
        }

        return {
            sharedSkinnedMesh: skinnedMeshes[0],
            baseRotation
        };
    }

    public applySkeleton(animation: string, target: SkinnedMesh) {
        const skeleton = this._skeletons.get(animation);
        if (!skeleton) {
            return;
        }
        if (target.skeleton !== skeleton) {
            target.bind(skeleton, identity);
        }
    }
}

