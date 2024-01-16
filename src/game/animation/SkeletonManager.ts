import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { objects } from "../../engine/Objects";
import { Matrix4, Object3D, Skeleton, SkinnedMesh } from "three";
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
class SkeletonManager {

    private _skeletons = new Map<string, {
        skeleton: Skeleton;
        armature: Object3D;
    }>();

    public async load(props: ISkeletonManagerProps) {
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

        skinnedMeshes.forEach((skinnedMesh, i) => {
            const rootBone = skinnedMesh.skeleton.bones[0];
            const armature = rootBone.parent!;
            armature.name = `${armature.name}-${props.animations[i].name}`;
            engine.scene!.add(armature);
        });

        const rootBone0 = skinnedMeshes[0].skeleton.bones[0];
        const armature0 = rootBone0.parent!;
        return {
            sharedSkinnedMesh: skinnedMeshes[0],
            baseRotation: armature0.quaternion.clone()
        };
    }

    public applySkeleton(animation: string, target: SkinnedMesh) {
        const skeleton = this._skeletons.get(animation);
        if (!skeleton) {
            return;
        }
        if (target.skeleton !== skeleton.skeleton) {
            target.bind(skeleton.skeleton, identity);

            if (animation === "death") {
                const animator = utils.getComponent(Animator, skeleton.armature);
                animator?.reset();
                const onAnimFinished = () => {
                    console.log("death anim finished");
                    animator?.state.mixer.removeEventListener("finished", onAnimFinished);
                };
                animator?.state.mixer.addEventListener("finished", onAnimFinished);
            }
        }
    }
}

export const skeletonManager = new SkeletonManager();

