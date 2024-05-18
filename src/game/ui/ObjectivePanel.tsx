import { useEffect, useState } from "react"
import { InlineIcon } from "./InlineIcon"
import { uiconfig } from "./uiconfig"
import { SetObjectiveEvent, cmdSetObjective, cmdSetObjectiveStatus } from "../../Events";

export function ObjectivesPanel() {

    const [objective, setObjective] = useState<SetObjectiveEvent | null>(null);
    const [status, setStatus] = useState<string>();

    useEffect(() => {
        cmdSetObjective.attach(setObjective);
        cmdSetObjectiveStatus.attach(setStatus);
        return () => {
            cmdSetObjective.detach(setObjective);
            cmdSetObjectiveStatus.detach(setStatus);
        }
    }, []);

    if (!objective) {
        return null;
    }

    return <div style={{
        position: "absolute",
        left: "0px",
        top: "25%",
        display: "flex",
        flexDirection: "column",
        gap: ".2rem",
    }}>
        <div style={{
            padding: `${uiconfig.paddingRem}rem`,
            backgroundColor: `${uiconfig.backgroundColor}`,
            textAlign: "center"
        }}>
            OBJECTIVE
        </div>
        <div style={{
            padding: `${uiconfig.paddingRem}rem`,
            backgroundColor: `${uiconfig.backgroundColor}`,
            display: "flex",
            alignItems: "flex-end",
            gap: ".5rem",
        }}>
            <span>{objective.objective}</span>
            {objective.icon && <InlineIcon name={objective.icon} />}
            {status && <span>{status}</span>}
        </div>
    </div>
}

