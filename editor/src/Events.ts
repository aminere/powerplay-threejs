
import { SyncEvent, AsyncEvent } from "ts-events";
import { Object3D } from "three";

export type ObjectMoved = {
    srcPath: number[];
    destPath: number[];
}

export type RemoveComponent = {
    type: string;
    obj: Object3D;
}

export type ShowPopover = {
    target: HTMLElement;
    content: JSX.Element;    
}

// events
export const evtObjectCreated = new AsyncEvent<Object3D>();
export const evtObjectDeleted = new SyncEvent<Object3D>();
export const evtObjectMoved = new AsyncEvent<ObjectMoved>();
export const evtObjectChanged = new AsyncEvent<Object3D>();
export const evtObjectChanging = new AsyncEvent<Object3D>();
export const evtObjectRenamed = new AsyncEvent<Object3D>();
export const evtObjectSelected = new SyncEvent<Object3D | null>();
export const evtTabRemoved = new AsyncEvent<string>();
export const evtEngineStatusChanged = new AsyncEvent<void>();
export const evtShowStatsChanged = new AsyncEvent<boolean>();
export const evtShowFPSChanged = new AsyncEvent<boolean>();
export const evtObjectTransformChanged = new AsyncEvent<void>();
export const evtSceneLoadingStarted = new AsyncEvent<void>();
export const evtSceneLoadingFinished = new AsyncEvent<void>();

// commands
export const cmdImportModel = new SyncEvent<void>();
export const cmdImportImage = new SyncEvent<(img: HTMLImageElement) => void>();
export const cmdImportScene = new SyncEvent<void>();
export const cmdImportObject = new SyncEvent<void>();
export const cmdRefreshInspectors = new AsyncEvent<Object3D>();
export const cmdSaveScene = new SyncEvent<boolean>();
export const cmdRefreshTree = new SyncEvent<void>();
export const cmdFocusObject = new AsyncEvent<Object3D>();
export const cmdSaveEditorCamera = new AsyncEvent<void>();
export const cmdShowPopover = new AsyncEvent<ShowPopover>();
export const cmdToggleViewportControls = new AsyncEvent<void>();
export const cmdRequestScreenshot = new AsyncEvent<void>();

