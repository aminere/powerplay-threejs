
import { Component } from "../../engine/Component";
import { ICell } from "../GameTypes";
import { meshes } from "../../engine/Meshes";
import { utils } from "../../engine/Utils";
import { Wagon } from "./Wagon";
import { Object3D } from "three";
import { ComponentProps } from "../../engine/ComponentProps";

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

export class Train extends Component<TrainProps> {
    constructor(props?: Partial<TrainProps>) {
        super(new TrainProps(props));
    }

    override start(owner: Object3D) {
        const { numWagons, gap, wagonLength, cell } = this.props;
        for (let i = 0; i < numWagons; ++i) {
            const wagon = utils.createObject(owner, "wagon");
            meshes.load("/models/train.glb").then(([mesh]) => {
                mesh.castShadow = true;
                wagon.add(mesh);
            });
            // const mesh = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, _wagonLength), new THREE.MeshBasicMaterial({ color: 0xff1000 }));
            // mesh.position.set(0, .25, 0);
            // container.add(mesh);
            const halfLength = wagonLength / 2;
            utils.setComponent(wagon, new Wagon({
                startingCell: cell,
                startingDist: -halfLength + wagonLength * (i + 1) + gap * i,
                trackLimit: (numWagons - 1 - i) * (wagonLength + gap) + halfLength
            }));
        }  
    }
}

