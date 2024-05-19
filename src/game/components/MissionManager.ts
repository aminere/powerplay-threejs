
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { SelectedElems, cmdRefreshUI, cmdSetIndicator, cmdSetObjective, cmdSetObjectiveStatus, cmdSetSelectedElems, evtActionClicked, evtBuildingCreated, evtBuildingStateChanged, evtConveyorCreated, evtGameMapUIMounted, evtUnitStateChanged } from "../../Events";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "./GameMapState";
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { IUnit } from "../unit/IUnit";
import { CharacterUnit } from "../unit/CharacterUnit";
import { depots } from "../buildings/Depots";
import { engine } from "../../engine/Engine";
import { GameUtils } from "../GameUtils";

export class MissionManagerProps extends ComponentProps {
    constructor(props?: Partial<MissionManagerProps>) {
        super();
        this.deserialize(props);
    }
}

enum MissionStep {
    SelectUnit,
    CollectStone,
    DepositStone,
    BuildFactory,
    BuildConveyorToFactory,
    ProduceGlass,
    BuildIncubator
}

export class MissionManager extends Component<MissionManagerProps> {

    private _step = MissionStep.SelectUnit;

    constructor(props?: Partial<MissionManagerProps>) {
        super(new MissionManagerProps(props));

    }

    override start(_owner: Object3D) {
        this.onSelection = this.onSelection.bind(this);
        this.onGameMapUIMounted = this.onGameMapUIMounted.bind(this);
        this.onUnitStateChanged = this.onUnitStateChanged.bind(this);
        this.onBuildingStateChanged = this.onBuildingStateChanged.bind(this);
        this.onActionClicked = this.onActionClicked.bind(this);
        this.onBuildingCreated = this.onBuildingCreated.bind(this);
        this.onConveyorCreated = this.onConveyorCreated.bind(this);
        cmdSetSelectedElems.attach(this.onSelection);
        evtGameMapUIMounted.once(this.onGameMapUIMounted);
        evtUnitStateChanged.once(this.onUnitStateChanged);
        evtBuildingStateChanged.attach(this.onBuildingStateChanged);
        evtActionClicked.attach(this.onActionClicked);
        evtBuildingCreated.attach(this.onBuildingCreated);
        evtConveyorCreated.once(this.onConveyorCreated);
    }

    override dispose(_owner: Object3D) {
        cmdSetSelectedElems.detach(this.onSelection);
        evtBuildingStateChanged.detach(this.onBuildingStateChanged);
        evtActionClicked.detach(this.onActionClicked);
        evtBuildingCreated.detach(this.onBuildingCreated);
    }

    override update(_owner: Object3D) {
    }

    private onSelection(selectedElem: SelectedElems | null) {
        switch (this._step) {
            case MissionStep.SelectUnit: {
                if (selectedElem?.type === "units") {
                    this._step = MissionStep.CollectStone;
                    cmdSetIndicator.post({
                        indicator: {
                            type: "cell",
                            mapCoords: new Vector2(34, 131)
                        },
                        props: {
                            action: "Collect stone",
                            actionIcon: "stone",
                            control: "Right click",
                            icon: "mouse-right"
                        }
                    });
                }
            }
                break;
        }
    }

    private onGameMapUIMounted() {
        cmdSetObjective.post({
            objective: "Collect Stone",
            icon: "stone"
        });
        cmdSetObjectiveStatus.post(`${0} / 5`);

        setTimeout(() => {
            cmdSetIndicator.post({
                indicator: {
                    type: "unit",
                    unit: unitsManager.units[0]
                },
                props: {
                    action: "Select Worker",
                    actionIcon: "worker",
                    control: "Left click",
                    icon: "mouse-left"
                }
            });
        }, 500);
    }

    private onUnitStateChanged(unit: IUnit) {
        const resource = (unit as CharacterUnit)!.resource!.type;
        console.assert(resource === "stone");
        console.assert(this._step === MissionStep.CollectStone);
        this._step = MissionStep.DepositStone;

        const { depotsCache } = GameMapState.instance;
        const depots = Array.from(depotsCache.values());
        const depot = depots[0][0];
        cmdSetIndicator.post({
            indicator: {
                type: "build",
                building: depot
            },
            props: {
                action: "Deposit Stone",
                actionIcon: "stone",
                control: "Right click",
                icon: "mouse-right"
            }
        });
    }

    private onBuildingStateChanged(building: IBuildingInstance) {
        switch (this._step) {
            case MissionStep.DepositStone: {
                switch (building.buildingType) {
                    case "depot": {
                        const reserves = depots.getReservesPerType(building);
                        const amount = reserves.stone;
                        cmdSetObjectiveStatus.post(`${amount} / 5`);
                        if (amount === 5) {
                            this._step = MissionStep.BuildFactory;
                
                            cmdSetObjective.post({
                                objective: "Build a Factory",
                                icon: "factory"
                            });
                            cmdSetObjectiveStatus.post(`${0} / 1`);
                
                            const { sideActions } = GameMapState.instance.tutorial;
                            sideActions.self = true;
                            sideActions.enabled.build.self = true;
                            sideActions.enabled.build.enabled.factory = true;
                            cmdRefreshUI.post();
                            setTimeout(() => {
                                cmdSetIndicator.post({
                                    indicator: {
                                        type: "ui",
                                        element: "build"
                                    }
                                });
                            }, 500);
                        }
                    }
                }                
            }
            break;

            case MissionStep.ProduceGlass: {
                switch (building.buildingType) {
                    case "depot": {
                        const reserves = depots.getReservesPerType(building);
                        const amount = reserves.glass;
                        if (amount !== undefined) {
                            cmdSetObjectiveStatus.post(`${amount} / 5`);
                            if (amount === 5) {
                                this._step = MissionStep.BuildIncubator;
                    
                                cmdSetObjective.post({
                                    objective: "Build an Incubator",
                                    icon: "incubator"
                                });
                                cmdSetObjectiveStatus.post(`${0} / 1`);
                    
                                const { sideActions } = GameMapState.instance.tutorial;                    
                                sideActions.enabled.build.enabled.incubator = true;
                                cmdRefreshUI.post();
                                setTimeout(() => {
                                    cmdSetIndicator.post({
                                        indicator: {
                                            type: "ui",
                                            element: "incubator"
                                        }
                                    });
                                }, 500);
                            }
                        }                        
                    }                    
                }                
            }
            break;
        }        
    }

    private onActionClicked(action: string) {
        switch (action) {
            case "build": {
                switch (this._step) {
                    case MissionStep.BuildFactory: {
                        setTimeout(() => {
                            cmdSetIndicator.post({
                                indicator: {
                                    type: "ui",
                                    element: "factory"
                                }
                            });
                        }, 60);
                    }
                    break;                    
                }                
            }
                break;

            case "factory": {
                cmdSetIndicator.post({
                    indicator: {
                        type: "cell",
                        mapCoords: new Vector2(27, 122)
                    },
                    props: {
                        action: "Place Factory",
                        actionIcon: "factory",
                        control: "Left click",
                        icon: "mouse-left"
                    }
                });

                const factoryShadow = engine.scene!.getObjectByName("factory-shadow")!;
                factoryShadow.visible = true;
                const mapCoords = GameUtils.worldToMap(factoryShadow.position, new Vector2());
                GameMapState.instance.buildingCreationFilter = {
                    click: coords => coords.equals(mapCoords)
                }
            }
            break;

            case "conveyor": {
                const conveyorShadow = engine.scene!.getObjectByName("conveyor-shadow")!;
                conveyorShadow.visible = true;
                const mapCoords = GameUtils.worldToMap(conveyorShadow.position, new Vector2());
                GameMapState.instance.buildingCreationFilter = {
                    endDrag: (start: Vector2, end: Vector2) => {
                        const desiredEnd = new Vector2().subVectors(mapCoords, new Vector2(0, 3));
                        return start.equals(mapCoords) && end.equals(desiredEnd);
                    }
                }

                cmdSetIndicator.post({
                    indicator: {
                        type: "cell",
                        mapCoords
                    },
                    props: {
                        action: "Place Conveyor",
                        actionIcon: "conveyor",
                        control: "Left drag",
                        icon: "mouse-left"
                    }
                });
            }
        }
    }

    private onBuildingCreated(building: IBuildingInstance) {
        if (building.buildingType === "factory") {
            const factoryShadow = engine.scene!.getObjectByName("factory-shadow")!;
            factoryShadow.removeFromParent();
            GameMapState.instance.buildingCreationFilter = null;

            this._step = MissionStep.BuildConveyorToFactory;
            cmdSetIndicator.post(null);
            setTimeout(() => {
                cmdSetObjective.post({
                    objective: "Build a conveyor",
                    icon: "conveyor"
                });
                cmdSetObjectiveStatus.post(`${0} / 1`);
    
                const { sideActions } = GameMapState.instance.tutorial;          
                sideActions.enabled.build.enabled.conveyor = true;
                cmdRefreshUI.post();
                setTimeout(() => {
                    cmdSetIndicator.post({
                        indicator: {
                            type: "ui",
                            element: "conveyor"
                        }
                    });
                }, 500);
            }, 2000);
        }
    }

    private onConveyorCreated() {
        const conveyorShadow = engine.scene!.getObjectByName("conveyor-shadow")!;
        conveyorShadow.removeFromParent();
        GameMapState.instance.buildingCreationFilter = null;

        this._step = MissionStep.ProduceGlass;
        cmdSetIndicator.post(null);
        setTimeout(() => {
            cmdSetObjective.post({
                objective: "Produce Glass",
                icon: "glass"
            });
            cmdSetObjectiveStatus.post(`${0} / 5`);
        }, 500);
    }
}

