import { useEffect, useRef, useState } from "react";
import { SelectedElems, cmdSetSelectedElems } from "../../Events";
import { uiconfig } from "./uiconfig";
import { ActionButton } from "./ActionButton";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "../components/GameMapState";

function FooterActions({ children }: { children: React.ReactNode }) {
    return <div style={{
        position: "absolute",
        right: `${uiconfig.padding}rem`,
        bottom: `${uiconfig.padding}rem`,
        display: "flex",
        gap: `${uiconfig.gap}rem`
    }}>
        {children}
    </div>
}

export function ActionsPanel() {
    const [selectedElems, setSelectedElems] = useState<SelectedElems | null>(null);
    const killedThroughUI = useRef(false);

    useEffect(() => {
        const onSelectedElems = (elems: SelectedElems | null) => {
            setSelectedElems(elems);
            if (!elems) {
                if (killedThroughUI.current) {
                    GameMapState.instance.cursorOverUI = false
                    killedThroughUI.current = false;
                }
            }
        };

        cmdSetSelectedElems.attach(onSelectedElems);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);
        }
    }, []);

    if (!selectedElems) {
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
                case "units": {
                    const units = selectedElems.units;
                    if (units.length === 1) {
                        return <>
                            <FooterActions>
                                <ActionButton
                                    onClick={() => {
                                        killedThroughUI.current = true;
                                        unitsManager.killSelection();
                                    }}
                                >
                                    kill
                                </ActionButton>
                            </FooterActions>
                        </>
                    } else if (units.length > 0) {
                        return null
                    } else {
                        return null;
                    }
                }
            }
        })()}
    </div>
}

