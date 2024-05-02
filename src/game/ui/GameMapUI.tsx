import { useEffect, useRef, useState } from "react";

import styles from './GameMapUI.module.css';
import { IGameUIProps } from "./GameUIProps";
import { HealthBars } from "./HealthBars";
import { SelectionRect } from "./SelectionRect";
import { Minimap } from "./Minimap";
import { GameMapState } from "../components/GameMapState";
import { GameMapProps } from "../components/GameMapProps";
import { BuildingType, BuildingTypes, IBuildingInstance, IIncubatorState, buildingSizes } from "../buildings/BuildingTypes";
import gsap from "gsap";
import { TransportAction, TransportActions } from "../GameDefinitions";
import { config } from "../config";
import { cmdSetSelectedElems, evtActionCleared, evtBuildError, evtBuildingStateChanged } from "../../Events";
import { unitsManager } from "../unit/UnitsManager";
import { Incubators } from "../buildings/Incubators";

function InGameUI({ children }: { children: React.ReactNode }) {
    return <div
        style={{ pointerEvents: "all" }}
        onPointerEnter={() => GameMapState.instance.cursorOverUI = true}
        onPointerLeave={() => GameMapState.instance.cursorOverUI = false}
    >
        {children}
    </div>
}

interface ActionButtonProps {
    name: string;
    selected: boolean;
    onClick: () => void;
}

function ActionButton(props: ActionButtonProps) {
    return <div
        className={`${styles.action} ${props.selected ? styles.selected : ""} clickable`}
        onClick={e => {
            props.onClick();
            e.stopPropagation();
        }}
    >
        {props.name}
    </div>
}

interface IActionSectionProps {
    open: boolean;
    name: string;
    actions: readonly string[];
    onSelected: (action: string) => void;
    onOpen: () => void;
    onClose: () => void;
}

function ActionSection(props: IActionSectionProps) {
    const [open, setOpen] = useState(props.open);
    const [action, setAction] = useState<string | null>(null);
    const actionsRef = useRef<HTMLDivElement>(null);

    const { open: _open } = props;
    useEffect(() => {
        setOpen(_open);
    }, [_open])

    useEffect(() => {
        if (open) {
            gsap.to(actionsRef.current, {
                scaleY: 1,
                opacity: 1,
                duration: 0.2,
                onComplete: () => {
                    actionsRef.current!.style.pointerEvents = "all";
                }
            });
            props.onOpen();

        } else {
            gsap.to(actionsRef.current, {
                scaleY: 0,
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    actionsRef.current!.style.pointerEvents = "none";
                }
            });

            setAction(null);
            const gameMapState = GameMapState.instance;
            gameMapState.action = null;
        }
    }, [open]);

    useEffect(() => {
        const onActionCleared = () => {
            setAction(null);
        };
        evtActionCleared.attach(onActionCleared);
        return () => {
            evtActionCleared.detach(onActionCleared);
        }
    }, []);

    return <div
        className={`${styles.action} clickable`}
        style={{
            position: "relative",
            backgroundColor: open ? undefined : "#0000002b"
        }}
        onClick={() => {
            if (open) {
                setOpen(false);
            } else {
                setOpen(true);
            }
        }}
    >
        <span>{props.name}</span>
        <div
            ref={actionsRef}
            style={{
                position: "absolute",
                left: "calc(5rem + .2rem)",
                display: "flex",
                flexDirection: "column",
                gap: ".2rem",
                transform: "scaleY(0)",
                opacity: 0,
                pointerEvents: "none"
            }}
        >
            {props.actions.map(_action => <ActionButton
                key={_action}
                name={_action}
                selected={action === _action}
                onClick={() => {
                    const gameMapState = GameMapState.instance;
                    if (action === _action) {
                        setAction(null);
                        gameMapState.action = null;
                        return;
                    }
                    setAction(_action);
                    props.onSelected(_action);
                }}
            />)}
        </div>
    </div>
}

interface IBuildingUIProps {
    instance: IBuildingInstance;
}

function BuildingUI(props: React.PropsWithChildren<IBuildingUIProps>) {
    return <div
        style={{
            padding: ".5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            backgroundColor: "#0000002b"
        }}>
        <div
            style={{
                textAlign: "center",
                fontWeight: "bold",
                textTransform: "uppercase"
            }}>
            {props.instance.buildingType}
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
            {props.children}
        </div>
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

    const [selectedBuilding, setSelectedBuilding] = useState<IBuildingInstance | null>(null);
    const [selectedBuildingTimestamp, setSelectedBuildingTimestamp] = useState(Date.now());
    useEffect(() => {
        const onSelectedElems = ({ building }: {
            building?: IBuildingInstance;
        }) => {
            setSelectedBuilding(building ?? null);
        };

        const onBuildingStateChanged = () => {
            setSelectedBuildingTimestamp(Date.now());
        };

        cmdSetSelectedElems.attach(onSelectedElems);
        evtBuildingStateChanged.attach(onBuildingStateChanged);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);
            evtBuildingStateChanged.detach(onBuildingStateChanged);
        }
    }, []);

    const [openSection, setOpenSection] = useState<"build" | "transport" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [clearError, setClearError] = useState<NodeJS.Timeout | null>(null);
    const [errorTween, setErrorTween] = useState<gsap.core.Tween | null>(null);
    const errorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const _clearError = () => {
            if (errorTween) {
                errorTween.kill();
            }
            if (clearError) {
                clearTimeout(clearError);
            }
        };

        const onError = (error: string) => {
            setError(error);
            _clearError();
            errorRef.current!.style.opacity = "0";
            const tween = gsap.to(errorRef.current, {
                opacity: 1,
                repeat: 4,
                yoyo: true,
                duration: .4,
                onComplete: () => {
                    const timeout = setTimeout(() => {
                        errorRef.current!.style.opacity = "0";
                        setError(null);
                        setClearError(null);
                    }, 3000);
                    setClearError(timeout);
                    setErrorTween(null);
                }
            });
            setErrorTween(tween);
        };

        const onActionCleared = () => {
            _clearError();
            setErrorTween(null);
            setClearError(null);
            setError(null);
            errorRef.current!.style.opacity = "0";
        };

        evtBuildError.attach(onError);
        evtActionCleared.attach(onActionCleared);
        return () => {
            evtBuildError.detach(onError);
            evtActionCleared.detach(onActionCleared);
        }
    }, [errorTween, clearError]);

    return <div className={styles.root}>
        <InGameUI>
            <div
                style={{
                    position: "absolute",
                    left: ".5rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    flexDirection: "column",
                    gap: ".2rem",
                }}
            >
                <ActionSection
                    name="Build"
                    actions={BuildingTypes}
                    open={openSection === "build"}
                    onSelected={action => {
                        const buildingType = action as BuildingType;
                        GameMapProps.instance.buildingType = buildingType;
                        const size = buildingSizes[buildingType];
                        const gameMapState = GameMapState.instance;
                        gameMapState.tileSelector.setSize(size.x, size.z);
                        gameMapState.tileSelector.setBuilding(buildingType);
                        gameMapState.action = "building";
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
                        if (transportType === "road") {
                            const { cellsPerRoadBlock } = config.game;
                            gameMapState.tileSelector.setSize(cellsPerRoadBlock, cellsPerRoadBlock);
                            gameMapState.tileSelector.resolution = cellsPerRoadBlock;
                        } else {
                            gameMapState.tileSelector.setSize(1, 1);
                            gameMapState.tileSelector.resolution = 1;
                        }
                        gameMapState.action = transportType;
                    }}
                    onOpen={() => setOpenSection("transport")}
                    onClose={() => setOpenSection(null)}
                />
            </div>

            <div style={{
                position: "absolute",
                bottom: ".5rem",
                left: "50%",
                transform: "translateX(-50%)",
            }}>
                <div style={{ position: "relative" }}>
                    <div
                        ref={errorRef}
                        style={{
                            position: "absolute",
                            bottom: ".5rem",
                            width: "500px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            textAlign: "center",
                            color: "red",
                            opacity: 0,
                            textShadow: "1 1 0 black"
                        }}
                    >
                        {error ?? ""}
                    </div>
                </div>
                
                {(() => {
                    const buildingType = selectedBuilding?.buildingType;
                    if (!buildingType) {
                        return null;
                    }
                    switch (buildingType) {
                        case "incubator": {
                            const state = selectedBuilding.state as IIncubatorState;

                            const canSpawn = () => {
                                const { workerCost } = config.incubators;
                                if (state.amount.water < workerCost.water) {
                                    return false;
                                }
                                if (state.amount.coal < workerCost.coal) {
                                    return false;
                                }
                                return true
                            };

                            return <BuildingUI key={selectedBuildingTimestamp} instance={selectedBuilding}>
                                <div>
                                    <div>Water: {state.amount.water}</div>
                                    <div>Coal: {state.amount.coal}</div>
                                </div>
                                <div>
                                    <div
                                        className={`${styles.action} clickable`}
                                        style={{
                                            opacity: canSpawn() ? 1 : .5
                                        }}
                                        onClick={() => {                                            
                                            if (canSpawn()) {
                                                Incubators.spawn(selectedBuilding);
                                            } else {
                                                const { workerCost } = config.incubators;
                                                evtBuildError.post(`Not enough resources, requires ${workerCost.water} water and ${workerCost.coal} coal`);
                                            }
                                        }}
                                    >
                                        Worker
                                        {/* <span className={styles.tooltiptext}>
                                            Incubate Worker<br/>
                                            Water x 1 <br/>
                                            Coal x 1 <br/>
                                        </span> */}
                                    </div>
                                </div>
                            </BuildingUI>
                        }
                    }
                })()}
            </div>
        </InGameUI>

        <HealthBars />
        <SelectionRect />
        <Minimap />
    </div>
}

