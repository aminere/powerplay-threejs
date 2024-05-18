import { IndicatorProps } from "../../Events";
import { uiconfig } from "./uiconfig";
import { InlineIcon } from "./InlineIcon";

interface IArrowIndicatorProps {
    x: number;
    y: number;
    props?: IndicatorProps;
    position?: "absolute" | "fixed";
}

export function ArrowIndicator(props: IArrowIndicatorProps) {
    return <div
        className="float"
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
                transform: "translateX(-50%) translateY(-3rem)",
            }}
            src="/images/arrows.png"
        />

        {
            props.props
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
                    {props.props.action} {props.props.actionIcon && <InlineIcon name={props.props.actionIcon} />}
                </div>
                <div style={{
                    position: "relative",
                    padding: `${uiconfig.paddingRem}rem`,
                    backgroundColor: `${uiconfig.backgroundColor}`,
                    display: "flex",
                    gap: ".5rem",
                    alignItems: "flex-end"
                }}>
                    {props.props.control}
                    <InlineIcon name={props.props.icon} />
                </div>
            </div>
        }        
    </div>
}

