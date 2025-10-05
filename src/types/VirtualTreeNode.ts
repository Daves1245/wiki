import type { SourceNode } from "./SourceNode";

export interface VirtualTreeNode {
    expanded: boolean;
    children?: VirtualTreeNode[];
    childrenLoaded: boolean;
    source: SourceNode;
}
