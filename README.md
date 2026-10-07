# যে যে আই জুনিয়র হাই স্কুল — Reunion Production Starter

বাংলা reunion website + Node/Express backend + SQLite + badge/fee selection + admin dashboard + QR/printable card + payment gateway integration points.

## Run
1. Node.js 18+ install
2. `npm install`
3. `.env.example` → `.env`
4. ADMIN credentials ও payment credentials বসান
5. `npm start`
6. `http://localhost:3000`

## Badges
`server/server.js`-এর BADGES array-তে badge name/fee পরিবর্তন করুন।

## Payment
SSLCommerz-এর server-side initiate/IPN/validation flow-এর জন্য official docs ব্যবহার করুন: https://developer.sslcommerz.com/doc/v4/

bKash credentials/endpoint আপনার merchant account-এর contract অনুযায়ী `.env`-এ বসবে। Secret কখনও frontend-এ দেবেন না।

## গুরুত্বপূর্ণ
GitHub Pages শুধু static frontend চালায়। Real payment gateway, database এবং callback/IPN-এর জন্য Node backend আলাদা server-এ deploy করতে হবে (Render/Railway/VPS/AWS ইত্যাদি)।
