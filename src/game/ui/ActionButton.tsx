import { cmdShowTooltip, evtActionClicked } from "../../Events";
import { uiconfig } from "./uiconfig";
import React, { useEffect, useRef } from "react";

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
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onShowTooltip = (id?: string) => {
            const show = id && id === props.id;
            if (show) {
                if (!tooltipRef.current!.classList.contains("visible")) {
                    tooltipRef.current!.classList.add("visible");
                }
            } else {
                if (tooltipRef.current!.classList.contains("visible")) {
                    tooltipRef.current!.classList.remove("visible");
                }
            }
        }
        cmdShowTooltip.attach(onShowTooltip);
        return () => {
            cmdShowTooltip.detach(onShowTooltip)
        }
    }, []);

    return <div
        id={props.id}
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

            if (props.id) {
                evtActionClicked.post(props.id);
            }
        }}
        onContextMenu={e => {
            e.stopPropagation();
            e.preventDefault();
            props.onContextMenu?.();
        }}

        onPointerEnter={() => {
            cmdShowTooltip.post(props.id);
        }}

        onPointerLeave={() => {
            cmdShowTooltip.post(undefined);
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

        <div
            ref={tooltipRef}
            className="tooltip"
            style={{
                position: "absolute",
                left: 0, //`calc(100% + ${uiconfig.paddingRem}rem)`,
                bottom: "100%", // `calc(100% + ${uiconfig.paddingRem}rem)`,
                backgroundColor: uiconfig.backgroundColor,
                padding: `${uiconfig.paddingRem}rem`,
                // minWidth: "10ch",
                minWidth: "max-content",
                textAlign: "left"
            }}>
            {props.id}
        </div>

    </div>
}

