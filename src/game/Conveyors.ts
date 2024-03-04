import { BoxGeometry, Mesh, MeshBasicMaterial, Vector2 } from "three";
import { gameMapState } from "./components/GameMapState";

class Conveyors {
    public create(mapCoords: Vector2) {
        const { layers } = gameMapState;

        const box = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0x00ff00 }));
        layers.conveyors.add(box);
    }


    public clear(mapCoords: Vector2) {
    }
}

export const conveyors = new Conveyors();

