import { ResourceType, ResourceTypes, VehicleType, VehicleTypes } from "../GameDefinitions";
import { resourceConfig } from "../config/ResourceConfig";
import { Icon } from "./Icon";
import { InlineIcon } from "./InlineIcon";
import { InventoryItemInfo } from "./InventoryItemInfo";
import { uiconfig } from "./uiconfig";

class Tooltips {
    public getContent(actionId: string) {
        if (ResourceTypes.includes(actionId as ResourceType)) {
            const inputs = resourceConfig.factoryProduction[actionId as ResourceType];
            return <div style={{
                display: "flex",
                flexDirection: "column",
                gap: ".2rem"
            }}>
                <div>{actionId}</div>
                <div style={{ fontSize: ".8rem" }}>requires</div>
                <div style={{
                    display: "flex",
                    gap: ".5rem"
                }}>
                    {inputs.map(input => {
                        return <div
                            key={input}
                            style={{
                                position: "relative",
                                height: "3rem",
                                width: "3rem",
                            }}
                        >
                            <Icon name={input} />
                            <InventoryItemInfo>
                                {1}
                            </InventoryItemInfo>
                        </div>
                    })}
                </div>
            </div>
        }

        if (VehicleTypes.includes(actionId as VehicleType)) {
            const inputs = resourceConfig.assemblyProduction[actionId as VehicleType];
            return <div style={{
                display: "flex",
                flexDirection: "column",
                gap: ".2rem"
            }}>
                <div>{actionId}</div>
                <div style={{ fontSize: ".8rem" }}>requires</div>
                <div style={{
                    display: "flex",
                    gap: ".5rem"
                }}>
                    {inputs.map(([input, amount]) => {
                        return <div
                            key={input}
                            style={{
                                position: "relative",
                                height: "3rem",
                                width: "3rem",
                            }}
                        >
                            <Icon name={input} />
                            <InventoryItemInfo>
                                {amount}
                            </InventoryItemInfo>
                        </div>
                    })}
                </div>
            </div>
        }

        if (actionId.startsWith("output_")) {
            const [, resource, on] = actionId.split("_");
            return <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem"
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: `${uiconfig.paddingRem}rem`
                }}>
                    Produce {resource} <InlineIcon name={resource} />
                </div>
                <div>Production mode: {on === "true" ? <span style={{ color: "yellow" }}>AUTO</span> : <span style={{ color: "blue" }}>MANUAL</span>}</div>
                <div style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: `${uiconfig.paddingRem}rem`
                }}>
                    <InlineIcon name="mouse-right" /> toggles production
                </div>
            </div>
        }

        if (actionId === "output-full") {
            return <>
                <div style={{ color: "red" }}>No space to eject!</div>
                <div style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: `${uiconfig.paddingRem}rem`
                }}>
                    Connect conveyor <InlineIcon name="conveyor" />
                </div>
            </>
        }

        return actionId;
    }
}

export const tooltips = new Tooltips();

