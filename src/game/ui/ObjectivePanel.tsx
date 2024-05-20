import { useEffect, useRef, useState } from "react"
import { InlineIcon } from "./InlineIcon"
import { uiconfig } from "./uiconfig"
import { SetObjectiveEvent, cmdSetObjective, cmdSetObjectiveStatus } from "../../Events";

export function ObjectivesPanel() {

    const [objective, setObjective] = useState<SetObjectiveEvent | null>(null);
    const [status, setStatus] = useState<string>();

    useEffect(() => {
        cmdSetObjective.attach(setObjective);

        const _setStatus = (status: string) => {
            setStatus(status);
            const elem = objectiveRef.current!;
            if (elem) {
                if (elem.classList.contains("highlight")) {
                    elem.classList.remove("highlight");
                    void elem.offsetWidth;
                }
                elem.classList.add("highlight");
            }
        }

        cmdSetObjectiveStatus.attach(_setStatus);
        return () => {
            cmdSetObjective.detach(setObjective);
            cmdSetObjectiveStatus.detach(_setStatus);
        }
    }, []);

    const objectiveRef = useRef<HTMLDivElement | null>(null);

    if (!objective) {
        return null;
    }

    return <div
        className="ui"
        style={{
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
        <div
            ref={objectiveRef}
            style={{
                padding: `${uiconfig.paddingRem}rem`,
                backgroundColor: `${uiconfig.backgroundColor}`,
                display: "flex",
                alignItems: "flex-end",
                gap: ".5rem",
            }}
        >
            <span>{objective.objective}</span>
            {objective.icon && <InlineIcon name={objective.icon} />}
            {status && <span>({status})</span>}
        </div>
    </div>
}

