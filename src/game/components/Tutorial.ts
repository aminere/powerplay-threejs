
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { SelectedElems, cmdOpenBuildSection, cmdRefreshUI, cmdSetIndicator, cmdSetObjective, cmdSetObjectiveStatus, cmdSetSelectedElems, cmdTutorialComplete, evtActionClicked, evtBuildingCreated, evtBuildingStateChanged, evtConveyorCreated, evtGameMapUIMounted, evtMoveCommand, evtUnitSpawned, evtUnitStateChanged } from "../../Events";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "./GameMapState";
import { BuildingType, BuildingTypes, IBuildingInstance, IDepotState, IFactoryState, IIncubatorState } from "../buildings/BuildingTypes";
import { IUnit } from "../unit/IUnit";
import { CharacterUnit } from "../unit/CharacterUnit";
import { depots } from "../buildings/Depots";
import { engine } from "../../engine/Engine";
import { GameUtils } from "../GameUtils";
import { ResourceType, ResourceTypes } from "../GameDefinitions";
import { GameMapProps } from "./GameMapProps";
import { unitMotion } from "../unit/UnitMotion";
import { engineState } from "../../engine/EngineState";
import { UnitUtils } from "../unit/UnitUtils";

function getBuildingOfType(type: BuildingType) {
    const buildings = GameMapState.instance.buildings;
    for (const [, instance] of buildings) {
        if (instance.buildingType === type) {
            return instance;
        }
    }
    return null;
}

function stopUnit(unit: IUnit) {
    unit.clearAction();
    if (unit.motionId > 0) {
        unitMotion.endMotion(unit);
        unit.onArrived();
    }
}

export class TutorialProps extends ComponentProps {
    constructor(props?: Partial<TutorialProps>) {
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
    CollectGlass,
    BuildIncubator,
    CollectWater,
    DepositWater,
    Incubate
}

export class Tutorial extends Component<TutorialProps> {

    private _step = MissionStep.SelectUnit;
    private _owner: Object3D | null = null;

    constructor(props?: Partial<TutorialProps>) {
        super(new TutorialProps(props));
    }

    override start(owner: Object3D) {

        this._owner = owner;
        GameMapState.instance.config = {
            minimap: false,
            sideActions: {
                self: false,
                enabled: {
                    build: {
                        self: false,
                        enabled: BuildingTypes.reduce((prev, cur) => {
                            return {
                                ...prev,
                                [cur]: false
                            }
                        }, {} as Record<BuildingType, boolean>)
                    },
                    conveyor: false
                }
            },
            bottomPanels: false,
            cameraPan: false,
            factoryOutputs: ResourceTypes.reduce((prev, cur) => {
                return {
                    ...prev,
                    [cur]: false
                }
            }, {} as Record<ResourceType, boolean>),
            selectionActions: {
                kill: false,
            },
            input: {
                leftClick: false,
                rightClick: false
            },
            freeConveyors: true
        };

        this.onSelection = this.onSelection.bind(this);
        this.onGameMapUIMounted = this.onGameMapUIMounted.bind(this);
        this.onUnitStateChanged = this.onUnitStateChanged.bind(this);
        this.onBuildingStateChanged = this.onBuildingStateChanged.bind(this);
        this.onActionClicked = this.onActionClicked.bind(this);
        this.onBuildingCreated = this.onBuildingCreated.bind(this);
        this.onConveyorCreated = this.onConveyorCreated.bind(this);
        this.onUnitSpawned = this.onUnitSpawned.bind(this);
        this.onMoveCommand = this.onMoveCommand.bind(this);
        evtGameMapUIMounted.once(this.onGameMapUIMounted);
        cmdSetSelectedElems.attach(this.onSelection);
        evtUnitStateChanged.attach(this.onUnitStateChanged);
        evtBuildingStateChanged.attach(this.onBuildingStateChanged);
        evtActionClicked.attach(this.onActionClicked);
        evtBuildingCreated.attach(this.onBuildingCreated);
        evtConveyorCreated.attach(this.onConveyorCreated);
        evtUnitSpawned.attach(this.onUnitSpawned);
        evtMoveCommand.attach(this.onMoveCommand);
    }

    override dispose(_owner: Object3D) {
        console.log("Tutorial.dispose");
        cmdSetSelectedElems.detach(this.onSelection);
        evtUnitStateChanged.detach(this.onUnitStateChanged);
        evtBuildingStateChanged.detach(this.onBuildingStateChanged);
        evtActionClicked.detach(this.onActionClicked);
        evtBuildingCreated.detach(this.onBuildingCreated);
        evtConveyorCreated.detach(this.onConveyorCreated);
        evtUnitSpawned.detach(this.onUnitSpawned);
        evtMoveCommand.detach(this.onMoveCommand);
    }

    override update(_owner: Object3D) {
    }

    private onSelection(selectedElem: SelectedElems | null) {
        switch (this._step) {
            case MissionStep.SelectUnit: {                
                if (selectedElem?.type === "units") {
                    GameMapState.instance.config.input.leftClick = false;
                    GameMapState.instance.config.input.rightClick = true;
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

            case MissionStep.ProduceGlass: {
                if (selectedElem?.type === "building") {
                    const { building } = selectedElem;
                    if (building.buildingType === "factory") {
                        GameMapState.instance.config.factoryOutputs.glass = true;
                        setTimeout(() => {
                            cmdSetIndicator.post({
                                indicator: {
                                    type: "ui",
                                    element: "factory-output"
                                }
                            });
                        }, 500);
                    }
                }
            }
                break;

            case MissionStep.CollectWater: {
                GameMapState.instance.config.input.leftClick = false;
                GameMapState.instance.config.input.rightClick = true;
                cmdSetIndicator.post({
                    indicator: {
                        type: "cell",
                        mapCoords: new Vector2(21, 120)
                    },
                    props: {
                        action: "Collect Water",
                        actionIcon: "water",
                        control: "Right click",
                        icon: "mouse-right"
                    }
                })
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
        GameMapState.instance.config.input.leftClick = true;
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
        switch (this._step) {
            case MissionStep.CollectStone: {

                this._step = MissionStep.DepositStone;
                const resource = (unit as CharacterUnit)!.resource!.type;
                console.assert(resource === "stone");
                const { depotsCache } = GameMapState.instance;
                const depots = Array.from(depotsCache.values());
                const depot = depots[0][0];
                cmdSetIndicator.post({
                    indicator: {
                        type: "building",
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
                break;

            case MissionStep.CollectWater: {

                this._step = MissionStep.DepositWater;
                const incubator = getBuildingOfType("incubator")!;
                cmdSetIndicator.post({
                    indicator: {
                        type: "building",
                        building: incubator
                    },
                    props: {
                        action: "Deposit Water",
                        actionIcon: "water",
                        control: "Right click",
                        icon: "mouse-right"
                    }
                });
            }
                break;
        }
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

                            const { sideActions } = GameMapState.instance.config;
                            sideActions.self = true;
                            sideActions.enabled.build.self = true;
                            sideActions.enabled.build.enabled.factory = true;
                            cmdRefreshUI.post();
                            setTimeout(() => {
                                cmdSetIndicator.post({
                                    indicator: {
                                        type: "ui",
                                        element: "building"
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
                    case "factory": {
                        const state = building.state as IFactoryState;
                        if (state.output === "glass") {
                            this._step = MissionStep.CollectGlass;

                            const unit = unitsManager.units[0];
                            stopUnit(unit);

                            const conveyorShadow = engine.scene!.getObjectByName("conveyor-shadow2")!;
                            conveyorShadow.visible = true;
                            const mapCoords = GameUtils.worldToMap(conveyorShadow.position, new Vector2());
                            GameMapState.instance.buildingCreationFilter = {
                                endDrag: (start: Vector2, end: Vector2) => {
                                    const desiredEnd = new Vector2().addVectors(mapCoords, new Vector2(0, 3));
                                    return start.equals(mapCoords) && end.equals(desiredEnd);
                                }
                            }

                            GameMapProps.instance.buildableType = "conveyor";
                            GameMapState.instance.action = "building";
                            // TODO select conveyor in UI
                            
                            cmdSetIndicator.post({
                                indicator: {
                                    type: "cell",
                                    mapCoords: mapCoords
                                },
                                props: {
                                    action: "Place Conveyor",
                                    actionIcon: "conveyor",
                                    control: "Left drag",
                                    icon: "mouse-left"
                                }
                            });

                            setTimeout(() => {
                                GameMapState.instance.config.bottomPanels = false;
                                cmdRefreshUI.post();
                            }, 100);
                        }
                    }
                        break;
                }
            }
                break;

            case MissionStep.CollectGlass: {
                switch (building.buildingType) {
                    case "depot": {
                        const reserves = depots.getReservesPerType(building);
                        const amount = reserves.glass;
                        if (amount !== undefined) {
                            cmdSetObjectiveStatus.post(`${amount} / 5`);
                            if (amount === 5) {
                                this._step = MissionStep.BuildIncubator;

                                GameMapState.instance.config.sideActions.self = true;
                                GameMapState.instance.config.sideActions.enabled.build.enabled.incubator = true;
                                cmdRefreshUI.post();

                                cmdSetObjective.post({
                                    objective: "Build an Incubator",
                                    icon: "incubator"
                                });
                                cmdSetObjectiveStatus.post(`${0} / 1`);                               

                                cmdOpenBuildSection.post("building");
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
                        break;
                }
            }
                break;

            case MissionStep.DepositWater: {
                switch (building.buildingType) {
                    case "incubator": {
                        const state = building.state as IIncubatorState;
                        const amount = state.reserve.get("water")!;
                        cmdSetObjectiveStatus.post(`${amount} / 5`);
                        if (amount === 5) {
                            this._step = MissionStep.Incubate;

                            const unit = unitsManager.units[0];
                            stopUnit(unit);

                            GameMapState.instance.config.bottomPanels = true;
                            const incubator = getBuildingOfType("incubator")!;
                            unitsManager.setSelection({
                                type: "building",
                                building: incubator
                            });
                            cmdSetObjective.post({
                                objective: "Incubate a worker",
                                icon: "worker"
                            });
                            cmdSetObjectiveStatus.post(`${0} / 1`);

                            setTimeout(() => {
                                cmdSetIndicator.post({
                                    indicator: {
                                        type: "ui",
                                        element: "worker"
                                    }
                                });
                            }, 1000);
                        }
                    }
                        break;
                }
            }
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
                        }, 100);
                    }
                        break;
                }
            }
                break;

            case "factory": {

                const factoryShadow = engine.scene!.getObjectByName("factory-shadow")!;
                factoryShadow.visible = true;
                const mapCoords = GameUtils.worldToMap(factoryShadow.position, new Vector2());

                GameMapState.instance.config.input.leftClick = true;
                GameMapState.instance.config.input.rightClick = false;
                cmdSetIndicator.post({
                    indicator: {
                        type: "cell",
                        // mapCoords: new Vector2(27, 122)
                        mapCoords
                    },
                    props: {
                        action: "Place Factory",
                        actionIcon: "factory",
                        control: "Left click",
                        icon: "mouse-left"
                    }
                });

                GameMapState.instance.buildingCreationFilter = {
                    click: coords => coords.equals(mapCoords)
                }

                setTimeout(() => {
                    GameMapState.instance.config.sideActions.self = false;
                    cmdRefreshUI.post();
                }, 100);                
            }
                break;

            case "conveyor": {
                switch (this._step) {
                    case MissionStep.BuildConveyorToFactory: {
                        const conveyorShadow = engine.scene!.getObjectByName("conveyor-shadow")!;
                        conveyorShadow.visible = true;
                        const mapCoords = GameUtils.worldToMap(conveyorShadow.position, new Vector2());
                        GameMapState.instance.buildingCreationFilter = {
                            endDrag: (start: Vector2, end: Vector2) => {
                                const desiredEnd = new Vector2().addVectors(mapCoords, new Vector2(0, -3));
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

                        setTimeout(() => {
                            GameMapState.instance.config.sideActions.self = false;
                            cmdRefreshUI.post();
                        }, 100);                        
                    }
                        break;
                }
            }
                break;

            case "factory-output": {
                switch (this._step) {
                    case MissionStep.ProduceGlass: {
                        setTimeout(() => {
                            cmdSetIndicator.post({
                                indicator: {
                                    type: "ui",
                                    element: "glass"
                                }
                            });
                        }, 300);
                    }
                        break;
                }
            }
                break;

            case "incubator": {
                switch (this._step) {
                    case MissionStep.BuildIncubator: {
                        const incubatorShadow = engine.scene!.getObjectByName("incubator-shadow")!;
                        incubatorShadow.visible = true;
                        const mapCoords = GameUtils.worldToMap(incubatorShadow.position, new Vector2());
                        cmdSetIndicator.post({
                            indicator: {
                                type: "cell",
                                mapCoords
                            },
                            props: {
                                action: "Place Incubator",
                                actionIcon: "incubator",
                                control: "Left click",
                                icon: "mouse-left"
                            }
                        });

                        GameMapState.instance.buildingCreationFilter = {
                            click: coords => coords.equals(mapCoords)
                        }

                        setTimeout(() => {
                            GameMapState.instance.config.sideActions.self = false;
                            cmdRefreshUI.post();
                        }, 100);                        
                    }
                }
            }
            break;

            case "worker": {
                cmdSetIndicator.post(null);
            }
        }
    }

    private onBuildingCreated(building: IBuildingInstance) {
        switch (building.buildingType) {
            case "factory": {
                const factoryShadow = engine.scene!.getObjectByName("factory-shadow")!;
                factoryShadow.removeFromParent();
                GameMapState.instance.buildingCreationFilter = null;
                cmdSetObjectiveStatus.post(`${1} / 1`);

                this._step = MissionStep.BuildConveyorToFactory;
                cmdSetIndicator.post(null);                

                setTimeout(() => {
                    cmdSetObjective.post({
                        objective: "Build a conveyor",
                        icon: "conveyor"
                    });
                    cmdSetObjectiveStatus.post(`${0} / 1`);
                    
                    GameMapState.instance.config.sideActions.self = true;
                    GameMapState.instance.config.sideActions.enabled.conveyor = true;
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
                break;

            case "incubator": {
                const shadow = engine.scene!.getObjectByName("incubator-shadow")!;
                shadow.removeFromParent();
                GameMapState.instance.buildingCreationFilter = null;
                cmdSetObjectiveStatus.post(`${1} / 1`);

                this._step = MissionStep.CollectWater;
                cmdSetIndicator.post(null);

                setTimeout(() => {                    
                    cmdSetObjective.post({
                        objective: "Collect Water",
                        icon: "water"
                    });
                    cmdSetObjectiveStatus.post(`${0} / 5`);
                    cmdSetIndicator.post({
                        indicator: {
                            type: "unit",
                            unit: unitsManager.units[0]
                        },
                        props: {
                            action: "Select worker",
                            actionIcon: "worker",
                            control: "Left click",
                            icon: "mouse-left"
                        }
                    });
                }, 2000);                
            }
        }
    }

    private onConveyorCreated() {

        switch (this._step) {
            case MissionStep.BuildConveyorToFactory: {
                const conveyorShadow = engine.scene!.getObjectByName("conveyor-shadow")!;
                conveyorShadow.removeFromParent();
                GameMapState.instance.action = null;
                GameMapState.instance.buildingCreationFilter = null;
                cmdSetIndicator.post(null);

                this._step = MissionStep.ProduceGlass;
                setTimeout(() => {
                    cmdSetObjective.post({
                        objective: "Produce Glass",
                        icon: "glass"
                    });
                    cmdSetObjectiveStatus.post(`${0} / 5`);

                    GameMapState.instance.config.bottomPanels = true;

                    const factory = getBuildingOfType("factory")!;
                    cmdSetIndicator.post({
                        indicator: {
                            type: "building",
                            building: factory
                        },
                        props: {
                            action: "Select Factory",
                            actionIcon: "factory",
                            control: "Left click",
                            icon: "mouse-left"
                        }
                    });

                }, 500);
            }
                break;

            case MissionStep.CollectGlass: {
                const conveyorShadow = engine.scene!.getObjectByName("conveyor-shadow2")!;
                conveyorShadow.removeFromParent();
                GameMapState.instance.action = null;
                GameMapState.instance.buildingCreationFilter = null;
                cmdSetIndicator.post(null);

                // remove factory panel for less confusion
                unitsManager.setSelection(null);
                GameMapState.instance.config.bottomPanels = false;

                // for demo disable auto ouput so glass remains in the depot
                const { depotsCache } = GameMapState.instance;
                const depot = Array.from(depotsCache.values())[0][0];
                const depotState = depot.state as IDepotState;
                depotState.autoOutput = false;
            }
                break;
        }
    }

    private onUnitSpawned() {
        switch (this._step) {
            case MissionStep.Incubate: {
                for (const unit of unitsManager.units) {
                    if (UnitUtils.isWorker(unit)) {
                        unitMotion.moveUnit(unit, new Vector2(32, 143));
                    }            
                }        
                engineState.removeComponent(this._owner!, Tutorial);
                cmdTutorialComplete.post();
            }
        }        
    }

    private onMoveCommand(mapCoords: Vector2) {
        switch (this._step) {
            case MissionStep.CollectStone: {
                const resource = GameUtils.getCell(mapCoords)?.resource?.type;
                if (resource === "stone") {
                    cmdSetIndicator.post(null);
                }
            }
            break;

            case MissionStep.DepositStone: {
                const building = GameUtils.getCell(mapCoords)?.building;
                if (building) {
                    const buildingType = GameMapState.instance.buildings.get(building)?.buildingType;
                    if (buildingType === "depot") {
                        cmdSetIndicator.post(null);
                    }
                }
            }   
            break;

            case MissionStep.CollectWater: {
                const resource = GameUtils.getCell(mapCoords)?.resource?.type;
                if (resource === "water") {
                    cmdSetIndicator.post(null);
                }
            }
            break;

            case MissionStep.DepositWater: {
                const building = GameUtils.getCell(mapCoords)?.building;
                if (building) {
                    const buildingType = GameMapState.instance.buildings.get(building)?.buildingType;
                    if (buildingType === "incubator") {
                        cmdSetIndicator.post(null);
                    }
                }
            }
        }
    }
}

