import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import type { Loadable } from '../types/Loadable';
import type { SourceNode } from '../types/SourceNode';
import type { VirtualTreeNode } from '../types/VirtualTreeNode';
import type { MarkdownFile } from '../types/Markdown';


interface SidebarProps {
  sources: Loadable<SourceNode>;
  getDirectory: (dirPath: string) => Promise<Loadable<SourceNode[]>>;
  getFile: (slug: string) => Promise<Loadable<MarkdownFile>>;
}

const Sidebar: React.FC<SidebarProps> = ({ sources, getDirectory, getFile }) => {
  const [virtualTree, setVirtualTree] = useState<Loadable<VirtualTreeNode>>({ type: 'idle' });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const navigate = useNavigate();

  // Convert sources to virtual tree
  const createVirtualTree = (source: SourceNode, isRoot = false): VirtualTreeNode => {
    return {
      expanded: isRoot, // Root defaults to expanded
      childrenLoaded: false,
      source,
    };
  };

  // Update virtual tree when sources change
  useEffect(() => {
    if (sources.type === 'loading') {
      setVirtualTree({ type: 'loading', taskId: sources.taskId });
    } else if (sources.type === 'error') {
      setVirtualTree({ type: 'error', msg: sources.msg });
    } else if (sources.type === 'success') {
      setVirtualTree({ type: 'success', data: createVirtualTree(sources.data, true) });
    }
  }, [sources]);

  const updateVirtualTreeNode = (tree: VirtualTreeNode, path: string, updater: (node: VirtualTreeNode) => VirtualTreeNode): VirtualTreeNode => {
    if (tree.source.path === path) {
      return updater(tree);
    }
    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map(child => updateVirtualTreeNode(child, path, updater))
      };
    }
    return tree;
  };

  const findVirtualTreeNode = (tree: VirtualTreeNode, path: string): VirtualTreeNode | null => {
    if (tree.source.path === path) return tree;
    if (tree.children) {
      for (const child of tree.children) {
        const found = findVirtualTreeNode(child, path);
        if (found) return found;
      }
    }
    return null;
  };

  const toggleFolder = (folderPath: string) => {
    console.log('Toggling folder:', folderPath);

    if (virtualTree.type !== 'success') return;

    const currentNode = findVirtualTreeNode(virtualTree.data, folderPath);
    if (!currentNode) return;

    const wasExpanded = currentNode.expanded;
    const willExpand = !wasExpanded;

    // Toggle expansion state
    setVirtualTree(prev => {
      if (prev.type !== 'success') return prev;
      
      const updatedTree = updateVirtualTreeNode(prev.data, folderPath, node => ({
        ...node,
        expanded: !node.expanded
      }));

      return { ...prev, data: updatedTree };
    });

    // Load directory if expanding and children not loaded
    if (willExpand && !currentNode.childrenLoaded) {
      console.log('Loading directory:', folderPath);

      getDirectory(folderPath).then(directoryContents => {
        if (directoryContents.type === 'success') {
          // Update the node with loaded children
          setVirtualTree(prev => {
            if (prev.type !== 'success') return prev;
            
            const updatedTree = updateVirtualTreeNode(prev.data, folderPath, node => ({
              ...node,
              childrenLoaded: true,
              children: directoryContents.data.map(source => createVirtualTree(source, false))
            }));

            return { ...prev, data: updatedTree };
          });

          // pre-queue files in expanded directory
          preQueueFiles(directoryContents.data);
        }
      }).catch(error => {
        console.error('Failed to load directory:', error);
      });
    }
  };

  const preQueueFiles = (sources: SourceNode[]) => {
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


  const getDirectoryChildren = (): VirtualTreeNode[] => {
    return [];
  };

  const TreeItemComponent: React.FC<{
    node: VirtualTreeNode;
    depth: number;
  }> = ({ node, depth }) => {
    const name = node.source.path.split('/').pop() || 'root';
    const isExpanded = node.expanded;
    const isSelected = selectedFile === node.source.path;
    const paddingLeft = `${1 + (depth * 1.25)}rem`;

    if (node.source.type === 'directory') {
      const children = node.children || getDirectoryChildren();

      return (
        <div>
          <button
            className={styles.folderButton}
            style={{ paddingLeft }}
            onClick={() => toggleFolder(node.source.path)}
          >
            <span className={styles.folderIcon}>
              {isExpanded ? '⌄' : '›'}
            </span>
            <span className={styles.itemText}>
              {name.replace(/\.md$/, '')}
            </span>
          </button>
          {isExpanded && (
            <div>
              {children.map((child, index) => (
                <TreeItemComponent
                  key={`${child.source.path}-${index}`}
                  node={child}
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
        onClick={() => selectFile(node.source.path)}
      >
        <span className={styles.itemText}>
          {name}
        </span>
      </button>
    );
  };


  return (
    <div className={styles.sidebar}>
      {virtualTree.type === 'loading' && (
        <div className={styles.itemText} style={{ padding: '1rem' }}>
          Loading wiki files...
        </div>
      )}
  {virtualTree.type === 'error' && (
    <div className={styles.itemText} style={{ padding: '1rem', color: '#ef4444' }}>
      Error: {virtualTree.msg}
    </div>
  )}
  {virtualTree.type === 'idle' && (
    <div className={styles.itemText} style={{ padding: '1rem' }}>
      Initializing...
    </div>
  )}
  {virtualTree.type === 'success' && (
    <TreeItemComponent node={virtualTree.data} depth={0} />
  )}
</div>
  );
}

export default Sidebar;
