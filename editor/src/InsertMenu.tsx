import { Menu, MenuItem, MenuDivider } from "@blueprintjs/core";
import { cmdImportModel } from "./Events";
import { addToScene, initDirectionalLight, setComponent } from "./Utils";
import { useRef } from "react";
import { AmbientLight, BoxGeometry, BufferGeometry, Color, DataTexture, DirectionalLight, DoubleSide, Euler, Float32BufferAttribute, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, Object3D, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Points, Quaternion, ShaderMaterial, SphereGeometry, TorusGeometry, Vector3 } from "three";
import { componentFactory, config, engine, textures } from "powerplay-lib";
import FastNoiseLite from "fastnoise-lite";
import { state } from "./State";

export function InsertMenu() {
    const defaultParticle = useRef(textures.load("/images/particle.png"));
    const defaultMaterial = () => new MeshStandardMaterial({ color: 0xffffff });

    const add = (obj: Object3D, name?: string) => {
        if (name) {
            obj.name = name;
        }
        const parent = state.selection ?? engine.scene!;
        addToScene(obj, parent);
    };

    const handleObject = () => add(new Object3D(), "Object");
    const handlePlane = () => {
        const plane = new Mesh(new PlaneGeometry(1, 1), defaultMaterial());
        plane.rotateX(-Math.PI / 2);
        plane.userData.eulerRotation = plane.rotation.clone();
        add(plane, "Plane");
    };
    const handleSphere = () => add(new Mesh(new SphereGeometry(1, 32, 32), defaultMaterial()), "Sphere");
    const handleTorus = () => add(new Mesh(new TorusGeometry(1, 0.5, 16, 100), defaultMaterial()), "Torus");
    const handleBillboard = () => {
        const billboard = new Mesh(new PlaneGeometry(1, 1), defaultMaterial());
        setComponent(billboard, componentFactory.create("Billboard")!);
        add(billboard, "Billboard");
    };
    const handleCube = () => add(new Mesh(new BoxGeometry(1, 1, 1), defaultMaterial()), "Cube");
    const handlePointParticles = () => {
        const uniforms = {
            map: { value: defaultParticle.current }
        };
        const material = new ShaderMaterial({
            uniforms,
            vertexShader: `
            attribute float size;
			varying vec4 vColor;
			void main() {
				vColor = color;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );                
				gl_PointSize = size * 100.;
				gl_Position = projectionMatrix * mvPosition;
			}
            `,
            fragmentShader: `
            uniform sampler2D map;
			varying vec4 vColor;
			void main() {
				gl_FragColor = vColor * texture2D(map, gl_PointCoord);
			}
            `,
            blending: NormalBlending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });
        const geometry = new BufferGeometry().setAttribute("color", new Float32BufferAttribute([1, 1, 1, 1], 4));
        const particles = new Points(geometry, material);
        setComponent(particles, componentFactory.create("Particles")!);
        add(particles, "Particles");
    };

    const handleInstancedParticles = () => {
        const material = new MeshBasicMaterial({
            map: defaultParticle.current,
            blending: NormalBlending,
            depthWrite: false,
            transparent: true
        });
        const particles = new InstancedMesh(new PlaneGeometry(1, 1), material, 300);
        setComponent(particles, componentFactory.create("InstancedParticles")!);
        add(particles, "Particles");
    };

    const handleCameraPerspective = () => {
        const camera = new PerspectiveCamera();
        camera.position.set(0, 0, 10);
        add(camera);
    };

    const handleCameraOrtho = () => {
        const { orthoSize } = config.camera;
        const { width, height } = engine.screenRect;
        const aspect = width / height;
        const camera = new OrthographicCamera(-orthoSize * aspect, orthoSize * aspect, orthoSize, -orthoSize, 0.1, 100);
        camera.position.set(0, 0, 10);
        add(camera);
    };

    const handleLightAmbient = () => {
        const light = new AmbientLight(0xffffff, 1);
        add(light);
    };

    const handleLightDirectional = () => {
        const light = new DirectionalLight(0xffffff, 1);
        light.castShadow = true;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 50;
        initDirectionalLight(light);
        add(light);
    };

    const handleLightHemisphere = () => {
        const light = new HemisphereLight(0xffffff, 0x000000, 1);        
        add(light);
    };

    return <Menu>
        <MenuDivider title="Insert" />
        <MenuItem text="Object" onClick={handleObject} />
        <MenuItem text="Camera">
            <MenuItem text="Perspective" onClick={handleCameraPerspective} />
            <MenuItem text="Orthographic" onClick={handleCameraOrtho} />
        </MenuItem>
        <MenuItem text="Light">
            <MenuItem text="Ambient" onClick={handleLightAmbient} />
            <MenuItem text="Directional" onClick={handleLightDirectional} />
            <MenuItem text="Hemisphere" onClick={handleLightHemisphere} />
        </MenuItem>
        <MenuItem text="Particles (Instanced)" onClick={handleInstancedParticles} />
        <MenuItem text="Particles (Points)" onClick={handlePointParticles} />
        <MenuDivider />
        <MenuItem text="Plane" onClick={handlePlane} />
        <MenuItem text="Cube" onClick={handleCube} />
        <MenuItem text="Sphere" onClick={handleSphere} />
        <MenuItem text="Torus" onClick={handleTorus} />
        <MenuItem text="Billboard" onClick={handleBillboard} />
        <MenuDivider />
        <MenuItem text="Model" onClick={() => cmdImportModel.post()} />
        <MenuItem text="Testing">
            <MenuItem text="Grass" onClick={() => {
                const instanceNumber = 1000;

                const geometry = new PlaneGeometry(0.1, 1, 1, 4);
                geometry.translate(0, 0.5, 0);

                const vertexShader = `
            varying vec2 vUv;
            uniform float time;            
            void main() {          
                vUv = uv;              
                vec4 mvPosition = vec4( position, 1.0 );              
                #ifdef USE_INSTANCING
                    mvPosition = instanceMatrix * mvPosition;
                #endif
                
                // here the displacement is made stronger on the blades tips.
                float dispPower = 1.0 - cos(uv.y * 3.1416 / 2.0);              
                float displacement = sin(mvPosition.z + time * 10.0) * ( 0.1 * dispPower);
                mvPosition.x += displacement;
                
                vec4 modelViewPosition = modelViewMatrix * mvPosition;
                gl_Position = projectionMatrix * modelViewPosition;          
            }
          `;

                const fragmentShader = `
            varying vec2 vUv;   
            uniform vec3 color;
            void main() {              
              gl_FragColor = vec4(color * vUv.y, 1);
            }
          `;

                const uniforms = {
                    time: { value: 0 },
                    color: { value: new Color(0x9FD260) }
                };

                const grassMaterial = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: DoubleSide });
                const mesh = new InstancedMesh(geometry, grassMaterial, instanceNumber);
                mesh.name = "Grass";
                const matrix = new Matrix4();
                const position = new Vector3();
                const rotation = new Euler();
                const scale = new Vector3();
                const quaternion = new Quaternion();
                for (let i = 0; i < instanceNumber; i++) {
                    position.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
                    scale.setScalar(0.5 + Math.random() * 0.5);
                    rotation.y = Math.random() * Math.PI;
                    quaternion.setFromEuler(rotation);
                    matrix.compose(position, quaternion, scale);
                    mesh.setMatrixAt(i, matrix);
                }

                add(mesh);

            }} />

            <MenuItem text="Noise" onClick={() => {
                const texRes = 32;
                const data = new Uint8Array(texRes * texRes * 4);
                const texture = new DataTexture(data, texRes, texRes);

                const noise = new FastNoiseLite();
                noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
                noise.SetFractalType(FastNoiseLite.FractalType.FBm);
                noise.SetFrequency(0.03);

                for (let i = 0; i < texRes; i++) {
                    for (let j = 0; j < texRes; j++) {
                        const index = i * texRes + j;
                        const stride = index * 4;
                        const sample = (noise.GetNoise(i, j) + 1) / 2;
                        const color = sample * 255;
                        data[stride] = color;
                        data[stride + 1] = color;
                        data[stride + 2] = color;
                        data[stride + 3] = 1;
                    }
                }
                texture.needsUpdate = true;
                const material = new MeshStandardMaterial({ map: texture });
                const plane = new Mesh(new PlaneGeometry(32, 32), material);
                plane.rotateX(-Math.PI / 2);
                plane.userData.eulerRotation = plane.rotation.clone();
                plane.translateZ(0.01);
                add(plane);
            }} />
        </MenuItem>
    </Menu>
}


