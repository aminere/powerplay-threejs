import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { objects } from "../../engine/Objects";
import { Matrix4, Skeleton, SkinnedMesh } from "three";
import { engineState } from "../../engine/EngineState";
import { Animator } from "../../engine/components/Animator";
import { engine } from "../../engine/Engine";
import { utils } from "../../engine/Utils";

interface ISkeletonAnim {
    name: string;
    isLooping?: boolean;
}

interface ISkeletonManagerProps {
    skin: string;
    animations: ISkeletonAnim[];
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
            const armature = rootBone.parent!;
            const animations = utils.MakeStrArray([animation.name]);
            engineState.setComponent(armature, new Animator({ 
                animations, 
                currentAnim: 0,
                loopMode: animation.isLooping === false ? "Once" : "Repeat",
            }));
            this._skeletons.set(animation.name, skeleton);
            return skinnedMesh;
        });

        skinnedMeshes.forEach((skinnedMesh, i) => {
            const rootBone = skinnedMesh.skeleton.bones[0];
            const armature = rootBone.parent!;
            armature.name = `${armature.name}-${props.animations[i].name}`;
            engine.scene!.add(armature);
        });

        return skinnedMeshes[0];
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

