import os
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    InlineQueryHandler,
    ConversationHandler,
    ContextTypes,
    ChatMemberHandler,
    filters,
)
from supabase import create_client

# --------------------
# Load env
# --------------------
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# --------------------
# Conversation states
# --------------------
ASK_USER_ID, ASK_PIN = range(2)

# --------------------
# Handlers
# --------------------
async def start_verify(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Please provide your user ID:")
    return ASK_USER_ID

async def ask_user_id(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id_input = update.message.text.strip()

    response = supabase.table("users").select("*").eq("user_id", user_id_input).execute()
    user = response.data[0] if response.data else None

    if not user or user.get("status") != "pending":
        await update.message.reply_text("❌ Invalid or already verified user ID.")
        return ConversationHandler.END

    ctx.user_data["user_id"] = user_id_input
    ctx.user_data["user_record"] = user

    await update.message.reply_text("Please provide your PIN:")
    return ASK_PIN

async def ask_pin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    pin_input = update.message.text.strip()
    user_id_input = context.user_data.get("user_id")
    telegram_user_id = update.effective_user.id
    print(f"Verifying user_id: {user_id_input} with PIN: {pin_input}")

    # Fetch latest record from Supabase
    response = supabase.table("users").select("*").eq("user_id", user_id_input).execute()
    user_record = response.data[0] if response.data else None

    if not user_record:
        await update.message.reply_text("❌ User not found.")
        return ConversationHandler.END

    if str(user_record.get("activation_code")) != pin_input:
        await update.message.reply_text("❌ Invalid PIN.")
        return ConversationHandler.END

    # Send invite link
    invite_link = user_record.get("invite_link")
    await update.message.reply_text(f"✅ Verified! Here is your chat invite link:\n{invite_link}")

    # Update user as verified and store Telegram ID
    supabase.table("users").update({
        "status": "verified",
        "telegram_id": telegram_user_id,
        "telegram_name": update.effective_user.username,
    }).eq("user_id", user_id_input).execute()

    print(f"User {user_id_input} verified with Telegram ID {telegram_user_id}.")

    return ConversationHandler.END

async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("❌ Verification cancelled.")
    return ConversationHandler.END

# --------------------
# Chat member updates
# --------------------
async def chat_member(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    print("Chat member update received:", update)

    # 1️⃣ BOT join/leave
    if update.my_chat_member:
        result = update.my_chat_member
    # 2️⃣ USER join/leave
    elif update.chat_member:
        result = update.chat_member
    else:
        return  # nothing to do

    user = result.new_chat_member.user
    status = result.new_chat_member.status
    chat = result.chat

    bot_id = (await ctx.bot.get_me()).id

    # --------------------
    # BOT JOIN / LEAVE
    # --------------------
    if user.id == bot_id:
        if status in ("member", "administrator"):
            supabase.table("bot_chats").upsert({
                "chat_id": chat.id,
                "chat_name": chat.title
            }).execute()
            print(f"✅ Bot joined chat {chat.title} ({chat.id})")

        elif status == "left":
            supabase.table("bot_chats") \
                .delete() \
                .eq("chat_id", chat.id) \
                .execute()
            print(f"❌ Bot left chat {chat.title} ({chat.id})")

        return

    # --------------------
    # USER JOIN
    # --------------------
    if status == "member":
        response = supabase.table("users") \
            .select("*") \
            .eq("telegram_id", user.id) \
            .execute()

        user_record = response.data[0] if response.data else None

        if not user_record or user_record.get("status") != "verified":
            try:
                await ctx.bot.send_message(
                    user.id,
                    "🚫 You were removed because your account is not verified. Please verify it first."
                )
            except Exception:
                pass  # User never started the bot. but this should not be the case if user ferified with bot. If it was pending then user only was adde by admin.

            await ctx.bot.ban_chat_member(chat.id, user.id)
            return

        # Mark user as active in chat_members table
        supabase.table("chat_members") \
            .update({"is_member_active": "active"}) \
            .eq("chat_id", chat.id) \
            .execute()

        await ctx.bot.send_message(user.id, f"👋 Welcome to {chat.title}, {user.first_name}!")

    # --------------------
    # USER LEAVE
    # --------------------
    elif status == "left":
        supabase.table("users") \
            .update({"active": "inactive"}) \
            .eq("telegram_id", user.id) \
            .execute()

        print(f"👋 User left: {user.first_name}")

# --------------------
# Inline queries
# --------------------
async def inline_query(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    from telegram import InlineQueryResultArticle, InputTextMessageContent

    results = [
        InlineQueryResultArticle(
            id="1",
            title="Hello",
            input_message_content=InputTextMessageContent("Hello from bot!")
        )
    ]

    await update.inline_query.answer(results, cache_time=0)

# --------------------
# MAIN
# --------------------
def main():
    app = Application.builder().token(BOT_TOKEN).build()

    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start_verify)],
        states={
            ASK_USER_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_user_id)],
            ASK_PIN: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_pin)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    app.add_handler(conv)
    app.add_handler(ChatMemberHandler(chat_member, ChatMemberHandler.CHAT_MEMBER))
    app.add_handler(ChatMemberHandler(chat_member, ChatMemberHandler.MY_CHAT_MEMBER))
    app.add_handler(InlineQueryHandler(inline_query))

    print("🤖 Bot running (PTB v20+, polling)...")
    app.run_polling()

if __name__ == "__main__":
    main()
