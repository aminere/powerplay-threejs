import { AsyncEvent } from "ts-events";
import { Action, UIType } from "./game/GameTypes";

export const evtCursorOverUI = new AsyncEvent<boolean>();
export const cmdShowUI = new AsyncEvent<UIType>();
export const cmdHideUI = new AsyncEvent<UIType>();

export const cmdSetAction = new AsyncEvent<Action | null>();
