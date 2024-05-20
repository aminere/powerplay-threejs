
import { ResourceType, ResourceTypes } from "../GameDefinitions";
import { ActionButton } from "./ActionButton";
import { IBuildingInstance, IFactoryState } from "../buildings/BuildingTypes";
import { useEffect, useState } from "react";
import { Factories } from "../buildings/Factories";
import { SelectedElems } from "../../Events";
import { Icon } from "./Icon";
import { OutputPanel } from "./OutputPanel";
import { GameMapState } from "../../powerplay";

interface FactoryOutputPanelProps {
    open: boolean;
    selectedElems: SelectedElems | null;
    onOutputSelected: () => void;
}

function getFactory(selection: SelectedElems | null) {
    if (selection?.type === "building") {
        const building = selection.building;
        if (building.buildingType === "factory") {
            return building;
        }
    }
    return null;
}

function getFactoryState(factory: IBuildingInstance | null) {
    return (factory?.state as IFactoryState) ?? null;
}

export function FactoryOutputPanel(props: FactoryOutputPanelProps) {
    const { selectedElems } = props;
    const [factory, setFactory] = useState<IBuildingInstance | null>(getFactory(selectedElems));
    const [output, setOutput] = useState<ResourceType | null>(getFactoryState(getFactory(selectedElems))?.output ?? null);

    useEffect(() => {
        const _factory = getFactory(selectedElems);
        setFactory(_factory);
        setOutput(getFactoryState(_factory)?.output ?? null);
    }, [selectedElems]);

    if (!factory) {
        return null;
    }

    return <OutputPanel open={props.open}>
        {ResourceTypes.map(resource => {            
            return <ActionButton                
                key={resource}
                id={resource}
                tooltipId={resource}
                visible={GameMapState.instance.config.factoryOutputs[resource]}
                selected={output === resource}
                onClick={() => {
                    setOutput(resource);
                    Factories.setOutput(factory, resource);
                    props.onOutputSelected();
                }}
            >
                <Icon name={resource} />
            </ActionButton>
        })}
    </OutputPanel>
}

