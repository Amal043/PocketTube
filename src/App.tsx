import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Plus, 
  BookOpen, 
  Database, 
  BarChart3, 
  Clock, 
  Layers, 
  Award, 
  ExternalLink, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase';

// --- TYPE DEFINITIONS ---
interface Video {
  id: string;
  video_url: string;
  timestamp: number;
  topic: string;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review_date: string;
  last_reviewed_at?: string;
  created_at: string;
}

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

const DEFAULT_MOCK_VIDEOS: Video[] = [
  {
    id: "mock-1",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    timestamp: 0,
    topic: "Introduction to Spaced Repetition (Mock)",
    interval: 1,
    ease_factor: 2.5,
    repetitions: 0,
    next_review_date: new Date().toISOString(), // Due now
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: "mock-2",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    timestamp: 120,
    topic: "SM-2 Algorithmic Logic Explained (Mock)",
    interval: 6,
    ease_factor: 2.6,
    repetitions: 2,
    next_review_date: new Date(Date.now() + 86400000).toISOString(), // Due tomorrow
    created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: "mock-3",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    timestamp: 600,
    topic: "n8n Webhook Ingestion Tutorial (Mock)",
    interval: 1,
    ease_factor: 2.3,
    repetitions: 1,
    next_review_date: new Date().toISOString(), // Due now
    created_at: new Date(Date.now() - 86400000 * 1).toISOString()
  }
];

// Load configuration securely from environment variables at build-time
const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || '';

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'vault' | 'add'>('dashboard');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reviewVideoId, setReviewVideoId] = useState<string | null>(null);
  
  // Decide whether to run in Mock Sandbox mode or Live mode
  const isConfigured = isSupabaseConfigured() && n8nWebhookUrl !== '';
  const [useMock, setUseMock] = useState<boolean>(!isConfigured);

  // Ingestion Form State
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [timestamp, setTimestamp] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Notification Toast State
  const [notification, setNotification] = useState<Notification>({
    message: '',
    type: 'info',
    visible: false
  });

  useEffect(() => {
    const isConfiguredEnv = isSupabaseConfigured() && n8nWebhookUrl !== '';
    setUseMock(!isConfiguredEnv);
  }, []);

  // Fetch videos whenever connection mode changes
  useEffect(() => {
    fetchData();
  }, [useMock]);

  // --- NOTIFICATION UTILITY ---
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type, visible: true });
  };

  useEffect(() => {
    if (notification.visible) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification.visible]);

  // --- DATA OPERATIONS ---
  const fetchData = async () => {
    setLoading(true);
    if (useMock) {
      const stored = localStorage.getItem('MOCK_VIDEOS');
      if (stored) {
        try {
          setVideos(JSON.parse(stored));
        } catch (e) {
          setVideos(DEFAULT_MOCK_VIDEOS);
          localStorage.setItem('MOCK_VIDEOS', JSON.stringify(DEFAULT_MOCK_VIDEOS));
        }
      } else {
        setVideos(DEFAULT_MOCK_VIDEOS);
        localStorage.setItem('MOCK_VIDEOS', JSON.stringify(DEFAULT_MOCK_VIDEOS));
      }
      setLoading(false);
    } else {
      // Fetch from Supabase
      const client = getSupabaseClient();
      if (!client) {
        showToast('Supabase client failed to initialize. Reverting to Mock mode.', 'error');
        setUseMock(true);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await client
          .from('video_vault')
          .select('*')
          .order('next_review_date', { ascending: true });

        if (error) throw error;
        setVideos(data || []);
      } catch (err: any) {
        console.error('Fetch error:', err);
        showToast(`Supabase Error: ${err.message || err}`, 'error');
        setUseMock(true);
      } finally {
        setLoading(false);
      }
    }
  };

  // --- INGEST VIDEO ---
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl || !topic) {
      showToast('Video URL and Topic are required', 'error');
      return;
    }

    setSubmitting(true);

    if (useMock) {
      const newVideo: Video = {
        id: `mock-${Date.now()}`,
        video_url: videoUrl,
        timestamp,
        topic,
        interval: 1,
        ease_factor: 2.5,
        repetitions: 0,
        next_review_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const updated = [newVideo, ...videos];
      setVideos(updated);
      localStorage.setItem('MOCK_VIDEOS', JSON.stringify(updated));
      showToast('Mock Video Ingested Successfully!', 'success');
      resetIngestForm();
      setActiveTab('dashboard');
    } else {
      if (!n8nWebhookUrl) {
        showToast('n8n Webhook URL is not configured.', 'error');
        setSubmitting(false);
        return;
      }

      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            video_url: videoUrl,
            topic,
            timestamp
          })
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        
        showToast('Video Sent to n8n Ingestion Webhook!', 'success');
        resetIngestForm();
        // Give n8n a second to write to DB before refreshing
        setTimeout(() => {
          fetchData();
          setActiveTab('dashboard');
        }, 1500);
      } catch (err: any) {
        showToast(`Ingest Failed: ${err.message}`, 'error');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const resetIngestForm = () => {
    setVideoUrl('');
    setTopic('');
    setTimestamp(0);
  };

  // Auto-parse timestamp from YouTube urls
  const handleUrlInput = (url: string) => {
    setVideoUrl(url);
    try {
      const urlObj = new URL(url);
      const t = urlObj.searchParams.get('t');
      if (t) {
        const secondsMatch = t.match(/^(\d+)s?$/);
        if (secondsMatch) {
          setTimestamp(parseInt(secondsMatch[1], 10));
          showToast(`Parsed YouTube timestamp: ${secondsMatch[1]}s`, 'info');
          return;
        }
        
        // Match formats like 20m40s
        const complexMatch = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
        if (complexMatch) {
          const h = parseInt(complexMatch[1] || '0', 10);
          const m = parseInt(complexMatch[2] || '0', 10);
          const s = parseInt(complexMatch[3] || '0', 10);
          const totalSeconds = h * 3600 + m * 60 + s;
          if (totalSeconds > 0) {
            setTimestamp(totalSeconds);
            showToast(`Parsed YouTube timestamp: ${totalSeconds}s`, 'info');
          }
        }
      }
    } catch (e) {
      // Ignore URL parse errors while typing
    }
  };

  // --- RATING / SM-2 CALCULATION ---
  const handleRateVideo = async (video: Video, rating: number) => {
    if (useMock) {
      // Local SM-2 Calculation
      let { interval, repetitions, ease_factor: easeFactor } = video;

      if (rating >= 3) {
        if (repetitions === 0) {
          interval = 1;
        } else if (repetitions === 1) {
          interval = 6;
        } else {
          interval = Math.round(interval * easeFactor);
        }
        repetitions += 1;
      } else {
        repetitions = 0;
        interval = 1;
      }

      easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
      if (easeFactor < 1.3) easeFactor = 1.3;

      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + interval);

      const updatedVideo: Video = {
        ...video,
        interval,
        repetitions,
        ease_factor: parseFloat(easeFactor.toFixed(3)),
        next_review_date: nextReviewDate.toISOString(),
        last_reviewed_at: new Date().toISOString()
      };

      const updatedList = videos.map(v => v.id === video.id ? updatedVideo : v);
      setVideos(updatedList);
      localStorage.setItem('MOCK_VIDEOS', JSON.stringify(updatedList));
      showToast(`Video rated ${rating}! New interval: ${interval} days.`, 'success');
    } else {
      if (!n8nWebhookUrl) {
        showToast('n8n Webhook URL is not configured.', 'error');
        return;
      }

      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rate',
            id: video.id,
            rating
          })
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        
        showToast(`Rating sent! n8n is running SM-2 updates...`, 'success');
        
        // Refresh after short delay
        setTimeout(() => {
          fetchData();
        }, 1500);
      } catch (err: any) {
        showToast(`Rating failed: ${err.message}`, 'error');
      }
    }
    setReviewVideoId(null);
  };

  // --- DELETE VIDEO (Direct Supabase delete or local Mock delete) ---
  const handleDeleteVideo = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this video snippet?')) {
      if (useMock) {
        const updated = videos.filter(v => v.id !== id);
        setVideos(updated);
        localStorage.setItem('MOCK_VIDEOS', JSON.stringify(updated));
        showToast('Mock video deleted.', 'info');
      } else {
        const client = getSupabaseClient();
        if (!client) return;

        try {
          const { error } = await client
            .from('video_vault')
            .delete()
            .eq('id', id);

          if (error) throw error;
          showToast('Video deleted from Supabase.', 'success');
          fetchData();
        } catch (err: any) {
          showToast(`Delete failed: ${err.message}`, 'error');
        }
      }
    }
  };

  // Configuration settings are securely managed via environment variables.

  // --- UTILITIES ---
  const getDueVideos = () => {
    const now = new Date();
    return videos.filter(v => new Date(v.next_review_date) <= now);
  };

  const getEmbedUrl = (url: string, timestamp?: number): string | null => {
    try {
      const cleanUrl = url.trim();
      let videoId: string | null = null;

      // 1. YouTube Shorts check
      if (cleanUrl.includes('/shorts/')) {
        const parts = cleanUrl.split('/shorts/');
        if (parts[1]) {
          videoId = parts[1].split(/[?&#]/)[0];
        }
      }
      
      // 2. YouTube Standard & Share URLs
      if (!videoId) {
        const ytReg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const ytMatch = cleanUrl.match(ytReg);
        if (ytMatch && ytMatch[2] && ytMatch[2].length >= 11) {
          videoId = ytMatch[2].substring(0, 11);
        }
      }

      if (videoId && videoId.length === 11) {
        let embed = `https://www.youtube.com/embed/${videoId}`;
        if (timestamp && timestamp > 0) {
          embed += `?start=${timestamp}`;
        }
        return embed;
      }

      // Vimeo
      const vimeoReg = /vimeo\.com\/(\d+)/;
      const vimeoMatch = cleanUrl.match(vimeoReg);
      if (vimeoMatch) {
        let embed = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        if (timestamp && timestamp > 0) {
          embed += `#t=${timestamp}s`;
        }
        return embed;
      }
    } catch (e) {
      console.error('Error creating embed URL:', e);
    }
    return null;
  };

  const getPlayableUrl = (url: string, timestamp?: number): string => {
    if (!timestamp || timestamp <= 0) return url;
    try {
      const cleanUrl = url.trim();
      if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
        const baseUrl = cleanUrl.replace(/[\?&]t=[^&]*/g, '');
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}t=${timestamp}s`;
      }
      if (cleanUrl.includes('vimeo.com')) {
        const baseUrl = cleanUrl.split('#')[0];
        return `${baseUrl}#t=${timestamp}s`;
      }
    } catch (e) {
      console.error('Error generating playable URL:', e);
    }
    return url;
  };

  const formatTimestamp = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Statistics Computations
  const dueCount = getDueVideos().length;
  const totalCount = videos.length;
  const learningCount = videos.filter(v => v.repetitions < 4).length;
  const graduatedCount = videos.filter(v => v.repetitions >= 4).length;
  
  // Topic Distribution for Charts
  const topicDistribution = videos.reduce((acc: { [key: string]: number }, curr) => {
    acc[curr.topic] = (acc[curr.topic] || 0) + 1;
    return acc;
  }, {});

  const topicChartData = Object.entries(topicDistribution).map(([topic, count]) => ({
    name: topic,
    value: count
  })).slice(0, 5); // top 5

  const maxChartValue = Math.max(...topicChartData.map(d => d.value), 1);

  return (
    <div className="app-container">
      {/* --- MOBILE TOP BAR --- */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={18} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>PocketTube</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: useMock ? 'var(--accent-warning)' : 'var(--accent-success)' }}></div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {useMock ? 'Sandbox' : 'Live'}
          </span>
        </div>
      </div>

      {/* --- SIDEBAR --- */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ background: 'var(--accent-primary)', padding: '0.5rem', borderRadius: '8px', display: 'flex' }}>
            <RefreshCw size={22} className="gradient-text" style={{ color: '#fff' }} />
          </div>
          <div className="sidebar-logo-text">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>PocketTube</h2>
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-secondary)', fontWeight: 600 }}>SM-2 Automated Brain</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', textAlign: 'left', font: 'inherit', width: '100%' }}
          >
            <BarChart3 size={18} />
            <span className="nav-link-text">Dashboard</span>
          </button>
          
          <button 
            onClick={() => { setReviewVideoId(null); setActiveTab('queue'); }} 
            className={`nav-link ${activeTab === 'queue' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', textAlign: 'left', font: 'inherit', width: '100%' }}
          >
            <BookOpen size={18} />
            <span className="nav-link-text">Review Queue</span>
            {dueCount > 0 && (
              <span style={{ marginLeft: 'auto', background: 'var(--accent-danger)', color: '#fff', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '99px', fontWeight: 'bold' }}>
                {dueCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('vault')} 
            className={`nav-link ${activeTab === 'vault' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', textAlign: 'left', font: 'inherit', width: '100%' }}
          >
            <Database size={18} />
            <span className="nav-link-text">Video Vault</span>
          </button>

          <button 
            onClick={() => setActiveTab('add')} 
            className={`nav-link ${activeTab === 'add' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', textAlign: 'left', font: 'inherit', width: '100%' }}
          >
            <Plus size={18} />
            <span className="nav-link-text">Add Video Snippet</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: useMock ? 'var(--accent-warning)' : 'var(--accent-success)' }}></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {useMock ? 'Sandbox (Mock Data)' : 'Live Database Connected'}
            </span>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="main-content">
        
        {/* --- HEADER BAR --- */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 700 }} className="gradient-text">
              {activeTab === 'dashboard' && 'Study Dashboard'}
              {activeTab === 'queue' && 'Curator’s Desk'}
              {activeTab === 'vault' && 'Video Vault'}
              {activeTab === 'add' && 'Ingest Video Snippet'}
            </h1>
            <p className="text-sm">
              {activeTab === 'dashboard' && 'Monitor your progress, review schedules, and learning statistics.'}
              {activeTab === 'queue' && 'Rate your retention to schedule your next review'}
              {activeTab === 'vault' && 'Browse, query, and manage your stored video snippets.'}
              {activeTab === 'add' && 'Send new timestamps and topics to n8n webhook for ingestion.'}
            </p>
          </div>
          
          <button 
            onClick={fetchData} 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 0.75rem' }}
            disabled={loading}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Sync
          </button>
        </header>

        {/* --- DASHBOARD TAB --- */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Stat Cards */}
            <div className="stats-grid">
              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' }}>
                  <Clock size={24} />
                </div>
                <div className="stat-info">
                  <h3>Due Reviews</h3>
                  <div className="stat-number">{dueCount}</div>
                </div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-primary)' }}>
                  <Layers size={24} />
                </div>
                <div className="stat-info">
                  <h3>Total Vault</h3>
                  <div className="stat-number">{totalCount}</div>
                </div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)' }}>
                  <Sparkles size={24} />
                </div>
                <div className="stat-info">
                  <h3>Learning</h3>
                  <div className="stat-number">{learningCount}</div>
                </div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}>
                  <Award size={24} />
                </div>
                <div className="stat-info">
                  <h3>Graduated</h3>
                  <div className="stat-number">{graduatedCount}</div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Topic Charts */}
            <div className="dashboard-grid">
              
              {/* Due Next Preview */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={18} style={{ color: 'var(--accent-primary)' }} />
                  Upcoming Queue ({dueCount} Due Now)
                </h3>
                {dueCount > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {getDueVideos().slice(0, 3).map(video => (
                      <div 
                        key={video.id} 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                      >
                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{video.topic}</h4>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                            <span className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={12} />
                              At: {formatTimestamp(video.timestamp)}
                            </span>
                            <span className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <RefreshCw size={12} />
                              Interval: {video.interval}d
                            </span>
                          </div>
                        </div>
                        <button onClick={() => setActiveTab('queue')} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                          Start Review
                        </button>
                      </div>
                    ))}
                    {dueCount > 3 && (
                      <button onClick={() => setActiveTab('queue')} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.9rem' }}>
                        View remaining {dueCount - 3} items
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)', padding: '1rem', borderRadius: '50%' }}>
                      <CheckCircle2 size={36} />
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 600 }}>Review Queue Clear!</h4>
                      <p className="text-sm" style={{ marginTop: '0.25rem' }}>You have completed all scheduled reviews for today. Great work!</p>
                    </div>
                    <button onClick={() => setActiveTab('add')} className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>
                      <Plus size={16} /> Ingest New Video
                    </button>
                  </div>
                )}
              </div>

              {/* Chart Panel */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart3 size={18} style={{ color: 'var(--accent-secondary)' }} />
                  Top Topics
                </h3>
                {topicChartData.length > 0 ? (
                  <div className="chart-container">
                    {topicChartData.map((data, index) => {
                      const percentage = (data.value / maxChartValue) * 100;
                      return (
                        <div key={index} className="chart-bar-wrapper">
                          <div 
                            className="chart-bar" 
                            style={{ 
                              height: `${percentage}%`,
                              background: index === 0 ? 'var(--accent-primary)' : 'var(--accent-secondary)'
                            }}
                          >
                            <div className="chart-tooltip">
                              {data.name}: {data.value}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', width: '45px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.5rem' }}>
                            {data.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 1rem' }}>
                    No topics loaded. Add a video snippet to render chart.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* --- REVIEW QUEUE TAB --- */}
        {activeTab === 'queue' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '5rem 0' }}>
                <RefreshCw size={36} className="gradient-text" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                <p>Retrieving your learning list...</p>
              </div>
            ) : (getDueVideos().length > 0 || reviewVideoId) ? (
              (() => {
                const currentVideo = reviewVideoId 
                  ? videos.find(v => v.id === reviewVideoId) || getDueVideos()[0]
                  : getDueVideos()[0];
                const embedUrl = getEmbedUrl(currentVideo.video_url, currentVideo.timestamp);

                return (
                  <div className="review-grid">
                    {/* Left Column: Embed Player */}
                    <div>
                      <div className="glass-panel" style={{ padding: '1.25rem' }}>
                        {embedUrl ? (
                          <div className="video-player-container">
                            <iframe 
                              src={embedUrl}
                              title={currentVideo.topic} 
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                              allowFullScreen
                            ></iframe>
                          </div>
                        ) : (
                          <div className="video-player-container">
                            <div className="video-player-fallback">
                              <AlertCircle size={48} style={{ color: 'var(--accent-warning)', marginBottom: '1rem' }} />
                              <h4>External Video Link</h4>
                              <p className="text-sm" style={{ margin: '0.5rem 0 1.5rem' }}>This URL format cannot be embedded directly. Open it in a new window to watch, then rate your recall below.</p>
                              <a href={getPlayableUrl(currentVideo.video_url, currentVideo.timestamp)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                <ExternalLink size={16} /> Open Video
                              </a>
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1.25rem' }}>{currentVideo.topic}</h3>
                            <a href={getPlayableUrl(currentVideo.video_url, currentVideo.timestamp)} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', textDecoration: 'none' }}>
                              Original URL <ExternalLink size={12} />
                            </a>
                          </div>
                          <div style={{ background: 'var(--bg-tertiary)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'right' }}>
                            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', color: 'var(--text-muted)' }}>Timestamp</span>
                            <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{formatTimestamp(currentVideo.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: SM-2 Action Panel */}
                    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>SM-2 Evaluation</h3>
                        
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '1.5rem' }}>
                          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={14} style={{ color: 'var(--accent-primary)' }} /> Current Metrics
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', fontSize: '0.8rem' }}>
                            <div style={{ background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '6px' }}>
                              <span style={{ display: 'block', color: 'var(--text-secondary)' }}>Interval</span>
                              <strong style={{ fontSize: '1rem', color: 'var(--accent-secondary)' }}>{currentVideo.interval}d</strong>
                            </div>
                            <div style={{ background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '6px' }}>
                              <span style={{ display: 'block', color: 'var(--text-secondary)' }}>Repetitions</span>
                              <strong style={{ fontSize: '1rem', color: 'var(--accent-success)' }}>{currentVideo.repetitions}</strong>
                            </div>
                            <div style={{ background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '6px' }}>
                              <span style={{ display: 'block', color: 'var(--text-secondary)' }}>Ease Factor</span>
                              <strong style={{ fontSize: '1rem', color: 'var(--accent-warning)' }}>{currentVideo.ease_factor}</strong>
                            </div>
                          </div>
                        </div>

                        <p className="text-sm" style={{ marginBottom: '1rem' }}>
                          Rate your understanding of this topic: How easily did you recall the key insights from this timestamp?
                        </p>

                        <div className="rating-grid">
                          <button onClick={() => handleRateVideo(currentVideo, 0)} className="rating-btn rating-btn-0">
                            <span className="score">0</span>
                            <span className="label">Forgot</span>
                          </button>
                          <button onClick={() => handleRateVideo(currentVideo, 1)} className="rating-btn rating-btn-1">
                            <span className="score">1</span>
                            <span className="label">Wrong</span>
                          </button>
                          <button onClick={() => handleRateVideo(currentVideo, 2)} className="rating-btn rating-btn-2">
                            <span className="score">2</span>
                            <span className="label">Struggled</span>
                          </button>
                          <button onClick={() => handleRateVideo(currentVideo, 3)} className="rating-btn rating-btn-3">
                            <span className="score">3</span>
                            <span className="label">Difficult</span>
                          </button>
                          <button onClick={() => handleRateVideo(currentVideo, 4)} className="rating-btn rating-btn-4">
                            <span className="score">4</span>
                            <span className="label">Good</span>
                          </button>
                          <button onClick={() => handleRateVideo(currentVideo, 5)} className="rating-btn rating-btn-5">
                            <span className="score">5</span>
                            <span className="label">Perfect</span>
                          </button>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={() => handleDeleteVideo(currentVideo.id)} className="btn btn-danger" style={{ padding: '0.5rem 1rem' }}>
                          <Trash2 size={16} /> Delete
                        </button>
                        <span className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center' }}>
                          1 of {dueCount} items due
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '5rem 2rem', maxWidth: '400px', margin: '0 auto' }}>
                <div style={{ display: 'inline-flex', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                  <CheckCircle2 size={48} />
                </div>
                <h2>Queue Complete!</h2>
                <p className="text-sm" style={{ margin: '0.5rem 0 2rem' }}>You have no due videos to review right now. Add new video timestamps or check the Settings tab to sync with Supabase.</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button onClick={() => setActiveTab('add')} className="btn btn-primary">
                    <Plus size={16} /> Add Video
                  </button>
                  <button onClick={() => setActiveTab('vault')} className="btn btn-secondary">
                    <Database size={16} /> View Vault
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- VIDEO VAULT TAB --- */}
        {activeTab === 'vault' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Snippet Inventory ({videos.length} Stored)</h3>
              <button onClick={() => setActiveTab('add')} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                <Plus size={16} /> New Snippet
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
                <p>Loading database...</p>
              </div>
            ) : videos.length > 0 ? (
              <div className="vault-table-container">
                <table className="vault-table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Video URL</th>
                      <th>Timestamp</th>
                      <th>SM-2 Stats (I / R / E)</th>
                      <th>Next Review</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map(video => {
                      const isDue = new Date(video.next_review_date) <= new Date();
                      
                      return (
                        <tr key={video.id}>
                          <td style={{ fontWeight: 600 }}>{video.topic}</td>
                          <td>
                            <a href={video.video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {video.video_url} <ExternalLink size={12} />
                            </a>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatTimestamp(video.timestamp)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
                              <span style={{ background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }} title="Interval">I: {video.interval}d</span>
                              <span style={{ background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }} title="Repetitions">R: {video.repetitions}</span>
                              <span style={{ background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }} title="Ease Factor">E: {video.ease_factor}</span>
                            </div>
                          </td>
                          <td>
                            {isDue ? (
                              <span className="badge badge-due">Due Now</span>
                            ) : (
                              <span className="text-sm">{formatDate(video.next_review_date)}</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                onClick={() => {
                                  // Set this video as currently focused for review
                                  setReviewVideoId(video.id);
                                  // Jump to Review Queue and set this video as due immediately
                                  const updated = videos.map(v => v.id === video.id ? { ...v, next_review_date: new Date().toISOString() } : v);
                                  setVideos(updated);
                                  if (useMock) localStorage.setItem('MOCK_VIDEOS', JSON.stringify(updated));
                                  setActiveTab('queue');
                                }}
                                className="btn btn-secondary" 
                                style={{ padding: '0.35rem', borderRadius: '6px' }}
                                title="Study Now"
                              >
                                <Play size={14} style={{ color: 'var(--accent-success)' }} />
                              </button>
                              <button 
                                onClick={() => handleDeleteVideo(video.id)} 
                                className="btn btn-secondary" 
                                style={{ padding: '0.35rem', borderRadius: '6px' }}
                                title="Delete"
                              >
                                <Trash2 size={14} style={{ color: 'var(--accent-danger)' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem' }}>
                No video snippets stored. Ingest one to get started!
              </div>
            )}
          </div>
        )}

        {/* --- ADD VIDEO TAB --- */}
        {activeTab === 'add' && (
          <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Send to n8n Ingest Webhook</h3>
            
            <form onSubmit={handleIngest}>
              <div className="form-group">
                <label className="form-label">Video URL</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://www.youtube.com/watch?v=..." 
                  value={videoUrl}
                  onChange={(e) => handleUrlInput(e.target.value)}
                  required 
                />
                <span className="text-sm text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                  Supports YouTube and Vimeo URLs. Timestamps like `&t=300s` are auto-detected.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Topic / Heading</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Thermodynamics: Rankine Cycle" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Start Timestamp (in Seconds)</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="0"
                    placeholder="e.g. 1240" 
                    value={timestamp || ''}
                    onChange={(e) => setTimestamp(parseInt(e.target.value, 10) || 0)}
                  />
                  <span style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '0.9rem', width: '100px' }}>
                    = {formatTimestamp(timestamp)}
                  </span>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '1rem' }}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Sending to Webhook...
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Ingest Snippet
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Settings tab removed for production security */}

      </main>

      {/* --- TOAST NOTIFICATION BANNER --- */}
      {notification.visible && (
        <div 
          className="notification-banner"
          style={{
            background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.9)' :
                        notification.type === 'error' ? 'rgba(239, 68, 68, 0.9)' :
                        'rgba(124, 58, 237, 0.9)',
            border: `1px solid ${
              notification.type === 'success' ? 'var(--accent-success)' :
              notification.type === 'error' ? 'var(--accent-danger)' :
              'var(--accent-primary)'
            }`,
            backdropFilter: 'blur(8px)',
            color: '#fff',
            fontWeight: 500
          }}
        >
          {notification.type === 'success' && <CheckCircle2 size={18} />}
          {notification.type === 'error' && <AlertCircle size={18} />}
          {notification.type === 'info' && <Sparkles size={18} />}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
}
