
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { SelectedElems, cmdSetIndicator, cmdSetSelectedElems, evtGameMapUIMounted, evtResourceCollected } from "../../Events";
import { unitsManager } from "../unit/UnitsManager";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { GameMapState } from "./GameMapState";

export class MissionManagerProps extends ComponentProps {
    constructor(props?: Partial<MissionManagerProps>) {
        super();
        this.deserialize(props);
    }
}

enum MissionStep {
    SelectUnit,
    CollectResource,
    DepositResource
}

export class MissionManager extends Component<MissionManagerProps> {

    private _step = MissionStep.SelectUnit;

    constructor(props?: Partial<MissionManagerProps>) {
        super(new MissionManagerProps(props));

    }

    override start(_owner: Object3D) {
        this.onSelection = this.onSelection.bind(this);
        cmdSetSelectedElems.attach(this.onSelection);
        this.onGameMapUIMounted = this.onGameMapUIMounted.bind(this);
        evtGameMapUIMounted.once(this.onGameMapUIMounted);
        this.onResourceCollected = this.onResourceCollected.bind(this);
        evtResourceCollected.once(this.onResourceCollected);
    }

    override dispose(_owner: Object3D) {
        cmdSetSelectedElems.detach(this.onSelection);
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
    }

    private onResourceCollected(resource: RawResourceType | ResourceType) {       
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
                action: "Deposit Resource",
                control: "Right click",
                icon: "mouse-right"
            }
        });
    }
}

