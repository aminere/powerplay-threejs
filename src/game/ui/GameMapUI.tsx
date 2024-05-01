import { useEffect, useRef, useState } from "react";
import { Action } from "../GameDefinitions";

import styles from './GameMapUI.module.css';
import { utils } from "../../engine/Utils";
import { IGameUIProps } from "./GameUIProps";
import { HealthBars } from "./HealthBars";
import { SelectionRect } from "./SelectionRect";
import { Minimap } from "./Minimap";
import { cmdSetSelectedElems } from "../../Events";
import { GameMapState } from "../components/GameMapState";
import { GameMapProps } from "../components/GameMapProps";
import { BuildingType, BuildingTypes, IBuildingInstance, buildingSizes } from "../buildings/BuildingTypes";
import gsap from "gsap";

function InGameUI({ children }: { children: React.ReactNode }) {
    return <div
        style={{ pointerEvents: "all" }}
        onPointerEnter={() => GameMapState.instance.cursorOverUI = true}
        onPointerLeave={() => GameMapState.instance.cursorOverUI = false}
    >
        {children}
    </div>
}

interface BuildButtonProps {
    name: BuildingType;
    selected: boolean;
    onClick: () => void;
}

function BuildButton(props: BuildButtonProps) {
    return <div
        className={`${styles.action} ${props.selected ? styles.selected : ""} clickable`}
        onClick={props.onClick}
    >
        {props.name}
    </div>
}

export function GameMapUI(props: IGameUIProps) {
    const actionsElem = useRef<HTMLDivElement>(null);
    const hoveredElement = useRef<HTMLElement | null>(null);
    const hoveredElementOnDown = useRef<HTMLElement | null>(null);
    const actions = useRef<Record<string, HTMLElement>>({});
    const [buildingType, setBuildingType] = useState<BuildingType | null>(null);
    const [buildingsOpen, setBuildingsOpen] = useState(false);
    const buildingsRef = useRef<HTMLDivElement>(null);

    // const setAction = useCallback((newAction: Action) => {
    //     const gameMapState = GameMapState.instance;
    //     gameMapState.action = newAction;

    //     let resolution = 1;
    //     switch (newAction) {
    //         case "elevation":
    //         case "water":
    //         case "flatten": {
    //             const { brushSize } = GameMapProps.instance;
    //             gameMapState.tileSelector.setSize(brushSize, brushSize);
    //         }
    //             break;

    //         case "road": {
    //             const { cellsPerRoadBlock } = config.game;
    //             gameMapState.tileSelector.setSize(cellsPerRoadBlock, cellsPerRoadBlock);
    //             resolution = cellsPerRoadBlock;
    //         }
    //             break;

    //         default:
    //             gameMapState.tileSelector.setSize(1, 1);
    //     }
    //     gameMapState.tileSelector.resolution = resolution;

    // }, [selectedAction]);

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

    useEffect(() => {

        const onSelectedElems = ({ building }: {
            building?: IBuildingInstance;
        }) => {
            // if (building) {
            //     _buildingUi.style.display = "block";
            // } else {
            //     _buildingUi.style.display = "none";
            // }
        };

        cmdSetSelectedElems.attach(onSelectedElems);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);
        }

    }, []);

    return <div className={styles.root}>

        {/* <div 
            ref={actionsElem} 
            className={styles.actions}
            onPointerEnter={() => {
                if (!GameMapState.instance) {
                    return;
                }
                GameMapState.instance.cursorOverUI = true;
            }}
            onPointerLeave={() => {
                if (!GameMapState.instance) {
                    return;
                }
                GameMapState.instance.cursorOverUI = false
            }}
        >
            {Actions.map(action => {

                const ignoredActions: Action[] = [
                    "terrain"
                ];
                
                if (ignoredActions.includes(action)) {
                    return null;
                }

                const selected = selectedAction === action;
                return <div
                    id={action}
                    key={action}
                    className={`${styles.action} clickable ${selected ? styles.selected : ''}`}
                    ref={e => actions.current[action] = e as HTMLElement}
                    onClick={() => {
                        if (!utils.isPointerLocked()) {
                            setAction(action);
                        }
                    }}
                >
                    <div>
                        {action}
                    </div>
                </div>
            })}
        </div> */}

        <InGameUI>
            <div
                style={{
                    position: "absolute",
                    right: "1rem",
                    bottom: ".5rem"
                }}
            >
                <div
                    className={`${styles.action} clickable`}
                    onClick={() => {                        
                        if (buildingsOpen) {
                            setBuildingsOpen(false);
                            setBuildingType(null);
                            const gameMapState = GameMapState.instance;
                            gameMapState.action = null;
                            gsap.to(buildingsRef.current, {
                                y: "100%",
                                opacity: 0,
                                duration: 0.5,
                                onComplete: () => {
                                    buildingsRef.current!.style.pointerEvents = "none";
                                }
                            });
                        } else {
                            setBuildingsOpen(true);
                            gsap.to(buildingsRef.current, {
                                y: 0,
                                opacity: 1,
                                duration: 0.5,
                                onComplete: () => {
                                    buildingsRef.current!.style.pointerEvents = "all";
                                }
                            });
                        }                        
                    }}
                >
                    Build
                </div>

                <div
                    ref={buildingsRef}
                    style={{
                        position: "absolute",
                        bottom: "calc(5rem + .2rem)",
                        display: "flex",
                        flexDirection: "column",
                        gap: ".2rem",
                        transformOrigin: "bottom",
                        transform: "translateY(100%)",
                        opacity: 0,
                        pointerEvents: "none"
                    }}
                >
                    {BuildingTypes.map(type => <BuildButton
                        key={type}
                        name={type}
                        selected={buildingType === type}
                        onClick={() => {
                            const gameMapState = GameMapState.instance;
                            if (type === buildingType) {
                                gameMapState.action = null;
                                setBuildingType(null);
                                return;
                            }
                            GameMapProps.instance.buildingType = type;
                            const size = buildingSizes[type];
                            gameMapState.tileSelector.setSize(size.x, size.z);
                            gameMapState.tileSelector.setBuilding(type);
                            gameMapState.action = "building";
                            setBuildingType(type);
                        }}
                    />)}
                </div>
            </div>

            <div style={{
                position: "absolute",
                bottom: "0",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "#0000002b",
                padding: ".5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem"
            }}>
                <div
                    style={{
                        textAlign: "center",
                        fontWeight: "bold",
                        textTransform: "uppercase"
                    }}>
                    Incubator
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                    <div>
                        <div>Water: 0</div>
                        <div>Coal: 0</div>
                    </div>
                    <div>
                        <div className={`${styles.action} clickable`}>Worker</div>
                    </div>
                </div>
            </div>
        </InGameUI>

        <HealthBars />
        <SelectionRect />
        <Minimap />
    </div>
}

