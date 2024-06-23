import { Object3D } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { time } from "../../engine/core/Time";
import { engineState } from "../../engine/EngineState";
import { unitAnimation } from "../unit/UnitAnimation";
import { ICharacterUnit } from "../unit/ICharacterUnit";

export class UnitCollisionAnimProps extends ComponentProps {
    duration = .25;
    unit: ICharacterUnit = null!;

    constructor(props?: Partial<UnitCollisionAnimProps>) {
        super();
        this.deserialize(props);
    }
}

interface IUnitCollisionAnimState {
    timer: number;
}

export class UnitCollisionAnim extends Component<UnitCollisionAnimProps, IUnitCollisionAnimState> {
    constructor(props?: Partial<UnitCollisionAnimProps>) {
        super(new UnitCollisionAnimProps(props));
    }

    override start(_owner: Object3D) {
        if (this.props.unit.isIdle) {            
            unitAnimation.setAnimation(this.props.unit, "walk");
        }
        this.setState({ timer: this.props.duration });
    }

    override update(owner: Object3D) {
        this.state.timer -= time.deltaTime;
        if (this.state.timer < 0) {
            if (this.props.unit.isIdle) {     
                unitAnimation.setAnimation(this.props.unit, "idle");
            }
            engineState.removeComponent(UnitCollisionAnim, owner);
        }
    }

    public reset() {
        this.state.timer = this.props.duration;        
    }
}

