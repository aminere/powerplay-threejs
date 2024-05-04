
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
            height: "5rem",
            width: "5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: ".1rem",
            textAlign: "center",
            backgroundColor: "#00000066",
            cursor: "pointer",
            outline: props.selected ? `2px solid ${props.selectedColor ?? "yellow"}` : undefined
        }}
        onClick={e => {
            e.stopPropagation();
            props.onClick();
        }}
    >
        {props.children}
    </div>
}

