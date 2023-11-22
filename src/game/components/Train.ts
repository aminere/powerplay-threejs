
import { Component, IComponentProps } from "../../engine/Component";
import { ICell } from "../GameTypes";
import { Meshes } from "../Meshes";
import { utils } from "../../engine/Utils";
import { Wagon } from "./Wagon";
import { Object3D } from "three";

export interface ITrainProps extends IComponentProps {
    numWagons: number;
    gap: number;
    wagonLength: number;
    cell: ICell;
}

export class Train extends Component<ITrainProps> {
    constructor(props?: ITrainProps) {
        super(props ?? {
            numWagons: 1,
            gap: .1,
            wagonLength: 1,
            cell: null!
        });
    }

    override start(owner: Object3D) {
        const { numWagons, gap, wagonLength, cell } = this.props;
        for (let i = 0; i < numWagons; ++i) {
            const wagon = utils.createObject(owner, "wagon");
            Meshes.load("/models/train.glb").then(([mesh]) => {
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

