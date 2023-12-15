
import { Object3D, Quaternion, Vector3 } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { InstancedAnimation } from "../../engine/animation/InstancedAnimation";
import { meshes } from "../../engine/Meshes";
import { time } from "../../engine/Time";

export class TestProps extends ComponentProps {
    separation = 2;
    repulsion = 1.5;
    constructor(props?: Partial<TestProps>) {
        super();
        this.deserialize(props);
    }
}

interface ITestState {
    anim: InstancedAnimation;
}

export class Test extends Component<TestProps, ITestState> {
    constructor(props?: Partial<TestProps>) {
        super(new TestProps(props));
    }    

    override start(owner: Object3D) {
        this.load(owner);
    }

    override update() {
       this.state?.anim.update(time.deltaTime);
    }

    private async load(owner: Object3D) {
        const gltf = await meshes.loadGLTF("/test/characters/walking.glb");
        const instancedAnimation = new InstancedAnimation({ gltf, count: 100 });
        const instance = {
            position: new Vector3(0, 0, 0),
            rotation: new Quaternion(),
            scale: new Vector3(1, 1, 1),
            animationIndex: 0,
            currentTime: 0,
        };
        instancedAnimation.addInstance(instance);
        owner.add(instancedAnimation.group);
        this.setState({ anim: instancedAnimation });
    }
}

