import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Page from './components/Page';
import { useMarkdownFiles } from './hooks/UseMarkdown';

function App() {
  const { sources, getDirectory, getFile } = useMarkdownFiles('wiki');

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh' }}>
        <Sidebar sources={sources} getDirectory={getDirectory} getFile={getFile} />
        <Routes>
          <Route path="/file/*" element={<Page getFile={getFile} />} />
          <Route path="/" element={<Page getFile={getFile} />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
