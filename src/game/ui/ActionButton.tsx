import { evtActionClicked } from "../../Events";
import { engine } from "../../engine/Engine";
import { uiconfig } from "./uiconfig";
import React from "react";

interface ActionButtonProps {
    id?: string;
    visible?: boolean;
    onClick: () => void;
    onContextMenu?: () => void;
    selected?: boolean;
    selectedColor?: "yellow" | "white";
    selectedAnim?: boolean;
}

export function ActionButton(props: React.PropsWithChildren<ActionButtonProps>) {

    const visible = props.visible ?? true;
    return <div
        id={props.id}
        className={`action icon clickable ${props.selectedAnim ? "item-auto-output" : ""}`}
        style={{
            position: "relative",
            height: `${uiconfig.buttonSizeRem}rem`,
            width: `${uiconfig.buttonSizeRem}rem`,
            display: visible ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            cursor: "pointer",
            border: (() => {
                if (props.selectedAnim) {
                    return undefined
                }
                if (props.selected) {
                    return `${uiconfig.selectedBorderSizePx}px solid ${props.selectedColor ?? "yellow"}`;
                }
                return "1px outset gray";
            })(),
            backgroundColor: uiconfig.slotBackgroundColor,
            padding: `${2 * uiconfig.gapRem}rem`
        }}
        onClick={e => {
            if (engine.runtime === "editor") {
                // in the editor, this is needed to avoid sending clicks to the editor viewport which dispatches it to the game 
                // TODO handle game input on the game canvas, not the viewport
                e.stopPropagation();
            }
            props.onClick();

            if (props.id) {
                evtActionClicked.post(props.id);
            }
        }}
        onContextMenu={e => {
            e.stopPropagation();
            e.preventDefault();
            props.onContextMenu?.();
        }}
    >
        {
            props.selectedAnim
            &&
            <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                <rect height="100%" width="100%" />
            </svg>
        }

        {props.children}
    </div>
}

