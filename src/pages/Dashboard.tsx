import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Trash2, Plus, Search, CheckCircle2, Bookmark, Tag, Eye, LogOut, Loader2, Pencil, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Note {
  id: string;
  title: string;
  command: string;
  language: string;
  createdAt: number;
  tags?: string[];
  preview?: string;
  usage_count?: number;
  user_id?: string;
}

type SortMode = 'recent' | 'frequent';

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

function Dashboard() {
  const { signOut, user } = useAuth();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [command, setCommand] = useState('');
  const [language, setLanguage] = useState('bash');
  const [tagsInput, setTagsInput] = useState('');
  const [preview, setPreview] = useState('');
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchNotes();
      // Only check migration once on initial load
      if (notes.length === 0) checkMigration();
    }
  }, [user, sortMode]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('notes').select('*');
      
      if (sortMode === 'frequent') {
        query = query.order('usage_count', { ascending: false }).order('createdAt', { ascending: false });
      } else {
        query = query.order('createdAt', { ascending: false });
      }
      
      const { data, error } = await query;
        
      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      showToast('Error loading notes from cloud');
    } finally {
      setIsLoading(false);
    }
  };

  const checkMigration = async () => {
    const localNotes = localStorage.getItem('commandNotes');
    if (localNotes) {
      try {
        const parsed = JSON.parse(localNotes);
        if (parsed.length > 0) {
          // If we have local notes and they aren't marked as migrated, show the option
          const isMigrated = localStorage.getItem('notesMigrated');
          if (!isMigrated) {
            handleMigration(parsed);
          }
        }
      } catch (e) {
        console.error('Migration check failed');
      }
    }
  };

  const handleMigration = async (localNotes: Note[]) => {
    if (!user) return;
    setIsMigrating(true);
    try {
      // Add user_id to local notes before uploading
      const notesToMigrate = localNotes.map(n => ({
        ...n,
        user_id: user.id
      }));
      
      const { error } = await supabase.from('notes').insert(notesToMigrate);
      if (error) throw error;
      
      localStorage.setItem('notesMigrated', 'true');
      showToast(`Migrated ${notesToMigrate.length} notes to the cloud!`);
      fetchNotes(); // Refresh to catch any new IDs assigned by DB
    } catch (err) {
      console.error('Migration failed:', err);
      showToast('Failed to migrate local notes');
    } finally {
      setIsMigrating(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !command.trim() || !user) return;

    const tags = tagsInput.split(',').map(tag => tag.trim()).filter(Boolean);

    if (editingNote) {
      // Handle Update
      const updatedNote = {
        ...editingNote,
        title,
        command,
        language,
        tags,
        preview
      };

      // Optimistically update
      setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
      
      resetForm();
      
      try {
        const { error } = await supabase
          .from('notes')
          .update(updatedNote)
          .eq('id', updatedNote.id);
          
        if (error) throw error;
        showToast('Command note updated successfully!');
      } catch (err) {
        console.error('Failed to update cloud note:', err);
        showToast('Error updating note.');
        // fetchNotes to revert state if update fails
        fetchNotes();
      }
      
    } else {
      // Handle Create
      const tempId = crypto.randomUUID();

      const newNote = {
        id: tempId,
        title,
        command,
        language,
        createdAt: Date.now(),
        tags,
        preview,
        user_id: user.id
      };

      setNotes(prev => [newNote as Note, ...prev]);
      
      resetForm();
      
      try {
        const { error } = await supabase.from('notes').insert([newNote]);
        if (error) throw error;
        showToast('Command note saved to cloud!');
      } catch (err) {
        console.error('Failed to save to cloud:', err);
        showToast('Error saving note. It may only exist locally.');
        setNotes(prev => prev.filter(n => n.id !== tempId));
      }
    }
  };

  const handleEditClick = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setCommand(note.command);
    setLanguage(note.language);
    setTagsInput(note.tags ? note.tags.join(', ') : '');
    setPreview(note.preview || '');
      
    // Scroll to top where the form is (for better UX on small screens)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const resetForm = () => {
    setEditingNote(null);
    setTitle('');
    setCommand('');
    setTagsInput('');
    setPreview('');
  };

  const handleDelete = async (id: string) => {
    const backupNotes = [...notes];
    setNotes(prev => prev.filter(note => note.id !== id));
    
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      showToast('Note deleted from cloud');
    } catch (err) {
      console.error('Delete failed:', err);
      // Revert on failure
      setNotes(backupNotes);
      showToast('Failed to delete note');
    }
  };

  const handleCopy = async (note: Note) => {
    try {
      await navigator.clipboard.writeText(note.command);
      showToast('Copied to clipboard!');
      
      // Optimistically update local state
      const newUsageCount = (note.usage_count || 0) + 1;
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, usage_count: newUsageCount } : n));
      
      // Update count in database
      const { error } = await supabase
        .from('notes')
        .update({ usage_count: newUsageCount })
        .eq('id', note.id);
        
      if (error) throw error;
      
    } catch (err) {
      console.error('Failed to copy text or update usage: ', err);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {user?.email}
          </span>
          <button 
            onClick={signOut}
            className="icon-button"
            title="Sign Out"
            style={{ 
              background: 'rgba(248, 81, 73, 0.1)', 
              color: 'var(--error)', 
              border: '1px solid rgba(248, 81, 73, 0.2)' 
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar">
          <div className="glass-panel">
            <h2 style={{ marginBottom: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bookmark size={20} color="var(--primary-color)" />
              {editingNote ? 'Edit Command' : 'New Command'}
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

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="button" style={{ flex: 1 }}>
                  {editingNote ? <CheckCircle2 size={20} /> : <Plus size={20} />}
                  {editingNote ? 'Update Note' : 'Save Note'}
                </button>
                {editingNote && (
                  <button 
                    type="button" 
                    className="button cancel" 
                    onClick={resetForm}
                    style={{ 
                      flex: 1, 
                      background: 'rgba(255, 255, 255, 0.1)', 
                      color: 'var(--text-primary)',
                      boxShadow: 'none'
                    }}
                  >
                    <X size={20} />
                    Cancel
                  </button>
                )}
              </div>
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
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            <button 
              className={`button ${sortMode === 'recent' ? 'active-tab' : ''}`}
              onClick={() => setSortMode('recent')}
              style={{ 
                flex: '0 1 auto', 
                background: sortMode === 'recent' ? 'var(--primary-color)' : 'transparent',
                color: sortMode === 'recent' ? '#000' : 'var(--text-secondary)',
                border: sortMode === 'recent' ? 'none' : '1px solid var(--glass-border)',
                boxShadow: sortMode === 'recent' ? '0 4px 12px var(--primary-glow)' : 'none',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem'
              }}
            >
              Recent
            </button>
            <button 
              className={`button ${sortMode === 'frequent' ? 'active-tab' : ''}`}
              onClick={() => setSortMode('frequent')}
              style={{ 
                flex: '0 1 auto', 
                background: sortMode === 'frequent' ? 'var(--primary-color)' : 'transparent',
                color: sortMode === 'frequent' ? '#000' : 'var(--text-secondary)',
                border: sortMode === 'frequent' ? 'none' : '1px solid var(--glass-border)',
                boxShadow: sortMode === 'frequent' ? '0 4px 12px var(--primary-glow)' : 'none',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem'
              }}
            >
              Frequently Used
            </button>
          </div>

          <div className="notes-list">
            {isMigrating && (
              <div style={{ background: 'var(--primary-glow)', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <Loader2 className="animate-spin" />
                <span>Migrating your local notes to the cloud...</span>
              </div>
            )}
            
            {isLoading ? (
              <div className="empty-state" style={{ border: 'none', background: 'transparent' }}>
                <Loader2 size={40} className="empty-icon animate-spin" />
                <p>Loading your commands from the cloud...</p>
              </div>
            ) : filteredNotes.length === 0 ? (
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
                        {(() => {
                          if (!note.tags) return null;
                          let parsedTags: string[] = [];
                          
                          if (Array.isArray(note.tags)) {
                            parsedTags = note.tags;
                          } else {
                            // TypeScript safe cast to work with the string
                            const tagsStr = String(note.tags);
                            try {
                              if (tagsStr.startsWith('{') && tagsStr.endsWith('}')) {
                                parsedTags = tagsStr.slice(1, -1).split(',').map((t: string) => t.trim().replace(/^"|"$/g, ''));
                              } else {
                                parsedTags = JSON.parse(tagsStr);
                              }
                            } catch (e) {
                              parsedTags = tagsStr.split(',').map((t: string) => t.trim());
                            }
                          }
                          
                          return parsedTags.map((tag: string, i: number) => (
                            <span key={i} className="note-tag">
                              <Tag size={12} />
                              {tag}
                            </span>
                          ));
                        })()}
                      </div>
                      <h3 className="note-title">{note.title}</h3>
                    </div>
                    <div className="note-actions">
                      {sortMode === 'frequent' && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}>
                          Used {note.usage_count || 0} times
                        </span>
                      )}
                      <button 
                        className="icon-button copy" 
                        onClick={() => handleCopy(note)}
                        title="Copy Command"
                      >
                        <Copy size={18} />
                      </button>
                      <button 
                        className="icon-button edit" 
                        onClick={() => handleEditClick(note)}
                        title="Edit Note"
                        style={{ color: 'var(--primary-color)' }}
                      >
                        <Pencil size={18} />
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

export default Dashboard;
