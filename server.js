const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'data');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

require('dotenv').config();
const express=require('express'),  crypto=require('crypto'), jwt=require('jsonwebtoken'), Database=require('better-sqlite3'), QRCode=require('qrcode'), rateLimit=require('express-rate-limit'), {v4:uuid}=require('uuid');
const app=express(), PORT=+(process.env.PORT||3000), BASE=process.env.BASE_URL||`http://localhost:${PORT}`;
const db = new Database(path.join(__dirname, 'data', 'reunion.db'))
db.exec(`CREATE TABLE IF NOT EXISTS registrations(id TEXT PRIMARY KEY,name TEXT,batch TEXT,phone TEXT,email TEXT,address TEXT,profession TEXT,badge_id TEXT,badge_name TEXT,amount INTEGER,payment_method TEXT,payment_status TEXT DEFAULT 'PENDING',transaction_id TEXT,created_at TEXT)`);
const BADGES=[{id:'general',name:'সাধারণ সদস্য',price:1000,description:'একজন প্রাক্তন ছাত্র/ছাত্রী'},{id:'family',name:'সদস্য + পরিবার',price:1800,description:'একজন সদস্য ও পরিবার'},{id:'vip',name:'VIP সদস্য',price:3000,description:'VIP আসন ও বিশেষ ব্যাজ'},{id:'lifetime',name:'আজীবন সদস্য',price:5000,description:'বিশেষ স্মারক/আজীবন সদস্য ব্যাজ'}];
const clean=x=>String(x||'').trim().slice(0,500), badge=id=>BADGES.find(x=>x.id===id);
app.use(express.json({limit:'1mb'})); app.use(express.urlencoded({extended:true})); app.use(rateLimit({windowMs:15*60*1000,max:300})); app.use(express.static(path.join(__dirname,'..')));
app.get('/api/config',(q,s)=>s.json({school:'যে যে আই জুনিয়র হাই স্কুল',location:'রাজঘাট, অভয়নগর, যশোর',established:1982,eventName:process.env.EVENT_NAME,eventDate:process.env.EVENT_DATE,badges:BADGES}));
app.post('/api/register',(q,s)=>{const x=q.body,b=badge(x.badgeId);if(!x.name||!x.batch||!x.phone||!b||!['bkash','sslcommerz'].includes(x.paymentMethod))return s.status(400).json({error:'প্রয়োজনীয় তথ্য/ব্যাজ/পেমেন্ট পদ্ধতি সঠিক দিন।'});const id='REG-'+uuid().split('-')[0].toUpperCase(),tran='REU-'+id;db.prepare(`INSERT INTO registrations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,clean(x.name),clean(x.batch),clean(x.phone),clean(x.email),clean(x.address),clean(x.profession),b.id,b.name,b.price,x.paymentMethod,'PENDING',tran,new Date().toISOString());s.json({registrationId:id,amount:b.price,transactionId:tran});});
app.post('/api/payments/sslcommerz/start',(q,s)=>{const r=db.prepare('SELECT * FROM registrations WHERE id=?').get(q.body.registrationId);if(!r)return s.status(404).json({error:'Registration not found'});if(!process.env.SSLCOMMERZ_STORE_ID||!process.env.SSLCOMMERZ_STORE_PASSWORD)return s.status(503).json({error:'SSLCOMMERZ credentials .env-এ বসানো হয়নি।'});s.status(501).json({error:'SSLCOMMERZ initiate API এখানে merchant credentials দিয়ে enable করতে হবে।',transactionId:r.transaction_id,docs:'https://developer.sslcommerz.com/doc/v4/'});});
app.post('/api/payments/sslcommerz/success',(q,s)=>{const r=db.prepare('SELECT * FROM registrations WHERE transaction_id=?').get(clean(q.body.tran_id));if(r)db.prepare("UPDATE registrations SET payment_status='PAID' WHERE id=?").run(r.id);s.redirect('/success.html?id='+encodeURIComponent(r?.id||''));});
app.post('/api/payments/sslcommerz/fail',(q,s)=>s.redirect('/payment-failed.html'));app.post('/api/payments/sslcommerz/cancel',(q,s)=>s.redirect('/payment-cancelled.html'));app.post('/api/payments/sslcommerz/ipn',(q,s)=>s.json({received:true,note:'Production: validate with SSLCOMMERZ Order Validation API before PAID'}));
app.post('/api/payments/bkash/start',(q,s)=>{if(!process.env.BKASH_BASE_URL||!process.env.BKASH_APP_KEY||!process.env.BKASH_APP_SECRET)return s.status(503).json({error:'bKash merchant credentials/endpoints .env-এ বসানো হয়নি।'});s.status(501).json({error:'bKash create/execute/query adapter আপনার merchant API contract অনুযায়ী enable করতে হবে।'});});
app.get('/api/registration/:id',async(q,s)=>{const r=db.prepare('SELECT id,name,batch,badge_name,amount,payment_status,payment_method,transaction_id,created_at FROM registrations WHERE id=?').get(q.params.id);if(!r)return s.status(404).json({error:'Not found'});if(r.payment_status!=='PAID')return s.status(403).json({error:'Payment not confirmed'});r.qr=await QRCode.toDataURL(`${BASE}/card.html?id=${r.id}`);s.json(r);});
function auth(q,s,n){try{q.user=jwt.verify((q.headers.authorization||'').replace('Bearer ',''),process.env.JWT_SECRET);n()}catch{s.status(401).json({error:'Unauthorized'})}}
app.post('/api/admin/login',(q,s)=>{if(q.body.email!==process.env.ADMIN_EMAIL||q.body.password!==process.env.ADMIN_PASSWORD)return s.status(401).json({error:'ভুল login'});s.json({token:jwt.sign({role:'admin'},process.env.JWT_SECRET,{expiresIn:'8h'})})});
app.get('/api/admin/registrations',auth,(q,s)=>s.json(db.prepare('SELECT * FROM registrations ORDER BY created_at DESC').all()));
app.get('/api/admin/export.csv',auth,(q,s)=>{const rows=db.prepare('SELECT id,name,batch,phone,email,badge_name,amount,payment_method,payment_status,transaction_id,created_at FROM registrations').all(),f=Object.keys(rows[0]||{id:1}),esc=x=>'"'+String(x??'').replaceAll('"','""')+'"';s.setHeader('Content-Type','text/csv; charset=utf-8');s.send('\ufeff'+[f.join(','),...rows.map(r=>f.map(k=>esc(r[k])).join(','))].join('\n'));});
app.listen(PORT,()=>console.log(`Running ${BASE}`));
