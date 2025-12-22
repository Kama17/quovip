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

async def ask_pin(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    pin_input = update.message.text.strip()
    user = ctx.user_data["user_record"]
    user_id_input = ctx.user_data["user_id"]

    if str(user.get("code")) != pin_input:
        await update.message.reply_text("❌ Invalid PIN.")
        return ConversationHandler.END

    telegram_user_id = update.effective_user.id
    invite_link = user.get("invite_link")

    await update.message.reply_text(
        f"✅ Verified!\nHere is your invite link:\n{invite_link}"
    )

    supabase.table("users").update({
        "status": "verified",
        "telegram_id": telegram_user_id,
        "active": True
    }).eq("user_id", user_id_input).execute()

    return ConversationHandler.END

async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("❌ Verification cancelled.")
    return ConversationHandler.END

# --------------------
# Chat member updates
# --------------------
async def chat_member(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = update.chat_member
    user = result.new_chat_member.user
    status = result.new_chat_member.status

    if status == "member":
        supabase.table("users").update({"active": True}) \
            .eq("telegram_id", user.id).execute()
        await ctx.bot.send_message(
            result.chat.id, f"👋 Welcome, {user.first_name}!"
        )

    elif status == "left":
        supabase.table("users").update({"active": False}) \
            .eq("telegram_id", user.id).execute()
        await ctx.bot.send_message(
            result.chat.id, f"👋 Goodbye, {user.first_name}!"
        )

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
    app.add_handler(InlineQueryHandler(inline_query))

    print("🤖 Bot running (PTB v20+, polling)...")
    app.run_polling()

if __name__ == "__main__":
    main()
