
# TrojanAI (BP) - 6-Relay IoT Control System

ระบบควบคุมรีเลย์ 6 ช่องผ่าน HTTP API และ Voice Command พร้อมแจ้งเตือน Telegram

## Features
- ควบคุมรีเลย์ 6 ช่องผ่าน HTTP API
- Voice Command ภาษาไทย
- ตั้งชื่อรีเลย์และหน่วงเวลาได้
- แจ้งเตือน Telegram ทุกการควบคุม

## การติดตั้ง

1. สร้าง Telegram Bot ผ่าน @BotFather
2. หา CHAT_ID ผ่าน @userinfobot
3. ตั้งค่า GitHub Secrets:
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID
   - NETLIFY_AUTH_TOKEN
   - NETLIFY_SITE_ID

## Voice Commands
- "เปิดไฟหลัก" / "ปิดไฟหลัก"
- "เปิดมอเตอร์ปั๊ม" / "ปิดมอเตอร์ปั๊ม"
- "เปิดทั้งหมด" / "ปิดทั้งหมด"
- "กลางคืน" / "ประหยัด"

## License
MIT
