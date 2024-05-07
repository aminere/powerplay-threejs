import { uiconfig } from "./uiconfig";

interface ActionButtonProps {
    onClick: () => void;
    selected?: boolean;
    selectedColor?: "yellow" | "red";
}

export function ActionButton(props: React.PropsWithChildren<ActionButtonProps>) {
    return <div
        className="clickable"
        style={{
            position: "relative",
            height: `${uiconfig.buttonSize}rem`,
            width: `${uiconfig.buttonSize}rem`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: ".1rem",
            textAlign: "center",
            backgroundColor: uiconfig.buttonBackgroundColor,
            cursor: "pointer",
            border: props.selected ? `2px outset ${props.selectedColor ?? "yellow"}` : `1px outset darkgrey`,            
        }}
        onClick={e => {
            e.stopPropagation();
            props.onClick();
        }}
    >
        {props.children}
    </div>
}

