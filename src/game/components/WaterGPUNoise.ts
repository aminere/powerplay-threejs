
import { Color, Euler, InstancedMesh, Matrix4, Mesh, Object3D, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { time } from "../../engine/core/Time";
import { config } from "../config";

export class WaterProps extends ComponentProps {

    strength = .5;
    frequency = .5;
    speed = .6;
    size = 1;

    constructor(props?: Partial<WaterProps>) {
        super();
        this.deserialize(props);
    }
}

const { mapRes, cellSize } = config.game;

export class Water extends Component<WaterProps> {
    constructor(props?: Partial<WaterProps>) {
        super(new WaterProps(props));
    }

    override start(owner: Object3D) {
        const patchSize = mapRes * cellSize;
        const geometry = new PlaneGeometry(patchSize, patchSize, 32, 32);

        const vertexShader = `
        uniform float time;
        uniform float strength;
        uniform float frequency;
        
        vec2 srandom2(in vec2 st) {
            const vec2 k = vec2(.3183099, .3678794);
            st = st * k + k.yx;
            return -1. + 2. * fract(16. * k * fract(st.x * st.y * (st.x + st.y)));
        }

        float noised (in vec2 p) {
            // grid
            vec2 i = floor( p );
            vec2 f = fract( p );
        
            // quintic interpolation
            vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
            vec2 du = 30. * f * f * (f * (f - 2.) + 1.);
        
            vec2 ga = srandom2(i + vec2(0., 0.));
            vec2 gb = srandom2(i + vec2(1., 0.));
            vec2 gc = srandom2(i + vec2(0., 1.));
            vec2 gd = srandom2(i + vec2(1., 1.));
        
            float va = dot(ga, f - vec2(0., 0.));
            float vb = dot(gb, f - vec2(1., 0.));
            float vc = dot(gc, f - vec2(0., 1.));
            float vd = dot(gd, f - vec2(1., 1.));

            return va + u.x*(vb-va) + u.y*(vc-va) + u.x*u.y*(va-vb-vc+vd);
        }

        out float normalizedNoise;
        void main() {          
            vec4 mvPosition = vec4( position, 1.0 );
            #ifdef USE_INSTANCING
                mvPosition = instanceMatrix * mvPosition;
            #endif

            float rawNoise = noised(mvPosition.xz * frequency + time);
            mvPosition.y = rawNoise * strength;
            normalizedNoise = smoothstep(-.5, 0.5, rawNoise);

            vec4 modelViewPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * modelViewPosition;          
        }
      `;

        const fragmentShader = `
        uniform vec3 color;
        in float normalizedNoise;
        void main() {
          gl_FragColor = vec4(mix(color, color * 1.5, normalizedNoise), .5);
        }
      `;

        const uniforms = {
            time: { value: 0 },
            strength: { value: this.props.strength },
            frequency: { value: this.props.frequency },
            color: { value: new Color(0x5199DB) }
        };

        const waterMaterial = new ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms,
            transparent: true,
            opacity: 0.5
        });

        const rowSize = this.props.size;
        const count = rowSize * rowSize;
        const plane = new InstancedMesh(geometry, waterMaterial, count);

        const matrix = new Matrix4();
        const position = new Vector3();
        const scale = new Vector3(1, 1, 1);
        const quaternion = new Quaternion();
        quaternion.setFromEuler(new Euler(-Math.PI / 2, 0, 0));
        for (let i = 0; i < rowSize; ++i) {
            for (let j = 0; j < rowSize; ++j) {
                const index = i * rowSize + j;
                position.set(i * patchSize, 0, j * patchSize);
                matrix.compose(position, quaternion, scale);
                plane.setMatrixAt(index, matrix);
            }
        }

        owner.add(plane);
    }

    override update(owner: Object3D) {
        const material = (owner.children[0] as Mesh).material as ShaderMaterial;
        material.uniforms.time.value = time.time * this.props.speed;
        material.uniformsNeedUpdate = true;
    }
}

