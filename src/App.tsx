import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Trash2, Plus, Search, CheckCircle2, Bookmark, Tag, Eye } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  command: string;
  language: string;
  createdAt: number;
  tags?: string[];
  preview?: string;
}

const LANGUAGES = [
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'docker', label: 'Docker' },
  { value: 'other', label: 'Other' },
];

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [title, setTitle] = useState('');
  const [command, setCommand] = useState('');
  const [language, setLanguage] = useState('bash');
  const [tagsInput, setTagsInput] = useState('');
  const [preview, setPreview] = useState('');
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load notes from local storage
    const savedNotes = localStorage.getItem('commandNotes');
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error('Failed to parse notes from local storage');
      }
    }
  }, []);

  useEffect(() => {
    // Save notes to local storage
    localStorage.setItem('commandNotes', JSON.stringify(notes));
  }, [notes]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !command.trim()) return;

    const tags = tagsInput.split(',').map(tag => tag.trim()).filter(Boolean);

    const newNote: Note = {
      id: crypto.randomUUID(),
      title,
      command,
      language,
      createdAt: Date.now(),
      tags,
      preview
    };

    setNotes(prev => [newNote, ...prev]);
    setTitle('');
    setCommand('');
    setTagsInput('');
    setPreview('');
    
    showToast('Command note created successfully!');
  };

  const handleDelete = (id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
    showToast('Note deleted');
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showToast('Failed to copy');
    }
  };

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-section">
          <Terminal size={32} className="logo-icon" />
          <h1 className="logo-text">Command Note</h1>
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar">
          <div className="glass-panel">
            <h2 style={{ marginBottom: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bookmark size={20} color="var(--primary-color)" />
              New Command
            </h2>
            <form onSubmit={handleAddNote}>
              <div className="form-group">
                <label htmlFor="title">Title / Description</label>
                <input
                  id="title"
                  type="text"
                  className="input"
                  placeholder="e.g. Docker Build & Push"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="language">Language</label>
                <select 
                  id="language"
                  className="select" 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="tags">Tags (comma-separated)</label>
                <input
                  id="tags"
                  type="text"
                  className="input"
                  placeholder="e.g. build, cli, setup"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="command">Command / Code</label>
                <textarea
                  id="command"
                  className="textarea"
                  placeholder="docker build -t app:latest . && docker push app:latest"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="preview">Preview Example (Optional)</label>
                <textarea
                  id="preview"
                  className="textarea"
                  style={{ minHeight: '80px' }}
                  placeholder="Paste an example of the command output..."
                  value={preview}
                  onChange={(e) => setPreview(e.target.value)}
                />
              </div>

              <button type="submit" className="button" style={{ marginTop: '1rem' }}>
                <Plus size={20} />
                Save Note
              </button>
            </form>
          </div>
        </aside>

        <section className="notes-section">
          <div className="search-bar">
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              className="search-input"
              placeholder="Search commands, titles, or languages..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="notes-list">
            {filteredNotes.length === 0 ? (
              <div className="empty-state">
                <Terminal className="empty-icon" />
                <h3>No notes found</h3>
                <p style={{ marginTop: '0.5rem' }}>
                  {notes.length === 0 ? "You haven't saved any command notes yet." : "No notes match your search query."}
                </p>
              </div>
            ) : (
              filteredNotes.map(note => (
                <article key={note.id} className="note-card">
                  <div className="note-header">
                    <div className="note-title-wrap">
                      <div className="note-badges">
                        <span className="note-lang">{note.language}</span>
                        {note.tags && note.tags.map((tag, i) => (
                          <span key={i} className="note-tag">
                            <Tag size={12} />
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="note-title">{note.title}</h3>
                    </div>
                    <div className="note-actions">
                      <button 
                        className="icon-button copy" 
                        onClick={() => handleCopy(note.command)}
                        title="Copy Command"
                      >
                        <Copy size={18} />
                      </button>
                      <button 
                        className="icon-button delete" 
                        onClick={() => handleDelete(note.id)}
                        title="Delete Note"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="note-body">
                    <pre className={`code-block language-${note.language}`}>
                      <code>{note.command}</code>
                    </pre>
                    {note.preview && (
                      <div className="note-preview-container">
                        <div className="note-preview-inner">
                          <div className="note-preview-box">
                            <div className="preview-label">
                              <Eye size={14} /> Output Preview
                            </div>
                            <pre className="code-block" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {note.preview}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      {toastMessage && (
        <div className="toast">
          <CheckCircle2 size={24} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
