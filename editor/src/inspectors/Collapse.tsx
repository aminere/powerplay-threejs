
export function Collapse({ isOpen, children }: { isOpen: boolean, children: React.ReactNode }) {
    return isOpen ? <>{children}</> : null;
}

