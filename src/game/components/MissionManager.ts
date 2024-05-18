
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { SelectedElems, cmdRefreshUI, cmdSetIndicator, cmdSetObjective, cmdSetObjectiveStatus, cmdSetSelectedElems, evtActionClicked, evtBuildingCreated, evtBuildingStateChanged, evtGameMapUIMounted, evtUnitStateChanged } from "../../Events";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "./GameMapState";
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { IUnit } from "../unit/IUnit";
import { CharacterUnit } from "../unit/CharacterUnit";
import { depots } from "../buildings/Depots";

export class MissionManagerProps extends ComponentProps {
    constructor(props?: Partial<MissionManagerProps>) {
        super();
        this.deserialize(props);
    }
}

enum MissionStep {
    SelectUnit,
    CollectResource,
    DepositResource,
    BuildFactory,
    BuildConveyorToFactory
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
        cmdSetSelectedElems.attach(this.onSelection);
        evtGameMapUIMounted.once(this.onGameMapUIMounted);
        evtUnitStateChanged.once(this.onUnitStateChanged);
        evtBuildingStateChanged.attach(this.onBuildingStateChanged);
        evtActionClicked.attach(this.onActionClicked);
        evtBuildingCreated.attach(this.onBuildingCreated);
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
                    this._step = MissionStep.CollectResource;
                    cmdSetIndicator.post({
                        indicator: {
                            type: "cell",
                            mapCoords: new Vector2(31, 124)
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
        console.assert(this._step === MissionStep.CollectResource);
        this._step = MissionStep.DepositResource;

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
        console.assert(building.buildingType === "depot");
        const reserves = depots.getReservesPerType(building);
        const amount = reserves.stone;
        cmdSetObjectiveStatus.post(`${amount} / 5`);
        if (amount === 5) {
            evtBuildingStateChanged.detach(this.onBuildingStateChanged);
            this._step = MissionStep.BuildFactory;

            cmdSetObjective.post({
                objective: "Build a Factory",
                icon: "factory"
            });
            cmdSetObjectiveStatus.post(`${0} / 1`);

            const { sideActions } = GameMapState.instance.enabled;
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
                        mapCoords: new Vector2(21, 131)
                    },
                    props: {
                        action: "Place Factory",
                        actionIcon: "factory",
                        control: "Left click",
                        icon: "mouse-left"
                    }
                });
            }
            break;

            case "conveyor": {
                cmdSetIndicator.post({
                    indicator: {
                        type: "cell",
                        mapCoords: new Vector2(21, 131)
                    },
                    props: {
                        action: "Place Conveyor",
                        actionIcon: "conveyor",
                        control: "Left click",
                        icon: "mouse-left"
                    }
                });
            }
        }
    }

    private onBuildingCreated(building: IBuildingInstance) {
        if (building.buildingType === "factory") {
            this._step = MissionStep.BuildConveyorToFactory;
            setTimeout(() => {
                cmdSetObjective.post({
                    objective: "Build a conveyor",
                    icon: "conveyor"
                });
                cmdSetObjectiveStatus.post(`${0} / 1`);
    
                const { sideActions } = GameMapState.instance.enabled;          
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
}

