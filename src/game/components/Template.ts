
import { Object3D } from "three";
import { Component, IComponentState } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";

export class Props extends ComponentProps {
    constructor(props?: Partial<Props>) {
        super();
        this.deserialize(props);
    }
}

interface IState extends IComponentState {    
}

export class Template extends Component<Props, IState> {
    constructor(props?: Partial<Props>) {
        super(new Props(props));
    }

    override start(_owner: Object3D) {
    }

    override update(_owner: Object3D) {        
    }
}

