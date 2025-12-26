from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes

# ---- /learn command ----
async def send_learning_guide(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("📘 Trading Basics", callback_data="lesson_basics")],
        [InlineKeyboardButton("📝 Terminology", callback_data="lesson_terms")],
        [InlineKeyboardButton("💡 Tips & Strategies", callback_data="lesson_tips")],
        [InlineKeyboardButton("🔗 Resources", callback_data="lesson_resources")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "📚 <b>Welcome to the Trading Learning Guide!</b>\n\n"
        "Select a topic below to start learning step-by-step:",
        reply_markup=reply_markup,
        parse_mode="HTML"
    )

# ---- Callback handler for lessons ----
async def lesson_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == "lesson_basics":
        text = (
            "📘 <b>Trading Basics</b>\n\n"
            "Trading is the act of buying and selling financial instruments like stocks, crypto, or forex to make a profit.\n\n"
            "<b>Markets:</b>\n"
            "🔹 Stocks – shares of companies\n"
            "🔹 Crypto – digital currencies like Bitcoin or Ethereum\n"
            "🔹 Forex – foreign exchange currency pairs\n\n"
            "<b>How it works:</b>\n"
            "1️⃣ Buy low, sell high\n"
            "2️⃣ Use analysis (technical/fundamental)\n"
            "3️⃣ Manage risk with stop-losses"
        )
    elif query.data == "lesson_terms":
        text = (
            "📝 <b>Key Trading Terms</b>\n\n"
            "📈 Bull Market – prices are rising\n"
            "📉 Bear Market – prices are falling\n"
            "💹 Leverage – borrowing money to increase position size\n"
            "⛔ Stop-Loss – automatically sell to limit losses\n"
            "📊 Candlestick – chart showing price movement\n"
            "💱 Spread – difference between buy and sell price\n"
            "🔄 Volatility – measure of price fluctuations\n"
        )
    elif query.data == "lesson_tips":
        text = (
            "💡 <b>Tips & Strategies</b>\n\n"
            "✅ Start with a demo account to practice\n"
            "✅ Diversify your investments\n"
            "✅ Stick to your risk management plan\n"
            "✅ Keep emotions out of trading decisions\n"
            "✅ Learn to read charts and indicators\n"
            "✅ Track news and market trends\n"
        )
    elif query.data == "lesson_resources":
        text = (
            "🔗 <b>Resources & Learning</b>\n\n"
            "📚 Books: 'Trading for Dummies', 'The Intelligent Investor'\n"
            "🌐 Websites: Investopedia, TradingView, CoinMarketCap\n"
            "🎥 YouTube channels: Trading tutorials, market analysis\n"
            "💬 Join our private chat groups for tips and daily discussions!"
        )
    else:
        text = "❌ Unknown lesson. Please try again."

    # Send the selected lesson
    await query.edit_message_text(text=text, parse_mode="HTML")