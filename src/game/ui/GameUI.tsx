import { useEffect, useRef } from "react";
import { Action, Actions } from "../GameTypes";
import { evtCursorOverUI } from "../../Events";
import styles from './GameUI.module.css';
import { utils } from "../../powerplay";
import { Vector2 } from "three";

function isPointInRect(x: number, y: number, rect: DOMRect) {
    return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

interface IProps {
    isWeb: boolean;
    pointerPos: Vector2;
}

export function GameUI(props: IProps) {

    const root = useRef<HTMLDivElement>(null);
    const actions = useRef<Record<string, HTMLElement>>({});
    const hoveredElement = useRef<HTMLElement | null>(null);
    const hoveredElementOnDown = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!root.current) {
            return;
        }
        const onGamePointerMove = () => {
            const rect = root.current!.getBoundingClientRect();
            const { pointerPos } = props;
            const cursorOverUI = isPointInRect(pointerPos.x, pointerPos.y, rect);
            evtCursorOverUI.post(cursorOverUI);

            if (utils.isPointerLocked()) {
                hoveredElement.current = null;
                for (const [, elem] of Object.entries(actions.current)) {
                    const hovered = isPointInRect(pointerPos.x, pointerPos.y, elem.getBoundingClientRect());
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
                    console.log("action", action);
                    // setAction(action);
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
    }, []);

    return <div ref={root} className={styles.root}>
        {Actions.map(action => {
            const selected = false;
            // const selected = context?.action === action;
            return <div
                id={action}
                key={action}
                className={`${styles.action} clickable ${selected ? styles.selected : ''}`}
                ref={e => actions.current[action] = e as HTMLElement}
                onClick={() => {
                    if (!utils.isPointerLocked()) {
                        console.log('click', action);
                        // setAction(action);
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

