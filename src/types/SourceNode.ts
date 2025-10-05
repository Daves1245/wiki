import type { MarkdownFile } from "./Markdown";
import type { Loadable } from "./Loadable";

export type SourceNode = {
    type: 'directory';
    path: string;
    children: Array<Loadable<SourceNode>>;
} | {
    type: 'file';
    path: string;
    result: Loadable<MarkdownFile>;
}
