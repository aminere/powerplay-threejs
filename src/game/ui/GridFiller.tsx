import { uiconfig } from "./uiconfig"

interface GridFillerProps {
    columns: number;
    slots: number;
}

export function GridFiller(props: GridFillerProps) {
    return <div style={{
        position: "absolute",
        left: "0px",
        top: "0px",
        width: `100%`,
        height: `100%`,
        display: "grid",
        gap: `${uiconfig.gapRem}rem`,
        gridTemplateColumns: `repeat(${props.columns}, ${uiconfig.buttonSizeRem}rem)`,
        gridAutoRows: "min-content",
    }}>
        {[...Array(props.slots)].map((_, i) => {
            return <div
                key={i}
                style={{
                    width: `${uiconfig.buttonSizeRem}rem`,
                    height: `${uiconfig.buttonSizeRem}rem`,
                    backgroundColor: uiconfig.slotBackgroundColor,
                }}
            />
        })}
    </div>
}
