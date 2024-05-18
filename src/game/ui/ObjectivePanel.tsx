import { InlineIcon } from "./InlineIcon"
import { uiconfig } from "./uiconfig"

export function ObjectivesPanel() {
    return <div style={{
        position: "absolute",
        padding: `${uiconfig.paddingRem}rem`,
        backgroundColor: `${uiconfig.backgroundColor}`,
        left: "0px",
        top: "25%",
        display: "flex",
        alignItems: "flex-end",
        gap: ".5rem",
    }}>
        OBJECTIVE: Collect stone <InlineIcon name="stone"/> (1 / 5)
    </div>
}
