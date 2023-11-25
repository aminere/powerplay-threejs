
import * as THREE from 'three';
import { config } from './config';
import { TileTypes } from './GameTypes';

type Uniform<T> = { value: T; };
export type TerrainUniforms = {
    mapRes: Uniform<number>;
    cellSize: Uniform<number>;
    cellTexture: Uniform<THREE.DataTexture>;
    highlightTexture: Uniform<THREE.DataTexture>;
    gridTexture: Uniform<THREE.Texture>;
    showGrid: Uniform<boolean>;
};

export class Terrain {
    public static createPatch() {
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
        // const color = new THREE.Color()
        // color.setHex([
        //     0xc4926f,
        //     0xff0000,
        //     0x00ff00,
        //     0x0000ff,
        // ][this._color++ % 4]);
        // const colors = new Float32Array([...Array(vertexCount)].flatMap(_ => color.toArray()));
        const normals = new Float32Array([...Array(vertexCount)].flatMap(_ => [0, 1, 0]));
        const terrainGeometry = new THREE.BufferGeometry()
            .setAttribute('position', new THREE.BufferAttribute(vertices, 3))
            // .setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
            .setAttribute('normal', new THREE.BufferAttribute(normals, 3))
            // .setAttribute('color', new THREE.BufferAttribute(colors, 3))
            .setIndex(indices);
        // .translate(0, 0.01, 0);

        terrainGeometry.computeVertexNormals();

        const terrainTexture = new THREE.TextureLoader().load('/images/dirt-atlas.png');
        terrainTexture.magFilter = THREE.NearestFilter;
        terrainTexture.minFilter = THREE.NearestFilter;
        const cellTextureData = new Uint8Array(cellCount); // * 4);
        const emptyTileThreshold = .9;
        const tileMapRes = 8;
        const { atlasTileCount } = config.terrain;
        const tileCount = atlasTileCount;
        const lastTileIndex = tileCount - 1;
        const lastDirtTileIndex = 15;
        for (let i = 0; i < cellCount; ++i) {
            // const stride = i * 4;
            const stride = i;
            if (Math.random() > emptyTileThreshold) {
                const dirtIndex = Math.round(Math.random() * lastDirtTileIndex);
                const indexNormalized = dirtIndex / lastTileIndex;                
                cellTextureData[stride] = indexNormalized * 255;
            } else {
                cellTextureData[stride] = 0;
            }
            // const indexNormalized = (32 + TileTypes.indexOf("sand")) / lastTileIndex;
            // cellTextureData[stride] = indexNormalized * 255;
        }
        const cellTexture = new THREE.DataTexture(cellTextureData, mapRes, mapRes, THREE.RedFormat);
        cellTexture.magFilter = THREE.NearestFilter;
        cellTexture.minFilter = THREE.NearestFilter;        
        cellTexture.needsUpdate = true;

        const highlightTextureData = new Uint8Array(cellCount * 4);
        const highlightTexture = new THREE.DataTexture(highlightTextureData, mapRes, mapRes, THREE.RGBAFormat);
        highlightTexture.magFilter = THREE.NearestFilter;
        highlightTexture.minFilter = THREE.NearestFilter;
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

        const gridTexture = new THREE.TextureLoader().load('/images/grid.png');
        gridTexture.magFilter = THREE.NearestFilter;
        gridTexture.minFilter = THREE.NearestFilter;
        gridTexture.wrapS = THREE.ClampToEdgeWrapping;
        gridTexture.wrapT = THREE.ClampToEdgeWrapping;

        const terrainMaterial = new THREE.MeshStandardMaterial({
            flatShading: true,
            wireframe: false,
            // vertexColors: true,
            map: terrainTexture,
        });
        terrainMaterial.onBeforeCompile = (shader) => {
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
        };

        const { elevationStep } = config.game;        
        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrain.scale.set(1, elevationStep, 1);
        // terrain.castShadow = true;
        terrain.receiveShadow = true;        
        return { terrain, cellTextureData, highlightTextureData };
    }
}

