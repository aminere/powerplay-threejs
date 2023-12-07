import { Object3D } from "three";
import { Component } from "../../engine/Component";
import { meshes } from "../../engine/Meshes";
import { ComponentProps } from "../../engine/ComponentProps";

export class TreeProps extends ComponentProps {
    model = "/models/trees/palm.glb";
}

export class Tree extends Component<TreeProps> {

    override start(owner: Object3D) {
        meshes.load(this.props.model).then(_meshes => {
            _meshes.forEach(mesh => {
                // const uniforms = {
                //     time: {
                //         value: 0
                //     }
                // };
                // const material = new ShaderMaterial({
                //     uniforms,
                //     vertexShader: `
                //     varying vec2 vUv;
                //     iform float time;  
                //     void main() {
                //         vUv = uv;    

                //         // VERTEX POSITION    
                //         vec4 mvPosition = vec4( position, 1.0 );
                //         #ifdef USE_INSTANCING
                //         	mvPosition = instanceMatrix * mvPosition;
                //         #endif
                        
                //         // DISPLACEMENT    
                //         // here the displacement is made stronger on the blades tips.
                //         float dispPower = 1.0 - cos( uv.y * 3.1416 / 2.0 );
                        
                //         float displacement = sin( mvPosition.z + time * 10.0 ) * ( 0.1 * dispPower );
                //         mvPosition.z += displacement;       
                        
                //         vec4 modelViewPosition = modelViewMatrix * mvPosition;
                //         gl_Position = projectionMatrix * modelViewPosition;
                //     }
                //     `,
                //     fragmentShader: `
                //     varying vec2 vUv;  
                //     void main() {
                //     	vec3 baseColor = vec3( 0.41, 1.0, 0.5 );
                //         float clarity = ( vUv.y * 0.5 ) + 0.5;
                //         gl_FragColor = vec4( baseColor * clarity, 1 );
                //     }
                //     `,
                //     depthWrite: false,
                //     transparent: true,
                //     vertexColors: true
                // });
                // const oldMaterial = mesh.material as MeshStandardMaterial;
                owner.add(mesh);
            });
        });
    }
}

