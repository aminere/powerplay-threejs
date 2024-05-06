import { useEffect, useState } from "react"
import { IBuildingInstance, IIncubatorState } from "../buildings/BuildingTypes";
import { SelectedElems, cmdSetSelectedElems, evtBuildingStateChanged } from "../../Events";
import { uiconfig } from "./uiconfig";
import { buildingConfig } from "../config/BuildingConfig";
import { unitConfig } from "../config/UnitConfig";
import { resourceConfig } from "../config/ResourceConfig";
import { config } from "../config/config";

interface PropertyProps {
    name: string;
    value: string;
}

function Property(props: PropertyProps) {
    return <div style={{
        position: "relative",
        height: "3.2rem",
        width: "3.2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: uiconfig.buttonBackgroundColor,
    }}>
        {props.name}
        <div style={{
            position: "absolute",
            right: "0",
            bottom: "0",
            backgroundColor: "black",
            fontSize: "0.8rem",
        }}>
            {props.value}
        </div>
    </div>
}

interface SingleSelectionProps {
    name: string;
    amount: number;
    capacity: number;
    properties: { name: string, value: string }[] | null;
}

function SingleSelectionPanel(props: SingleSelectionProps) {
    return <div
        style={{
            padding: `${uiconfig.padding}rem`,
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
        <div style={{ display: "flex", gap: `${uiconfig.gap}rem`, justifyContent: "space-between" }}>
            <div>
                <div
                    style={{
                        width: "4rem",
                        height: "4rem",
                        backgroundColor: uiconfig.buttonBackgroundColor,
                    }}
                />
                <div style={{ textAlign: "center" }}>{props.amount} / {props.capacity}</div>
            </div>
            <div
                style={{
                    display: "flex",
                    gap: `${uiconfig.gap}rem`,
                    flexWrap: "wrap",
                    justifyContent: "end",
                }}
            >
                {props.properties?.map((prop, i) => <Property key={i} name={prop.name} value={prop.value} />)}
            </div>
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
        bottom: `${uiconfig.padding}rem`,
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
                    const { hitpoints } = buildingConfig[building.buildingType];

                    const properties = (() => {
                        switch (building.buildingType) {                            
                            case "incubator": {
                                const state = building.state as IIncubatorState;
                                const { inputs, inputCapacity } = config.incubators;
                                return inputs.map(input => {
                                    const amount = state.reserve[input];
                                    return { name: 
                                        input,
                                        value: `${amount} / ${inputCapacity}`
                                    };
                                });
                            }                            
                        }
                        return null;
                    })();

                    return <SingleSelectionPanel
                        name={building.buildingType}
                        amount={building.hitpoints}
                        capacity={hitpoints}
                        properties={properties}
                    />
                }
                case "units": {
                    const units = selectedElems.units;
                    if (units.length === 1) {
                        const unit = units[0];
                        const { hitpoints } = unitConfig[unit.type];
                        return <SingleSelectionPanel
                            name={unit.type}
                            amount={unit.hitpoints}
                            capacity={hitpoints}
                            properties={[]}
                        />
                    } else if (units.length > 0) {
                        return <MultiSelectionPanel />
                    } else {
                        return null;
                    }
                }
                case "cell": {
                    const cell = selectedElems.cell;
                    if (cell.resource) {
                        const { capacity } = resourceConfig[cell.resource.type];
                        return <SingleSelectionPanel
                            name={cell.resource.type}
                            amount={cell.resource.amount}
                            capacity={capacity}
                            properties={[]}
                        />
                    }
                }
            }
            return null;
        })()}

    </div>
}

