import { AsyncEvent, SyncEvent } from "ts-events";
import { UIType } from "./game/GameDefinitions";
import { Vector2 } from "three";
import { IBuildingInstance } from "./game/buildings/BuildingTypes";
import { IUnit } from "./game/unit/Unit";

export const cmdShowUI = new AsyncEvent<UIType>();
export const cmdHideUI = new SyncEvent<UIType>();

export const cmdSetSelectedElems = new AsyncEvent<{
    units?: IUnit[];
    building?: IBuildingInstance;
    conveyor?: Vector2;
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
export const cmdRotateMinimap = new AsyncEvent<number>();

export const cmdFogAddCircle = new SyncEvent<{ mapCoords: Vector2; radius: number; }>();
export const cmdFogMoveCircle = new SyncEvent<{ mapCoords: Vector2; radius: number; dx: number; dy: number; }>();
export const cmdFogRemoveCircle = new SyncEvent<{ mapCoords: Vector2; radius: number;}>();


export const evtScreenResized = new AsyncEvent<void>();
export const evtUnitKilled = new SyncEvent<IUnit>();
export const evtActionCleared = new AsyncEvent<void>();

