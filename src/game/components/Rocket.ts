

import { Object3D, Vector2, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { time } from "../../engine/core/Time";
import { engineState } from "../../engine/EngineState";
import { GameUtils } from "../GameUtils";
import { utils } from "../../engine/Utils";
import { InstancedParticles } from "../../engine/components/particles/InstancedParticles";
import { UnitUtils } from "../unit/UnitUtils";
import { objects } from "../../engine/resources/Objects";
import { AutoDestroy } from "./AutoDestroy";
import { ISector } from "../GameTypes";

class RocketState {
    initialized = false;
    hit = false;
    lifeTime = 0;
    velocity = new Vector3();
    tween: gsap.core.Tween | null = null;
}

const cellCoords = new Vector2();
const sectorCoords = new Vector2();
const localCoords = new Vector2();

class RocketProps extends ComponentProps {
    damage = 10;
    constructor(props?: Partial<RocketProps>) {
        super();
        this.deserialize(props);
    }
}

function spawnSmoke(sector: ISector, worldPos: Vector3, groundLevel: number) {        
    const _smoke = objects.loadImmediate("/prefabs/smoke.json")!;
    const smoke = utils.instantiate(_smoke);
    smoke.position.copy(worldPos).setY(groundLevel);
    smoke.updateMatrixWorld();        
    sector.layers.fx.attach(smoke);
    engineState.setComponent(smoke, new AutoDestroy({ delay: 2 }));
}

export class Rocket extends Component<RocketProps, RocketState> {    

    constructor(props?: Partial<RocketProps>) {
        super(new RocketProps(props));
    }

    override start(_owner: Object3D) {
        this.setState(new RocketState());
    }
    
    override dispose() {
        this.state?.tween?.kill();
    }

    override update(owner: Object3D) {
        if (!this.state.initialized) {
            owner.getWorldDirection(this.state.velocity);
            const speed = 20;
            this.state.velocity.multiplyScalar(speed);
            this.state.initialized = true;
        }        

        if (this.state.hit) {
            return;
        }

        const gravity = 1;
        this.state.velocity.y -= gravity * time.deltaTime;
        owner.position.addScaledVector(this.state.velocity, time.deltaTime);

        GameUtils.worldToMap(owner.position, cellCoords);
        const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
        const sector = GameUtils.getSector(sectorCoords)!;
        const groundLevel = cell ? GameUtils.getMapHeight(cellCoords, localCoords, sector, owner.position.x, owner.position.z) : 0;

        if (owner.position.y < groundLevel) {
            console.log("rocket hit ground");
            this.onHit(owner);
            if (sector) {
                spawnSmoke(sector, owner.position, groundLevel);
            }
            return;
        }

        // check for enemies
        const units = cell?.units;
        if (units) {
            let hit = false;
            for (const unit of units) {
                if (UnitUtils.isEnemy(unit)) {
                    // TODO check the bounding box
                    // for now just hit all the enemies in the cell
                    hit = true;
                    if (unit.isAlive) {
                        unit.setHitpoints(unit.hitpoints - this.props.damage);
                    }
                }
            }
            
            if (hit) {
                this.onHit(owner);
                spawnSmoke(sector, owner.position, groundLevel);
                return;
            }
        }       

        this.state.lifeTime += time.deltaTime;
        if (this.state.lifeTime > 3) {
            this.onHit(owner);
        }
    }

    private onHit(owner: Object3D) {
        this.state.hit = true;
        const particlesOwner = owner.getObjectByName("Particles")!;
        const particles = utils.getComponent(InstancedParticles, particlesOwner)!;
        particles.state.isEmitting = false;
        this.state.tween = utils.postpone(2, () => {
            this.state.tween = null;
            engineState.removeObject(owner);
        });
    }
}

