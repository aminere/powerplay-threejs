import { AsyncEvent, SyncEvent } from "ts-events";
import { UIType, UnitType } from "./game/GameDefinitions";
import { Vector2 } from "three";
import { IBuildingInstance } from "./game/buildings/BuildingTypes";
import { IUnit } from "./game/unit/IUnit";
import { ICell } from "./game/GameTypes";

export const cmdShowUI = new AsyncEvent<UIType | null>();

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
    mapCoords: Vector2;
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

export const cmdSpawnUnit = new AsyncEvent<[IBuildingInstance, UnitType]>();

export const evtScreenResized = new AsyncEvent<void>();
export const evtUnitKilled = new SyncEvent<IUnit>();
export const evtActionCleared = new AsyncEvent<void>();
export const evtBuildError = new AsyncEvent<string>();
export const evtBuildingStateChanged = new AsyncEvent<IBuildingInstance>();
export const evtUnitStateChanged = new AsyncEvent<IUnit>();
export const evtCellStateChanged = new AsyncEvent<ICell>();
export const evtGameMapUIMounted = new AsyncEvent<void>();

interface IBuildingIndicator {
    type: "building";
    building: IBuildingInstance;
}

interface IUnitIndicator {
    type: "unit",
    unit: IUnit;
}

interface ICellIndicator {
    type: "cell";
    mapCoords: Vector2;
}

interface IUIIndicator {
    type: "ui";
    element: string;
}

export type IndicatorType = IBuildingIndicator | IUnitIndicator | ICellIndicator | IUIIndicator;
export interface IndicatorProps {
    action: string;
    actionIcon?: string;
    control: string;
    icon: string;
}

export interface SetIndicatorEvent {
    indicator: IndicatorType;
    props?: IndicatorProps;    
}

export const cmdSetIndicator = new AsyncEvent<SetIndicatorEvent | null>();

export interface SetObjectiveEvent {
    objective: string;
    icon?: string;
}

export const cmdSetObjective = new AsyncEvent<SetObjectiveEvent | null>();
export const cmdSetObjectiveStatus = new AsyncEvent<string>();
export const evtActionClicked = new AsyncEvent<string>();
export const evtBuildingCreated = new AsyncEvent<IBuildingInstance>();

