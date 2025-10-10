import { Fragment, useEffect, useState } from "react";
import { IOptions, Property } from "./Property";
import { cmdRefreshInspectors, cmdSaveScene, evtObjectChanged, evtObjectRenamed, evtObjectTransformChanged } from "../Events";
import { Camera, DirectionalLight, HemisphereLight, Light, MathUtils, Object3D, OrthographicCamera, PerspectiveCamera, PointLight, SpotLight } from "three";
import { undoRedo } from "../UndoRedo";
import { Section } from "./Section";
import { Properties } from "./Properties";
import { engineState } from "powerplay-lib";

interface IProps {
    target: Object3D;
    timestamp: number;
}

export function ObjectInspector(props: IProps) {
    const { target } = props;
    const [localTimeStamp, setLocalTimestamp] = useState(Date.now());

    const onChanged = () => {
        undoRedo.pushState();
        evtObjectChanged.post(target);

        const perspective = target as PerspectiveCamera;
        const orthographic = target as OrthographicCamera;
        if (perspective.isPerspectiveCamera) {
            perspective.updateProjectionMatrix();
        } else if (orthographic.isOrthographicCamera) {
            orthographic.updateProjectionMatrix();
        }

        target.updateMatrixWorld();
        cmdSaveScene.post(false);
    };

    const makeProperty = (property: string, useTimestamp?: boolean, options?: IOptions) => {
        return <Property
            key={`${target.uuid}-${property}-${props.timestamp}-${useTimestamp ? localTimeStamp : ""}`}
            target={target}
            owner={target}
            property={property}
            options={options}
            onChanged={onChanged}
        />;
    };

    useEffect(() => {
        const onTransformChanged = () => setLocalTimestamp(Date.now());
        evtObjectTransformChanged.attach(onTransformChanged);
        return () => {
            evtObjectTransformChanged.detach(onTransformChanged);
        }
    }, []);

    const { timestamp } = props;
    return <>
        <Properties>
            {makeProperty("type", false, { readonly: true })}
            <Property
                key={`${target.uuid}-${timestamp}-name`}
                target={target}
                owner={target}
                property={"name"}
                onChanged={() => {
                    evtObjectRenamed.post(target);
                    onChanged();
                }}
            />
            {makeProperty("position", true)}
            <Property
                key={`${target.uuid}-"rotation"-${timestamp}-${localTimeStamp}`}
                target={target}
                owner={target}
                property="rotation"
                onChanged={() => {
                    target.userData.eulerRotation = target.rotation.clone();
                    onChanged();
                }}
            />
            {makeProperty("scale", true)}
            {makeProperty("visible")}
            {(() => {
                const light = target as Light;
                const camera = target as Camera;
                if (light.isLight) {
                    const directionalLight = light as DirectionalLight;
                    const spotLight = light as SpotLight;
                    const pointLight = light as PointLight;
                    const hemisphereLight = light as HemisphereLight;
                    return <>
                        {makeProperty("intensity")}
                        {makeProperty("color")}
                        {
                            hemisphereLight.isHemisphereLight
                            &&
                            makeProperty("groundColor")
                        }
                        {
                            (
                                directionalLight.isDirectionalLight
                                || spotLight.isSpotLight
                                || pointLight.isPointLight
                            )
                            &&
                            makeProperty("castShadow")
                        }
                        {
                            directionalLight.isDirectionalLight
                            &&
                            (() => {
                                const dummyLight = { shadowArea: Math.abs(directionalLight.shadow.camera.left) }
                                return <Property
                                    key={`${target.uuid}-${timestamp}-shadowArea`}
                                    target={dummyLight}
                                    owner={target}
                                    property={"shadowArea"}
                                    onChanged={() => {
                                        directionalLight.shadow.camera.left = -dummyLight.shadowArea;
                                        directionalLight.shadow.camera.right = dummyLight.shadowArea;
                                        directionalLight.shadow.camera.top = dummyLight.shadowArea;
                                        directionalLight.shadow.camera.bottom = -dummyLight.shadowArea;
                                        directionalLight.shadow.camera.updateProjectionMatrix();
                                        onChanged();
                                    }}
                                />
                            })()
                        }
                        {
                            directionalLight.isDirectionalLight
                            &&
                            (() => {
                                const dummyLight = { far: directionalLight.shadow.camera.far }
                                return <Property
                                    key={`${target.uuid}-${timestamp}-far`}
                                    target={dummyLight}
                                    owner={target}
                                    property={"far"}
                                    onChanged={() => {
                                        directionalLight.shadow.camera.far = dummyLight.far;                                        
                                        directionalLight.shadow.camera.updateProjectionMatrix();
                                        onChanged();
                                    }}
                                />
                            })()
                        }
                    </>
                } else if (camera.isCamera) {
                    const perspective = camera as PerspectiveCamera;
                    return <>
                        {perspective.isPerspectiveCamera && makeProperty("fov")}
                        {makeProperty("near")}
                        {makeProperty("far")}
                        {makeProperty("zoom")}
                    </>
                } else {
                    return <>
                        {makeProperty("castShadow")}
                        {makeProperty("receiveShadow")}
                    </>;
                }
            })()}
        </Properties>
        {
            target.animations.length > 0
            &&
            <Section 
                name="Animations"
                actions={[{
                    icon: "cross",
                    onClick: () => {
                        undoRedo.recordState(target);
                        engineState.unregisterAnimations(target);
                        target.animations.length = 0;
                        undoRedo.pushState();
                        onChanged();
                        setLocalTimestamp(Date.now());
                    }
                }]}
            >
                <Properties>
                    {target.animations.map((animation, index) => {
                        return <Fragment key={`${target.uuid}-${timestamp}-animation-${index}`}>
                            <Property
                                target={animation}
                                property={"name"}
                                owner={target}
                                onBeforeChange={() => {
                                    engineState.unregisterAnimations(target);
                                }}
                                onChanged={() => {
                                    engineState.registerAnimations(target);
                                    onChanged();
                                }}
                            />
                        </Fragment>
                    })}
                </Properties>
            </Section>
        }
        <Section name="Advanced">
            <Properties>
                <Property
                    key={`${target.uuid}-uuid-${timestamp}`}
                    target={target}
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
                        target.uuid = MathUtils.generateUUID();                        
                        cmdRefreshInspectors.post(target);
                        cmdSaveScene.post(false);
                    }}
                />
                <Property
                    key={`${target.uuid}-${timestamp}-reset`}
                    target={{ transform: { command: "Reset" } }}
                    owner={target}
                    property={"transform"}
                    onChanged={() => {
                        undoRedo.recordState(target);
                        target.position.set(0, 0, 0);
                        target.rotation.set(0, 0, 0);
                        target.scale.set(1, 1, 1);
                        target.userData.eulerRotation = target.rotation.clone();
                        onChanged();
                        evtObjectTransformChanged.post();
                    }}
                />
                <Property
                    key={`${target.uuid}-${timestamp}-eulerOrder`}
                    target={target.rotation}
                    owner={target}
                    property={"order"}
                    options={{
                        values: [
                            "YXZ",
                            "YZX",
                            "XYZ",
                            "XZY",
                            "ZXY",
                            "ZYX"
                        ]
                    }}
                    onChanged={() => {
                        target.userData.eulerRotation = target.rotation.clone();
                        onChanged();
                    }}
                />
                {makeProperty("matrixAutoUpdate")}
                {makeProperty("matrixWorldAutoUpdate")}
                {makeProperty("frustumCulled")}
                {makeProperty("renderOrder")}
            </Properties>
        </Section>
        <Section name="Layers">
            <Properties>
                {[...Array(32)].map((_, i) => {
                    const adapter = {};
                    Object.defineProperty(adapter, "active", {
                        get: () => target.layers.isEnabled(i),
                        set: (v: boolean) => {
                            if (v) {
                                target.layers.enable(i);
                            } else {
                                target.layers.disable(i);
                            }
                        }
                    });
                    return <Property
                        key={`${target.uuid}-${timestamp}-layer-${i}`}
                        target={adapter}
                        owner={target}
                        property={"active"}
                        options={{ label: i.toString() }}
                        onChanged={() => onChanged()}
                    />
                })}
            </Properties>
        </Section>
    </>
}

