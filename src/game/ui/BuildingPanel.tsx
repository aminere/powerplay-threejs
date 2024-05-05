
import { useEffect, useState } from "react";
import { IBuildingInstance } from "../buildings/BuildingTypes";

interface BuildingPanelProps {
    timestamp: number;
    instance: IBuildingInstance;
}

export function BuildingPanel(props: React.PropsWithChildren<BuildingPanelProps>) {

    const [, setTimestamp] = useState(props.timestamp);

    const { timestamp } = props;
    useEffect(() => {
        setTimestamp(timestamp);
    }, [timestamp]);

    return <div
        style={{
            padding: ".5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            backgroundColor: "#0000002b",
            height: "100%",
            pointerEvents: "all",
            position: "relative"
        }}>
        <div
            style={{
                textAlign: "center",
                fontWeight: "bold",
                textTransform: "uppercase"
            }}>
            {props.instance.buildingType}
        </div>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "space-between" }}>
            {props.children}
        </div>
    </div>
}

