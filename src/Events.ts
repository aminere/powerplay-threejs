import { AsyncEvent, SyncEvent } from "ts-events";
import { UIType } from "./game/GameDefinitions";
import { Vector2 } from "three";
import { IBuildingInstance } from "./game/buildings/BuildingTypes";
import { IUnit } from "./game/unit/Unit";
import { ICell } from "./game/GameTypes";

export const cmdShowUI = new AsyncEvent<UIType>();
export const cmdHideUI = new SyncEvent<UIType>();

interface IBuildingSelection {
    type: "building";
    building: IBuildingInstance;
}

interface IUnitSelection {
    type: "units",
    units: IUnit[];
}

interface ICellSelection {
    type: "cell";
    cell: ICell;
}

export type SelectedElems = IBuildingSelection | IUnitSelection | ICellSelection;
export const cmdSetSelectedElems = new AsyncEvent<SelectedElems | null>();

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

export const cmdSpawnUnit = new AsyncEvent<IBuildingInstance>();

export const evtScreenResized = new AsyncEvent<void>();
export const evtUnitKilled = new SyncEvent<IUnit>();
export const evtActionCleared = new AsyncEvent<void>();
export const evtBuildError = new AsyncEvent<string>();
export const evtBuildingStateChanged = new AsyncEvent<IBuildingInstance>();
