import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      console.log('Not authenticated');
    } finally {
      setLoading(false);
    }
  };

  const login = (sessionToken, userData) => {
    document.cookie = `session_token=${sessionToken}; max-age=604800; path=/`;
    setUser(userData);
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
    document.cookie = 'session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Auth Modal Components
const AuthModal = ({ isOpen, onClose, type }) => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1];
        handleAuthCallback(sessionId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Check on mount

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAuthCallback = async (sessionId) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/profile`, {
        session_id: sessionId
      });
      
      login(response.data.session_token, response.data.user);
      window.location.hash = '';
      onClose();
    } catch (error) {
      console.error('Auth error:', error);
      alert('Giriş yapılırken hata oluştu. Lütfen tekrar deneyiniz.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthRedirect = () => {
    const redirectUrl = window.location.origin + '/profile';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {type === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600 text-center">
            {type === 'login' 
              ? 'ÇizgiHub\'a giriş yapmak için aşağıdaki butona tıklayın.'
              : 'ÇizgiHub\'a kayıt olmak için aşağıdaki butona tıklayın.'
            }
          </p>

          <button
            onClick={handleAuthRedirect}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Yükleniyor...' : (type === 'login' ? 'Giriş Yap' : 'Kayıt Ol')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Landing Page Component
const LandingPage = () => {
  const [authModal, setAuthModal] = useState({ isOpen: false, type: 'login' });

  const openAuthModal = (type) => {
    setAuthModal({ isOpen: true, type });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false, type: 'login' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900">
      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6">
        <div className="flex items-center">
          <h1 className="text-3xl font-bold text-white">ÇizgiHub</h1>
        </div>
        <div className="space-x-4">
          <button
            onClick={() => openAuthModal('login')}
            className="bg-transparent border-2 border-white text-white px-6 py-2 rounded-lg hover:bg-white hover:text-purple-900 transition duration-200"
          >
            Giriş Yap
          </button>
          <button
            onClick={() => openAuthModal('register')}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition duration-200"
          >
            Kayıt Ol
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Türkiye'nin En Büyük
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">
              {' '}Çizgi Film{' '}
            </span>
            Platformu
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Reklamsız akış, Full HD kalite, Türkçe altyazı desteği ve daha fazlasıyla 
            sevdiğiniz çizgi filmleri ve animeleri izleyin.
          </p>
          <button
            onClick={() => openAuthModal('register')}
            className="bg-gradient-to-r from-pink-500 to-violet-500 text-white text-xl px-8 py-4 rounded-lg hover:from-pink-600 hover:to-violet-600 transition duration-200"
          >
            Hemen Başla
          </button>
        </div>

        {/* Hero Images */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <img 
            src="https://images.unsplash.com/photo-1613336116818-b83da0180161" 
            alt="Çizgi Film Karakterleri"
            className="rounded-lg shadow-lg hover:scale-105 transition duration-200"
          />
          <img 
            src="https://images.unsplash.com/photo-1668119064420-fb738fb05e32" 
            alt="Anime Karakterleri"
            className="rounded-lg shadow-lg hover:scale-105 transition duration-200"
          />
          <img 
            src="https://images.unsplash.com/flagged/photo-1572491259205-506c425b45c3" 
            alt="Anime Kız"
            className="rounded-lg shadow-lg hover:scale-105 transition duration-200"
          />
          <img 
            src="https://images.unsplash.com/photo-1668119065964-8e78fddc5dfe" 
            alt="Koleksiyon"
            className="rounded-lg shadow-lg hover:scale-105 transition duration-200"
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 bg-black bg-opacity-50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-4xl font-bold text-white text-center mb-16">Neden ÇizgiHub?</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-purple-800 bg-opacity-50 rounded-lg">
              <div className="text-5xl mb-4">🎬</div>
              <h4 className="text-2xl font-bold text-white mb-4">Reklamsız İzleme</h4>
              <p className="text-gray-300">Hiçbir reklamla bölünmeden sevdiğiniz içerikleri izleyin.</p>
            </div>
            <div className="text-center p-6 bg-purple-800 bg-opacity-50 rounded-lg">
              <div className="text-5xl mb-4">🎯</div>
              <h4 className="text-2xl font-bold text-white mb-4">Full HD Kalite</h4>
              <p className="text-gray-300">Tüm içerikler Full HD kalitesinde sunuluyor.</p>
            </div>
            <div className="text-center p-6 bg-purple-800 bg-opacity-50 rounded-lg">
              <div className="text-5xl mb-4">💬</div>
              <h4 className="text-2xl font-bold text-white mb-4">Türkçe Altyazı</h4>
              <p className="text-gray-300">Tüm içerikler Türkçe altyazıyla destekleniyor.</p>
            </div>
            <div className="text-center p-6 bg-purple-800 bg-opacity-50 rounded-lg">
              <div className="text-5xl mb-4">⭐</div>
              <h4 className="text-2xl font-bold text-white mb-4">Kullanıcı Puanları</h4>
              <p className="text-gray-300">Diğer kullanıcıların puanlarına göre içerik keşfedin.</p>
            </div>
            <div className="text-center p-6 bg-purple-800 bg-opacity-50 rounded-lg">
              <div className="text-5xl mb-4">🛡️</div>
              <h4 className="text-2xl font-bold text-white mb-4">Spoiler Koruması</h4>
              <p className="text-gray-300">Spoiler içeren yorumlar gizlenerek gösteriliyor.</p>
            </div>
            <div className="text-center p-6 bg-purple-800 bg-opacity-50 rounded-lg">
              <div className="text-5xl mb-4">🎭</div>
              <h4 className="text-2xl font-bold text-white mb-4">Çeşitli Kategoriler</h4>
              <p className="text-gray-300">Anime, Aksiyon, Komedi, Korku ve daha fazlası.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-4xl font-bold text-white text-center mb-16">Popüler Kategoriler</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Anime', 'Aksiyon', 'Komedi', 'Bilim Kurgu', 'Korku', 'Spor', 'Gerilim', 'Çocuk'].map((category) => (
              <div key={category} className="bg-gradient-to-r from-pink-500 to-violet-500 p-4 rounded-lg text-center cursor-pointer hover:scale-105 transition duration-200">
                <span className="text-white font-bold text-lg">{category}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AuthModal 
        isOpen={authModal.isOpen} 
        onClose={closeAuthModal} 
        type={authModal.type} 
      />
    </div>
  );
};

// Main App Content
const MainContent = () => {
  const { user, logout } = useAuth();
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadShows();
      initializeData();
    }
  }, [user]);

  const initializeData = async () => {
    try {
      await axios.post(`${API}/admin/init-data`, {}, { withCredentials: true });
    } catch (error) {
      console.log('Data already initialized or error:', error);
    }
  };

  const loadShows = async () => {
    try {
      const response = await axios.get(`${API}/shows`, { withCredentials: true });
      setShows(response.data);
    } catch (error) {
      console.error('Error loading shows:', error);
    }
  };

  const loadShow = async (showId) => {
    try {
      const response = await axios.get(`${API}/shows/${showId}`, { withCredentials: true });
      setSelectedShow(response.data);
      setSelectedSeason(null);
      setSelectedEpisode(null);
    } catch (error) {
      console.error('Error loading show:', error);
    }
  };

  const loadEpisodes = async (season) => {
    try {
      const response = await axios.get(`${API}/seasons/${season.id}/episodes`, { withCredentials: true });
      setSelectedSeason({ ...season, episodes: response.data });
      setSelectedEpisode(null);
    } catch (error) {
      console.error('Error loading episodes:', error);
    }
  };

  const loadEpisode = async (episode) => {
    try {
      const [episodeResponse, commentsResponse] = await Promise.all([
        axios.get(`${API}/episodes/${episode.id}`, { withCredentials: true }),
        axios.get(`${API}/episodes/${episode.id}/comments`, { withCredentials: true })
      ]);
      setSelectedEpisode(episodeResponse.data);
      setComments(commentsResponse.data);
    } catch (error) {
      console.error('Error loading episode:', error);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      await axios.post(`${API}/comments`, {
        episode_id: selectedEpisode.id,
        content: newComment,
        is_spoiler: isSpoiler
      }, { withCredentials: true });
      
      // Reload comments
      const response = await axios.get(`${API}/episodes/${selectedEpisode.id}/comments`, { withCredentials: true });
      setComments(response.data);
      setNewComment('');
      setIsSpoiler(false);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const deleteComment = async (commentId) => {
    if (!user.is_admin) return;

    try {
      await axios.delete(`${API}/admin/comments/${commentId}`, { withCredentials: true });
      setComments(comments.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Show selector
  if (!selectedShow) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 p-6">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">ÇizgiHub</h1>
          <div className="flex items-center space-x-4">
            <span className="text-white">Hoş geldin, {user.name}</span>
            {user.is_admin && <span className="bg-red-500 text-white px-2 py-1 rounded text-sm">Admin</span>}
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Çıkış
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">Popüler Diziler</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {shows.map((show) => (
              <div key={show.id} className="bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition duration-200" onClick={() => loadShow(show.id)}>
                <img src={show.poster_url} alt={show.title} className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h3 className="text-white font-bold text-lg mb-2">{show.title}</h3>
                  <p className="text-gray-400 text-sm mb-2">{show.genre} • {show.year}</p>
                  <p className="text-gray-300 text-sm line-clamp-3">{show.description}</p>
                  <div className="mt-2 flex items-center">
                    <span className="text-yellow-400">⭐</span>
                    <span className="text-white ml-1">{show.rating}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Episode player
  if (selectedEpisode) {
    return (
      <div className="min-h-screen bg-black">
        <header className="flex justify-between items-center p-4 bg-gray-900">
          <button
            onClick={() => setSelectedEpisode(null)}
            className="text-white hover:text-gray-300"
          >
            ← Geri Dön
          </button>
          <h1 className="text-white font-bold">{selectedEpisode.title}</h1>
          <button
            onClick={logout}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Çıkış
          </button>
        </header>

        <div className="max-w-6xl mx-auto p-4">
          {/* Video Player */}
          <div className="mb-8">
            <video 
              className="w-full h-96 bg-black rounded-lg"
              controls
              poster={selectedEpisode.thumbnail_url}
            >
              <source src={selectedEpisode.video_url} type="video/mp4" />
              <track kind="subtitles" src="" label="Türkçe" srcLang="tr" />
              Tarayıcınız video etiketini desteklemiyor.
            </video>
            <div className="mt-4">
              <h2 className="text-2xl font-bold text-white">{selectedEpisode.title}</h2>
              <p className="text-gray-400">{selectedEpisode.description}</p>
              <p className="text-gray-500 text-sm mt-2">Süre: {selectedEpisode.duration}</p>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">Yorumlar</h3>
            
            {/* Add Comment */}
            <div className="mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Yorumunuzu yazın..."
                className="w-full p-3 bg-gray-700 text-white rounded-lg resize-none"
                rows="3"
              />
              <div className="flex justify-between items-center mt-2">
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={isSpoiler}
                    onChange={(e) => setIsSpoiler(e.target.checked)}
                    className="mr-2"
                  />
                  Spoiler içerir
                </label>
                <button
                  onClick={addComment}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                >
                  Yorum Ekle
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-gray-700 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-white">{comment.user_name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400 text-sm">
                        {new Date(comment.created_at).toLocaleDateString('tr-TR')}
                      </span>
                      {user.is_admin && (
                        <button
                          onClick={() => deleteComment(comment.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  </div>
                  {comment.is_spoiler ? (
                    <SpoilerComment content={comment.content} />
                  ) : (
                    <p className="text-gray-300">{comment.content}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Season/Episode selector
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 p-6">
      <header className="flex justify-between items-center mb-8">
        <button
          onClick={() => setSelectedShow(null)}
          className="text-white hover:text-gray-300"
        >
          ← Ana Sayfa
        </button>
        <button
          onClick={logout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Çıkış
        </button>
      </header>

      <div className="max-w-6xl mx-auto">
        {/* Show Details */}
        <div className="mb-8 bg-gray-800 rounded-lg overflow-hidden">
          <img src={selectedShow.show.banner_url} alt={selectedShow.show.title} className="w-full h-64 object-cover" />
          <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-2">{selectedShow.show.title}</h1>
            <p className="text-gray-400 mb-4">{selectedShow.show.genre} • {selectedShow.show.year} • ⭐ {selectedShow.show.rating}</p>
            <p className="text-gray-300">{selectedShow.show.description}</p>
          </div>
        </div>

        {/* Seasons */}
        <div className="grid md:grid-cols-2 gap-6">
          {selectedShow.seasons.map((season) => (
            <div key={season.id} className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">{season.title}</h2>
              <p className="text-gray-400 mb-4">{season.episode_count} bölüm</p>
              <button
                onClick={() => loadEpisodes(season)}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                Bölümleri Göster
              </button>

              {selectedSeason && selectedSeason.id === season.id && (
                <div className="mt-6 space-y-2">
                  {selectedSeason.episodes.map((episode) => (
                    <div
                      key={episode.id}
                      onClick={() => loadEpisode(episode)}
                      className="bg-gray-700 p-4 rounded cursor-pointer hover:bg-gray-600 transition duration-200"
                    >
                      <h3 className="text-white font-bold">{episode.title}</h3>
                      <p className="text-gray-400 text-sm">{episode.description}</p>
                      <p className="text-gray-500 text-xs mt-1">Süre: {episode.duration}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Spoiler Comment Component
const SpoilerComment = ({ content }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      {!revealed ? (
        <div className="bg-gray-600 p-3 rounded cursor-pointer" onClick={() => setRevealed(true)}>
          <p className="text-center text-gray-300">🚫 Spoiler içerir - görmek için tıklayın</p>
        </div>
      ) : (
        <p className="text-gray-300">{content}</p>
      )}
    </div>
  );
};

// Profile Page Component (for auth callback)
const ProfilePage = () => {
  const { checkAuth } = useAuth();

  useEffect(() => {
    // Handle auth callback
    const handleAuth = async () => {
      await checkAuth();
      window.location.href = '/';
    };

    handleAuth();
  }, [checkAuth]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mb-4 mx-auto"></div>
        <p className="text-xl">Giriş yapılıyor...</p>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <AuthProvider>
      <div className="App">
        <AuthContent currentPath={currentPath} />
      </div>
    </AuthProvider>
  );
}

const AuthContent = ({ currentPath }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mb-4 mx-auto"></div>
          <p className="text-xl">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (currentPath === '/profile') {
    return <ProfilePage />;
  }

  if (!user) {
    return <LandingPage />;
  }

  return <MainContent />;
};

export default App;