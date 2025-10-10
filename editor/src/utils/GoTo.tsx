import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function GoTo(props: { route?: string; onFinished: () => void; }) {
    const navigate = useNavigate();
    const { route, onFinished } = props;
    useEffect(() => {
        if (route) {
            navigate(route);
            onFinished();
        }
    }, [navigate, onFinished, route]);
    return <></>;
}

