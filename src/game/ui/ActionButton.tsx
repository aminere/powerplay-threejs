import { cmdShowTooltip, evtActionClicked } from "../../Events";
import { tooltips } from "./Tooltips";
import { uiconfig } from "./uiconfig";
import React from "react";
import { useTooltip } from "./useTooltip";
import { Tooltip } from "./Tooltip";

interface ActionButtonProps {
    id?: string;
    tooltipId?: string;
    visible?: boolean;
    onClick: () => void;
    onContextMenu?: () => void;
    selected?: boolean;
    selectedColor?: "yellow" | "white" | "red";
    selectedAnim?: boolean;
}

export function ActionButton(props: React.PropsWithChildren<ActionButtonProps>) {

    const visible = props.visible ?? true;
    const { id, tooltipId } = props; 

    const tooltipRef = useTooltip(tooltipId);
    const tooltip = tooltipId ? tooltips.getContent(tooltipId) : null;
    return <div
        id={id}
        className={`action icon clickable ${props.selectedAnim ? "item-auto-output" : ""}`}
        style={{
            pointerEvents: "all",
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
            props.onClick();

            // in the editor, this is needed to avoid sending clicks to the editor viewport which dispatches it to the game 
            // TODO handle game input on the game canvas, not the viewport
            // in the game, this is needed so that onClick() doesn't trigger on ActionButton ancestors
            e.stopPropagation();

            if (id) {
                evtActionClicked.post(id);
            }
        }}
        onContextMenu={e => {
            e.stopPropagation();
            e.preventDefault();
            props.onContextMenu?.();
        }}

        onPointerEnter={() => {
            if (tooltipId) {
                cmdShowTooltip.post(tooltipId);
            }
        }}

        onPointerLeave={() => {
            if (tooltipId) {
                cmdShowTooltip.post(undefined);
            }
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

        {
            tooltip
            &&
            <Tooltip rootRef={tooltipRef}>
                {tooltip}
            </Tooltip>
        }       
    </div>
}

