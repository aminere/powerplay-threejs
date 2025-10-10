import { Collider, ComponentProps, IComponentState, SphereCollider } from "powerplay-lib";
import { Mesh, MeshBasicMaterial, Object3D, SphereGeometry } from "three";

export class ColliderHelper extends Mesh {

    public get root() { return this._root; }
    private _root: Object3D;

    constructor(root: Object3D, collider: Collider<ComponentProps, IComponentState>) {        
        switch (collider.getType()) {
            case "sphere": {
                const sphereCollider = collider as SphereCollider;
                const geometry = new SphereGeometry(sphereCollider.props.radius);
                super(geometry, new MeshBasicMaterial({ color: 0xff0000 }));
                this.position.copy(sphereCollider.props.center);
            }  
            break;

            default: {
                super();
            }
        }

        this._root = root;
    }

    override updateMatrixWorld() {
        super.updateMatrixWorld();
        this.matrixWorld.multiplyMatrices(this._root.matrixWorld, this.matrix);
    }
}

