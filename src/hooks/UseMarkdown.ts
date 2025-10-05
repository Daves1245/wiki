import { useState, useEffect, useRef, useCallback } from 'react';
import { SourceManager } from '../util/SourceManager';
import type { Loadable } from '../types/Loadable';
import type { SourceNode } from '../types/SourceNode';
import type { MarkdownFile } from '../types/Markdown';

export function useMarkdownFiles(path: string) {
    const [sources, setSources] = useState<Loadable<SourceNode>>({ type: 'idle' });
    const sourceManagerRef = useRef<SourceManager | null>(null);

    useEffect(() => {
        if (!sourceManagerRef.current) {
            sourceManagerRef.current = new SourceManager(path);
        }

        const manager = sourceManagerRef.current;

        const ingestSources = async () => {
            await manager.ingest();
            setSources(manager.sources);
        };

        ingestSources();
    }, [path]);

    const getDirectory = useCallback(async (dirPath: string) => {
        if (!sourceManagerRef.current) return { type: 'error', msg: 'SourceManager not initialized' } as Loadable<SourceNode[]>;
        return await sourceManagerRef.current.getDirectory(dirPath);
    }, []);

    const getFile = useCallback(async (slug: string) => {
        if (!sourceManagerRef.current) return { type: 'error', msg: 'SourceManager not initialized' } as Loadable<MarkdownFile>;
        return await sourceManagerRef.current.getFile(slug);
    }, []);

    return {
        sources,
        getDirectory,
        getFile,
        sourceManager: sourceManagerRef.current
    };
}
