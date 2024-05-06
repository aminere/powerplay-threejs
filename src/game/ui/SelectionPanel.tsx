import { useEffect, useState } from "react"
import { IBuildingInstance, IDepotState, IFactoryState, IIncubatorState } from "../buildings/BuildingTypes";
import { SelectedElems, evtBuildingStateChanged, evtUnitStateChanged } from "../../Events";
import { uiconfig } from "./uiconfig";
import { buildingConfig } from "../config/BuildingConfig";
import { unitConfig } from "../config/UnitConfig";
import { resourceConfig } from "../config/ResourceConfig";
import { config } from "../config/config";
import { ICharacterUnit } from "../unit/CharacterUnit";
import { ITruckUnit } from "../unit/TruckUnit";
import { IUnit } from "../unit/Unit";
import { FactoryDefinitions } from "../buildings/FactoryDefinitions";

const { resourcesPerSlot, slotCount } = config.trucks;
const truckCapacity = resourcesPerSlot * slotCount;

interface PropertyProps {
    name: string;
    value: string;
}

function Property(props: PropertyProps) {
    return <div style={{
        position: "relative",
        height: `${uiconfig.propertySize}rem`,
        width: `${uiconfig.propertySize}rem`,
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
            gap: `${uiconfig.padding}rem`,
            height: "100%",
            position: "relative"
        }}>
        <div
            style={{
                textAlign: "center",
                fontWeight: "bold",
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
                    gap: `${uiconfig.gap}rem`,
                    display: "grid",
                    gridTemplateColumns: `repeat(3, ${uiconfig.propertySize}rem)`,
                    gridAutoRows: "min-content",
                }}
            >
                {props.properties?.map((prop, i) => <Property key={i} name={prop.name} value={prop.value} />)}                
            </div>
        </div>
    </div>
}

function MultiSelectionPanel() {
    return null;
}

interface SelectionPanelProps {
    selectedElems: SelectedElems | null;
}

export function SelectionPanel(props: SelectionPanelProps) {
    const [, setTimestamp] = useState<number>(0);

    const { selectedElems } = props;
    useEffect(() => {
        const onBuildingStateChanged = (instance: IBuildingInstance) => {
            const selectedBuilding = selectedElems?.type === "building" ? selectedElems.building : null;
            if (instance === selectedBuilding) {
                setTimestamp(Date.now());
            }
        }

        const onUnitStateChanged = (unit: IUnit) => {
            const selectedUnits = selectedElems?.type === "units" ? selectedElems.units : null;
            if (selectedUnits && selectedUnits.length === 1) {
                if (unit === selectedUnits[0]) {
                    setTimestamp(Date.now());
                }
            }
        }

        evtBuildingStateChanged.attach(onBuildingStateChanged);
        evtUnitStateChanged.attach(onUnitStateChanged);
        return () => {
            evtBuildingStateChanged.detach(onBuildingStateChanged);
            evtUnitStateChanged.detach(onUnitStateChanged);
        }
    }, [selectedElems]);

    if (!selectedElems) {
        return null;
    }

    return <div
        style={{
            width: "250px",
            pointerEvents: "none",
            backgroundColor: uiconfig.backgroundColor,
        }}
    >
        {(() => {
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
                                    return {
                                        name: input,
                                        value: `${amount} / ${inputCapacity}`
                                    };
                                });
                            }

                            case "depot": {
                                const state = building.state as IDepotState;
                                if (state.type) {
                                    return [{
                                        name: state.type,
                                        value: `${state.amount} / ${state.capacity}`
                                    }];
                                }
                                break;
                            }

                            case "factory": {                                
                                const state = building.state as IFactoryState;
                                if (state.output) {
                                    const inputs = FactoryDefinitions[state.output];
                                    const { inputCapacity } = config.factories;
                                    return inputs.map(input => {
                                        const amount = state.reserve.get(input) ?? 0;
                                        return {
                                            name: input,
                                            value: `${amount} / ${inputCapacity}`
                                        }
                                    });
                                }
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
                        const properties = (() => {
                            switch (unit.type) {
                                case "worker": {
                                    const character = unit as ICharacterUnit;
                                    if (character.resource) {
                                        return [{
                                            name: character.resource.type,
                                            value: `1 / 1`
                                        }];
                                    }
                                    break;
                                }

                                case "truck": {
                                    const truck = unit as ITruckUnit;
                                    if (truck.resources) {
                                        return [{
                                            name: truck.resources.type,
                                            value: `${truck.resources.amount} / ${truckCapacity}`
                                        }]
                                    }
                                }
                            }

                            return null;
                        })();
                        return <SingleSelectionPanel
                            name={unit.type}
                            amount={Math.round(unit.hitpoints)}
                            capacity={hitpoints}
                            properties={properties}
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
                            properties={null}
                        />
                    }
                }
            }
        })()}
    </div>
}

