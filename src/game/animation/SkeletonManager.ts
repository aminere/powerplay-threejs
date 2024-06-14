import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { objects } from "../../engine/resources/Objects";
import { Box3, Matrix4, Object3D, Skeleton, SkinnedMesh } from "three";
import { engineState } from "../../engine/EngineState";
import { Animator } from "../../engine/components/Animator";
import { engine } from "../../engine/Engine";
import { utils } from "../../engine/Utils";
import { GameUtils } from "../GameUtils";
import { CharacterType, UnitType } from "../GameDefinitions";

const identity = new Matrix4();

class SkeletonManager {    
    
    public get boundingBox() { return this._boundingBox; }

    private _skeletons = new Map<string, {
        skeleton: Skeleton;
        armature: Object3D;
    }>();

    private _sharedSkinnedMeshes = new Map<UnitType, SkinnedMesh>();
    private _boundingBox!: Box3;

    public getSkeleton(animation: string) {
        return this._skeletons.get(animation);
    }

    public getSharedSkinnedMesh(type: CharacterType) {
        return this._sharedSkinnedMeshes.get(type);
    }

    public async load(props: {
        skins: Record<CharacterType, string>;
        animations: Array<{
            name: string;
            isLooping?: boolean;
        }>;
    }) {
        const skins = await Promise.all(Object.values(props.skins).map(skin => objects.load(skin)));
        const skin0 = skins[0];

        const skinnedMeshes = props.animations.map(animation => {
            const skinCopy = SkeletonUtils.clone(skin0);
            const skinnedMesh = skinCopy.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
            const skeleton = skinnedMesh.skeleton;
            const rootBone = skeleton.bones[0];
            const armature = rootBone.parent!;
            const animations = utils.makeStrArray([animation.name]);
            engineState.setComponent(armature, new Animator({ 
                animations, 
                currentAnim: 0,
                loopMode: animation.isLooping === false ? "Once" : "Repeat",
                speed: 1
            }));
            this._skeletons.set(animation.name, { skeleton, armature });
            return skinnedMesh;
        });

        const skeletons = utils.createObject(engine.scene!, "Skeletons");
        skeletons.visible = false;
        skinnedMeshes.forEach((skinnedMesh, i) => {
            const rootBone = skinnedMesh.skeleton.bones[0];
            const armature = rootBone.parent!;
            // this is purely for debugging purposes
            // it's dangerous since the armature is fetched by name in PropertyBinding constructor
            // this only works because the armature was already bound at this point, in Animator.start()
            armature.name = `${armature.name}-${props.animations[i].name}`;
            skeletons.add(armature);
        });

        skins.forEach((skin, i) => {
            const unitType = Object.keys(props.skins)[i] as UnitType;
            const skinCopy = SkeletonUtils.clone(skin);
            const sharedSkinnedMesh = skinCopy.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
            this._sharedSkinnedMeshes.set(unitType, sharedSkinnedMesh);
        });

        // TODO support a bounding boxes per type
        this._boundingBox = (() => {
            const skinnedMesh0 = skinnedMeshes[0];
            const rootBone0 = skinnedMesh0.skeleton.bones[0];
            const armature0 = rootBone0.parent!;        
            const baseRotation = armature0.quaternion.clone();        
            skinnedMesh0.geometry.computeBoundingBox();
            const boundingBox = skinnedMesh0.geometry.boundingBox!.clone()
            boundingBox.applyMatrix4(new Matrix4().compose(GameUtils.vec3.zero, baseRotation, GameUtils.vec3.one));
            return boundingBox;
        })();
    }

    public dispose() {
        this._skeletons.clear();
    }

    public applySkeleton(animation: string, target: SkinnedMesh, animSpeed?: number) {
        const skeleton = this._skeletons.get(animation);
        if (!skeleton) {
            return null;
        }
        if (target.skeleton !== skeleton.skeleton) {            
            target.bind(skeleton.skeleton, identity);
        }
        const animator = utils.getComponent(Animator, skeleton.armature)!;
        animator.props.speed = animSpeed ?? 1;
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

