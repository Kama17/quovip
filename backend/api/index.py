import os
import jwt
import datetime
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from supabase import create_client, Client
import httpx

load_dotenv()

# ----------------- Environment Variables -----------------
BOT_USERNAME = os.getenv("BOT_USERNAME")
JWT_SECRET = os.getenv("JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ----------------- Initialize Supabase -----------------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ----------------- Initialize FastAPI -----------------
app = FastAPI()

# Allow your frontend to access the backend
origins = [
    "http://localhost:5173",  # your frontend URL
    "http://127.0.0.1:5173",  # optional, if you use this
    "*",  # optional: allow all origins (not recommended in production)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Generate Invite Endpoint -----------------
@app.get("/generate-invite")
async def generate_invite():
    payload = {
        "invite_id": os.urandom(4).hex(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    invite_link = f"https://t.me/{BOT_USERNAME}?start=verify_{token}"
    return {"invite": invite_link}

# ----------------- Verify Webapp Endpoint -----------------
@app.post("/api/verify-webapp")
async def verify_webapp(request: Request):
    body = await request.json()
    telegram_user_id = body.get("telegram_user_id")
    token = body.get("inviteToken")
    init_data = body.get("initData")

    if not telegram_user_id or not token or not init_data:
        raise HTTPException(status_code=400, detail="Missing fields")

    try:
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")

    # Optional: validate init_data with Telegram WebApp (not included here)
    invite_link = "https://t.me/joinchat/<your_invite_hash>"

    # Send message to user via Telegram API
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{os.getenv('BOT_TOKEN')}/sendMessage",
            json={
                "chat_id": telegram_user_id,
                "text": f"✅ You can join the VIP group here:\n{invite_link}",
            },
            timeout=5,
        )

    return JSONResponse({"success": True})

# ----------------- Healthcheck -----------------
@app.get("/")
def root():
    return {"message": "API is running!"}
