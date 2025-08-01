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
    username: str
    email: EmailStr
    password_hash: str = Field(exclude=True)  # Exclude from responses
    is_admin: bool = False
    is_verified: bool = False
    verification_code: Optional[str] = None
    verification_code_expires: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    login: str  # Can be username or email
    password: str

class EmailVerification(BaseModel):
    email: EmailStr
    verification_code: str

class ResendVerification(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str

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

# Utility Functions
def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password"""
    return pwd_context.verify(plain_password, hashed_password)

def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return str(random.randint(100000, 999999))

def create_jwt_token(user_id: str) -> str:
    """Create JWT token for user"""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> str:
    """Verify JWT token and return user_id"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token süresi doldu")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

def send_verification_email(email: str, verification_code: str) -> bool:
    """Send verification email using Gmail SMTP"""
    try:
        gmail_user = os.environ.get('GMAIL_USER')
        gmail_password = os.environ.get('GMAIL_APP_PASSWORD')
        
        if not gmail_user or not gmail_password:
            logging.error("Gmail credentials not configured")
            return False
            
        msg = MimeMultipart()
        msg['From'] = gmail_user
        msg['To'] = email
        msg['Subject'] = "ÇizgiHub - E-posta Doğrulama"
        
        body = f"""
        Merhaba!
        
        ÇizgiHub hesabınızı doğrulamak için aşağıdaki kodu kullanın:
        
        Doğrulama Kodu: {verification_code}
        
        Bu kod 15 dakika içinde geçerliliğini yitirecektir.
        
        Bu e-postayı siz talep etmediyseniz, lütfen görmezden gelin.
        
        ÇizgiHub Ekibi
        """
        
        msg.attach(MimeText(body, 'plain', 'utf-8'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(gmail_user, gmail_password)
        text = msg.as_string()
        server.sendmail(gmail_user, email, text)
        server.quit()
        
        logging.info(f"Verification email sent to {email}")
        return True
        
    except Exception as e:
        logging.error(f"Failed to send email: {str(e)}")
        return False

def is_valid_username(username: str) -> bool:
    """Validate username format"""
    if len(username) < 3 or len(username) > 20:
        return False
    return re.match("^[a-zA-Z0-9_-]+$", username) is not None

def is_valid_password(password: str) -> bool:
    """Validate password strength"""
    if len(password) < 6:
        return False
    return True

# Auth middleware
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    user_id = verify_jwt_token(credentials.credentials)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    
    if not user.get("is_verified", False):
        raise HTTPException(status_code=401, detail="E-posta doğrulanmamış")
    
    return User(**user)

async def get_admin_user(user: User = Depends(get_current_user)):
    """Ensure user is admin"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Yetki yok")
    return user

# Auth endpoints
@api_router.post("/auth/register")
async def register_user(user_data: UserRegistration):
    """Register new user"""
    try:
        # Validate input
        if not is_valid_username(user_data.username):
            raise HTTPException(status_code=400, detail="Geçersiz kullanıcı adı. 3-20 karakter, sadece harf, rakam, _ ve - kullanılabilir.")
        
        if not is_valid_password(user_data.password):
            raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalıdır.")
        
        # Check if username or email already exists
        existing_user = await db.users.find_one({
            "$or": [
                {"username": user_data.username.lower()},
                {"email": user_data.email.lower()}
            ]
        })
        
        if existing_user:
            if existing_user["username"].lower() == user_data.username.lower():
                raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor.")
            else:
                raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı.")
        
        # Generate verification code
        verification_code = generate_verification_code()
        
        # Hash password
        password_hash = hash_password(user_data.password)
        
        # Check if this is admin account
        is_admin = user_data.email.lower() == "admin@cizgihub.com.tr"
        
        # Create user
        new_user = {
            "id": str(uuid.uuid4()),
            "username": user_data.username.lower(),
            "email": user_data.email.lower(),
            "password_hash": password_hash,
            "is_admin": is_admin,
            "is_verified": is_admin,  # Admin is automatically verified
            "verification_code": verification_code if not is_admin else None,
            "verification_code_expires": datetime.utcnow() + timedelta(minutes=15) if not is_admin else None,
            "created_at": datetime.utcnow()
        }
        
        await db.users.insert_one(new_user)
        
        # Send verification email (except for admin)
        if not is_admin:
            email_sent = send_verification_email(user_data.email, verification_code)
            if not email_sent:
                # Still allow registration but notify about email issue
                logging.warning(f"Failed to send verification email to {user_data.email}")
        
        return {
            "message": "Hesap oluşturuldu. E-posta adresinizi kontrol ederek doğrulama kodunu girin." if not is_admin else "Admin hesabı oluşturuldu.",
            "user_id": new_user["id"],
            "is_admin": is_admin,
            "requires_verification": not is_admin
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail="Kayıt sırasında bir hata oluştu.")

@api_router.post("/auth/verify-email")
async def verify_email(verification_data: EmailVerification):
    """Verify email with code"""
    try:
        user = await db.users.find_one({"email": verification_data.email.lower()})
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
        
        if user.get("is_verified", False):
            raise HTTPException(status_code=400, detail="E-posta zaten doğrulanmış.")
        
        if (not user.get("verification_code") or 
            user["verification_code"] != verification_data.verification_code):
            raise HTTPException(status_code=400, detail="Geçersiz doğrulama kodu.")
        
        if (user.get("verification_code_expires") and 
            user["verification_code_expires"] < datetime.utcnow()):
            raise HTTPException(status_code=400, detail="Doğrulama kodu süresi dolmuş.")
        
        # Verify user
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {"is_verified": True},
                "$unset": {"verification_code": "", "verification_code_expires": ""}
            }
        )
        
        # Generate JWT token
        token = create_jwt_token(user["id"])
        
        return {
            "message": "E-posta başarıyla doğrulandı.",
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "is_admin": user.get("is_admin", False)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Email verification error: {str(e)}")
        raise HTTPException(status_code=500, detail="Doğrulama sırasında bir hata oluştu.")

@api_router.post("/auth/resend-verification")
async def resend_verification(resend_data: ResendVerification):
    """Resend verification email"""
    try:
        user = await db.users.find_one({"email": resend_data.email.lower()})
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
        
        if user.get("is_verified", False):
            raise HTTPException(status_code=400, detail="E-posta zaten doğrulanmış.")
        
        # Generate new verification code
        verification_code = generate_verification_code()
        
        # Update user with new code
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "verification_code": verification_code,
                    "verification_code_expires": datetime.utcnow() + timedelta(minutes=15)
                }
            }
        )
        
        # Send email
        email_sent = send_verification_email(resend_data.email, verification_code)
        
        if not email_sent:
            raise HTTPException(status_code=500, detail="E-posta gönderilirken hata oluştu.")
        
        return {"message": "Doğrulama kodu tekrar gönderildi."}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Resend verification error: {str(e)}")
        raise HTTPException(status_code=500, detail="E-posta gönderilirken hata oluştu.")

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    """Login user"""
    try:
        # Find user by username or email
        user = await db.users.find_one({
            "$or": [
                {"username": login_data.login.lower()},
                {"email": login_data.login.lower()}
            ]
        })
        
        if not user:
            raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı/e-posta veya şifre.")
        
        # Verify password
        if not verify_password(login_data.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı/e-posta veya şifre.")
        
        # Check if email is verified
        if not user.get("is_verified", False):
            raise HTTPException(status_code=401, detail="E-posta adresiniz doğrulanmamış. Lütfen e-postanızı kontrol edin.")
        
        # Generate JWT token
        token = create_jwt_token(user["id"])
        
        return {
            "message": "Başarıyla giriş yapıldı.",
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "is_admin": user.get("is_admin", False)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Giriş sırasında bir hata oluştu.")

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user info"""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_verified": user.is_verified
    }

@api_router.post("/auth/logout")
async def logout():
    """Logout (client-side token removal)"""
    return {"message": "Başarıyla çıkış yapıldı."}

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