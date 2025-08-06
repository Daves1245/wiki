import type { MarkdownFile } from "./Markdown";
import type { Loadable } from "./Loadable";

export type Source = {
    type: 'directory';
    path: string;
    children: Array<Loadable<Source>>;
} | {
    type: 'file';
    path: string;
    result: Loadable<MarkdownFile>;
}

