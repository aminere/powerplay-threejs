import { Camera, Color, InstancedMesh, Matrix4, Quaternion, Renderer, Scene, Vector3 } from "three";
import { Component } from "../../ecs/Component";
import { ParticlesProps } from "./ParticlesProps";
import { ParticlesState } from "./ParticlesState";
import { ParticlesEmitter } from "./ParticlesEmitter";
import * as Attributes from "../../serialization/Attributes";
import { utils } from "../../Utils";

const particlePos = new Vector3();
const color = new Color();
const color2 = new Color();
const color3 = new Color();
const matrix = new Matrix4();
const scale = new Vector3();
const quaternion = new Quaternion();

@Attributes.componentRequires(obj => {
    return obj instanceof InstancedMesh
})
export class InstancedParticles extends Component<ParticlesProps, ParticlesState> {
    constructor(props?: Partial<ParticlesProps>) {
        super(new ParticlesProps(props));
    }

    override start(owner: InstancedMesh) {
        this.setState(new ParticlesState(this.props.maxParticles));        
        owner.computeBoundingSphere();

        ParticlesEmitter.init(this.state, this.props.duration);
        if (this.props.delay > 0) {
            this.state.isEmitting = false;
            utils.postpone(this.props.delay, () => this.state.isEmitting = true);
        }
    }

    override update(owner: InstancedMesh) {
        ParticlesEmitter.update(this.state, this.props);
        this.updateGeometry(owner);
    }

    override mount(owner: InstancedMesh) { 
        owner.count = 0;

        owner.userData.cameraRotation = new Quaternion();
        owner.onBeforeRender = (_renderer: Renderer, _scene: Scene, camera: Camera) => {
            const { worldRotation: cameraRotation } = camera.userData;
            owner.userData.cameraRotation.copy(cameraRotation);
        };
    }

    private updateGeometry(owner: InstancedMesh) {
        let index = 0;
        let particlesToProcess = this.state.particleCount;
        let radiusSq = 0;

        // world = parent * local
        // local = world * invParent
        const { cameraRotation } = owner.userData;
        const parentRotation = owner.parent!.getWorldQuaternion(quaternion);
        const invParentRotation = parentRotation.invert();
        const localParticleRotation = invParentRotation.multiply(cameraRotation);

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
            this.state.getColor("initialColor", i, color);
            this.state.getColor("color", i, color2);            
            const alpha = this.state.getAlpha(i);
            color3.copy(color).multiply(color2).multiplyScalar(alpha);
            
            const _size = size * initialSize;
            scale.set(_size, _size, _size);
            matrix.compose(particlePos, localParticleRotation, scale);
            owner.setMatrixAt(index, matrix);            
            owner.setColorAt(index, color3);

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

