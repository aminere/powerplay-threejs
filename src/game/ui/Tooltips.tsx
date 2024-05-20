import { ResourceType, ResourceTypes } from "../GameDefinitions";
import { resourceConfig } from "../config/ResourceConfig";
import { GridFiller } from "./GridFiller";
import { Icon } from "./Icon";
import { InlineIcon } from "./InlineIcon";
import { InventoryItemInfo } from "./InventoryItemInfo";
import { uiconfig } from "./uiconfig";

class Tooltips {
    public getContent(actionId: string) {
        if (ResourceTypes.includes(actionId as ResourceType)) {
            const inputs = resourceConfig.factoryProduction[actionId as ResourceType];
            const cols = 2;
            const rows = 2;
            return <>
                <div>{actionId}</div>
                <div
                    style={{
                        position: "relative",
                        display: "grid",
                        gridTemplateColumns: `repeat(${cols}, ${uiconfig.buttonSizeRem}rem)`,
                        gridAutoRows: "min-content",
                        gap: `${uiconfig.gapRem}rem`
                    }}
                >
                    <GridFiller slots={cols * rows} columns={cols} />
                    {inputs.map(input => {
                        return <div
                            key={input}
                            style={{
                                position: "relative",
                            }}
                        >
                            <Icon name={input} />
                            <InventoryItemInfo>
                                {1}
                            </InventoryItemInfo>
                        </div>
                    })}
                </div>
                <div>requires</div>
            </>
        }

        if (actionId.startsWith("mine-output")) {
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

