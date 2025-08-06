import fs from 'fs/promises';
import path from 'path';
import type { Plugin } from 'vite';

interface WikiFile {
  type: 'file';
  path: string;
  name: string;
}

interface WikiDirectory {
  type: 'directory';
  path: string;
  children: (WikiFile | WikiDirectory)[];
}

export function wikiPlugin(): Plugin {
  const WIKI_DIR = path.resolve('./public/wiki');

  // Scan directory structure (only first level)
  async function scanDirectory(dirPath: string, relativePath = '', depth = 0): Promise<WikiDirectory> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result: WikiDirectory = {
        type: 'directory',
        path: relativePath || 'wiki',
        children: []
      };

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Only scan one level deep, then mark subdirectories for lazy loading
          if (depth === 0) {
            const subDir = await scanDirectory(entryPath, entryRelativePath, depth + 1);
            result.children.push(subDir);
          } else {
            // Just mark as directory without scanning contents
            result.children.push({
              type: 'directory',
              path: entryRelativePath,
              children: [] // Empty - will be loaded on demand
            });
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          result.children.push({
            type: 'file',
            path: entryRelativePath,
            name: entry.name
          });
        }
      }

      return result;
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
      return { type: 'directory', path: relativePath || 'wiki', children: [] };
    }
  }

  return {
    name: 'wiki-plugin',
    configureServer(server) {
      // Add middleware before internal middlewares
      server.middlewares.use(async (req, res, next) => {
        console.log('All requests:', req.method, req.url);

        // Handle all /api/wiki requests
        if (req.method === 'GET' && req.url?.startsWith('/api/wiki')) {
          console.log('Wiki API request intercepted:', req.url);

          // Handle file requests first (most specific)
          if (req.url?.startsWith('/api/wiki/file/')) {
            try {
              const rawSlug = req.url.replace('/api/wiki/file/', '');
              const slug = decodeURIComponent(rawSlug);
              if (!slug) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing file slug' }));
                return;
              }

              console.log('Loading file:', slug);
              const filePath = path.join(WIKI_DIR, `${slug}.md`);

              // Security check
              const resolvedPath = path.resolve(filePath);
              const resolvedWikiDir = path.resolve(WIKI_DIR);
              if (!resolvedPath.startsWith(resolvedWikiDir)) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: 'Access denied' }));
                return;
              }

              const content = await fs.readFile(filePath, 'utf-8');
              console.log('File loaded successfully:', slug);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                path: `${slug}.md`,
                slug,
                content
              }));
              return;
            } catch (error) {
              if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                res.statusCode = 404;
                res.end(JSON.stringify({
                  error: 'File not found',
                  message: `File does not exist`
                }));
                return;
              }

              console.error('Error reading file:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({
                error: 'Failed to read file',
                message: error instanceof Error ? error.message : 'Unknown error'
              }));
              return;
            }
          }

          // Handle directory requests
          if (req.url?.startsWith('/api/wiki/dir')) {
            try {
              const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
              const dirPath = url.searchParams.get('path') || '';
              const fullPath = path.join(WIKI_DIR, dirPath);

              console.log('Directory API called with path:', dirPath);

              // Security check
              const resolvedPath = path.resolve(fullPath);
              const resolvedWikiDir = path.resolve(WIKI_DIR);
              if (!resolvedPath.startsWith(resolvedWikiDir)) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: 'Access denied' }));
                return;
              }

              const entries = await fs.readdir(fullPath, { withFileTypes: true });
              const children = [];

              for (const entry of entries) {
                const entryRelativePath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

                if (entry.isDirectory()) {
                  children.push({
                    type: 'directory',
                    path: entryRelativePath,
                    name: entry.name
                  });
                } else if (entry.isFile() && entry.name.endsWith('.md')) {
                  children.push({
                    type: 'file',
                    path: entryRelativePath,
                    name: entry.name
                  });
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(children));
              return;
            } catch (error) {
              console.error('Error reading directory:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({
                error: 'Failed to read directory',
                message: error instanceof Error ? error.message : 'Unknown error'
              }));
              return;
            }
          }

          // Handle exact /api/wiki requests (root structure)
          if (req.url === '/api/wiki') {
            try {
              const structure = await scanDirectory(WIKI_DIR);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(structure));
              return;
            } catch (error) {
              console.error('Error getting wiki structure:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({
                error: 'Failed to read wiki directory',
                message: error instanceof Error ? error.message : 'Unknown error'
              }));
              return;
            }
          }

        }
        
        // If we get here, pass to next middleware
        next();
      });
    }
  };
}
