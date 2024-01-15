import { Object3D, SkinnedMesh } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { time } from "../../engine/Time";
import { engineState } from "../../engine/EngineState";
import { unitUtils } from "../unit/UnitUtils";
import { IUnit } from "../unit/IUnit";

export class UnitCollisionAnimProps extends ComponentProps {
    duration = .25;
    unit: IUnit = null!;

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

    override start(owner: Object3D) {
        if (!this.props.unit.fsm.currentState) {
            unitUtils.skeletonManager.applySkeleton("walk", owner as SkinnedMesh);            
        }
        this.setState({ timer: this.props.duration });
    }

    override update(owner: Object3D) {
        this.state.timer -= time.deltaTime;
        if (this.state.timer < 0) {
            if (!this.props.unit.fsm.currentState) {
                unitUtils.skeletonManager.applySkeleton("idle", owner as SkinnedMesh);
            }
            engineState.removeComponent(owner, UnitCollisionAnim);
        }
    }

    public reset() {
        this.state.timer = this.props.duration;
    }
}

