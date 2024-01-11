
import { Object3D, Vector3 } from "three";
import { Component, IComponentState } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { engineState } from "../../engine/EngineState";
import { Flock } from "./Flock";
import { IUnit } from "../unit/IUnit";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/Time";

export class NpcProps extends ComponentProps {
    detectRadius = 3;
    positionDamp = 2;
    maxSpeed = 6;

    constructor(props?: Partial<NpcProps>) {
        super();
        this.deserialize(props);
    }
}

enum NpcState {
    Idle,
    Follow,
    Attack
}

interface INpcState extends IComponentState {
    state: NpcState;
    units: IUnit[];
    target?: IUnit;
    velocity: Vector3;
}

export class NPC extends Component<NpcProps, INpcState> {
    constructor(props?: Partial<NpcProps>) {
        super(new NpcProps(props));
    }

    override start() {
        this.setState({
            state: NpcState.Idle,
            units: [],
            velocity: new Vector3()
        });
    }

    override update(_owner: Object3D) {

        if (this.state.units.length === 0) {
            const flock = engineState.getComponents(Flock)[0];
            const units = flock.component.state?.units;
            if (units) {
                this.state.units = units;
            }
            return;
        }

        switch (this.state.state) {
            case NpcState.Idle:
                for (const unit of this.state.units) {
                    const dist = unit.obj.position.distanceTo(_owner.position);
                    if (dist < this.props.detectRadius) {
                        this.state.target = unit;
                        this.state.state = NpcState.Follow;
                        break;
                    }
                }
                break;
            case NpcState.Follow:
                const targetObj = this.state.target!.obj;
                mathUtils.smoothDampVec3(
                    _owner.position, 
                    targetObj.position, 
                    this.state.velocity,
                    this.props.positionDamp,
                    this.props.maxSpeed, 
                    time.deltaTime
                );
                break;

            case NpcState.Attack:
                break;
        }
    }
}


