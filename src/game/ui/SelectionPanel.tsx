import { useEffect, useState } from "react"
import { IBuildingInstance, IDepotState, IFactoryState, IIncubatorState } from "../buildings/BuildingTypes";
import { SelectedElems, evtBuildingStateChanged, evtUnitStateChanged } from "../../Events";
import { uiconfig } from "./uiconfig";
import { buildingConfig } from "../config/BuildingConfig";
import { unitConfig } from "../config/UnitConfig";
import { resourceConfig } from "../config/ResourceConfig";
import { config } from "../config/config";
import { ICharacterUnit } from "../unit/ICharacterUnit";
import { ITruckUnit } from "../unit/TruckUnit";
import { IUnit } from "../unit/IUnit";
import { FactoryDefinitions } from "../buildings/FactoryDefinitions";
import { GridFiller } from "./GridFiller";
import { InventoryItem } from "./InventoryItem";

const { resourcesPerSlot, slotCount } = config.trucks;
const truckCapacity = resourcesPerSlot * slotCount;

interface SingleSelectionProps {
    type: string;
    title?: string    
    health: number;
    properties: { name: string, value: string }[] | null;
    output?: {
        type: string;
        progress?: number;
        stack?: number;
    }
}

function SingleSelectionPanel(props: React.PropsWithChildren<SingleSelectionProps>) {
    
    return <>
        {props.children}    

        <div
            style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: `repeat(${uiconfig.selectionColumns}, ${uiconfig.buttonSizeRem}rem)`,
                gridAutoRows: "min-content",
                gap: `${uiconfig.gapRem}rem`
            }}
        >
            <GridFiller slots={props.output ? 2 : 1} columns={props.output ? 2 : 1} />    
            <InventoryItem name={props.type}>
                <div
                    style={{
                        position: "absolute",
                        bottom: `-${uiconfig.gapRem}rem`,
                        transform: "translateY(100%)",
                        textAlign: "center"
                    }}
                >
                    {props.title ?? props.type}
                </div>
            </InventoryItem>

            {
                props.output
                &&
                <InventoryItem
                    name={props.output.type}
                    progress={props.output.progress}
                    value={props.output.stack !== undefined ? `${props.output.stack}` : undefined}
                />
            }
        </div>        

        <div
            style={{
                position: "absolute",
                right: `${uiconfig.paddingRem}rem`,
                top: `${uiconfig.paddingRem}rem`,
                height: `calc(100% - 2 * ${uiconfig.paddingRem}rem)`
            }}
        >
            <div
                dir="rtl"
                style={{
                    position: "relative",
                    height: "100%",
                    display: "grid",
                    gridTemplateColumns: `repeat(2, ${uiconfig.buttonSizeRem}rem)`,
                    gridAutoRows: "min-content",
                    gap: `${uiconfig.gapRem}rem`
                }}
            >
                <GridFiller slots={4} columns={2} />
                {props.properties?.map((prop, i) => <InventoryItem key={i} name={prop.name} value={prop.value} />)}

            </div>
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
        width: `calc(2 * ${uiconfig.paddingRem}rem + ${uiconfig.selectionColumns} * ${uiconfig.buttonSizeRem}rem + ${uiconfig.selectionColumns - 1} * ${uiconfig.gapRem}rem)`,
        position: "relative",
        backgroundColor: `${uiconfig.backgroundColor}`,
        padding: `${uiconfig.paddingRem}rem`        
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
                            const { inputs, inputCapacity, productionTime } = config.incubators;
                            const properties = inputs.map(input => {
                                const amount = state.reserve.get(input) ?? 0;
                                return {
                                    name: input,
                                    value: `${amount} / ${inputCapacity}`
                                };
                            });

                            return <SingleSelectionPanel
                                type={type}
                                health={hitpoints / maxHitpoints}
                                properties={properties}
                                output={state.active ? {
                                    type: "worker",
                                    progress: state.productionTimer / productionTime,
                                    stack: state.spawnRequests + 1
                                } : undefined}
                            />;
                        }

                        case "depot": {
                            const state = building.state as IDepotState;
                            const properties = state.type ? [{
                                name: state.type,
                                value: `${state.amount} / ${state.capacity}`
                            }] : null;
                            return <SingleSelectionPanel
                                type={type}
                                health={hitpoints / maxHitpoints}
                                title={state.type ? `${state.type} ${type}` : undefined}
                                properties={properties}
                            />;
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

                                const progress = state.productionTimer / productionTime;
                                return <SingleSelectionPanel
                                    type={type}
                                    health={hitpoints / maxHitpoints}
                                    title={state.output ? `${state.output} ${type}` : undefined}
                                    properties={properties}
                                    output={{
                                        type: state.output,
                                        progress: state.active ? progress : undefined
                                    }}
                                />
                                
                            } else {
                                return <SingleSelectionPanel
                                    type={type}
                                    health={hitpoints / maxHitpoints}
                                    properties={null}
                                    output={{
                                        type: uiconfig.noOutput
                                    }}
                                />
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
                            type={unit.type}
                            health={unit.hitpoints / hitpoints}
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
                            type={cell.resource.type}
                            health={cell.resource.amount / capacity}
                            properties={null}
                        />
                    } else if (cell.conveyor) {
                        return <SingleSelectionPanel
                            type={"conveyor"}
                            health={1}
                            properties={null}
                        />
                    }
                }
            }
        })()}
    </div>
}

