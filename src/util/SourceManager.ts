import type { Loadable } from "../types/Loadable";
import type { SourceNode } from "../types/SourceNode";
import type { MarkdownFile } from "../types/Markdown";

const API_BASE_URL = '/api';

export class SourceManager {
    path: string;
    sources: Loadable<SourceNode> = { type: 'idle' }
    private loadedFiles: Map<string, Loadable<MarkdownFile>> = new Map();
    private loadedDirectories: Map<string, Loadable<SourceNode[]>> = new Map();

    constructor(path: string) {
        this.path = path;
    }

    async ingest() {
        if (this.sources.type !== 'idle') {
            return;
        }

        this.sources = { type: 'loading', taskId: Date.now() };

        try {
            const response = await fetch(`${API_BASE_URL}/wiki`);
            if (!response.ok) {
                throw new Error(`Failed to fetch wiki structure: ${response.statusText}`);
            }

            const data = await response.json();

            const rootSource: SourceNode = {
                type: 'directory',
                path: data.path,
                children: data.children.map(() => ({ type: 'idle' as const }))
            };

            this.sources = { type: 'success', data: rootSource };
        } catch (error) {
            this.sources = {
                type: 'error',
                msg: error instanceof Error ? error.message : 'Failed to ingest sources'
            };
        }
    }

    async getDirectory(dirPath: string): Promise<Loadable<SourceNode[]>> {
        if (this.loadedDirectories.has(dirPath)) {
            return this.loadedDirectories.get(dirPath)!;
        }

        const loadable: Loadable<SourceNode[]> = { type: 'loading', taskId: Date.now() };
        this.loadedDirectories.set(dirPath, loadable);

        try {
            let url;
            if (dirPath === 'wiki') {
                url = `${API_BASE_URL}/wiki`;
            } else {
                // remove 'wiki/' prefix for the API call
                const apiPath = dirPath.startsWith('wiki/') ? dirPath.substring(5) : dirPath;
                url = `${API_BASE_URL}/wiki/dir?path=${encodeURIComponent(apiPath)}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch directory: ${response.statusText}`);
            }

            const data = await response.json();
            const sources: SourceNode[] = [];

            const items = data.children || data;

            for (const item of items) {
                if (item.type === 'directory') {
                    sources.push({
                        type: 'directory',
                        path: item.path,
                        children: []
                    });
                } else if (item.type === 'file' && item.name.endsWith('.md')) {
                    sources.push({
                        type: 'file',
                        path: item.path,
                        result: { type: 'idle' }
                    });
                }
            }

            const successLoadable: Loadable<SourceNode[]> = { type: 'success', data: sources };
            this.loadedDirectories.set(dirPath, successLoadable);
            return successLoadable;
        } catch (error) {
            const errorLoadable: Loadable<SourceNode[]> = {
                type: 'error',
                msg: error instanceof Error ? error.message : 'Failed to load directory'
            };
            this.loadedDirectories.set(dirPath, errorLoadable);
            return errorLoadable;
        }
    }

    async getFile(slug: string): Promise<Loadable<MarkdownFile>> {
        if (this.loadedFiles.has(slug)) {
            return this.loadedFiles.get(slug)!;
        }

        const loadable: Loadable<MarkdownFile> = { type: 'loading', taskId: Date.now() };
        this.loadedFiles.set(slug, loadable);

        try {
            const response = await fetch(`${API_BASE_URL}/wiki/file/${slug}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`File not found: ${slug}`);
                }
                throw new Error(`Failed to fetch file: ${response.statusText}`);
            }

            const data = await response.json();

            const markdownFile: MarkdownFile = {
                path: data.path,
                slug: data.slug,
                content: data.content
            };

            const successLoadable: Loadable<MarkdownFile> = { type: 'success', data: markdownFile };
            this.loadedFiles.set(slug, successLoadable);
            return successLoadable;
        } catch (error) {
            const errorLoadable: Loadable<MarkdownFile> = {
                type: 'error',
                msg: error instanceof Error ? error.message : 'Failed to load file'
            };
            this.loadedFiles.set(slug, errorLoadable);
            return errorLoadable;
        }
    }
}
