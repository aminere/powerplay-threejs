import { BoxGeometry, BufferGeometry, Object3D, PlaneGeometry, SphereGeometry, TorusGeometry } from "three"
import { Property } from "./Property";
import { useState } from "react";
import { undoRedo } from "../UndoRedo";
import { cmdSaveScene } from "../Events";
import { Properties } from "./Properties";

interface IProps {
    target: Object3D & { geometry: BufferGeometry };
    timestamp: number;
}


const geometryLib = {
    PlaneGeometry,
    BoxGeometry,
    SphereGeometry,
    TorusGeometry,
    BufferGeometry,
};

function createGeometryFromType(type: string) {
    return new geometryLib[type as keyof typeof geometryLib]();
}

export function GeometryInspector(props: IProps) {
    const [, setLocalTimestamp] = useState(Date.now());

    const { target, timestamp } = props;
    const type = props.target.geometry.type;
    const typeDummy = { type };
    const onChanged = () => {
        undoRedo.pushState();
        cmdSaveScene.post(false);
    };

    return <>
        <Properties>
            <Property
                key={`${target.uuid}-geometry-uuid-${timestamp}`}
                target={target.geometry}
                owner={target}
                property={"uuid"}
                options={{ readonly: true }}
            />
            <Property
                key={`${target.uuid}-type-${timestamp}`}
                target={typeDummy}
                owner={target}
                property={"type"}
                options={{
                    values: Object.keys(geometryLib)
                }}
                onChanged={() => {                    
                    setLocalTimestamp(Date.now());
                    target.geometry.dispose();
                    const newType = typeDummy.type;
                    target.geometry = createGeometryFromType(newType);
                    onChanged();
                }}
            />
            {
                type !== "BufferGeometry"
                &&
                <>
                    {(() => {
                        const parameters = (target.geometry as BoxGeometry).parameters;
                        if (parameters) {
                            return Object.keys(parameters).map(key => {
                                return <Property
                                    key={`${target.uuid}-${key}-${type}-${timestamp}`}
                                    target={parameters}
                                    owner={target}
                                    property={key}
                                    onChanged={() => {
                                        target.geometry.dispose();
                                        const ctor = geometryLib[type as keyof typeof geometryLib];
                                        target.geometry = new ctor(...Object.values(parameters));
                                        onChanged();
                                    }}
                                />
                            });
                        }
                    })()}
                </>
            }
        </Properties>
    </>
}
