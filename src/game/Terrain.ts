
import { config } from './config';
import { BufferAttribute, BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, Mesh, MeshStandardMaterial, NearestFilter, RGBAFormat, RedFormat, Shader, Sphere, Texture, Vector2, Vector3 } from 'three';
import FastNoiseLite from "fastnoise-lite";
import { textures } from '../engine/resources/Textures';
import { TileTypes } from './GameDefinitions';

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

const sandNoise = new FastNoiseLite();
sandNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
sandNoise.SetFractalType(FastNoiseLite.FractalType.FBm);

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

const { mapRes, cellSize, elevationStep } = config.game;
const verticesPerRow = mapRes + 1;
const vertexCount = verticesPerRow * verticesPerRow;

export class Terrain {
    public static createPatch(props: ITerrainPatch) {        
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

        const terrainTexture = textures.load('/images/dirt-atlas.png');
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
        sandNoise.SetFrequency(props.continentFreq * 4);

        const yellowSand = new Color(0xcdaf69);
        const sand = new Color(0xc4926f);
        const stone = new Color(0xa0a0a0);
        const colorMix = new Color();
        const lastContinentHeight = props.continent[props.continent.length - 1].y;      

        for (let i = 0; i < verticesPerRow; ++i) {
            for (let j = 0; j < verticesPerRow; ++j) {
                const noiseX = (props.sectorX * mapRes) + j;
                const noiseY = (props.sectorY * mapRes) + i;
                const continentSample = continentNoise.GetNoise(noiseX, noiseY);
                const continentHeight = sampleNoise(continentSample, props.continent);
                const erosionSample = erosionNoise.GetNoise(noiseX, noiseY);
                const erosionHeight = sampleNoise(erosionSample, props.erosion);
                const _height = Math.round(
                    continentHeight * props.continentGain * props.continentWeight
                    + erosionHeight * props.erosionGain * props.erosionWeight
                );

                const height = _height * 0;
                const vertexIndex = i * verticesPerRow + j;
                position.setY(vertexIndex, height);

                if (height >= 0 && height <= 1) {
                    const sandSample = sandNoise.GetNoise(noiseX, noiseY);
                    const factor = (sandSample + 1) / 2;
                    colorMix.lerpColors(yellowSand, sand, factor).toArray(color.array, vertexIndex * 3);
                } else {
                    const vertexY = position.getY(vertexIndex);
                    const heightFactor = vertexY / lastContinentHeight;
                    colorMix.lerpColors(sand, stone, heightFactor).toArray(color.array, vertexIndex * 3);
                }
            }
        }

        terrainGeometry.computeVertexNormals();

        // custom bounding sphere
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;        
        for (let i = 0; i < position.count; ++i) {
            const x = position.getX(i);
            const z = position.getZ(i);
            if (x < minX) minX = x;
            else if (x > maxX) maxX = x;
            if (z < minZ) minZ = z;
            else if (z > maxZ) maxZ = z;
        }
        const center = new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
        const corner = new Vector3(maxX, 0, maxZ);
        terrainGeometry.boundingSphere = new Sphere(center, center.distanceTo(corner));

        for (let i = 0; i < cellCount; ++i) {
             // const stride = i * 4;
            const stride = i;
            let indexNormalized = (32 + TileTypes.indexOf("rock")) / lastTileIndex;            
            indexNormalized = 0 / lastTileIndex;
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

        const gridTexture = textures.load('/images/grid.png');
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
                    showGrid: { value: true }
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
                        
                        // FOG
                        /*float cxn = (cellX - 1.) / mapRes;
                        float cxp = (cellX + 1.) / mapRes;
                        float cyn = (cellY - 1.) / mapRes;
                        float cyp = (cellY + 1.) / mapRes;
                        vec4 c = texture2D(highlightTexture, vec2(cx, cy));
                        vec4 t = texture2D(highlightTexture, vec2(cx, cyn));
                        vec4 b = texture2D(highlightTexture, vec2(cx, cyp));
                        vec4 l = texture2D(highlightTexture, vec2(cxn, cy));
                        vec4 r = texture2D(highlightTexture, vec2(cxp, cy));
                        vec4 tl = texture2D(highlightTexture, vec2(cxn, cyn));
                        vec4 tr = texture2D(highlightTexture, vec2(cxp, cyn));
                        vec4 bl = texture2D(highlightTexture, vec2(cxn, cyp));
                        vec4 br = texture2D(highlightTexture, vec2(cxp, cyp));
                        vec4 tla = (c + tl + l + t) / 4.;
                        vec4 tra = (c + tr + r + t) / 4.;
                        vec4 bla = (c + bl + l + b) / 4.;
                        vec4 bra = (c + br + r + b) / 4.;
                        vec4 tColor = mix(tla, tra, localUVx);
                        vec4 bColor = mix(bla, bra, localUVx);
                        vec4 yColor = mix(tColor, bColor, localUVy);
                        vec4 highlightColor = yColor;*/

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

        const terrain = new Mesh(terrainGeometry, terrainMaterial);
        terrain.name = "terrain";
        terrain.matrixWorldAutoUpdate = false;
        terrain.matrixAutoUpdate = false;
        terrain.scale.set(1, elevationStep, 1);
        terrain.updateMatrix();
        terrain.userData.unserializable = true;
        // terrain.castShadow = true;
        terrain.receiveShadow = true;        
        return { terrain, cellTextureData, highlightTextureData };
    }
}

