import { MathUtils } from "three";
import { LoopMode } from "../../engine/serialization/Types";
import { skeletonManager } from "../animation/SkeletonManager";
import { getSkeletonId, skeletonPool } from "../animation/SkeletonPool";
import { ICharacterUnit } from "./ICharacterUnit";
import gsap from "gsap";

class UnitAnimation {

    public setAnimation(
        unit: ICharacterUnit,
        _animation: string,
        props?: {
            transitionDuration?: number;
            scheduleCommonAnim?: boolean;
            destAnimLoopMode?: LoopMode;
            destAnimSpeed?: number;
        }
    ) {
        
        const animation = (() => {
            if (unit.resource) {
                if (_animation === "idle") {
                    return "carry-idle";
                } else if (_animation === "run") {
                    return "carry-run";
                } else {
                    return _animation;
                }
            } else {
                return _animation;
            }
        })();       

        if (animation === unit.animation!.name) {
            return;
        }
        
        const destAnimSpeed = props?.destAnimSpeed;
        if (props?.transitionDuration !== undefined) {
    
            const { transitionDuration, destAnimLoopMode } = props;
            const skeletonId = getSkeletonId(unit.animation!.name, animation);            
            if (unit.skeleton?.id === skeletonId) {
                skeletonPool.transition({ unit, destAnim: animation, duration: transitionDuration, destAnimLoopMode, destAnimSpeed });
            } else {
                if (unit.skeleton) {
                    skeletonPool.releaseSkeleton(unit);
                }
                skeletonPool.applyTransitionSkeleton({ unit, destAnim: animation, duration: transitionDuration, destAnimLoopMode, destAnimSpeed });
            }
    
            if (props.scheduleCommonAnim) {
                skeletonPool.releaseSkeletonTweens(unit.skeleton!);

                const currentAction = unit.animation.action;
                const targetAction = skeletonManager.getAction(animation)!;
                const anim = { time: 0 }
                unit.skeleton!.syncToCommonAnim = gsap.to(anim, {
                    time: transitionDuration,
                    duration: transitionDuration,
                    onUpdate: () => {
                        const factor = anim.time / transitionDuration;
                        currentAction.time = MathUtils.lerp(currentAction.time, targetAction.time, factor);
                    },
                    onComplete: () => {
                        currentAction.time = targetAction.time;
                        unit.skeleton!.syncToCommonAnim = null;
                        this.setCommonAnimation(unit, animation, destAnimSpeed);
                    }
                });

            } else {
                skeletonPool.releaseSkeletonTweens(unit.skeleton!);
            }
    
        } else {            
            this.setCommonAnimation(unit, animation, destAnimSpeed);
        }
    }    

    public getSkeleton(unit: ICharacterUnit) {
        if (unit.skeleton) {
            return unit.skeleton.armature;
        } else {
            const skeleton = skeletonManager.getSkeleton(unit.animation.name)!;
            return skeleton.armature;
        }
    }

    private setCommonAnimation(unit: ICharacterUnit, animation: string, animSpeed?: number) {
        if (unit.skeleton) {
            skeletonPool.releaseSkeleton(unit);
        }
        const action = skeletonManager.applySkeleton(animation, unit.skinnedMesh, animSpeed)!;
        unit.animation.name = animation;
        unit.animation.action = action;
    }
}

export const unitAnimation = new UnitAnimation();

