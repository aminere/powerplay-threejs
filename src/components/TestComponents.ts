import { Component, ComponentProps } from "./Components";

export interface TestComponentProps extends ComponentProps {
    a: number;
    b: string;
    c: boolean;
}

export class TestComponent extends Component {
    constructor(props?: TestComponentProps) {        
        super(props ?? { a: 1, b: "2", c: true });
    }
}

export function TestComponentUpdate(component: TestComponent) {
    console.log(component);
}

export interface TestComponentProps2 extends ComponentProps {
    d: number;
    e: string;
    f: boolean;
}

export class TestComponent2 extends Component {
    constructor(props?: TestComponentProps2) {
        super(props ?? { d: 1, e: "2", f: true });
    }
}

