

import { MathUtils, Object3D, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { time } from "../../engine/core/Time";

export class ExplodeProps extends ComponentProps {
    velocityBias = new Vector3(0, 1, 0);
    impulse = 10;
    angularSpeed = 180;
    gravity = 10;
    constructor(props?: Partial<ExplodeProps>) {
        super();
        this.deserialize(props);
    }
}

interface IExplosionChunk {
    velocity: Vector3;
    rotationAxis: Vector3;
}

export class Explode extends Component<ExplodeProps> {
    constructor(props?: Partial<ExplodeProps>) {
        super(new ExplodeProps(props));
    }

    override start(owner: Object3D) {
        for (const child of owner.children) {
            const chunk: IExplosionChunk = {
                velocity: new Vector3(),
                rotationAxis: new Vector3(MathUtils.randFloat(-1, 1), MathUtils.randFloat(-1, 1), MathUtils.randFloat(-1, 1)).normalize(),
            };
            chunk.velocity.copy(child.position)
                .add(this.props.velocityBias)
                .normalize()
                .multiplyScalar(this.props.impulse);
            child.userData.explosionChunk = chunk;
        }
    }

    override update(owner: Object3D) {
        const angle = this.props.angularSpeed * time.deltaTime;
        const gravity = this.props.gravity * time.deltaTime;
        for (const child of owner.children) {
            const chunk = child.userData.explosionChunk as IExplosionChunk;
            chunk.velocity.y -= gravity;
            child.position.addScaledVector(chunk.velocity, time.deltaTime);            
            child.rotateOnAxis(chunk.rotationAxis, MathUtils.degToRad(angle));
        }
    }
}

