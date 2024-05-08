import { uiconfig } from "./uiconfig";
import { ResourceType, ResourceTypes } from "../GameDefinitions";
import { ActionButton } from "./ActionButton";
import { IBuildingInstance, IFactoryState } from "../buildings/BuildingTypes";
import { useEffect, useRef, useState } from "react";
import { Factories } from "../buildings/Factories";
import { SelectedElems } from "../../Events";
import gsap from "gsap";
import { GridFiller } from "./GridFiller";

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
    const rootRef = useRef<HTMLDivElement | null>(null);
    const { selectedElems } = props;
    const [factory, setFactory] = useState<IBuildingInstance | null>(getFactory(selectedElems));
    const [output, setOutput] = useState<ResourceType | null>(getFactoryState(getFactory(selectedElems))?.output ?? null);
    const [_open, setOpen] = useState(props.open);

    useEffect(() => {
        const factory = getFactory(selectedElems);
        setFactory(factory);
        setOutput(getFactoryState(factory)?.output ?? null);
    }, [selectedElems]);

    const { open } = props;
    useEffect(() => {
        setOpen(open);
    }, [open]);

    useEffect(() => {
        if (!rootRef.current) {
            return;
        }
        if (_open) {
            rootRef.current!.style.display = "grid";
            gsap.to(rootRef.current, {
                scaleY: 1,
                opacity: 1,
                duration: 0.2
            });
        } else {
            gsap.to(rootRef.current, {
                scaleY: 0,
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    if (!rootRef.current) {
                        return;
                    }
                    rootRef.current!.style.display = "none";
                }
            });
        }
    }, [_open]);

    if (!factory) {
        return null;
    }

    const height = `${uiconfig.outputRows} * ${uiconfig.buttonSizeRem}rem + ${uiconfig.outputRows - 1} * ${uiconfig.gapRem}rem + 2 * ${uiconfig.paddingRem}rem`;
    return <div
        ref={rootRef}
        style={{
            position: "absolute",
            left: "0px",
            top: `calc(-1 * (${height}))`,
            height: `calc(${height})`,            
            overflowY: "auto",
            overflowX: "hidden",
            backgroundColor: uiconfig.backgroundColor,
            padding: `${uiconfig.paddingRem}rem`,
            transformOrigin: "bottom",
            transform: "scaleY(0)",
            opacity: 0,
            display: "none"
        }}
        onWheel={e => e.stopPropagation()}
    >
        <div
            style={{
                position: "relative",
                height: "100%",
                display: "grid",
                gap: `${uiconfig.gapRem}rem`,
                gridTemplateColumns: `repeat(${uiconfig.outputColumns}, ${uiconfig.buttonSizeRem}rem)`,
                gridAutoRows: "min-content",
            }}
        >
            <GridFiller slots={uiconfig.outputColumns * uiconfig.outputRows} columns={uiconfig.outputColumns} />

            {ResourceTypes.map(resource => {
                return <ActionButton
                    key={resource}
                    selected={output === resource}
                    onClick={() => {
                        setOutput(resource);
                        Factories.setOutput(factory, resource);
                        props.onOutputSelected();
                    }}
                >
                    <img src={`/images/icons/${resource}.png`} />
                </ActionButton>
            })}
        </div>
    </div>
}

