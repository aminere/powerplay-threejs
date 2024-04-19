import { SkinnedMesh } from "three";
import { IUniqueSkeleton } from "../animation/SkeletonPool";
import { IUnit, IUnitAnim } from "./IUnit";

export interface ICharacterUnit extends IUnit {
    skinnedMesh: SkinnedMesh;
    animation: IUnitAnim;
    skeleton: IUniqueSkeleton | null;
    muzzleFlashTimer: number;
}

