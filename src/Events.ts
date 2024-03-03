import { AsyncEvent, SyncEvent } from "ts-events";
import { UIType } from "./game/GameDefinitions";
import { Vector2 } from "three";
import { IUnit } from "./game/unit/IUnit";
import { IBuildingInstance } from "./game/GameTypes";

export const evtScreenResized = new AsyncEvent<void>();
export const cmdShowUI = new AsyncEvent<UIType>();
export const cmdHideUI = new AsyncEvent<UIType>();

export const cmdSetSelectedElems = new AsyncEvent<{
    units?: IUnit[];
    building?: IBuildingInstance;
}>();

export const cmdStartSelection = new AsyncEvent<Vector2>();
export const cmdEndSelection = new AsyncEvent<void>();
export const cmdUpdateUI = new SyncEvent<void>();
export const cmdRenderUI = new SyncEvent<void>();

export interface IMinimapFog {
    x: number;
    y: number;
    visible: boolean;
}

export const cmdUpdateMinimapFog = new AsyncEvent<IMinimapFog>();

