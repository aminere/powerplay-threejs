import { useEffect, useState } from "react"
import { IBuildingInstance, IDepotState, IFactoryState, IIncubatorState } from "../buildings/BuildingTypes";
import { SelectedElems, evtBuildingStateChanged, evtUnitKilled, evtUnitStateChanged } from "../../Events";
import { uiconfig } from "./uiconfig";
import { buildingConfig } from "../config/BuildingConfig";
import { unitConfig } from "../config/UnitConfig";
import { resourceConfig } from "../config/ResourceConfig";
import { config } from "../config/config";
import { ICharacterUnit } from "../unit/CharacterUnit";
import { ITruckUnit } from "../unit/TruckUnit";
import { IUnit } from "../unit/Unit";
import { FactoryDefinitions } from "../buildings/FactoryDefinitions";
import { ProgressBar } from "./ProgressBar";

const { resourcesPerSlot, slotCount } = config.trucks;
const truckCapacity = resourcesPerSlot * slotCount;

interface PropertyProps {
    name: string;
    value: string;
}

function Property(props: React.PropsWithChildren<PropertyProps>) {
    return <div style={{
        position: "relative",
        height: `${uiconfig.buttonSize}rem`,
        width: `${uiconfig.buttonSize}rem`,
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

        {props.children}
    </div>
}

interface SingleSelectionProps {
    name: string;
    amount: number;
    capacity: number;
    properties: { name: string, value: string }[] | null;
}

function SingleSelectionPanelHeader({ children }: React.PropsWithChildren<{}>) {
    return <div
        style={{
            position: "absolute",
            width: "100%",
            backgroundColor: uiconfig.backgroundColor,
            padding: `${uiconfig.padding}rem`,
            top: `-${uiconfig.gap}rem`,
            transformOrigin: "bottom",
            transform: "translateY(-100%)",
            textAlign: "center"
        }}
    >
        {children}
    </div>
}

function SingleSelectionPanel(props: React.PropsWithChildren<SingleSelectionProps>) {
    return <>
        {props.children}

        <Property name={""} value={`${props.amount} / ${props.capacity}`}>
            <div
                style={{
                    position: "absolute",
                    bottom: `-${uiconfig.gap}rem`,
                    transform: "translateY(100%)",
                    textAlign: "center"
                }}
            >
                {props.name}
            </div>
        </Property>
        <div
            dir="rtl"
            style={{
                position: "absolute",
                right: `${uiconfig.padding}rem`,
                top: `${uiconfig.padding}rem`,
                display: "grid",
                gridTemplateColumns: `repeat(2, ${uiconfig.buttonSize}rem)`,
                gridAutoRows: "min-content",
                gap: `${uiconfig.gap}rem`,
            }}
        >
            {props.properties?.map((prop, i) => <Property key={i} name={prop.name} value={prop.value} />)}
        </div>
    </>    
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

    const multipleSelection = selectedElems.type === "units" && selectedElems.units.length > 1;
    if (multipleSelection) {
        return null;
    }

    return <div style={{
        width: `calc(2 * ${uiconfig.padding}rem + ${uiconfig.actionsPerRow} * ${uiconfig.buttonSize}rem + ${uiconfig.actionsPerRow - 1} * ${uiconfig.gap}rem)`,
        backgroundColor: uiconfig.backgroundColor,
        padding: `${uiconfig.padding}rem`,
        position: "relative",
        display: "grid",
        gridTemplateColumns: `repeat(4, ${uiconfig.buttonSize}rem)`,
        gridAutoRows: "min-content",
        gap: `${uiconfig.gap}rem`
    }}>
        
        {(() => {
            switch (selectedElems.type) {
                case "building": {
                    const building = selectedElems.building;
                    const { hitpoints: maxHitpoints } = buildingConfig[building.buildingType];
                    const { buildingType: type, hitpoints } = building;
                    switch (type) {
                        case "incubator": {
                            const state = building.state as IIncubatorState;
                            const { inputs, inputCapacity } = config.incubators;
                            const properties = inputs.map(input => {
                                const amount = state.reserve[input];
                                return {
                                    name: input,
                                    value: `${amount} / ${inputCapacity}`
                                };
                            });
                            return <SingleSelectionPanel name={type} amount={hitpoints} capacity={maxHitpoints} properties={properties} />;
                        }

                        case "depot": {
                            const state = building.state as IDepotState;
                            const properties = state.type ? [{
                                name: state.type,
                                value: `${state.amount} / ${state.capacity}`
                            }] : null;                              
                            return <SingleSelectionPanel name={type} amount={hitpoints} capacity={maxHitpoints} properties={properties} />;
                        }

                        case "factory": {
                            const state = building.state as IFactoryState;
                            if (state.output) {
                                const inputs = FactoryDefinitions[state.output];
                                const { inputCapacity, productionTime } = config.factories;
                                const properties = inputs.map(input => {
                                    const amount = state.reserve.get(input) ?? 0;
                                    return {
                                        name: input,
                                        value: `${amount} / ${inputCapacity}`
                                    }
                                });

                                return <SingleSelectionPanel name={`${state.output} ${type}`} amount={hitpoints} capacity={maxHitpoints} properties={properties}>
                                    {(() => {
                                        if (state.active) {
                                            const progress = state.productionTimer / productionTime;
                                            return <SingleSelectionPanelHeader>
                                                <ProgressBar progress={progress} />
                                            </SingleSelectionPanelHeader>                                            
                                        }
                                    })()}
                                </SingleSelectionPanel>
                            } else {
                                return <SingleSelectionPanel name={type} amount={hitpoints} capacity={maxHitpoints} properties={null} />;
                            }
                        }
                    }
                    return null;
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
                    } else if (cell.conveyor) {
                        return <SingleSelectionPanel
                            name={"conveyor"}
                            amount={10}
                            capacity={10}
                            properties={null}
                        />
                    }
                }
            }
        })()}
    </div>
}

