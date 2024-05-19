import { uiconfig } from "./uiconfig";

export function TextButton({ text, onClick }: { text: string, onClick: () => void }) {
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
        }}
        className="clickable"
        onClick={onClick}
    >
        {text.toUpperCase()}
    </div>;
}

