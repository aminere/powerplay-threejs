import { AddEquation, AdditiveBlending, AlwaysDepth, BackSide, ConstantAlphaFactor, ConstantColorFactor, CustomBlending, DoubleSide, DstAlphaFactor, DstColorFactor, EqualDepth, FrontSide, GreaterDepth, GreaterEqualDepth, LessDepth, LessEqualDepth, LineBasicMaterial, LineDashedMaterial, Material, MaxEquation, MeshBasicMaterial, MeshDepthMaterial, MeshDistanceMaterial, MeshLambertMaterial, MeshMatcapMaterial, MeshNormalMaterial, MeshPhongMaterial, MeshPhysicalMaterial, MeshStandardMaterial, MeshToonMaterial, MinEquation, MultiplyBlending, NeverDepth, NoBlending, NormalBlending, NotEqualDepth, Object3D, OneFactor, OneMinusConstantAlphaFactor, OneMinusConstantColorFactor, OneMinusDstAlphaFactor, OneMinusDstColorFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, PointsMaterial, RawShaderMaterial, ReverseSubtractEquation, ShaderMaterial, ShadowMaterial, Side, SpriteMaterial, SrcAlphaFactor, SrcAlphaSaturateFactor, SrcColorFactor, SubtractEquation, SubtractiveBlending, ZeroFactor } from "three"
import { IOptions, Property } from "./Property";
import { useState } from "react";
import { undoRedo } from "../UndoRedo";
import { cmdRefreshInspectors, cmdSaveScene } from "../Events";
import { Section } from "./Section";
import { Properties } from "./Properties";

interface IProps {
    target: Object3D & { material: Material };
    timestamp: number;
}

const materialLib = {
    ShadowMaterial,
    SpriteMaterial,
    RawShaderMaterial,
    ShaderMaterial,
    PointsMaterial,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    MeshPhongMaterial,
    MeshToonMaterial,
    MeshNormalMaterial,
    MeshLambertMaterial,
    MeshDepthMaterial,
    MeshDistanceMaterial,
    MeshBasicMaterial,
    MeshMatcapMaterial,
    LineDashedMaterial,
    LineBasicMaterial
};

const blendSrcFactors = {
    ZeroFactor,
    OneFactor,
    SrcColorFactor,
    OneMinusSrcColorFactor,
    SrcAlphaFactor,
    OneMinusSrcAlphaFactor,
    DstAlphaFactor,
    OneMinusDstAlphaFactor,
    DstColorFactor,
    OneMinusDstColorFactor,
    SrcAlphaSaturateFactor,
    ConstantColorFactor,
    OneMinusConstantColorFactor,
    ConstantAlphaFactor,
    OneMinusConstantAlphaFactor
};

const blendDstFactors = Object.entries(blendSrcFactors)
    .reduce((acc, [key, value]) => {
        if (key !== "SrcAlphaSaturateFactor") {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, number>);

const blendEquations = {
    AddEquation,
    SubtractEquation,
    ReverseSubtractEquation,
    MinEquation,
    MaxEquation,
};

const sideModes = {
    FrontSide,
    BackSide,
    DoubleSide
};

const blendingModes = {
    NoBlending,
    NormalBlending,
    AdditiveBlending,
    SubtractiveBlending,
    MultiplyBlending,
    CustomBlending
};

const depthFunc = {
    NeverDepth,
    AlwaysDepth,
    EqualDepth,
    LessDepth,
    LessEqualDepth,
    GreaterEqualDepth,
    GreaterDepth,
    NotEqualDepth
};

const precision = [
    "highp",
    "mediump",
    "lowp"
] as const;

export type Precision = typeof precision[number];

const shadowSideModes = {
    ...sideModes,
    unset: Object.keys(sideModes).length,
};

const wireframeLinecap = [
    "butt",
    "round",
    "square"
];

const wireframeLinejoin = [
    "round",
    "bevel",
    "miter"
];

function createMaterialFromType(type: string) {
    return new materialLib[type as keyof typeof materialLib]();
}

const isBasicMaterialPropCache = new Map<string, boolean>();
function isBasicMaterialProp(key: string) {
    const cached = isBasicMaterialPropCache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    if ([
        "color",
        "specular",
        "shininess",
        "emissive",
        "reflectivity",
        "roughness",
        "metalness",
        "transparent",
        "opacity",
        "blending",
        "vertexColors",
        "side",
        "depthTest",
        "depthWrite",
        "alphaTest",
        "flatShading",
        "wireframe",
        "visible",
        "map",
        "normalMap",
        "emissiveMap",
        "envMap",
        "size",
        "uniforms"
    ].includes(key)) {
        isBasicMaterialPropCache.set(key, true);
        return true;
    }

    isBasicMaterialPropCache.set(key, false);
    return false;
}

export function MaterialInspector(props: IProps) {
    const [, setLocalTimestamp] = useState(Date.now());

    const { target, timestamp } = props;

    if (Array.isArray(target.material)) {
        // TODO multiple materials
        return null;
    }

    const material = target.material;
    const type = material.type;    
    const typeDummy = { type };
    const onChanged = () => {
        material.needsUpdate = true;
        undoRedo.pushState();
        cmdSaveScene.post(false);
    };

    const allProps = Object.keys(material)
        .filter(key => {
            if (!Object.hasOwnProperty.call(material, key)) {
                return false;
            }
            if (key.startsWith("is")
                || key === "uuid"
                || key === "type"
                || key === "name"
                || key === "version"
                || key === "userData"
                || key === "defines"
            ) {
                return false;
            }

            return true;
        })
        .sort((a, b) => {
            return a.localeCompare(b);
        });

    const { basicProps, advancedProps } = allProps.reduce((acc, key) => {
        if (isBasicMaterialProp(key)) {
            acc.basicProps.push(key);
        } else {
            acc.advancedProps.push(key);
        }
        return acc;
    }, { basicProps: [] as string[], advancedProps: [] as string[] });

    const makeOptions = (key: string): IOptions | undefined => {
        if (key === "blending") {
            return { values: Object.entries(blendingModes).map(([key, value]) => ({ label: key, value })) }

        } else if (key === "side") {
            return { values: Object.entries(sideModes).map(([key, value]) => ({ label: key, value })) }

        } else if (key === "opacity"
            || key === "bumpScale"
            || key === "metalness"
            || key === "normalScale"
            || key === "roughness") {
            return { range: [0, 1], step: 0.01 }

        } else if (key === "wireframeLinecap") {
            return { values: wireframeLinecap }

        } else if (key === "wireframeLinejoin") {
            return { values: wireframeLinejoin }

        } else if (key === "blendSrc") {
            return { values: Object.entries(blendSrcFactors).map(([key, value]) => ({ label: key, value })) }

        } else if (key === "blendDst") {
            return { values: Object.entries(blendDstFactors).map(([key, value]) => ({ label: key, value })) }

        } else if (key === "blendEquation") {
            return { values: Object.entries(blendEquations).map(([key, value]) => ({ label: key, value })) }

        } else if (key === "depthFunc") {
            return { values: Object.entries(depthFunc).map(([key, value]) => ({ label: key, value })) }
        }
    };

    return <>
        <Properties>
            <Property
                key={`${target.uuid}-type-${timestamp}`}
                target={typeDummy}
                owner={target}
                property={"type"}
                options={{ values: Object.keys(materialLib) }}
                onChanged={() => {                    
                    setLocalTimestamp(Date.now());
                    material.dispose();
                    const newType = typeDummy.type;
                    target.material = createMaterialFromType(newType);
                    onChanged();
                }}
            />
            {basicProps.flatMap(key => {
                if (key === "uniforms" && material instanceof ShaderMaterial) {
                    return Object.keys(material.uniforms).map(uniform => {
                        return <Property
                            key={`${material.uuid}-${key}-${uniform}-${type}-${timestamp}`}
                            target={material.uniforms[uniform]}
                            owner={target}
                            property={"value"}
                            onChanged={onChanged}
                            options={{ label: uniform }}
                        />
                    });
                } else {
                    return <Property
                        key={`${material.uuid}-${key}-${type}-${timestamp}`}
                        target={material}
                        owner={target}
                        property={key}
                        onChanged={onChanged}
                        options={makeOptions(key)}
                    />
                }
            })}
        </Properties>
        <Section name="Advanced">
            <Properties>
                <Property
                    key={`${target.uuid}-uuid-${timestamp}`}
                    target={material}
                    owner={target}
                    property={"uuid"}
                    options={{ readonly: true }}                 
                />
                <Property
                    key={`${target.uuid}-duplicate-${timestamp}`}
                    target={{ uuid: { command: "New" } }}
                    owner={target}
                    property={"uuid"}
                    onChanged={() => {                        
                        target.material = material.clone();
                        material.dispose();
                        target.material.needsUpdate = true;
                        cmdSaveScene.post(false);
                        cmdRefreshInspectors.post(target);
                    }}
                />
                <Property
                    key={`${target.uuid}-reset-${timestamp}`}
                    target={{ material: { command: "Reset" } }}
                    owner={target}
                    property={"material"}
                    onChanged={() => {
                        material.dispose();
                        undoRedo.recordState(target);
                        target.material = createMaterialFromType(type);
                        onChanged();
                        cmdRefreshInspectors.post(target);
                    }}
                />                
                {advancedProps.map(key => {
                    if (key === "shadowSide") {
                        const currentShadowSide = material["shadowSide"];
                        const dummy = { shadowSide: currentShadowSide ?? shadowSideModes.unset };
                        return <Property
                            key={`${material.uuid}-${key}-${type}-${timestamp}`}
                            target={dummy}
                            owner={target}
                            property={key}
                            onChanged={() => {
                                const newShadowSide = dummy.shadowSide;
                                if (newShadowSide === shadowSideModes.unset) {
                                    material[key] = null;
                                } else {
                                    material[key] = newShadowSide as Side;
                                }
                                onChanged();
                            }}
                            options={{
                                values: Object.entries(shadowSideModes).map(([key, value]) => ({ label: key, value }))
                            }}
                        />
                    } else if (key === "precision") {
                        const currentPrecision = material["precision"];
                        const dummy = { precision: currentPrecision ?? "unset" };
                        return <Property
                            key={`${material.uuid}-${key}-${type}-${timestamp}`}
                            target={dummy}
                            owner={target}
                            property={key}
                            onChanged={() => {
                                const newPrecision = dummy.precision;
                                if (newPrecision === "unset") {
                                    material[key] = null;
                                } else {
                                    material[key] = newPrecision as Precision;
                                }
                                onChanged();
                            }}
                            options={{
                                values: [...precision, "unset"]
                            }}
                        />
                    }

                    return <Property
                        key={`${material.uuid}-${key}-${type}-${timestamp}`}
                        target={material}
                        owner={target}
                        property={key}
                        onChanged={onChanged}
                        options={makeOptions(key)}
                    />
                })}
            </Properties>
        </Section>
    </>
}
