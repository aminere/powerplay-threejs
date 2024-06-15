import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Mesh, Object3D, Triangle, Vector3 } from "three";
import { ISector } from "../GameTypes";
import { config } from "../config/config";

const { mapRes, elevationStep } = config.game;
const verticesPerRow = mapRes + 1;
const triangle = new Triangle(new Vector3(), new Vector3(), new Vector3());

export class NormalsViewer extends Object3D {
    constructor() {
        super();
        const lineSegments = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xffffff }));
        this.add(lineSegments);
        this.name = "NormalsViewer";
        this.visible = false;
    }

    public setSector(sector: ISector) {
        const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
        const position = geometry.getAttribute("position") as BufferAttribute;

        const points = new Array<Vector3>();
        for (let i = 0; i < mapRes; ++i) {
            for (let j = 0; j < mapRes; ++j) {
                const startVertexIndex = i * verticesPerRow + j;
                triangle.a.set(position.getX(startVertexIndex), position.getY(startVertexIndex) * elevationStep, position.getZ(startVertexIndex));
                triangle.b.set(position.getX(startVertexIndex + verticesPerRow), position.getY(startVertexIndex + verticesPerRow) * elevationStep, position.getZ(startVertexIndex + verticesPerRow));
                triangle.c.set(position.getX(startVertexIndex + verticesPerRow + 1), position.getY(startVertexIndex + verticesPerRow + 1) * elevationStep, position.getZ(startVertexIndex + verticesPerRow + 1));                
                const center = triangle.getMidpoint(new Vector3());
                center.x += sector.root.position.x;
                center.z += sector.root.position.z;
                points.push(center);
                const normal = triangle.getNormal(new Vector3());
                points.push(center.clone().addScaledVector(normal, .5));

                triangle.a.set(position.getX(startVertexIndex), position.getY(startVertexIndex) * elevationStep, position.getZ(startVertexIndex));
                triangle.b.set(position.getX(startVertexIndex + verticesPerRow + 1), position.getY(startVertexIndex + verticesPerRow + 1) * elevationStep, position.getZ(startVertexIndex + verticesPerRow + 1));
                triangle.c.set(position.getX(startVertexIndex + 1), position.getY(startVertexIndex + 1) * elevationStep, position.getZ(startVertexIndex + 1));                
                const center2 = triangle.getMidpoint(new Vector3());
                center2.x += sector.root.position.x;
                center2.z += sector.root.position.z;
                points.push(center2);
                const normal2 = triangle.getNormal(new Vector3());
                points.push(center2.clone().addScaledVector(normal2, .5));

                // const sphere1 = new Mesh(new SphereGeometry(.1), new MeshBasicMaterial({ color: 0xff0000 }));
                // sphere1.position.copy(center);
                // this.add(sphere1);
                // const sphere2 = new Mesh(new SphereGeometry(.1), new MeshBasicMaterial({ color: 0xff0000 }));
                // sphere2.position.copy(center2);
                // this.add(sphere2);
            }
        }

        const lines = this.children[0] as LineSegments;
        lines.geometry.setFromPoints(points);
        lines.geometry.computeBoundingSphere();
    }
}

