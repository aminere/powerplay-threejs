import { useCallback, useEffect, useRef, useState } from "react";
import { Action, Actions } from "../GameTypes";

import styles from './GameMapUI.module.css';
import { utils } from "../../engine/Utils";
import { IGameUIProps } from "./GameUIProps";
import { cmdSetAction, evtCursorOverUI } from "../../Events";

function isPointInRect(x: number, y: number, rect: DOMRect) {
    return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

export function GameMapUI(props: IGameUIProps) {
    const root = useRef<HTMLDivElement>(null);
    const hoveredElement = useRef<HTMLElement | null>(null);
    const hoveredElementOnDown = useRef<HTMLElement | null>(null);
    const cursorOverUI = useRef(false);
    const actions = useRef<Record<string, HTMLElement>>({});
    const [selectedAction, setSelectedAction] = useState<Action | null>(null);

    const setAction = useCallback((newAction: Action) => {
        if (newAction === selectedAction) {
            cmdSetAction.post(null);
            setSelectedAction(null);
        } else {
            cmdSetAction.post(newAction);
            setSelectedAction(newAction);
        }
    }, [selectedAction]);

    useEffect(() => {
        if (!root.current) {
            return;
        }
        const onGamePointerMove = () => {
            const rect = root.current!.getBoundingClientRect();
            const { rawPointerPos } = props;
            const _cursorOverUI = isPointInRect(rawPointerPos.x, rawPointerPos.y, rect);
            if (cursorOverUI.current !== _cursorOverUI) {
                evtCursorOverUI.post(_cursorOverUI);
                cursorOverUI.current = _cursorOverUI;
            }

            if (utils.isPointerLocked()) {
                hoveredElement.current = null;
                for (const [, elem] of Object.entries(actions.current)) {
                    const hovered = isPointInRect(rawPointerPos.x, rawPointerPos.y, elem.getBoundingClientRect());
                    if (hovered) {
                        hoveredElement.current = elem;
                        elem.classList.add("hovered");
                    } else {
                        elem.classList.remove("hovered");
                    }
                }
            }
        };

        const onGamePointerDown = () => {
            if (utils.isPointerLocked()) {
                if (hoveredElement.current) {
                    hoveredElement.current.classList.add("active");
                    hoveredElementOnDown.current = hoveredElement.current;
                }
            }
        };

        const onGamePointerUp = () => {
            if (utils.isPointerLocked()) {
                if (hoveredElement.current && hoveredElement.current === hoveredElementOnDown.current) {
                    const action = hoveredElement.current.id as Action;
                    setAction(action);
                }
                hoveredElementOnDown.current?.classList.remove("active");
                hoveredElementOnDown.current = null;
            }
        };

        document.addEventListener('pointermove', onGamePointerMove);
        if (props.isWeb) {
            document.addEventListener('pointerdown', onGamePointerDown);
            document.addEventListener('pointerup', onGamePointerUp);
        }
        return () => {
            document.removeEventListener('pointermove', onGamePointerMove);
            if (props.isWeb) {
                document.removeEventListener('pointerdown', onGamePointerDown);
                document.removeEventListener('pointerup', onGamePointerUp);
            }
        };
    }, [setAction]);

    return <div ref={root} className={styles.root}>
        {Actions.map(action => {            
            const selected = selectedAction === action;            
            return <div
                id={action}
                key={action}
                className={`${styles.action} clickable ${selected ? styles.selected : ''}`}
                ref={e => actions.current[action] = e as HTMLElement}
                onClick={() => {
                    if (!utils.isPointerLocked()) {
                        setAction(action);
                    }
                }}
            >
                <div>
                    {action}
                </div>
            </div>
        })}
    </div>
}

