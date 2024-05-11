import { uiconfig } from "./uiconfig";

interface ActionButtonProps {
    onClick: () => void;
    onContextMenu?: () => void;
    selected?: boolean;
    selectedColor?: "yellow" | "white";
}

export function ActionButton(props: React.PropsWithChildren<ActionButtonProps>) {
    return <div
        className="icon clickable"
        style={{
            position: "relative",
            height: `${uiconfig.buttonSizeRem}rem`,
            width: `${uiconfig.buttonSizeRem}rem`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            cursor: "pointer",
            border: props.selected ? `${uiconfig.selectedBorderSizePx}px double ${props.selectedColor ?? "yellow"}` : "1px outset gray",
            backgroundColor: uiconfig.slotBackgroundColor,
            padding: `${2 * uiconfig.gapRem}rem`
        }}
        onClick={e => {
            e.stopPropagation();
            props.onClick();
        }}
        onContextMenu={e => {
            e.stopPropagation();
            e.preventDefault();
            props.onContextMenu?.();
        }}
    >
        {props.children}
    </div>
}

