import { useEffect, useRef, useState } from "react";

import styles from './GameMapUI.module.css';
import { IGameUIProps } from "./GameUIProps";
import { HealthBars } from "./HealthBars";
import { SelectionRect } from "./SelectionRect";
import { Minimap } from "./Minimap";
import { GameMapState } from "../components/GameMapState";
import { GameMapProps } from "../components/GameMapProps";
import { BuildingType, BuildingTypes } from "../buildings/BuildingTypes";
import { TransportAction, TransportActions } from "../GameDefinitions";
import { config } from "../config/config";
import { SelectedElems, cmdSetSelectedElems, evtActionCleared, evtBuildError } from "../../Events";
import { buildingConfig } from "../config/BuildingConfig";
import { SelectionPanel } from "./SelectionPanel";
import { uiconfig } from "./uiconfig";
import { ActionsPanel } from "./ActionsPanel";
import { ActionSection } from "./ActionSection";
import gsap from "gsap";
import { FactoryOutputPanel } from "./FactoryOutputPanel";


function InGameUI({ children }: { children: React.ReactNode }) {
    return <div
        style={{ pointerEvents: "all" }}
        onPointerEnter={() => GameMapState.instance.cursorOverUI = true}
        onPointerLeave={() => GameMapState.instance.cursorOverUI = false}
    >
        {children}
    </div>
}

export function GameMapUI(_props: IGameUIProps) {
    // useEffect(() => {
    //     if (!actionsElem.current) {
    //         return;
    //     }

    //     const onGamePointerMove = () => {
    //         if (utils.isPointerLocked()) {
    //             hoveredElement.current = null;
    //             const { rawPointerPos } = props;
    //             for (const [, elem] of Object.entries(actions.current)) {
    //                 const hovered = utils.isPointInRect(rawPointerPos.x, rawPointerPos.y, elem.getBoundingClientRect());
    //                 if (hovered) {
    //                     hoveredElement.current = elem;
    //                     elem.classList.add("hovered");
    //                 } else {
    //                     elem.classList.remove("hovered");
    //                 }
    //             }
    //         }
    //     };

    //     const onGamePointerDown = () => {
    //         if (utils.isPointerLocked()) {
    //             if (hoveredElement.current) {
    //                 hoveredElement.current.classList.add("active");
    //                 hoveredElementOnDown.current = hoveredElement.current;
    //             }
    //         }
    //     };

    //     const onGamePointerUp = () => {
    //         if (utils.isPointerLocked()) {
    //             if (hoveredElement.current && hoveredElement.current === hoveredElementOnDown.current) {
    //                 const action = hoveredElement.current.id as Action;
    //                 setAction(action);
    //             }
    //             hoveredElementOnDown.current?.classList.remove("active");
    //             hoveredElementOnDown.current = null;
    //         }
    //     };

    //     document.addEventListener('pointermove', onGamePointerMove);
    //     if (props.isWeb) {
    //         document.addEventListener('pointerdown', onGamePointerDown);
    //         document.addEventListener('pointerup', onGamePointerUp);
    //     }
    //     return () => {
    //         document.removeEventListener('pointermove', onGamePointerMove);
    //         if (props.isWeb) {
    //             document.removeEventListener('pointerdown', onGamePointerDown);
    //             document.removeEventListener('pointerup', onGamePointerUp);
    //         }
    //     };
    // }, [setAction]);   

    const [error, setError] = useState<string | null>(null);
    const clearErrorRef = useRef<NodeJS.Timeout | null>(null);
    const errorTweenRef = useRef<gsap.core.Tween | null>(null);
    const errorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const clearError = () => {
            errorTweenRef.current?.kill();
            errorTweenRef.current = null;
            if (clearErrorRef.current) {
                clearTimeout(clearErrorRef.current);
                clearErrorRef.current = null;
            }
        };

        const onError = (error: string) => {
            setError(error);
            clearError();
            errorRef.current!.style.opacity = "0";
            const tween = gsap.to(errorRef.current, {
                opacity: 1,
                repeat: 4,
                yoyo: true,
                duration: .4,
                onComplete: () => {
                    errorTweenRef.current = null;
                    clearErrorRef.current = setTimeout(() => {
                        errorRef.current!.style.opacity = "0";
                        setError(null);
                        clearErrorRef.current = null;
                    }, 3000);
                }
            });
            errorTweenRef.current = tween;
        };

        const onActionCleared = () => {
            clearError();
            setError(null);
            errorRef.current!.style.opacity = "0";
        };

        evtBuildError.attach(onError);
        evtActionCleared.attach(onActionCleared);
        return () => {
            evtBuildError.detach(onError);
            evtActionCleared.detach(onActionCleared);
        }
    }, []);

    const [openSection, setOpenSection] = useState<"build" | "transport" | "destroy" | null>(null);
    useEffect(() => {
        const gameMapState = GameMapState.instance;
        if (openSection === "destroy") {
            gameMapState.action = "destroy";
            gameMapState.tileSelector.setSize(1, 1);
            gameMapState.tileSelector.resolution = 1;
            gameMapState.tileSelector.mode = "destroy";
        } else {
            gameMapState.action = null;
        }

        const onActionCleared = () => {
            if (openSection === "destroy") {
                setOpenSection(null);
            }
        }

        evtActionCleared.attach(onActionCleared);
        return () => {
            evtActionCleared.detach(onActionCleared);
        }

    }, [openSection]);

    const [selectedElems, setSelectedElems] = useState<SelectedElems | null>(null);
    const [showFactoryPanel, setShowFactoryPanel] = useState(false);
    useEffect(() => {
        const onSelectedElems = (elems: SelectedElems | null) => {
            setSelectedElems(elems);
        }
        cmdSetSelectedElems.attach(onSelectedElems);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);           
        }
    }, []);

    return <div className={styles.root}>
        <InGameUI>
            <div
                style={{
                    position: "absolute",
                    left: `${uiconfig.padding}rem`,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    flexDirection: "column",
                    gap: `${uiconfig.gap}rem`,
                }}
            >
                <ActionSection
                    name="Build"
                    actions={BuildingTypes}
                    open={openSection === "build"}
                    onSelected={action => {
                        const buildingType = action as BuildingType;
                        GameMapProps.instance.buildingType = buildingType;
                        const size = buildingConfig[buildingType].size;
                        const gameMapState = GameMapState.instance;
                        gameMapState.action = "building";
                        gameMapState.tileSelector.mode = "select";
                        gameMapState.tileSelector.setSize(size.x, size.z);
                        gameMapState.tileSelector.setBuilding(buildingType);
                    }}
                    onOpen={() => setOpenSection("build")}
                    onClose={() => setOpenSection(null)}
                />
                <ActionSection
                    name="Transport"
                    actions={TransportActions}
                    open={openSection === "transport"}
                    onSelected={action => {
                        const transportType = action as TransportAction;
                        const gameMapState = GameMapState.instance;
                        gameMapState.action = transportType;
                        gameMapState.tileSelector.mode = "select";
                        if (transportType === "road") {
                            const { cellsPerRoadBlock } = config.game;
                            gameMapState.tileSelector.setSize(cellsPerRoadBlock, cellsPerRoadBlock);
                            gameMapState.tileSelector.resolution = cellsPerRoadBlock;
                        } else {
                            gameMapState.tileSelector.setSize(1, 1);
                            gameMapState.tileSelector.resolution = 1;
                        }
                    }}
                    onOpen={() => setOpenSection("transport")}
                    onClose={() => setOpenSection(null)}
                />
                {/* <ActionButton
                    selected={openSection === "destroy"}
                    selectedColor="red"
                    onClick={() => {
                        if (openSection === "destroy") {
                            setOpenSection(null);
                        } else {
                            setOpenSection("destroy");
                        }
                    }}
                >
                    Destroy
                </ActionButton> */}
            </div>

            <div style={{
                position: "absolute",
                bottom: `${uiconfig.padding}rem`,
                left: "470px",
                height: `calc(${uiconfig.actionRows} * ${uiconfig.buttonSize}rem + ${uiconfig.actionRows - 1} * ${uiconfig.gap}rem + 2 * ${uiconfig.padding}rem)`,
                display: "flex",
                gap: `${uiconfig.gap}rem`,
            }}>
                <SelectionPanel selectedElems={selectedElems} />
                <ActionsPanel onToggleFactoryOutputs={() => setShowFactoryPanel(prev => !prev)}>
                    {(() => {
                        if (showFactoryPanel) {
                            if (selectedElems?.type === "building") {
                                const building = selectedElems.building;
                                if (building.buildingType === "factory") {
                                    return <FactoryOutputPanel factory={building} />
                                }
                            }                            
                        }
                    })()}
                </ActionsPanel>
            </div>

            <div
                ref={errorRef}
                style={{
                    position: "absolute",
                    bottom: "240px",
                    left: "1rem",
                    color: "red",
                    opacity: 0
                }}
            >
                {error ?? ""}
            </div>
        </InGameUI>

        <HealthBars />
        <SelectionRect />
        <Minimap />
    </div>
}

