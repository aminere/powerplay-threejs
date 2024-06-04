import { Color, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { Component } from "../../ecs/Component";
import { ParticlesProps } from "./ParticlesProps";
import { ParticlesState } from "./ParticlesState";
import { ParticlesEmitter } from "./ParticlesEmitter";
import * as Attributes from "../../serialization/Attributes";

const particlePos = new Vector3();
const dummyColor = new Color();
const matrix = new Matrix4();
const scale = new Vector3();

@Attributes.componentRequires(obj => {
    return obj instanceof InstancedMesh
})
export class InstancedParticles extends Component<ParticlesProps, ParticlesState> {

    public static typename = "InstancedParticles";

    constructor(props?: Partial<ParticlesProps>) {
        super(new ParticlesProps(props));
    }

    override start(owner: InstancedMesh) {
        this.setState(new ParticlesState(this.props.maxParticles));
        ParticlesEmitter.init(this.state, this.props.duration);
        owner.computeBoundingSphere();
    }

    override update(_owner: InstancedMesh) {
        ParticlesEmitter.update(this.state, this.props);
    }

    override mount(owner: InstancedMesh) { 
        owner.count = 0;
    }

    public updateGeometry(owner: InstancedMesh, quaternion: Quaternion) {

        if (!this.state) {
            return;
        }

        let index = 0;
        let particlesToProcess = this.state.particleCount;
        let radiusSq = 0;
        for (let i = 0; i < this.props.maxParticles; ++i) {
            if (particlesToProcess === 0) {
                // early break if no more particles to process
                break;
            }

            const active = this.state.getData("active", i);
            if (active === 0) {
                continue;
            }

            this.state.getVector3("position", i, particlePos);
            const lengthSq = particlePos.lengthSq();
            if (lengthSq > radiusSq) {
                radiusSq = lengthSq;
            }

            const size = this.state.getData("size", i);
            const initialSize = this.state.getData("initialSize", i);
            this.state.getColor(i, dummyColor);
            const alpha = this.state.getAlpha(i);
            dummyColor.multiplyScalar(alpha);

            const _size = size * initialSize;
            scale.set(_size, _size, _size);
            matrix.compose(particlePos, quaternion, scale);
            owner.setMatrixAt(index, matrix);            
            owner.setColorAt(index, dummyColor);

            --particlesToProcess;
            index++;
        }

        owner.count = index;
        owner.boundingSphere!.radius = Math.sqrt(radiusSq);
        owner.instanceMatrix.needsUpdate = true;
        if (owner.instanceColor) {
            owner.instanceColor.needsUpdate = true;
        }
    }
}

