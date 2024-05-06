import { useEffect, useState } from "react"
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { SelectedElems, cmdSetSelectedElems, evtBuildingStateChanged } from "../../Events";

interface SingleSelectionProps {
    name: string;
}

function SingleSelectionPanel(props: SingleSelectionProps) {
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
            {props.name}
        </div>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "space-between" }}>
            
        </div>
    </div>
}

function MultiSelectionPanel() {
    return <div>TODO</div>
}

export function SelectionPanel() {
    const [selectedElems, setSelectedElems] = useState<SelectedElems | null>(null);   
    const [timestamp, setTimestamp] = useState<number>(0);

    useEffect(() => {
        const onSelectedElems = (elems: SelectedElems | null) => {
            setSelectedElems(elems);
        };

        cmdSetSelectedElems.attach(onSelectedElems);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);
        }
    }, []);

    useEffect(() => {
        const onBuildingStateChanged = (instance: IBuildingInstance) => {
            const selectedBuilding = selectedElems?.type === "building" ? selectedElems.building : null;
            if (instance === selectedBuilding) {
                if (instance.deleted) {
                    setSelectedElems(null);
                } else {
                    setTimestamp(Date.now());
                }
            }
        }
        evtBuildingStateChanged.attach(onBuildingStateChanged);
        return () => {
            evtBuildingStateChanged.detach(onBuildingStateChanged);
        }
    }, [selectedElems]);

    return <div style={{
        position: "absolute",
        bottom: ".5rem",
        left: "470px",
        height: "200px",
        width: "250px",
        pointerEvents: "none"
    }}>

        {(() => {
            if (!selectedElems) {
                return null;
            }
            switch (selectedElems.type) {
                case "building": {
                    const building = selectedElems.building;
                    return <SingleSelectionPanel name={building.buildingType} />
                }
                case "units": {
                    const units = selectedElems.units;
                    if (units.length === 1) {
                        const unit = units[0];
                        return <SingleSelectionPanel name={unit.type} />
                    } else if (units.length > 0) {
                        return <MultiSelectionPanel />
                    } else {
                        return null;
                    }
                }
                case "cell": {
                    const cell = selectedElems.cell;
                    if (cell.resource) {
                        return <SingleSelectionPanel name={cell.resource.type} />
                    }
                }
            }
            return null;
        })()}

    </div>
}

