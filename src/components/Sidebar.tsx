import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import type { Loadable } from '../types/Loadable';
import type { Source } from '../types/SourceNode';
import type { MarkdownFile } from '../types/Markdown';

interface TreeItem {
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: TreeItem[];
  loadable?: Loadable<Source[]>;
}

interface SidebarProps {
  sources: Loadable<Source>;
  getDirectory: (dirPath: string) => Promise<Loadable<Source[]>>;
  getFile: (slug: string) => Promise<Loadable<MarkdownFile>>;
}

const Sidebar: React.FC<SidebarProps> = ({ sources, getDirectory, getFile }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loadedDirectories, setLoadedDirectories] = useState<Map<string, Loadable<Source[]>>>(new Map());
  const [pendingDirectories, setPendingDirectories] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const toggleFolder = (folderPath: string) => {
    console.log('Toggling folder:', folderPath);

    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);

      // debounce directories (shouldn't be an issue)
      if (!loadedDirectories.has(folderPath) && !pendingDirectories.has(folderPath)) {
        console.log('Loading directory:', folderPath);
        // mark as pending
        setPendingDirectories(prev => new Set([...prev, folderPath]));
        // mark Loadable directory as pending
        setLoadedDirectories(prev => new Map([...prev, [folderPath, { type: 'loading', taskId: Date.now() }]]));

        // load in the background
        getDirectory(folderPath).then(directoryContents => {
          setLoadedDirectories(prev => new Map([...prev, [folderPath, directoryContents]]));
          setPendingDirectories(prev => {
            const newSet = new Set(prev);
            newSet.delete(folderPath);
            return newSet;
          });

          // pre-queue files in expanded directory
          if (directoryContents.type === 'success') {
            preQueueFiles(directoryContents.data);
          }
        }).catch(error => {
          console.error('Failed to load directory:', error);
          setPendingDirectories(prev => {
            const newSet = new Set(prev);
            newSet.delete(folderPath);
            return newSet;
          });
        });
      }
    }
    setExpandedFolders(newExpanded);
  };

  const preQueueFiles = (sources: Source[]) => {
    console.log('Pre-queuing files for', sources.length, 'items');

    sources.forEach(source => {
      if (source.type === 'file') {
        const slug = source.path.replace(/\.md$/, '');

        console.log('Pre-queuing file:', slug);

        getFile(slug).catch(() => {
          // ignore errors
        });
      }
    });
  };

  const selectFile = (filePath: string) => {
    setSelectedFile(filePath);
    // the slug should be the full path without the .md extension
    const slug = filePath.replace(/\.md$/, '');
    navigate(`/file/${slug}`);
  };

  const sourceToTreeItem = (source: Source, basePath: string = ''): TreeItem => {
    if (source.type === 'directory') {
      return {
        name: source.path.split('/').pop() || 'root',
        type: 'folder',
        path: source.path,
        children: [], // populated when expanded
      };
    } else {
      const pathParts = basePath.split('/');
      const fileName = pathParts[pathParts.length - 1] || 'unknown.md';
      return {
        name: fileName,
        type: 'file',
        path: basePath,
      };
    }
  };

  // get children for a directory from loaded sources
  const getDirectoryChildren = (dirPath: string): TreeItem[] => {
    const loadable = loadedDirectories.get(dirPath);
    if (loadable?.type === 'success') {
      return loadable.data.map(source => {
        if (source.type === 'directory') {
          return sourceToTreeItem(source);
        } else {
          const fileName = source.path.split('/').pop() || 'unknown.md';
          return {
            name: fileName,
            type: 'file' as const,
            path: source.path,
          };
        }
      });
    }
    return [];
  };

  const TreeItemComponent: React.FC<{
    item: TreeItem;
    path?: string;
    depth?: number;
  }> = ({ item, path = '', depth = 0 }) => {
    const currentPath = path ? `${path}/${item.name}` : item.name;
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedFile === item.path;
    const paddingLeft = `${1 + (depth * 1.25)}rem`;

    if (item.type === 'folder') {
      const directoryLoadable = loadedDirectories.get(item.path);
      const children = getDirectoryChildren(item.path);

      return (
        <div>
          <button
            className={styles.folderButton}
            style={{ paddingLeft }}
            onClick={() => toggleFolder(item.path)}
          >
            <span className={styles.folderIcon}>
              {isExpanded ? '⌄' : '›'}
            </span>
            <span className={styles.itemText}>
              {item.name.replace(/\.md$/, '')}
            </span>
          </button>
          {isExpanded && (
            <div>
              {directoryLoadable?.type === 'loading' && (
                <div style={{ paddingLeft: `${1 + ((depth + 1) * 1.25)}rem` }} className={styles.itemText}>
                  Loading...
                </div>
              )}
              {directoryLoadable?.type === 'error' && (
                <div style={{ paddingLeft: `${1 + ((depth + 1) * 1.25)}rem` }} className={styles.itemText}>
                  Error: {directoryLoadable.msg}
                </div>
              )}
              {children.map((child, index) => (
                <TreeItemComponent
                  key={`${child.path}-${index}`}
                  item={child}
                  path={currentPath}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        className={`${styles.fileButton} ${isSelected ? styles.selected : ''}`}
        style={{ paddingLeft }}
        onClick={() => selectFile(item.path)}
      >
        <span className={styles.itemText}>
          {item.name}
        </span>
      </button>
    );
  };

  const getRootTree = (): TreeItem | null => {
    if (sources.type === 'success') {
      return sourceToTreeItem(sources.data);
    }
    return null;
  };

  return (
    <div className={styles.sidebar}>
      {sources.type === 'loading' && (
        <div className={styles.itemText} style={{ padding: '1rem' }}>
          Loading wiki files...
        </div>
      )}
      {sources.type === 'error' && (
        <div className={styles.itemText} style={{ padding: '1rem', color: '#ef4444' }}>
          Error: {sources.msg}
        </div>
      )}
      {sources.type === 'idle' && (
        <div className={styles.itemText} style={{ padding: '1rem' }}>
          Initializing...
        </div>
      )}
      {sources.type === 'success' && (
        <TreeItemComponent item={getRootTree()!} />
      )}
    </div>
  );
};

export default Sidebar;
