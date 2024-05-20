import { uiconfig } from "./uiconfig";

interface TooltipProps {
    rootRef: React.RefObject<HTMLDivElement>;
}

export function Tooltip(props: React.PropsWithChildren<TooltipProps>) {
    return <div
        ref={props.rootRef}
        className="tooltip"
        style={{
            position: "absolute",
            left: 0, //`calc(100% + ${uiconfig.paddingRem}rem)`,
            bottom: "100%", // `calc(100% + ${uiconfig.paddingRem}rem)`,
            backgroundColor: uiconfig.backgroundColor,
            padding: `${uiconfig.paddingRem}rem`,
            minWidth: "max-content",
            textAlign: "left"
        }}>
        {props.children}
    </div>
}

