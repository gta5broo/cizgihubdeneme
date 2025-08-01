from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import requests
import secrets
import hashlib
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import random
import re
from passlib.context import CryptContext
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Password encryption
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()

# Add session middleware for auth
app.add_middleware(SessionMiddleware, secret_key=secrets.token_urlsafe(32))

# Create API router
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    is_admin: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Show(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    genre: str
    year: int
    rating: float
    poster_url: str
    banner_url: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Season(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    show_id: str
    season_number: int
    title: str
    episode_count: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Episode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    season_id: str
    episode_number: int
    title: str
    description: str
    duration: str
    video_url: str
    thumbnail_url: str
    turkish_subtitles: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    episode_id: str
    user_id: str
    user_name: str
    content: str
    is_spoiler: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AuthRequest(BaseModel):
    session_id: str

class CommentCreate(BaseModel):
    episode_id: str
    content: str
    is_spoiler: bool = False

# Auth middleware
async def get_current_user(request: Request):
    session_token = request.cookies.get("session_token")
    if not session_token:
        raise HTTPException(status_code=401, detail="Oturum bulunamadı")
    
    # Verify session token exists in database
    session = await db.sessions.find_one({"session_token": session_token})
    if not session or session["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Geçersiz oturum")
    
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    
    return User(**user)

# Auth endpoints
@api_router.post("/auth/profile")
async def auth_profile(auth_request: AuthRequest, request: Request):
    try:
        # Call Emergent auth API
        headers = {"X-Session-ID": auth_request.session_id}
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers=headers
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Geçersiz oturum kimliği")
        
        user_data = response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data["email"]})
        
        if not existing_user:
            # Create new user - check if admin
            is_admin = user_data["email"] == "admin@cizgihub.com"
            user = User(
                email=user_data["email"],
                name=user_data["name"],
                picture=user_data.get("picture"),
                is_admin=is_admin
            )
            await db.users.insert_one(user.dict())
            user_id = user.id
        else:
            user_id = existing_user["id"]
        
        # Create session
        session_token = secrets.token_urlsafe(32)
        session = {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": datetime.utcnow() + timedelta(days=7)
        }
        await db.sessions.insert_one(session)
        
        return {"session_token": session_token, "user": user_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kimlik doğrulama hatası: {str(e)}")

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout(request: Request):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.sessions.delete_one({"session_token": session_token})
    return {"message": "Başarıyla çıkış yapıldı"}

# Content endpoints
@api_router.get("/shows")
async def get_shows(user: User = Depends(get_current_user)):
    shows = await db.shows.find().to_list(100)
    return shows

@api_router.get("/shows/{show_id}")
async def get_show(show_id: str, user: User = Depends(get_current_user)):
    show = await db.shows.find_one({"id": show_id})
    if not show:
        raise HTTPException(status_code=404, detail="Dizi bulunamadı")
    
    seasons = await db.seasons.find({"show_id": show_id}).sort("season_number").to_list(100)
    return {"show": show, "seasons": seasons}

@api_router.get("/seasons/{season_id}/episodes")
async def get_episodes(season_id: str, user: User = Depends(get_current_user)):
    episodes = await db.episodes.find({"season_id": season_id}).sort("episode_number").to_list(100)
    return episodes

@api_router.get("/episodes/{episode_id}")
async def get_episode(episode_id: str, user: User = Depends(get_current_user)):
    episode = await db.episodes.find_one({"id": episode_id})
    if not episode:
        raise HTTPException(status_code=404, detail="Bölüm bulunamadı")
    return episode

@api_router.get("/episodes/{episode_id}/comments")
async def get_comments(episode_id: str, user: User = Depends(get_current_user)):
    comments = await db.comments.find({"episode_id": episode_id}).sort("created_at", -1).to_list(100)
    return comments

@api_router.post("/comments")
async def create_comment(comment_data: CommentCreate, user: User = Depends(get_current_user)):
    comment = Comment(
        episode_id=comment_data.episode_id,
        user_id=user.id,
        user_name=user.name,
        content=comment_data.content,
        is_spoiler=comment_data.is_spoiler
    )
    await db.comments.insert_one(comment.dict())
    return comment

# Admin endpoints
@api_router.delete("/admin/comments/{comment_id}")
async def delete_comment(comment_id: str, user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Yetki yok")
    
    result = await db.comments.delete_one({"id": comment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")
    
    return {"message": "Yorum silindi"}

# Initialize data endpoint
@api_router.post("/admin/init-data")
async def init_data():
    # Check if data already exists
    existing_shows = await db.shows.count_documents({})
    if existing_shows > 0:
        return {"message": "Veri zaten mevcut"}
    
    # Create mock Turkish shows
    shows_data = [
        {
            "id": str(uuid.uuid4()),
            "title": "Kaptan Zaman",
            "description": "Zamanda yolculuk yapabilen süper kahraman Kaptan Zaman, geçmiş ve gelecekteki tehlikelere karşı savaşır.",
            "genre": "Aksiyon/Bilim Kurgu",
            "year": 2023,
            "rating": 8.5,
            "poster_url": "https://images.unsplash.com/photo-1613336116818-b83da0180161",
            "banner_url": "https://images.unsplash.com/photo-1668119064420-fb738fb05e32"
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Rüya Takımı",
            "description": "Büyülü futbol takımının maceralarını konu alan anime tarzı çocuk dizisi.",
            "genre": "Anime/Spor",
            "year": 2022,
            "rating": 9.2,
            "poster_url": "https://images.unsplash.com/flagged/photo-1572491259205-506c425b45c3",
            "banner_url": "https://images.unsplash.com/photo-1668119065964-8e78fddc5dfe"
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Karanlık Gölgeler",
            "description": "Gerilim dolu karanlık çizgi roman serisi. Gece yarısı şehrini koruyan gizemli kahraman.",
            "genre": "Korku/Gerilim",
            "year": 2024,
            "rating": 7.8,
            "poster_url": "https://images.unsplash.com/photo-1613336116818-b83da0180161",
            "banner_url": "https://images.unsplash.com/photo-1668119064420-fb738fb05e32"
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Evcil Robotlar",
            "description": "Akıllı ev robotlarının duygular öğrenme serüvenini komik bir şekilde anlatan dizi.",
            "genre": "Komedi/Bilim Kurgu",
            "year": 2023,
            "rating": 8.1,
            "poster_url": "https://images.unsplash.com/flagged/photo-1572491259205-506c425b45c3",
            "banner_url": "https://images.unsplash.com/photo-1668119065964-8e78fddc5dfe"
        }
    ]
    
    # Insert shows
    await db.shows.insert_many(shows_data)
    
    # Create seasons and episodes for each show
    for show in shows_data:
        # Create 2 seasons per show
        for season_num in range(1, 3):
            season_id = str(uuid.uuid4())
            season = {
                "id": season_id,
                "show_id": show["id"],
                "season_number": season_num,
                "title": f"Sezon {season_num}",
                "episode_count": 8,
                "created_at": datetime.utcnow()
            }
            await db.seasons.insert_one(season)
            
            # Create 8 episodes per season
            for ep_num in range(1, 9):
                episode = {
                    "id": str(uuid.uuid4()),
                    "season_id": season_id,
                    "episode_number": ep_num,
                    "title": f"Bölüm {ep_num}: {show['title']} Macerası",
                    "description": f"{show['title']} dizisinin {ep_num}. bölümü. Heyecan verici maceralar sizi bekliyor!",
                    "duration": "24:30",
                    "video_url": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
                    "thumbnail_url": show["poster_url"],
                    "turkish_subtitles": "Bu bölümde Türkçe altyazılar mevcuttur.",
                    "created_at": datetime.utcnow()
                }
                await db.episodes.insert_one(episode)
    
    return {"message": "Mock veriler başarıyla oluşturuldu"}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()