import { LoopMode } from "../../engine/serialization/Types";
import { skeletonManager } from "../animation/SkeletonManager";
import { getSkeletonId, skeletonPool } from "../animation/SkeletonPool";
import { IUnit } from "./IUnit";

class UnitAnimation {

    public setAnimation(
        unit: IUnit,
        _animation: string,
        props?: {
            transitionDuration?: number;
            scheduleCommonAnim?: boolean;
            destAnimLoopMode?: LoopMode;
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
        
        if (props?.transitionDuration !== undefined) {
    
            const { transitionDuration, destAnimLoopMode } = props;
            const skeletonId = getSkeletonId(unit.animation!.name, animation);
            
            if (unit.skeleton?.id === skeletonId) {
                skeletonPool.transition({ unit, destAnim: animation, duration: transitionDuration, destAnimLoopMode });
            } else {
                if (unit.skeleton) {
                    skeletonPool.releaseSkeleton(unit);
                }
                skeletonPool.applyTransitionSkeleton({ unit, destAnim: animation, duration: transitionDuration, destAnimLoopMode });
            }
    
            if (props.scheduleCommonAnim) {
                if (unit.skeleton!.timeout) {
                    clearTimeout(unit.skeleton!.timeout);
                }
                unit.skeleton!.timeout = setTimeout(() => {
                    unit.skeleton!.timeout = null;
                    this.setCommonAnimation(unit, animation);
                }, transitionDuration * 1000 + 200);
            } else {
                if (unit.skeleton!.timeout) {
                    clearTimeout(unit.skeleton!.timeout);
                    unit.skeleton!.timeout = null;
                }
            }
    
        } else {
            this.setCommonAnimation(unit, animation);
        }
    }    

    public getSkeleton(unit: IUnit) {
        if (unit.skeleton) {
            return unit.skeleton.armature;
        } else {
            const skeleton = skeletonManager.getSkeleton(unit.animation.name)!;
            return skeleton?.armature;
        }
    }

    private setCommonAnimation(unit: IUnit, animation: string) {
        if (unit.skeleton) {
            skeletonPool.releaseSkeleton(unit);
        }
        const action = skeletonManager.applySkeleton(animation, unit.obj)!;
        unit.animation.name = animation;
        unit.animation.action = action;
    }
}

export const unitAnimation = new UnitAnimation();

