import { uiconfig } from "./uiconfig";

interface ActionButtonProps {
    onClick: () => void;
    selected?: boolean;
    selectedColor?: "yellow" | "white";
}

export function ActionButton(props: React.PropsWithChildren<ActionButtonProps>) {
    return <div
        className="clickable"
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
            padding: `${uiconfig.gapRem}rem`,
        }}
        onClick={e => {
            e.stopPropagation();
            props.onClick();
        }}
    >
        {props.children}
    </div>
}

