import { AnimationMixer, Matrix4, Object3D, Skeleton, SkinnedMesh } from "three";
import { objects } from "../../engine/Objects";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { IUnit } from "../unit/IUnit";
import { engineState } from "../../engine/EngineState";
import { time } from "../../engine/Time";
import { utils } from "../../engine/Utils";
import { engine } from "../../engine/Engine";

export interface IUniqueSkeleton {
    isFree: boolean;
    skeleton: Skeleton;
    armature: Object3D;
    mixer: AnimationMixer;
}

const identity = new Matrix4();
class SkeletonPool {
    private _skeletons = new Map<string, IUniqueSkeleton[]>();
    private _skin!: Object3D;
    private _root!: Object3D;

    public async load(skin: string) {
        this._skin = await objects.load(skin);
        this._root = utils.createObject(engine.scene!, "UniqueSkeletons");
    }

    public applyTransitionSkeleton(props: {
        srcAnim: string;
        srcAnimTime?: number;
        destAnim: string;
        unit: IUnit;
        duration?: number;
    }) {
        const { srcAnim, srcAnimTime, destAnim, unit, duration } = props;
        const id = (() => {
            if (srcAnim.localeCompare(destAnim) < 0) {
                return `${srcAnim}-${destAnim}`;
            } else {
                return `${destAnim}-${srcAnim}`;
            }
        })();

        let skeletons = this._skeletons.get(id);        
        if (!skeletons) {
            skeletons = [];
            this._skeletons.set(id, skeletons);
        }

        const srcClip = engineState.animations.get(srcAnim)!;
        const destClip = engineState.animations.get(destAnim)!;
        let skeleton = skeletons.find(skeleton => skeleton.isFree);
        if (!skeleton) {
            console.log(`Creating new skeleton for ${id}`);
            const skinCopy = SkeletonUtils.clone(this._skin);
            const skinnedMesh = skinCopy.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
            const _skeleton = skinnedMesh.skeleton;
            const rootBone = _skeleton.bones[0];
            const armature = rootBone.parent!;
            const mixer = new AnimationMixer(armature);
            mixer.clipAction(srcClip.clip);
            mixer.clipAction(destClip.clip);
            skeleton = {
                isFree: true,
                skeleton: _skeleton, 
                armature,
                mixer
            };
            skeletons.push(skeleton);
            armature.name = `${armature.name}-${id}`;
            this._root.add(armature);
        }

        const srcAction = skeleton.mixer.existingAction(srcClip.clip)!;
        const destAction = skeleton.mixer.existingAction(destClip.clip)!;
        if (srcAnimTime !== undefined) {
            srcAction.reset().play();
            srcAction.time = srcAnimTime;
        }
        destAction.reset().play();
        srcAction.crossFadeTo(destAction, duration ?? 1, true);
        skeleton.isFree = false;
        unit.animation = destAnim;
        skeleton.mixer.update(time.deltaTime);
        unit.obj.bind(skeleton.skeleton, identity);
        return skeleton;
    }

    public transition(skeleton: IUniqueSkeleton, srcAnim: string, destAnim: string, duration?: number) {
        const srcClip = engineState.animations.get(srcAnim)!;
        const destClip = engineState.animations.get(destAnim)!;
        const srcAction = skeleton.mixer.existingAction(srcClip.clip)!;
        const destAction = skeleton.mixer.existingAction(destClip.clip)!;
        destAction.reset().play();
        srcAction.crossFadeTo(destAction, duration ?? 1, true);
    }

    public update() {
        this._skeletons.forEach(skeletons => {
            skeletons.forEach(skeleton => {
                if (skeleton.isFree) {
                    return;
                }
                skeleton.mixer.update(time.deltaTime);
            });
        });
    }
}

export const skeletonPool = new SkeletonPool();

