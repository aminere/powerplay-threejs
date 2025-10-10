import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function GoHome(props: { onFinished: () => void; }) {
    const navigate = useNavigate();
    useEffect(() => {
        navigate("/");
        props.onFinished();
    });
    return <></>;
}

