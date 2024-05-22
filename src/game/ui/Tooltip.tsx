import { uiconfig } from "./uiconfig";

interface TooltipProps {
    rootRef: React.RefObject<HTMLDivElement>;
    options?: {
        position?: "top" | "bottom";
    }    
}

export function Tooltip(props: React.PropsWithChildren<TooltipProps>) {

    const position = props.options?.position ?? "top";
    return <div
        ref={props.rootRef}
        className="tooltip"
        style={{
            position: "absolute",
            left: 0,
            bottom: position === "top" ? "100%" : undefined,
            top: position === "bottom" ? "100%" : undefined,
            backgroundColor: uiconfig.backgroundColor,
            padding: `${uiconfig.paddingRem}rem`,
            minWidth: "max-content",
            textAlign: "left"
        }}>
        {props.children}
    </div>
}

