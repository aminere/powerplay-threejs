

import { Object3D } from "three";
import { Component, IComponentState } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { utils } from "../../engine/Utils";
import { engineState } from "../../engine/EngineState";

export class AutoDestroyProps extends ComponentProps {
    public delay = 2;
    constructor(props?: Partial<AutoDestroyProps>) {
        super();
        this.deserialize(props);
    }
}

interface IState extends IComponentState {
    tween: gsap.core.Tween | null;
}

export class AutoDestroy extends Component<AutoDestroyProps, IState> {
    constructor(props?: Partial<AutoDestroyProps>) {
        super(new AutoDestroyProps(props));
    }

    override start(owner: Object3D) {
        const tween = utils.postpone(this.props.delay, () => {            
            this.state.tween = null;
            engineState.removeObject(owner);
        });
        this.setState({
            tween
        });
    }

    override dispose() {
        this.state?.tween?.kill();
    }
}

