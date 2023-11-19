import { MathUtils, Object3D } from "three";
import { Component, IComponentProps } from "../../engine/Component";
import { Time } from "../../engine/Time";

export interface TestComponentProps extends IComponentProps {
    moveSpeed: number;   
}

export class TestComponent extends Component<TestComponentProps> {
    constructor(props?: TestComponentProps) {        
        super(props ?? { moveSpeed: 1 });
    }

    override update(owner: Object3D) {
        owner.position.y += this.props.moveSpeed * Time.deltaTime;
    }
}

export function TestComponentUpdate(component: TestComponent) {
    console.log(component);
}

export interface TestComponentProps2 extends IComponentProps {
    rotationSpeed: number;    
}

export class TestComponent2 extends Component<TestComponentProps2> {
    constructor(props?: TestComponentProps2) {
        super(props ?? { rotationSpeed: 1 });
    }

    override update(owner: Object3D) {
        owner.rotateY(this.props.rotationSpeed * MathUtils.DEG2RAD * Time.deltaTime);
    }
}

