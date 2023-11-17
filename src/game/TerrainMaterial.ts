import { IUniform, ShaderMaterial } from "three";

import { ShaderLib } from "three/src/renderers/shaders/ShaderLib.js";

export class TerrainMaterial extends ShaderMaterial {
    constructor(uniforms: Record<string, IUniform>) {
        const {
            vertexShader: standardVertexShader,
            fragmentShader: standardFragmentShader
        } = ShaderLib.standard;

        let vertexShader = `
            varying vec3 vPosition;
            ${standardVertexShader}
            `;
        vertexShader = vertexShader.replace(
            `#include <begin_vertex>`,
            `                
                vec3 transformed = vec3(position);
                vPosition = position;
                `
        );

        let fragmentShader = `
        uniform float mapRes;
        uniform float cellSize;
        uniform sampler2D cellTexture;
        varying vec3 vPosition;
        ${standardFragmentShader}
    `;

        fragmentShader = fragmentShader.replace(
            `#include <map_fragment>`,
            `                
        #ifdef USE_MAP
            // vec4 sampledDiffuseColor = texture2D( map, vMapUv );
            float cellX = floor(vPosition.x / cellSize);
            float cellY = floor(vPosition.z / cellSize);                    
            float cx = (cellX / mapRes) + (.5 / mapRes);
            float cy = cellY / mapRes + (.5 / mapRes);
            float normalizedIndex = texture2D(cellTexture, vec2(cx, cy)).r;
            float reconstructedIndex = floor(normalizedIndex * 15.);
            float lookUpY = floor(reconstructedIndex / 4.);
            float lookUpX = reconstructedIndex - lookUpY * 4.;
            float localUVx = (vPosition.x - cellX * cellSize) / cellSize;
            float localUVy = (vPosition.z - cellY * cellSize) / cellSize;
            vec4 tileColor = texture2D(map, vec2(lookUpX / 4. + localUVx / 4., lookUpY / 4. + localUVy / 4.));                    
            vec4 sampledDiffuseColor = tileColor;
            diffuseColor *= sampledDiffuseColor;
        #endif
        `
        );

        super({
            uniforms: {
                ...ShaderLib.standard.uniforms,
                ...uniforms
            },
            vertexShader,
            fragmentShader,
            lights: true
        });
        Object.assign(this, { flatShading: true });
    }
}
