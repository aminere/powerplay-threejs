import { uiconfig } from "./uiconfig";

interface MenuButtonProps {    
    disabled?: boolean;
    onClick: () => void;
}

export function MenuButton(props: React.PropsWithChildren<MenuButtonProps>) {
    return <div
        style={{
            backgroundColor: uiconfig.slotBackgroundColor,
            height: `${uiconfig.buttonSizeRem}rem`,
            padding: `${2 * uiconfig.gapRem}rem`,
            fontSize: "2rem",
            border: "1px outset gray",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textTransform: "uppercase",
            textShadow: "1px 1px 0px black",
            pointerEvents: props.disabled ? "none": "all",
            opacity: props.disabled ? .5 : 1
        }}
        className="clickable"
        onClick={props.onClick}
    >
        {props.children}
    </div>;
}

