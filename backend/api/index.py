import os
from fastapi.params import Depends
import jwt
import datetime
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from supabase import create_client, Client
from api.auth import verify_admin
import httpx

load_dotenv()

# ----------------- Environment Variables -----------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
BOT_TOKEN = os.getenv("BOT_TOKEN")

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


# ----------------- API Endpoints -----------------
@app.post("/api/chats/remove-user")
async def remove_user_endpoint(
    data: dict,
    admin=Depends(verify_admin)
):
    """Remove a user from a Telegram chat using the bot."""
    chat_id = data.get("chat_id")
    user_id = data.get("telegram_user_id")

    if not chat_id or not user_id:
        raise HTTPException(
            status_code=400,
            detail="chat_id and telegram_user_id are required"
        )

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/banChatMember",
            json={
                "chat_id": chat_id,
                "user_id": user_id,
            },
            timeout=5
        )

    result = r.json()

    if not result.get("ok"):
        raise HTTPException(
            status_code=400,
            detail=result.get("description", "Telegram API error")
        )

    return {"success": True, "message": "User removed successfully"}

# need send infotation to the user
# @app.post("/api/chats/send-message")



# ----------------- Healthcheck -----------------
@app.get("/")
def root():
    return {"message": "API is running!"}
