
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { SelectedElems, cmdSetIndicator, cmdSetSelectedElems, evtGameMapUIMounted } from "../../Events";
import { unitsManager } from "../unit/UnitsManager";

export class MissionManagerProps extends ComponentProps {
    constructor(props?: Partial<MissionManagerProps>) {
        super();
        this.deserialize(props);
    }
}

enum MissionStep {
    SelectUnit,
    SelectStone
}

export class MissionManager extends Component<MissionManagerProps> {

    private _step = MissionStep.SelectUnit;

    constructor(props?: Partial<MissionManagerProps>) {
        super(new MissionManagerProps(props));

    }

    override start(_owner: Object3D) {
        this.onSelection = this.onSelection.bind(this);
        cmdSetSelectedElems.attach(this.onSelection);
        evtGameMapUIMounted.attach(this.onGameMapUIMounted);
    }

    override dispose(_owner: Object3D) {
        cmdSetSelectedElems.detach(this.onSelection);
        evtGameMapUIMounted.detach(this.onGameMapUIMounted);
    }

    override update(_owner: Object3D) {
    }

    private onSelection(selectedElem: SelectedElems | null) {
        switch (this._step) {
            case MissionStep.SelectUnit: {
                if (selectedElem?.type === "units") {
                    this._step = MissionStep.SelectStone;
                    cmdSetIndicator.post({
                        indicator: {
                            type: "cell",
                            mapCoords: new Vector2(33, 119)
                        },
                        control: "Right click",
                        icon: "mouse-right"
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
            control: "Left click",
            icon: "mouse-left"
        });
    }
}

