import { AnimationMixer, Matrix4, Object3D, Skeleton, SkinnedMesh } from "three";
import { objects } from "../../engine/resources/Objects";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { engineState } from "../../engine/EngineState";
import { time } from "../../engine/core/Time";
import { utils } from "../../engine/Utils";
import { engine } from "../../engine/Engine";
import { LoopMode } from "../../engine/serialization/Types";
import { ICharacterUnit } from "../unit/ICharacterUnit";

export interface IUniqueSkeleton {
    id: string;
    isFree: boolean;
    skeleton: Skeleton;
    armature: Object3D;
    mixer: AnimationMixer;
    tween: gsap.core.Tween | null;
}

export function getSkeletonId(srcAnim: string, destAnim: string) {
    if (srcAnim.localeCompare(destAnim) < 0) {
        return `${srcAnim}-${destAnim}`;
    } else {
        return `${destAnim}-${srcAnim}`;
    }
}

const identity = new Matrix4();
class SkeletonPool {
    private _skeletons = new Map<string, IUniqueSkeleton[]>();
    private _skin!: Object3D;
    private _root!: Object3D;

    public async load(skin: string) {
        this._skin = await objects.load(skin);
        this._root = utils.createObject(engine.scene!, "UniqueSkeletons");
        this._root.visible = false;
    }

    public dispose() {
        this._skeletons.clear();
    }

    public applyTransitionSkeleton(props: {
        unit: ICharacterUnit;
        destAnim: string;
        duration?: number;
        destAnimLoopMode?: LoopMode;
        destAnimSpeed?: number;
    }) {
        const { destAnim, unit, duration } = props;
        const id = getSkeletonId(unit.animation.name, destAnim);

        let skeletons = this._skeletons.get(id);
        if (!skeletons) {
            skeletons = [];
            this._skeletons.set(id, skeletons);
        }

        const srcClip = unit.animation.action.getClip();
        const destClip = engineState.animations.get(destAnim)!.clip;
        let skeleton = skeletons.find(skeleton => skeleton.isFree);
        if (!skeleton) {
            console.log(`Creating new skeleton for ${id}`);
            const skinCopy = SkeletonUtils.clone(this._skin);
            const skinnedMesh = skinCopy.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
            const _skeleton = skinnedMesh.skeleton;
            const rootBone = _skeleton.bones[0];
            const armature = rootBone.parent!;
            const mixer = new AnimationMixer(armature);
            mixer.clipAction(srcClip);
            mixer.clipAction(destClip);
            skeleton = {
                id,
                isFree: true,
                skeleton: _skeleton, 
                armature,
                mixer,
                tween: null
            };
            skeletons.push(skeleton);
            armature.name = `${armature.name}-${id}`;
            this._root.add(armature);
        }        

        const srcAction = skeleton.mixer.existingAction(srcClip)!;
        srcAction.reset().play();
        srcAction.time = unit.animation.action.time;
        srcAction.loop = unit.animation.action.loop;
        srcAction.clampWhenFinished = unit.animation.action.clampWhenFinished;

        const destAction = skeleton.mixer.existingAction(destClip)!;
        destAction.reset().play();
        if (props.destAnimLoopMode) {
            utils.setLoopMode(destAction, props.destAnimLoopMode, Infinity);
        }
        if (props.destAnimSpeed !== undefined) {
            destAction.timeScale = props.destAnimSpeed;
        }
        
        srcAction.crossFadeTo(destAction, duration ?? 1, false);
        skeleton.isFree = false;        
        skeleton.mixer.update(time.deltaTime);

        unit.skinnedMesh.bind(skeleton.skeleton, identity);
        unit.skeleton = skeleton;
        unit.animation.name = destAnim;
        unit.animation.action = destAction;
    }

    public transition(props: {
        unit: ICharacterUnit;
        destAnim: string;
        duration?: number;
        destAnimLoopMode?: LoopMode;
        destAnimSpeed?: number;
    }) {
        const { destAnim, unit, duration } = props;
        const srcAction = unit.animation.action;
        const destClip = engineState.animations.get(destAnim)!.clip;
        const destAction = unit.skeleton!.mixer.existingAction(destClip)!;
        destAction.reset().play();
        if (props.destAnimLoopMode) {
            utils.setLoopMode(destAction, props.destAnimLoopMode, Infinity);
        }        
        if (props.destAnimSpeed !== undefined) {
            destAction.timeScale = props.destAnimSpeed;
        }
        srcAction.crossFadeTo(destAction, duration ?? 1, false);
        unit.animation.name = destAnim;
        unit.animation.action = destAction;
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

    public releaseSkeleton(unit: ICharacterUnit) {
        unit.skeleton!.isFree = true;
        if (unit.skeleton!.tween) {
            unit.skeleton!.tween.kill();
            unit.skeleton!.tween = null;
        }
        unit.skeleton = null;
    }
}

export const skeletonPool = new SkeletonPool();

