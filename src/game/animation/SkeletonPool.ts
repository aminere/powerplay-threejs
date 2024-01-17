import { Matrix4, Object3D, Skeleton, SkinnedMesh } from "three";

interface IUniqueSkeleton {
    isFree: boolean;
    skeleton: Skeleton;
    armature: Object3D;
}

const identity = new Matrix4();
class SkeletonPool {
    private _skeletons: IUniqueSkeleton[] = [];

    public init(animations: string[]) {

    }

    public applyUniqueSkeleton(animation: string, target: SkinnedMesh) {
        const skeleton = this._skeletons.find(s => s.isFree);
        if (!skeleton) {
            console.warn("No free skeletons available");
            return;
        }
        skeleton.isFree = false;
        
        if (target.skeleton !== skeleton.skeleton) {
            target.bind(skeleton.skeleton, identity);
        }
    }
}

export const skeletonPool = new SkeletonPool();

