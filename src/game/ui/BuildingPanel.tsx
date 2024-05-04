
import { IBuildingInstance } from "../buildings/BuildingTypes";

interface BuildingPanelProps {
    instance: IBuildingInstance;
}

export function BuildingPanel(props: React.PropsWithChildren<BuildingPanelProps>) {
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

