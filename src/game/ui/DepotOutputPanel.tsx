import { RawResourceType, ResourceType } from "../GameDefinitions";
import { ActionButton } from "./ActionButton";
import { IBuildingInstance, IDepotState } from "../buildings/BuildingTypes";
import { useEffect, useState } from "react";
import { SelectedElems } from "../../Events";
import { Icon } from "./Icon";
import { OutputPanel } from "./OutputPanel";
import { depots } from "../buildings/Depots";

interface DepotOutputPanelProps {
    open: boolean;
    selectedElems: SelectedElems | null;
    onOutputSelected: () => void;
}

function getDepot(selection: SelectedElems | null) {
    if (selection?.type === "building") {
        const building = selection.building;
        if (building.buildingType === "depot") {
            return building;
        }
    }
    return null;
}

function getDepotState(depot: IBuildingInstance | null) {
    return (depot?.state as IDepotState) ?? null;
}

export function DepotOutputPanel(props: DepotOutputPanelProps) {
    const { selectedElems } = props;
    const [depot, setDepot] = useState<IBuildingInstance | null>(getDepot(selectedElems));
    const [output, setOutput] = useState<(RawResourceType | ResourceType) | null>(getDepotState(getDepot(selectedElems))?.output ?? null);

    useEffect(() => {
        const _depot = getDepot(selectedElems);
        setDepot(_depot);
        setOutput(getDepotState(_depot)?.output ?? null);
    }, [selectedElems]);

    if (!depot) {
        return null;
    }

    const depotResources = depots.getReservesPerType(depot);
    return <OutputPanel open={props.open}>
        {Object.keys(depotResources).map(type => {
            const resourceType = type as ResourceType;
                return <ActionButton
                    key={type}
                    tooltipId={type}
                    selected={output === type}
                    onClick={() => {
                        const state = depot.state as IDepotState;
                        state.output = resourceType;
                        setOutput(resourceType);
                        props.onOutputSelected();
                    }}
                >
                    <Icon name={type} />
                </ActionButton>
            })}
    </OutputPanel>
}

