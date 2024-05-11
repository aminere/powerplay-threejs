import { uiconfig } from "./uiconfig";

interface ActionButtonProps {
    onClick: () => void;
    onContextMenu?: () => void;
    selected?: boolean;
    selectedColor?: "yellow" | "white";
    selectedAnim?: boolean;
}

export function ActionButton(props: React.PropsWithChildren<ActionButtonProps>) {
    return <div
        className={`icon clickable ${props.selectedAnim ? "item-auto-output" : ""}`}
        style={{
            position: "relative",
            height: `${uiconfig.buttonSizeRem}rem`,
            width: `${uiconfig.buttonSizeRem}rem`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            cursor: "pointer",
            border: (() => {
                if (props.selectedAnim) {
                    return undefined
                }
                if (props.selected) {
                    return `${uiconfig.selectedBorderSizePx}px double ${props.selectedColor ?? "yellow"}`;
                }
                return "1px outset gray";
            })(),
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

