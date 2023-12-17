import { AsyncEvent, SyncEvent } from "ts-events";
import { UIType } from "./game/GameTypes";
import { Object3D, Vector2 } from "three";

export const evtCursorOverUI = new AsyncEvent<boolean>();
export const cmdShowUI = new AsyncEvent<UIType>();
export const cmdHideUI = new AsyncEvent<UIType>();

export interface ISelectedUnit {
    obj: Object3D;
    health: number;
} 

export const cmdSetSeletedUnits = new AsyncEvent<ISelectedUnit[]>();
export const cmdStartSelection = new AsyncEvent<Vector2>();
export const cmdEndSelection = new AsyncEvent<void>();
export const cmdUpdateUI = new SyncEvent<void>();
