import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));

app.use(express.json());

const WIKI_DIR = path.join(__dirname, 'wiki');

// Helper function to scan directory recursively
async function scanDirectory(dirPath, relativePath = '') {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result = {
      type: 'directory',
      path: relativePath || 'wiki',
      children: []
    };

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subDir = await scanDirectory(entryPath, entryRelativePath);
        result.children.push(subDir);
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
    throw error;
  }
}

// API Routes

// Get directory structure
app.get('/api/wiki', async (req, res) => {
  try {
    const structure = await scanDirectory(WIKI_DIR);
    res.json(structure);
  } catch (error) {
    console.error('Error getting wiki structure:', error);
    res.status(500).json({ 
      error: 'Failed to read wiki directory',
      message: error.message 
    });
  }
});

// Get directory contents (for lazy loading) 
app.get('/api/wiki/dir', async (req, res) => {
  try {
    const dirPath = req.query.path || ''; // Get path from query parameter
    const fullPath = path.join(WIKI_DIR, dirPath);
    
    // Security check - make sure we're still within wiki directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedWikiDir = path.resolve(WIKI_DIR);
    if (!resolvedPath.startsWith(resolvedWikiDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const children = [];

    for (const entry of entries) {
      const entryRelativePath = `${dirPath}/${entry.name}`;
      
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

    res.json(children);
  } catch (error) {
    console.error('Error reading directory:', error);
    res.status(500).json({ 
      error: 'Failed to read directory',
      message: error.message 
    });
  }
});

// Get file content
app.get('/api/wiki/file/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const filePath = path.join(WIKI_DIR, `${slug}.md`);
    
    // Security check
    const resolvedPath = path.resolve(filePath);
    const resolvedWikiDir = path.resolve(WIKI_DIR);
    if (!resolvedPath.startsWith(resolvedWikiDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const content = await fs.readFile(filePath, 'utf-8');
    
    res.json({
      path: `${slug}.md`,
      slug,
      content
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ 
        error: 'File not found',
        message: `File ${req.params.slug}.md does not exist`
      });
    }
    
    console.error('Error reading file:', error);
    res.status(500).json({ 
      error: 'Failed to read file',
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Wiki API server running on http://localhost:${PORT}`);
  console.log(`Wiki directory: ${WIKI_DIR}`);
});