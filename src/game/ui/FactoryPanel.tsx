import { useEffect, useRef, useState } from "react";
import { ResourceType, ResourceTypes } from "../GameDefinitions";
import { IBuildingInstance, IFactoryState } from "../buildings/BuildingTypes";
import { ActionButton } from "./ActionButton";
import { BuildingPanel } from "./BuildingPanel";
import gsap from "gsap";
import { Factories } from "../buildings/Factories";
import { FactoryDefinitions } from "../buildings/FactoryDefinitions";

interface FactoryPanelProps {
    timestamp: number;
    building: IBuildingInstance;
}

export function FactoryPanel(props: FactoryPanelProps) {

    const [timestamp, setTimestamp] = useState(props.timestamp);
    const [open, setOpen] = useState(false);
    const [output, setOutput] = useState<ResourceType | null>((props.building.state as IFactoryState).output);
    const outputsRef = useRef<HTMLDivElement | null>(null);

    const { building } = props;
    useEffect(() => {
        setOutput((building.state as IFactoryState).output);
    }, [building]);

    const { timestamp: newTimeStamp } = props;
    useEffect(() => {
        setTimestamp(newTimeStamp);
    }, [newTimeStamp]);

    useEffect(() => {
        if (!outputsRef.current) {
            return;
        }
        if (open) {
            gsap.to(outputsRef.current, {
                scaleX: 1,
                opacity: 1,
                duration: 0.2,
                onComplete: () => {
                    outputsRef.current!.style.pointerEvents = "all"
                }
            });

        } else {
            gsap.to(outputsRef.current, {
                scaleX: 0,
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    outputsRef.current!.style.pointerEvents = "none"
                }
            });
        }
    }, [open]);

    return <BuildingPanel timestamp={timestamp} instance={props.building}>
        <div>
            {(() => {
                if (output) {
                    const state = props.building.state as IFactoryState;
                    const inputs = FactoryDefinitions[output];
                    return inputs.map(input => {
                        const amount = state.reserve.get(input) ?? 0;
                        return <div key={input}>
                            {input}: {amount}
                        </div>
                    });
                }
            })()}
        </div>

        <ActionButton
            onClick={() => {
                setOpen(prev => !prev);
            }}
        >
            {output ? output : "Select Output"}
        </ActionButton>

        <div
            ref={outputsRef}
            style={{
                position: "absolute",
                // left: "calc(200px + 250px + .5rem)",
                // bottom: ".5rem",
                left: "calc(100% + .2rem)",
                top: "0px",
                height: "200px",
                // width: "600px",
                overflow: "auto",
                // display: "flex",
                display: "grid",
                gap: ".2rem",
                gridTemplateColumns: "repeat(7, 5rem)",
                gridAutoRows: "min-content",
                transform: "scaleX(0)",
                transformOrigin: "left",
                opacity: 0,
                pointerEvents: "none"
                // flexWrap: "wrap",
                // alignItems: "center"
            }}
            onWheel={e => e.stopPropagation()}
        >
            {ResourceTypes.map(resource => {
                return <ActionButton
                    key={resource}
                    selected={output === resource}
                    onClick={() => {
                        setOutput(resource);
                        Factories.setOutput(props.building, resource);
                    }}
                >
                    {resource}
                </ActionButton>
            })}
        </div>
    </BuildingPanel>
}

