import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { MarkdownFile } from '../types/Markdown';
import type { Loadable } from '../types/Loadable';

interface PageProps {
  getFile: (slug: string) => Promise<Loadable<MarkdownFile>>;
}

const Page = ({ getFile }: PageProps) => {
  const params = useParams<{ '*': string }>();
  const slug = params['*'];
  const [file, setFile] = useState<Loadable<MarkdownFile>>({ type: 'idle' });

  useEffect(() => {
    if (slug) {
      const loadFile = async () => {
        setFile({ type: 'loading', taskId: Date.now() });
        const result = await getFile(slug);
        setFile(result);
      };
      loadFile();
    }
  }, [slug, getFile]);

  return (
    <div className="page-content">
      {!slug && (
        <div className="text-gray-500">
          <h1 className="text-2xl font-bold mb-4">Welcome to the Wiki</h1>
          <p>Select a file from the sidebar to view its content.</p>
        </div>
      )}

      {slug && file.type === 'loading' && (
        <div>Loading file...</div>
      )}

      {slug && file.type === 'error' && (
        <div className="text-red-500">Error: {file.msg}</div>
      )}

      {slug && file.type === 'success' && (
        <div>
          <div className="prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {file.data.content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default Page;
