
import { Component } from "../../engine/ecs/Component";
import { ICell } from "../GameTypes";
import { meshes } from "../../engine/resources/Meshes";
import { utils } from "../../engine/Utils";
import { Wagon } from "./Wagon";
import { Object3D } from "three";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { engineState } from "../../engine/EngineState";
import { config } from "../config";

export class TrainProps extends ComponentProps {
    constructor(props?: Partial<TrainProps>) {
        super();
        this.deserialize(props);
    }

    numWagons = 1;
    gap = .1;
    wagonLength = 1;
    cell: ICell = null!;
}

const { scale } = config.train;
const { cellSize } = config.game;

export class Train extends Component<TrainProps> {
    constructor(props?: Partial<TrainProps>) {
        super(new TrainProps(props));
    }

    override start(owner: Object3D) {
        const { numWagons, gap, wagonLength, cell } = this.props;
        for (let i = 0; i < numWagons; ++i) {
            const wagon = utils.createObject(owner, "wagon");
            const model = i === (numWagons - 1) ? "locomotive" : "wagon";
            meshes.load(`/models/${model}.glb`).then(([_mesh]) => {
                const mesh = _mesh.clone();
                mesh.castShadow = true;
                mesh.scale.multiplyScalar(scale * cellSize);
                wagon.add(mesh);
            });
            // const mesh = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, _wagonLength), new THREE.MeshBasicMaterial({ color: 0xff1000 }));
            // mesh.position.set(0, .25, 0);
            // container.add(mesh);
            const halfLength = wagonLength / 2;
            engineState.setComponent(wagon, new Wagon({
                startingCell: cell,
                startingDist: -halfLength + wagonLength * (i + 1) + gap * i,
                trackLimit: (numWagons - 1 - i) * (wagonLength + gap) + halfLength
            }));
        }  
    }
}

