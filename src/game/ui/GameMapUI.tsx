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
import { evtActionCleared, evtBuildError } from "../../Events";
import { ActionButton } from "./ActionButton";
import { buildingConfig } from "../config/BuildingConfig";
import { SelectionPanel } from "./SelectionPanel";
import gsap from "gsap";
import { uiconfig } from "./uiconfig";

function InGameUI({ children }: { children: React.ReactNode }) {
    return <div
        style={{ pointerEvents: "all" }}
        onPointerEnter={() => GameMapState.instance.cursorOverUI = true}
        onPointerLeave={() => GameMapState.instance.cursorOverUI = false}
    >
        {children}
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

        } else {
            setAction(null);
            gsap.to(actionsRef.current, {
                scaleY: 0,
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    actionsRef.current!.style.pointerEvents = "none";
                }
            });
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

    return <ActionButton
        onClick={() => {
            if (open) {
                setOpen(false);
                props.onClose();
            } else {
                setOpen(true);
                props.onOpen();
            }
        }}
    >
        <span>{props.name}</span>
        <div
            ref={actionsRef}
            style={{
                position: "absolute",
                left: `calc(${uiconfig.buttonSize}rem + ${uiconfig.gap}rem)`,
                display: "flex",
                flexDirection: "column",
                gap: `${uiconfig.gap}rem`,
                transform: "scaleY(0)",
                opacity: 0,
                pointerEvents: "none"
            }}
        >
            {props.actions.map(_action => {
                return <ActionButton
                    key={_action}
                    selected={action === _action}
                    selectedColor="yellow"
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
                >
                    {_action}
                </ActionButton>
            })}
        </div>
    </ActionButton>
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

                <ActionButton
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
                </ActionButton>
            </div>

            <SelectionPanel />

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

