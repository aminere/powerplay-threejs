
import { Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { utils } from "../../engine/Utils";
import { engine } from "../../engine/Engine";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/core/Time";
import { GameUtils } from "../GameUtils";

export class TestProps extends ComponentProps {

    dampDuration = .5;
    maxSpeed = 10;

    constructor(props?: Partial<TestProps>) {
        super();
        this.deserialize(props);
    }
}

interface ITestState {
    target: Object3D;
}

export class Test extends Component<TestProps, ITestState> {
    constructor(props?: Partial<TestProps>) {
        super(new TestProps(props));
    }    

    override start() {
        const target = utils.createObject(engine.scene!, "target");
        this.setState({ 
            target
        });
    }

    override update(owner: Object3D) {
        const targetPos = this.state.target.position;
        const toTarget = targetPos.clone().normalize();
        const matrix = new Matrix4();
        const lookAt = new Quaternion().setFromRotationMatrix(matrix.lookAt(GameUtils.vec3.zero, toTarget.negate(), GameUtils.vec3.up));
        mathUtils.smoothDampQuat(owner.quaternion, lookAt, this.props.dampDuration, time.deltaTime);
    }
}

