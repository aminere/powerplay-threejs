import { BufferAttribute, Color, DynamicDrawUsage, Object3D, Points, ShaderMaterial, Vector3 } from "three";
import { Component } from "../../ecs/Component";
import { ParticlesState } from "./ParticlesState";
import { ParticlesProps } from "./ParticlesProps";
import * as Attributes from "../../serialization/Attributes";
import { ParticlesEmitter } from "./ParticlesEmitter";

const particlePos = new Vector3();
const dummyColor = new Color();

@Attributes.componentRequires(obj => {
    return obj instanceof Points && (obj as Points).material instanceof ShaderMaterial;
})
export class Particles extends Component<ParticlesProps, ParticlesState> {

    constructor(props?: Partial<ParticlesProps>) {
        super(new ParticlesProps(props));
    }

    override start(_owner: Points) {
        const geometry = _owner.geometry;
        const vertices = new Float32Array([...Array(this.props.maxParticles)].flatMap(_ => [0, 0, 0]));
        const colors = new Float32Array([...Array(this.props.maxParticles)].flatMap(_ => [1, 1, 1, 1]));
        const sizes = new Float32Array([...Array(this.props.maxParticles)].map(_ => 1));
        geometry.setAttribute('position', new BufferAttribute(vertices, 3).setUsage(DynamicDrawUsage));
        geometry.setAttribute('color', new BufferAttribute(colors, 4).setUsage(DynamicDrawUsage));
        geometry.setAttribute('size', new BufferAttribute(sizes, 1).setUsage(DynamicDrawUsage));
        geometry.setDrawRange(0, 0);
        geometry.computeBoundingSphere();  
        this.setState(new ParticlesState(this.props.maxParticles));

        ParticlesEmitter.init(this.state, this.props.duration);
    }

    override update(owner: Object3D) {
        ParticlesEmitter.update(this.state, this.props);        
        this.updateGeometry(owner as Points);
    }

    private updateGeometry(owner: Points) {
        const geometry = owner.geometry;
        const positions = geometry.getAttribute("position") as BufferAttribute;
        const colors = geometry.getAttribute("color") as BufferAttribute;
        const sizes = geometry.getAttribute("size") as BufferAttribute;
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

            // Apply position
            this.state.getVector3("position", i, particlePos);
            positions.setXYZ(index, particlePos.x, particlePos.y, particlePos.z);
            const lengthSq = particlePos.lengthSq();
            if (lengthSq > radiusSq) {
                radiusSq = lengthSq;
            }            

            // Apply size
            const size = this.state.getData("size", i);
            const initialSize = this.state.getData("initialSize", i);
            sizes.setX(index, initialSize * size);

            // Apply color
            this.state.getColor(i, dummyColor);
            const alpha = this.state.getAlpha(i);
            colors.setXYZW(index, dummyColor.r, dummyColor.g, dummyColor.b, alpha);
            --particlesToProcess;
            index++;
        }
        
        geometry.setDrawRange(0, index);
        geometry.boundingSphere!.radius = Math.sqrt(radiusSq);
        positions.needsUpdate = true;
        colors.needsUpdate = true;
        sizes.needsUpdate = true;
    }
}

