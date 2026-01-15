import asyncio
import os
from typing import Optional, List, Dict
from fastapi.params import Depends
import json
from fastapi import FastAPI, HTTPException, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from api.auth import verify_admin
import httpx

# ----------------- Load Environment Variables -----------------
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
    "https://quovipapi.vercel.ap",  # your frontend URL
    "http://127.0.0.1:5173",
      "http://127.0.0.1:8000/",  # optional, if you use this
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
        return {"ok": False, "message": "chat_id and telegram_user_id are required"}

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/banChatMember",
            json={
                "chat_id": chat_id,
                "user_id": user_id,
            },
            timeout=10
        )

    result = r.json()

    if not result.get("ok"):
        return {"ok": False, "message": result.get("description", "Telegram API error")}

    return {"ok": True, "message": "User removed successfully"}

@app.post("/api/chats/send-invitation")
async def send_invitation_endpoint(
    data: dict,
    admin=Depends(verify_admin)
):
    """
    Send the chat's invite link to a single user.
    The invite link is stored in Supabase for future revoking.
    """
    chat_id = data.get("chat_id")
    telegram_user_id = data.get("telegram_user_id")  # single user ID
    
    if not chat_id or not telegram_user_id:
        return {"ok": False, "message": "chat_id and telegram_user_id are required"}

    async with httpx.AsyncClient() as client:
        # Check if user already is a member of the chat
        r_check = await client.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMember",
            json={
                "chat_id": chat_id,
                "user_id": telegram_user_id,
            },
            timeout=10
        )
        result_check = r_check.json()
        if result_check.get("ok"):
            status = result_check["result"]["status"]
            if status in ["member", "administrator", "creator"]:
                return {"ok": False, "message": "User is already a member of the chat"}
            if status in ["left", "kicked"]:
                pass  # User can be re-invited
        
        # Check if the user is marked as invited in supabase
        users_record = supabase.table("users") \
            .select("*") \
            .eq("telegram_id", telegram_user_id) \
            .execute()
        
        if users_record.data:
            chat_member = supabase.table("chat_members") \
                .select("*") \
                .eq("user_id", users_record.data[0]["id"]) \
                .eq("chat_id", chat_id) \
                .execute()
            if chat_member.data and chat_member.data[0]["is_member_active"] == "invited":
                return {"ok": False, "message": "User has already been invited to this chat"}
        
        # 1️⃣ Check if we already have an invite link stored in Supabase
        record = supabase.table("bot_chats") \
            .select("*") \
            .eq("chat_id", chat_id) \
            .execute()

        if record.data and record.data[0]["invite_link"] != None:
            invite_link = record.data[0]["invite_link"]
            print(f'invite_link: {invite_link}')
        else:
            # Create new invite link for the chat
            r = await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/createChatInviteLink",
                json={"chat_id": chat_id},
                timeout=10
            )
            result = r.json()
            if not result.get("ok"):
                return {"ok": False, "message": result.get("description", "Telegram API error")}
            invite_link = result["result"]["invite_link"]
            print(f'result invite_link: {invite_link}')
            # Store link in Supabase
            supabase.table("bot_chats") \
                .update({"invite_link": invite_link}) \
                .eq("chat_id", chat_id) \
                .execute()
        # 2️⃣ Send invite link to the single user
        r2 = await client.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            json={
                "chat_id": telegram_user_id,
                "parse_mode": "HTML",
                "text": (
                    "🎉 <b>You’re in!</b>\n\n"
                    "📈 Here’s your invite link to our <b>private trading group</b>:\n\n"
                    f"🔗 <a href=\"{invite_link}\">Join the private group</a>\n\n"
                    "👋 See you inside!"
                )
            },
            timeout=10
        )
        result2 = r2.json()
        if not result2.get("ok"):
            return {"ok": False, "message": result2.get("description", "Failed to send invitation link")}
        
        # 5️⃣ insert or update chat_members table 
        print(f'users_record: {users_record.data}')
        print(f'chat_id: {chat_id}, user_id: {users_record.data[0]["id"]}')
        supabase.table("chat_members").upsert(
            {
                "chat_id": chat_id,
                "user_id": users_record.data[0]["id"],  # must exist in users table
                "is_member_active": "invited",
            },
            on_conflict=["chat_id", "user_id"]
        ).execute()


    return {"ok": True, "message": f"Invitation link sent successfully to user {telegram_user_id}"}


# Brockast message
@app.post("/api/chats/broadcast-message")
async def send_message_to_selected_chats(
    text: str = Form(...),
    chat_ids: str = Form(...),  # JSON string
    image: UploadFile | None = File(None),
    parse_mode: str = Form("HTML"),
    admin=Depends(verify_admin),
):
    # 1️⃣ Parse payload
    try:
        chat_targets: List[Dict] = json.loads(chat_ids)
    except Exception:
        raise HTTPException(status_code=400, detail="chat_ids must be valid JSON")

    if not isinstance(chat_targets, list):
        raise HTTPException(status_code=400, detail="chat_ids must be a list")

    for item in chat_targets:
        if not isinstance(item, dict) or "chat_id" not in item:
            raise HTTPException(
                status_code=400,
                detail="Each item must be { chat_id: string, topic?: string }",
            )

    # 2️⃣ Read image ONCE
    image_bytes = None
    if image:
        image_bytes = await image.read()

    async def send_to_chat(
        client: httpx.AsyncClient,
        chat_id: int,
        topic: Optional[str] = None,
    ):
        try:
            print("Preparing to send to:", chat_id, "topic:", topic)
            # Common params
            base_params = {
                "chat_id": chat_id,
                "parse_mode": parse_mode,
            }

            if topic:
                base_params["message_thread_id"] = int(topic)

            if image_bytes:
                files = {
                    "photo": (
                        image.filename,
                        image_bytes,
                        image.content_type,
                    )
                }
                data = {
                    **base_params,
                    "caption": text,
                }

                r = await client.post(
                    f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto",
                    data=data,
                    files=files,
                )
            else:
                print("Sending to:", chat_id, "topic:", topic)

                r = await client.post(
                    f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                    json={
                        **base_params,
                        "text": text,
                        "disable_web_page_preview": True,
                    },
                )

            result = r.json()
            print("Result:", result)
            if result.get("ok"):
                return {
                    "chat_id": chat_id,
                    "topic": topic,
                    "ok": True,
                }
            else:
                return {
                    "chat_id": chat_id,
                    "topic": topic,
                    "ok": False,
                    "error": result.get("description"),
                }

        except Exception as e:
            return {
                "chat_id": chat_id,
                "topic": topic,
                "ok": False,
                "error": str(e),
            }

    # 3️⃣ Send concurrently
    async with httpx.AsyncClient(timeout=15) as client:
        tasks = [
            send_to_chat(
                client,
                int(item["chat_id"]),
                item.get("topic"),
            )
            for item in chat_targets
        ]

        results = await asyncio.gather(*tasks)

    # 4️⃣ Summary
    success = sum(1 for r in results if r["ok"])
    failed = len(results) - success

    return {
        "ok": True,
        "sent": success,
        "failed": failed,
        "errors": [r for r in results if not r["ok"]],
    }
# need send infotation to the user
# @app.post("/api/chats/send-message")



# ----------------- Healthcheck -----------------
@app.get("/")
def root():
    return {"message": "API is running!"}
