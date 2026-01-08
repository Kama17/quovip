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
from learing.learing import send_learning_guide, lesson_callback

# --------------------
# Load env
# --------------------
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# TODO:: All related to Supabase should be moved to api fatapi
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# --------------------
# Conversation states
# --------------------
ASK_USER_ID, ASK_PIN = range(2)

# --------------------
# Handlers
# --------------------
async def start_verify(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 <b>Welcome to the Verification Process!</b>\n\n"
        "To get access to our private trading chats, please follow these steps:\n\n"
        "1️⃣ Provide your <b>User ID</b>.\n"
        "2️⃣ Enter the <b>verification code</b> sent to you by the admin.\n"
        "3️⃣ Once verified, you'll be added to the appropriate trading groups.\n\n"
        "Let's get started!\n\n"
        "Please provide your <b>User ID</b> to begin:",
        parse_mode="HTML"
    )
    return ASK_USER_ID

async def ask_user_id(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id_input = update.message.text.strip()

    response = supabase.table("users").select("*").eq("user_id", user_id_input).execute()
    user = response.data[0] if response.data else None

    if not user: 
        await update.message.reply_text(
            "❌ <b>User ID not found</b>.\n\n"
            "Please check your ID and try again.",
            parse_mode="HTML"
        )
        return ConversationHandler.END
    if user.get("status") == "verified":
        await update.message.reply_text(
            "✅ <b>You are already verified!</b>\n\n"
            "No further action is needed.",
            parse_mode="HTML")
        return ConversationHandler.END

    ctx.user_data["user_id"] = user_id_input
    ctx.user_data["user_record"] = user

    await update.message.reply_text(
         "🔐 <b>Almost there!</b>\n"
        "Please provide your <b>verification code</b> sent by the admin to complete verification.",
        parse_mode="HTML")
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
        await update.message.reply_text(
            "❌ <b>User not found</b>\n\n"
            "🔍 We couldn't find your account in our system.\n"
            "👉 Please make sure you joined using the correct ID.",
            parse_mode="HTML"
        )
        return ConversationHandler.END

    if str(user_record.get("activation_code")) != pin_input:
        await update.message.reply_text(
            "❌ <b>Invalid PIN</b>\n\n"
            "🔐 The PIN you entered is incorrect.\n",
            parse_mode="HTML"
        )
        return ConversationHandler.END

    await update.message.reply_text(
        f"😊 <b>Welcome, {update.effective_user.first_name}!</b>\n\n"
        "✅ You’re all verified\n"
        "📊 Invite links to our <b>private trading groups</b> are coming your way soon.\n\n"
        "🚀 Excited to have you with us!",
        parse_mode="HTML"
    )

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
# CHAT MIGRATION (group → supergroup)
# --------------------
async def chat_migration(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    message = update.message
    if not message:
        return

    if message.migrate_from_chat_id:
        old_id = message.migrate_from_chat_id
        new_id = message.chat.id
        new_name = message.chat.title or "Unnamed chat"

        exists = supabase.table("bot_chats") \
            .select("chat_id") \
            .eq("chat_id", new_id) \
            .execute()

        if exists.data:
            return


        supabase.table("bot_chats") \
            .update({"chat_id": new_id, "chat_name": new_name}) \
            .eq("chat_id", old_id) \
            .execute()

        supabase.table("chat_members") \
            .update({"chat_id": new_id}) \
            .eq("chat_id", old_id) \
            .execute()

        print(f"🔁 Chat migrated {old_id} → {new_id}")


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
            .eq("user_id", user.id) \
            .execute()
        print(f"👋 User joined: {user.first_name} in chat {chat.title}")

        message = (
            f"👋 <b>Welcome to <u>{chat.title}</u>!</b>\n\n"
            f"😊 Hi <b>{user.first_name}</b>, we’re glad to have you here.\n\n"
            "📌 <i>Please read the pinned message and follow the group rules.</i>\n"
            "🤝 Be respectful and enjoy your stay!"
            )

        await ctx.bot.send_message(
            chat_id=user.id,
            text=message,
            parse_mode="HTML"
        )

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

async def help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    help_text = (
       "👋 <b>Welcome to the community!</b>\n\n"
        "Getting access is easy 👇\n\n"
        "1️⃣ Type <code>/start</code> to begin verification\n"
        "2️⃣ Send the <b>activation code</b> you received from an admin\n"
        "3️⃣ We’ll verify you automatically ✅\n"
        "4️⃣ An admin will add you to the right <b>private trading chats</b>\n\n"
        "📈 All chats are private and trading-focused\n"
        "⏱ Verification usually takes only a minute\n\n"
        "🚀 See you inside!"
    )
    await update.message.reply_text(help_text, parse_mode="HTML")

async def about(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    about_text = (
        "<b>🌟 About Us</b>\n\n"
        "Welcome to our Trading Learning Community! 📈\n\n"
        "We are a group of traders and enthusiasts dedicated to learning, sharing knowledge, and improving trading skills together.\n\n"
        "Here you can:\n"
        "✅ Learn trading strategies\n"
        "✅ Share insights and tips\n"
        "✅ Connect with like-minded members\n\n"
        "Our goal is to create a friendly and supportive environment where everyone can grow as a trader. 🚀\n\n"
        "<b>📬 Contact Us</b>\n"
        "For any questions or support, reach out to our admins:\n"
        "✉ Email: support@tradingcommunity.com\n"
        "💬 Telegram: @TradingAdmin\n"
        "🌐 Website: https://tradingcommunity.com"
    )
    await update.message.reply_text(about_text, parse_mode="HTML")

# --------------------
# MAIN
# --------------------
def main():
    app = Application.builder().token(BOT_TOKEN).build()

    conv = ConversationHandler(
        entry_points=[CommandHandler("verify", start_verify)],
        states={
            ASK_USER_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_user_id)],
            ASK_PIN: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_pin)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    app.add_handler(conv)
    app.add_handler(ChatMemberHandler(chat_member, ChatMemberHandler.CHAT_MEMBER))
    app.add_handler(ChatMemberHandler(chat_member, ChatMemberHandler.MY_CHAT_MEMBER))
    app.add_handler(MessageHandler(filters.StatusUpdate.ALL, chat_migration))

    app.add_handler(CommandHandler("help", help))
    app.add_handler(CommandHandler("about", about))
    app.add_handler(CommandHandler("learn", send_learning_guide))
    app.add_handler(CallbackQueryHandler(lesson_callback))
    app.add_handler(InlineQueryHandler(inline_query))

    print("🤖 Bot running (PTB v20+, polling)...")
    app.run_polling()

if __name__ == "__main__":
    main()
