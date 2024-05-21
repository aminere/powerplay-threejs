import { IndicatorPanel } from "../../Events";
import { uiconfig } from "./uiconfig";
import { InlineIcon } from "./InlineIcon";

interface IArrowIndicatorProps {
    x: number;
    y: number;
    panel?: IndicatorPanel;
    position?: "absolute" | "fixed";
    align?: "left" | "top";
}

export function ArrowIndicator(props: IArrowIndicatorProps) {

    const align = props.align ?? "top";
    return <div
        className={align === "top" ? "float" : "float-left"}
        style={{
            position: props.position ?? "absolute",
            left: `${props.x}px`,
            top: `${props.y}px`,
            minWidth: "max-content",
            pointerEvents: "none",
        }}>
        <img
            style={{
                height: "3rem",
                transform: (() => {
                    switch (align) {
                        case "top": return "translateX(-50%) translateY(-3rem)";
                        default: return "rotate(-90deg) translate(3rem, -50%)";
                    }
                })(),
                transformOrigin: "bottom"
            }}
            src="/images/arrows.png"
        />

        {
            props.panel
            &&
            <div style={{
                transform: "translateX(-50%) translateY(-11rem)",
                display: "flex",
                gap: `${uiconfig.gapRem}rem`,
            }}>
                <div style={{
                    padding: `${uiconfig.paddingRem}rem`,
                    backgroundColor: `${uiconfig.backgroundColor}`,
                    display: "flex",
                    gap: ".5rem",
                    alignItems: "flex-end"
                }}>
                    {props.panel.action} {props.panel.actionIcon && <InlineIcon name={props.panel.actionIcon} />}
                </div>
                <div style={{
                    position: "relative",
                    padding: `${uiconfig.paddingRem}rem`,
                    backgroundColor: `${uiconfig.backgroundColor}`,
                    display: "flex",
                    gap: ".5rem",
                    alignItems: "flex-end"
                }}>
                    {props.panel.control}
                    <InlineIcon name={props.panel.icon} />
                </div>
            </div>
        }        
    </div>
}

