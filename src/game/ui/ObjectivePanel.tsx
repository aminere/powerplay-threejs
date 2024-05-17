import React from "react"
import { Icon } from "./Icon"
import { uiconfig } from "./uiconfig"

function InlineIcon({ children}: React.PropsWithChildren<{}>) {
    return <div style={{
        display: "inline-block",
        transform: "translateY(8px)",
        height: "2rem"
    }}>
        {children}
    </div>
}

export function ObjectivesPanel() {
    return <div style={{
        position: "absolute",
        padding: `${uiconfig.paddingRem}rem`,
        backgroundColor: `${uiconfig.backgroundColor}`,
        left: "0px",
        top: "25%"
    }}>
        OBJECTIVE: Collect stone <InlineIcon><Icon name="stone"  /></InlineIcon> (1 / 5)
    </div>
}
