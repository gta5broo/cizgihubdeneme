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
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openAuthModal = (type) => {
    setAuthModal({ isOpen: true, type });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false, type: 'login' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
        <div className="floating-shape shape-4"></div>
        <div className="floating-shape shape-5"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 backdrop-blur-sm bg-black/20 border-b border-gray-700/30">
        <div className="flex items-center">
          <h1 className="text-3xl font-bold text-white logo-glow-dark">ÇizgiHub</h1>
        </div>
        <div className="space-x-4 flex items-center">
          <button
            onClick={() => openAuthModal('login')}
            className="group relative overflow-hidden bg-transparent border-2 border-gray-500 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:border-gray-300 hover:shadow-lg hover:shadow-gray-400/25 backdrop-blur-sm"
          >
            <span className="relative z-10">Giriş Yap</span>
            <div className="absolute inset-0 bg-gray-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          </button>
          <button
            onClick={() => openAuthModal('register')}
            className="group relative overflow-hidden bg-gradient-to-r from-gray-700 to-gray-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:from-gray-600 hover:to-gray-500 hover:shadow-xl hover:shadow-gray-500/50 hover:scale-105"
          >
            <span className="relative z-10">Kayıt Ol</span>
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 py-20 text-center">
        <div className="max-w-6xl mx-auto">
          <div 
            className="transform transition-transform duration-1000 ease-out"
            style={{ transform: `translateY(${scrollY * 0.2}px)` }}
          >
            <div className="mb-8">
              <div className="inline-block p-3 rounded-full bg-gradient-to-r from-gray-700/50 to-gray-600/50 backdrop-blur-sm border border-gray-500/30 mb-6">
                <span className="text-gray-300 text-sm font-medium">🎬 Türkiye'nin Yeni Nesil Streaming Platformu</span>
              </div>
            </div>
            
            <h2 className="text-6xl md:text-8xl font-extrabold text-white mb-8 leading-tight">
              <span className="block mb-4">Hayal Gücünün</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-300 via-gray-200 to-white animate-gradient-x">
                Sınırsız Dünyası
              </span>
            </h2>
            
            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
              Premium çizgi filmler ve animeler, kristal berraklığında görüntü kalitesi, 
              Türkçe altyazı desteği ile <span className="text-gray-200 font-semibold">tamamen reklamsız</span> deneyim.
            </p>
            
            <div className="space-y-4 md:space-y-0 md:space-x-6 md:flex md:justify-center">
              <button
                onClick={() => openAuthModal('register')}
                className="group relative inline-flex items-center justify-center px-10 py-5 text-xl font-bold text-white bg-gradient-to-r from-gray-700 to-gray-600 rounded-2xl overflow-hidden transition-all duration-300 hover:from-gray-600 hover:to-gray-500 hover:shadow-2xl hover:shadow-gray-600/50 hover:scale-105"
              >
                <span className="relative z-10 flex items-center">
                  Hemen Başla
                  <svg className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
              
              <button
                className="group relative inline-flex items-center justify-center px-10 py-5 text-xl font-bold text-white bg-black/30 backdrop-blur-sm border-2 border-gray-600 rounded-2xl overflow-hidden transition-all duration-300 hover:bg-black/50 hover:border-gray-400 hover:shadow-xl"
              >
                <span className="relative z-10 flex items-center">
                  Önizleme İzle
                  <svg className="ml-2 w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Hero Images with Advanced Animations */}
        <div className="mt-20 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { src: "https://images.unsplash.com/photo-1613336116818-b83da0180161", alt: "Çizgi Film Karakterleri", delay: "0s" },
              { src: "https://images.unsplash.com/photo-1668119064420-fb738fb05e32", alt: "Anime Karakterleri", delay: "0.2s" },
              { src: "https://images.unsplash.com/flagged/photo-1572491259205-506c425b45c3", alt: "Anime Kız", delay: "0.4s" },
              { src: "https://images.unsplash.com/photo-1668119065964-8e78fddc5dfe", alt: "Koleksiyon", delay: "0.6s" }
            ].map((image, index) => (
              <div
                key={index}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800/30 to-gray-700/30 backdrop-blur-sm border border-gray-600/30 hover:border-gray-500/50 transition-all duration-500 animate-fade-in-up"
                style={{ animationDelay: image.delay }}
              >
                <img 
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-semibold text-sm">{image.alt}</p>
                  </div>
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-gray-600 to-gray-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
              </div>
            ))}
          </div>
          
          {/* Floating Elements */}
          <div className="absolute top-10 left-10 text-4xl opacity-20 animate-bounce" style={{ animationDelay: '1s' }}>🎭</div>
          <div className="absolute top-20 right-20 text-3xl opacity-20 animate-bounce" style={{ animationDelay: '1.5s' }}>🎬</div>
          <div className="absolute bottom-10 left-20 text-5xl opacity-20 animate-bounce" style={{ animationDelay: '2s' }}>⭐</div>
        </div>
      </section>

      {/* Premium Features Section */}
      <section className="relative px-6 py-32 bg-gradient-to-r from-indigo-950/90 to-purple-950/90 backdrop-blur-sm border-y border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-block p-3 rounded-full bg-gradient-to-r from-pink-500/20 to-violet-500/20 backdrop-blur-sm border border-white/20 mb-6">
              <span className="text-white text-sm font-medium">✨ Premium Özellikler</span>
            </div>
            <h3 className="text-5xl font-extrabold text-white mb-6">
              Neden 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-violet-400"> ÇizgiHub?</span>
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Teknoloji ve eğlenceyi bir araya getiren benzersiz deneyim
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "🎬", title: "Reklamsız İzleme", desc: "Hiçbir reklamla bölünmeden sevdiğiniz içerikleri kesintisiz izleyin.", gradient: "from-pink-500 to-rose-500" },
              { icon: "🎯", title: "4K Ultra HD", desc: "Kristal berraklığında görüntü kalitesi ile sinema deneyimi yaşayın.", gradient: "from-violet-500 to-purple-500" },
              { icon: "💬", title: "Türkçe Altyazı", desc: "Profesyonel çeviri ile tüm içerikler Türkçe altyazı desteğiyle.", gradient: "from-indigo-500 to-blue-500" },
              { icon: "⭐", title: "Akıllı Öneriler", desc: "AI destekli öneri sistemi ile size özel içerik keşfetme deneyimi.", gradient: "from-pink-500 to-violet-500" },
              { icon: "🛡️", title: "Spoiler Koruması", desc: "Gelişmiş spoiler filtreleme sistemi ile güvenli yorum deneyimi.", gradient: "from-violet-500 to-indigo-500" },
              { icon: "🌟", title: "Çoklu Dil Seçeneği", desc: "İngilizce, Japonca ve Türkçe ses seçenekleri mevcut.", gradient: "from-indigo-500 to-purple-500" }
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative overflow-hidden p-8 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 hover:border-white/30 transition-all duration-500 hover:scale-105 animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.gradient} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <span className="text-3xl">{feature.icon}</span>
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-4 group-hover:text-pink-300 transition-colors duration-300">
                    {feature.title}
                  </h4>
                  <p className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                    {feature.desc}
                  </p>
                </div>
                <div className={`absolute -inset-1 bg-gradient-to-r ${feature.gradient} rounded-3xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Stats Section */}
      <section className="relative px-6 py-20 bg-gradient-to-br from-purple-950/80 to-indigo-950/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: "10K+", label: "Aktif Kullanıcı", icon: "👥" },
              { number: "500+", label: "Premium İçerik", icon: "🎬" },
              { number: "99.9%", label: "Uptime Garantisi", icon: "⚡" },
              { number: "7/24", label: "Teknik Destek", icon: "🛠️" }
            ].map((stat, index) => (
              <div key={index} className="group cursor-pointer">
                <div className="relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-105">
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
                    {stat.icon}
                  </div>
                  <div className="text-4xl font-bold text-white mb-2 group-hover:text-pink-400 transition-colors duration-300">
                    {stat.number}
                  </div>
                  <div className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modern Categories Grid */}
      <section className="relative px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-block p-3 rounded-full bg-gradient-to-r from-pink-500/20 to-violet-500/20 backdrop-blur-sm border border-white/20 mb-6">
              <span className="text-white text-sm font-medium">🎭 İçerik Kategorileri</span>
            </div>
            <h3 className="text-5xl font-extrabold text-white mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-violet-400">
                Sınırsız Kategori
              </span>
              <br />Sınırsız Eğlence
            </h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'Anime', emoji: '🎌', color: 'from-red-500 to-pink-500' },
              { name: 'Aksiyon', emoji: '⚡', color: 'from-orange-500 to-red-500' },
              { name: 'Komedi', emoji: '😂', color: 'from-yellow-500 to-orange-500' },
              { name: 'Bilim Kurgu', emoji: '🚀', color: 'from-blue-500 to-indigo-500' },
              { name: 'Korku', emoji: '👻', color: 'from-purple-500 to-indigo-500' },
              { name: 'Spor', emoji: '⚽', color: 'from-green-500 to-blue-500' },
              { name: 'Gerilim', emoji: '🔥', color: 'from-red-500 to-purple-500' },
              { name: 'Çocuk', emoji: '🧸', color: 'from-pink-500 to-violet-500' }
            ].map((category, index) => (
              <div
                key={category.name}
                className="group relative overflow-hidden p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/30 cursor-pointer transition-all duration-500 hover:scale-105 animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-20 transition-opacity duration-300`}></div>
                <div className="relative z-10 text-center">
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
                    {category.emoji}
                  </div>
                  <span className="text-white font-bold text-lg group-hover:text-pink-300 transition-colors duration-300">
                    {category.name}
                  </span>
                </div>
                <div className={`absolute -inset-1 bg-gradient-to-r ${category.color} rounded-2xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-500`}></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="relative px-6 py-32 bg-gradient-to-r from-pink-900/30 to-violet-900/30 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="text-6xl mb-6">🎬</div>
            <h3 className="text-5xl font-extrabold text-white mb-6">
              Hayal Dünyasına
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-violet-400">
                Adım Atın
              </span>
            </h3>
            <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
              Milyonlarca saatlik premium içerik, reklamsız deneyim ve Türkçe altyazı ile 
              eğlence dünyasının kapılarını aralayın.
            </p>
          </div>
          
          <div className="space-y-6 md:space-y-0 md:space-x-6 md:flex md:justify-center">
            <button
              onClick={() => openAuthModal('register')}
              className="group relative inline-flex items-center justify-center px-12 py-6 text-xl font-bold text-white bg-gradient-to-r from-pink-500 to-violet-500 rounded-2xl overflow-hidden transition-all duration-300 hover:from-pink-600 hover:to-violet-600 hover:shadow-2xl hover:shadow-violet-500/50 hover:scale-105"
            >
              <span className="relative z-10 flex items-center">
                Ücretsiz Hesap Oluştur
                <svg className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-violet-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
          
          <div className="mt-8 text-gray-400 text-sm">
            ✨ Kredi kartı gerektirmez • 🚫 Reklam yok • 📱 Tüm cihazlarda çalışır
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