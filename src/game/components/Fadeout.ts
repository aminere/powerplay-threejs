
import { DoubleSide, Material, Mesh, Object3D } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import gsap from "gsap";

export class FadeoutProps extends ComponentProps {    
    duration = 1;

    constructor(props?: Partial<FadeoutProps>) {
        super();
        this.deserialize(props);
    }
}

export class Fadeout extends Component<FadeoutProps> {

    constructor(props?: Partial<FadeoutProps>) {
        super(new FadeoutProps(props));
    }    

    override start(owner: Object3D) {

        const meshFadeout = (mesh: Mesh) => {
            if (Array.isArray(mesh.material)) {                
                console.warn("Fadeout component can only be applied to Mesh objects with a single material");
                return Promise.resolve();
            } else {
                return new Promise(resolve => {
                    const material = (mesh.material as Material).clone();
                    material.transparent = true;
                    material.side = DoubleSide;
                    mesh.material = material;
                    gsap.to(material, {
                        duration: this.props.duration,
                        opacity: 0,
                        onUpdate: () => {
                            if (mesh.castShadow) {
                                if (material.opacity < .5) {
                                    mesh.castShadow = false;
                                }
                            }
                        },
                        onComplete: resolve
                    });
                });                
            }
        };

        const mesh = owner as Mesh;
        if (mesh.isMesh) {
            meshFadeout(mesh).then(() => owner.removeFromParent());
        } else {
            const subMeshes = mesh.getObjectsByProperty("isMesh", true) as Mesh[];
            Promise.all(subMeshes.map(meshFadeout)).then(() => owner.removeFromParent());
        }
    }
}

