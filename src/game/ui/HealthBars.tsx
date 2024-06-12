import { useEffect, useRef } from "react"
import { cmdRenderUI, evtScreenResized, cmdUpdateHealthBars, SelectedElems } from "../../Events";
import { Color, Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { engine } from "../../engine/Engine";
import { config } from "../config/config";
import { GameMapState } from "../components/GameMapState";
import { buildingConfig } from "../config/BuildingConfig";
import { unitConfig } from "../config/UnitConfig";

const full = new Color(0x19c80f);
const empty = new Color(0xc01c06);
const color = new Color();
const parts = 5;
const step = 1 / parts;
const partWidth = 8;
const partHeight = 8;
const totalWidth = partWidth * parts;
const worldPos = new Vector3();
const screenPos = new Vector3();
const sectorCoords = new Vector2();
const { cellSize, unitScale } = config.game;

const headOffset = 2 * unitScale;
const conveyorHeight = .7;

function drawBar(ctx: CanvasRenderingContext2D, position: Vector3, health: number, maxHealth: number) {
    const { camera } = GameMapState.instance;
    GameUtils.worldToScreen(position, camera, screenPos);
    const barX = Math.round(screenPos.x - totalWidth / 2);
    const barY = Math.round(screenPos.y);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(barX, barY, totalWidth, partHeight);

    const progress = health / maxHealth;
    color.copy(empty).lerpHSL(full, progress);
    for (let j = 0; j < parts; ++j) {
        const section = Math.floor(progress * parts);
        const opacity = (() => {
            if (j < section) {
                return 1;
            } else if (j > section) {
                return 0;
            } else {
                const localProgress = progress - (section * step);
                const normalizedProgress = localProgress / step;
                return normalizedProgress;
            }
        })();
        const partColor = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${opacity})`;
        ctx.fillStyle = partColor;
        ctx.fillRect(barX + j * partWidth, barY, partWidth, partHeight);
        ctx.strokeRect(barX + j * partWidth, barY, partWidth, partHeight);
    }
}

export function HealthBars() {

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const selectedElemsRef = useRef<SelectedElems | null>(null);

    useEffect(() => {

        const onUpdateHealthBars = (elems: SelectedElems | null) => {
            selectedElemsRef.current = elems;
        };

        const renderUI = () => {
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "black";
            
            if (selectedElemsRef.current) {
                switch (selectedElemsRef.current.type) {
                    case "building": {
                        const building = selectedElemsRef.current.building;                        
                        const { visual, buildingType } = building;
                        const size = buildingConfig[buildingType].size;
                        visual.getWorldPosition(worldPos).addScaledVector(visual.up, size.y * cellSize);
                        worldPos.x += size.x / 2 * cellSize;
                        worldPos.z += size.z / 2 * cellSize;
                        drawBar(ctx, worldPos, building.hitpoints, buildingConfig[buildingType].hitpoints);
                    }
                    break;

                    case "units": {
                        const units = selectedElemsRef.current.units;
                        for (let i = 0; i < units.length; i++) {  
                            const unit = units[i];              
                            const { visual, isAlive } = unit;
                            if (!isAlive) {
                                continue;
                            }
                            worldPos.copy(visual.position).addScaledVector(visual.up, headOffset);                    
                            drawBar(ctx, worldPos, units[i].hitpoints, unitConfig[unit.type].hitpoints);
                        }
                    }
                    break;

                    case "cell": {
                        const { cell, mapCoords } = selectedElemsRef.current;
                        if (cell.conveyor) {
                            GameUtils.mapToWorld(mapCoords, worldPos);
                            worldPos.y += conveyorHeight * cellSize;
                            drawBar(ctx, worldPos, 10, 10);
                        }
                    }
                    break;
                }
            }            
        };

        const onResize = () => {
            const { width, height } = engine.screenRect;
            canvasRef.current!.width = width;
            canvasRef.current!.height = height;
        };

        cmdRenderUI.attach(renderUI);
        cmdUpdateHealthBars.attach(onUpdateHealthBars);
        evtScreenResized.attach(onResize);
        return () => {
            cmdUpdateHealthBars.detach(onUpdateHealthBars);
            cmdRenderUI.detach(renderUI);
            evtScreenResized.detach(onResize);
        }
    }, []);

    const { width, height } = engine.screenRect;
    return <canvas
        ref={canvasRef}
        style={{
            position: "absolute",
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
            imageRendering: "pixelated",
            pointerEvents: "none"
        }}
        width={width}
        height={height}
    />
}

