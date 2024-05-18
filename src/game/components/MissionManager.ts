
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { SelectedElems, cmdSetIndicator, cmdSetObjective, cmdSetObjectiveStatus, cmdSetSelectedElems, evtBuildingStateChanged, evtGameMapUIMounted, evtUnitStateChanged } from "../../Events";
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
    BuildFactory
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
        cmdSetSelectedElems.attach(this.onSelection);
        evtGameMapUIMounted.once(this.onGameMapUIMounted);
        evtUnitStateChanged.once(this.onUnitStateChanged);
        evtBuildingStateChanged.attach(this.onBuildingStateChanged);
    }

    override dispose(_owner: Object3D) {
        cmdSetSelectedElems.detach(this.onSelection);
        evtBuildingStateChanged.detach(this.onBuildingStateChanged);
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
                            mapCoords: new Vector2(33, 119)
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
        }, 1000);
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

    private onBuildingStateChanged(building: IBuildingInstance) {
        console.assert(building.buildingType === "depot");
        const reserves = depots.getReservesPerType(building);
        const amount = reserves.stone;
        cmdSetObjectiveStatus.post(`${amount} / 5`);
        if (amount === 5) {
            evtBuildingStateChanged.detach(this.onBuildingStateChanged);
            this._step = MissionStep.BuildFactory;
            // TODO
        }
    }
}

