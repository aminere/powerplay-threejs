import { AnimationAction, SkinnedMesh, Vector2 } from "three";
import { IUnit } from "./IUnit";
import { IUniqueSkeleton } from "../animation/SkeletonPool";
import { ICarriedResource } from "../GameTypes";
import { CharacterType } from "../GameDefinitions";
import { State } from "../fsm/StateMachine";

export interface IUnitAnim {
    name: string;
    action: AnimationAction;
}

export interface ICharacterUnit extends IUnit {
    skinnedMesh: SkinnedMesh;
    animation: IUnitAnim;
    skeleton: IUniqueSkeleton | null;
    muzzleFlashTimer: number;
    resource: ICarriedResource | null;
    targetBuilding: Vector2 | null;
    clearResource: () => void;
}

export interface ICharacterUnitProps {
    visual: SkinnedMesh;    
    type: CharacterType;
    speed?: number;
    states: State<ICharacterUnit>[];
    animation: IUnitAnim;
}

