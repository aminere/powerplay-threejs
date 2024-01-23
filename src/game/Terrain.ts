
import { config } from './config';
import { BufferAttribute, BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, MathUtils, Mesh, MeshStandardMaterial, NearestFilter, RGBAFormat, RedFormat, Shader, Texture, TextureLoader, Vector2 } from 'three';
import FastNoiseLite from "fastnoise-lite";

type Uniform<T> = { value: T; };
export type TerrainUniforms = {
    mapRes: Uniform<number>;
    cellSize: Uniform<number>;
    cellTexture: Uniform<DataTexture>;
    highlightTexture: Uniform<DataTexture>;
    gridTexture: Uniform<Texture>;
    showGrid: Uniform<boolean>;
};

const continentNoise = new FastNoiseLite();
continentNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
continentNoise.SetFractalType(FastNoiseLite.FractalType.FBm);

const erosionNoise = new FastNoiseLite();
erosionNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
erosionNoise.SetFractalType(FastNoiseLite.FractalType.Ridged);

function sampleNoise(sample: number, curve: Vector2[]) {
    let index = 0;
    for (let i = 0; i < curve.length - 1; ++i) {
        if (sample < curve[i + 1].x) {
            index = i;
            break;
        }
    }
    const curvePoint1 = curve[index];
    const curvePoint2 = curve[index + 1];
    const range = curvePoint2.x - curvePoint1.x;
    const normalized = (sample - curvePoint1.x) / range;
    const value = curvePoint1.y + normalized * (curvePoint2.y - curvePoint1.y);
    return value;
}

export interface ITerrainPatch {
    sectorX: number;
    sectorY: number;
    continentFreq: number;
    erosionFreq: number;
    continentWeight: number;
    erosionWeight: number;
    continentGain: number;
    erosionGain: number;
    continent: Vector2[];
    erosion: Vector2[];
}

export class Terrain {
    public static createPatch(props: ITerrainPatch) {
        const { mapRes, cellSize } = config.game;
        const verticesPerRow = mapRes + 1;
        const vertexCount = verticesPerRow * verticesPerRow;
        const vertices = new Float32Array(
            [...Array(vertexCount)].flatMap((_, i) => {
                const x = i % verticesPerRow;
                const z = Math.floor(i / verticesPerRow);
                return [
                    cellSize * x,
                    0,
                    cellSize * z
                ];
            })
        );

        const cellCount = mapRes * mapRes;
        const indices = [...Array(cellCount)].flatMap((_, i) => {
            const row = Math.floor(i / mapRes);
            const col = i % mapRes;
            const rowStartVertex = row * verticesPerRow;
            const cellStartVertex = rowStartVertex + col;
            return [
                cellStartVertex,
                cellStartVertex + verticesPerRow + 1,
                cellStartVertex + 1,
                cellStartVertex,
                cellStartVertex + verticesPerRow,
                cellStartVertex + verticesPerRow + 1,
            ];
        });
        
        const colors = new Float32Array([...Array(vertexCount)].flatMap(_ => [1, 1, 1]));
        // const normals = new Float32Array([...Array(vertexCount)].flatMap(_ => [0, 1, 0]));
        const terrainGeometry = new BufferGeometry()
            .setAttribute('position', new BufferAttribute(vertices, 3))
            // .setAttribute('uv', new BufferAttribute(uvs, 2))
            // .setAttribute('normal', new BufferAttribute(normals, 3))
            .setAttribute('color', new BufferAttribute(colors, 3))
            .setIndex(indices);
        // .translate(0, 0.01, 0);

        terrainGeometry.computeVertexNormals();

        const terrainTexture = new TextureLoader().load('/images/dirt-atlas.png');
        terrainTexture.magFilter = NearestFilter;
        terrainTexture.minFilter = NearestFilter;
        const cellTextureData = new Uint8Array(cellCount); // * 4);        
        const tileMapRes = 8;
        const { atlasTileCount } = config.terrain;
        const tileCount = atlasTileCount;
        const lastTileIndex = tileCount - 1;
        // const lastDirtTileIndex = 15;
        // const emptyTileThreshold = .9;

        const position = terrainGeometry.getAttribute("position") as BufferAttribute;
        const color = terrainGeometry.getAttribute("color") as BufferAttribute;
        continentNoise.SetFrequency(props.continentFreq);
        erosionNoise.SetFrequency(props.erosionFreq);

        const color1 = new Color(0xcdaf69);
        const color2 = new Color(0xc4926f);
        const colorMix = new Color();
        for (let i = 0; i < cellCount; ++i) {
            // const stride = i * 4;
            const stride = i;

            // if (Math.random() > emptyTileThreshold) {
            //     const dirtIndex = Math.round(Math.random() * lastDirtTileIndex);
            //     const indexNormalized = dirtIndex / lastTileIndex;                
            //     cellTextureData[stride] = indexNormalized * 255;
            // } else {
            //     cellTextureData[stride] = 0;
            // }

            const cellY = Math.floor(i / mapRes);
            const cellX = i - cellY * mapRes;

            const continentSample = continentNoise.GetNoise((props.sectorX * mapRes) + cellX, (props.sectorY * mapRes) + cellY);
            const continentHeight = sampleNoise(continentSample, props.continent);
            const erosionSample = erosionNoise.GetNoise((props.sectorX * mapRes) + cellX, (props.sectorY * mapRes) + cellY);
            const erosionHeight = sampleNoise(erosionSample, props.erosion);

            const startVertexIndex = cellY * verticesPerRow + cellX;

            // if (cellX === 0 || cellX === mapRes - 1 || cellY === 0 || cellY === mapRes - 1) {
            //     height = segmentIndex;
            // } else {
            //     const [minHeight, _, __, maxHeight] = [
            //         position.getY(startVertexIndex),
            //         position.getY(startVertexIndex + 1),
            //         position.getY(startVertexIndex + verticesPerRow),
            //         position.getY(startVertexIndex + verticesPerRow + 1)
            //     ].sort((a, b) => a - b);

            //     if (segmentIndex < minHeight) {
            //         height = Math.max(segmentIndex, minHeight - 1);
            //     } else if (segmentIndex > maxHeight) {
            //         height = Math.min(segmentIndex, maxHeight + 1);
            //     } else {
            //         const distToMin = segmentIndex - minHeight;
            //         const distToMax = maxHeight - segmentIndex;
            //         if (distToMin < distToMax) {
            //             height = Math.min(minHeight + 1, segmentIndex);
            //         } else {
            //             height = Math.max(maxHeight - 1, segmentIndex);
            //         }
            //     }
            // }

            const height = Math.round(
                continentHeight * props.continentGain * props.continentWeight
                + erosionHeight * props.erosionGain * props.erosionWeight
            );
            position.setY(startVertexIndex, height);
            position.setY(startVertexIndex + 1, height);
            position.setY(startVertexIndex + verticesPerRow, height);
            position.setY(startVertexIndex + verticesPerRow + 1, height);

            const lastContinentHeight = props.continent[props.continent.length - 1].y;
            const heightNormalized = continentHeight / lastContinentHeight;
            const tileIndex = Math.round(heightNormalized * 4);

            const setColor = (vertexIndex: number) => {
                const vertexY = position.getY(vertexIndex);
                const heightFactor = vertexY / lastContinentHeight;
                const _color = colorMix.lerpColors(color1, color2, heightFactor);
                _color.toArray(color.array, vertexIndex * 3);
            }

            setColor(startVertexIndex);
            setColor(startVertexIndex + 1);
            setColor(startVertexIndex + verticesPerRow);
            setColor(startVertexIndex + verticesPerRow + 1);

            const indexNormalized = (32 + tileIndex * 0) / lastTileIndex;
            // const indexNormalized = (32 + TileTypes.indexOf("sand")) / lastTileIndex;            
            cellTextureData[stride] = indexNormalized * 255;
        }

        const cellTexture = new DataTexture(cellTextureData, mapRes, mapRes, RedFormat);
        cellTexture.magFilter = NearestFilter;
        cellTexture.minFilter = NearestFilter;
        cellTexture.needsUpdate = true;

        const highlightTextureData = new Uint8Array(cellCount * 4);
        const highlightTexture = new DataTexture(highlightTextureData, mapRes, mapRes, RGBAFormat);
        highlightTexture.magFilter = NearestFilter;
        highlightTexture.minFilter = NearestFilter;
        for (let i = 0; i < mapRes; ++i) {
            for (let j = 0; j < mapRes; ++j) {
                const cellIndex = i * mapRes + j;
                const stride = cellIndex * 4;
                highlightTextureData[stride] = 255;
                highlightTextureData[stride + 1] = 255;
                highlightTextureData[stride + 2] = 255;
                highlightTextureData[stride + 3] = 255;
            }
        }
        highlightTexture.needsUpdate = true;

        const gridTexture = new TextureLoader().load('/images/grid.png');
        gridTexture.magFilter = NearestFilter;
        gridTexture.minFilter = NearestFilter;
        gridTexture.wrapS = ClampToEdgeWrapping;
        gridTexture.wrapT = ClampToEdgeWrapping;

        const terrainMaterial = new MeshStandardMaterial({
            flatShading: true,
            wireframe: false,
            vertexColors: true,
            map: terrainTexture,
        });

        Object.defineProperty(terrainMaterial, "onBeforeCompile", {
            enumerable: false,
            value: (shader: Shader) => { 
                const uniforms: TerrainUniforms = {
                    mapRes: { value: mapRes },
                    cellSize: { value: cellSize },
                    cellTexture: { value: cellTexture },
                    highlightTexture: { value: highlightTexture },
                    gridTexture: { value: gridTexture },
                    showGrid: { value: false }
                };
                shader.uniforms = {
                    ...shader.uniforms,
                    ...uniforms
                };            
                terrainMaterial.userData.shader = shader;
    
                shader.vertexShader = `
                varying vec3 vPosition;
                ${shader.vertexShader}
                `;
    
                shader.vertexShader = shader.vertexShader.replace(
                    `#include <begin_vertex>`,
                    `                
                    vec3 transformed = vec3(position);
                    vPosition = position;
                    `
                );
    
                shader.fragmentShader = `
                    uniform float mapRes;
                    uniform float cellSize;
                    uniform sampler2D cellTexture;
                    uniform sampler2D highlightTexture;
                    uniform sampler2D gridTexture;
                    uniform bool showGrid;
                    varying vec3 vPosition;
                    ${shader.fragmentShader}
                `;
    
                shader.fragmentShader = shader.fragmentShader.replace(
                    `#include <map_fragment>`,
                    `                
                    #ifdef USE_MAP
                        float localX = vPosition.x / cellSize;
                        float localY = vPosition.z / cellSize;
                        float cellX = floor(localX);
                        float cellY = floor(localY);                    
                        float cx = (cellX / mapRes); // + (.5 / mapRes);
                        float cy = (cellY / mapRes); // + (.5 / mapRes);
                        float normalizedIndex = texture2D(cellTexture, vec2(cx, cy)).r;
                        float reconstructedIndex = round(normalizedIndex * ${lastTileIndex}.);
                        float lookUpY = floor(reconstructedIndex / ${tileMapRes}.);
                        float lookUpX = reconstructedIndex - lookUpY * ${tileMapRes}.;
                        float localUVx = localX - cellX;
                        float localUVy = localY - cellY;
                        vec2 tileUv = vec2(lookUpX + localUVx, lookUpY + localUVy) / ${tileMapRes}.;
                        vec4 tileColor = texture2D(map, vec2(tileUv.x, 1.0 - tileUv.y)); 
                        diffuseColor *= tileColor;
    
                        vec4 highlightColor = texture2D(highlightTexture, vec2(cx, cy));
                        diffuseColor.rgb *= highlightColor.rgb;
    
                        if (showGrid) {
                            vec4 gridColor = texture2D(gridTexture, vec2(localUVx, localUVy));
                            diffuseColor.rgb += gridColor.rgb;    
                        }
                    #endif
                    `
                );
            }
        });        

        const { elevationStep } = config.game;        
        const terrain = new Mesh(terrainGeometry, terrainMaterial);
        terrain.name = "terrain";
        terrain.scale.set(1, elevationStep, 1);
        terrain.userData.unserializable = true;
        // terrain.castShadow = true;
        terrain.receiveShadow = true;        
        return { terrain, cellTextureData, highlightTextureData };
    }
}

