const path = require('path'); 
require('dotenv').config({ path: path.join(__dirname, '.env') });

const TelegramBot = require('node-telegram-bot-api');
const multer  = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const { BotDb } = require('./storage');

const db = new BotDb();
const app = express();
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

function validateInitData(initData) {
  const data = {};
  const raw = {};
  let hash;
  for (let line of initData.split('&')) {
    const pair = line.split('=');
    if (pair.length == 2) {
      const key = decodeURIComponent(pair[0]);
      const value = decodeURIComponent(pair[1]);
      if (key == 'hash') {
        hash = value;
      } else {
        raw[key] = value;
        data[key] = (key == 'user') ? JSON.parse(value) : value;
      }
    }
  }
  const keys = Object.keys(data);
  keys.sort();

  const list = [];
  for (let key of keys) {
    list.push(`${key}=${raw[key]}`);
  }
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_TOKEN).digest();
  const correctHash = crypto.createHmac('sha256', secretKey).update(list.join('\n')).digest('hex');
  
  if (correctHash != hash) {
    return null;
  }
  return data;
}

db.createTables();

bot.onText(/^\/start/, (msg, match) => {
  const chatId = msg.chat.id;
  //bot.sendMessage(chatId, 'Hello');
});

bot.on('message', (msg) => {
  
});

function userProfiles(rows) {
  return rows.map(row => {
    const user = {};
    for (let k in row) {
      if (['id', 'name', 'interests', 'about', 'gender', 'display_gender', 'pronouns', 'sexuality', 'lookingfor', 'city', 'height', 'weight', 'photo_id'].includes(k)) {
        user[k] = row[k];
      }
    }
    if (!user.name) {
      user.name = row.first_name;
    }
    // TODO: compute age
    return user;
  });
}

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;
  while (currentIndex > 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

app.use(express.json());
app.use(express.static('static'));
app.post('/init', async (req, res) => {
  const initData = validateInitData(req.body.initData);
  if (!initData) {
    res.json({ error: 'Invalid initData' });
    return;
  }
  const me = await db.upsertUserByTgUser(initData.user);
  res.json({ user: me });
});
app.post('/update', async (req, res) => {
  const initData = validateInitData(req.body.initData);
  if (!initData) {
    res.json({ error: 'Invalid initData' });
    return;
  }

  const fields = {};
  for (let key in req.body) {
    if (!['name', 'interests', 'about', 'hide_profile', 'lang', 'gender', 'display_gender', 'pronouns', 'sexuality', 'lookingfor', 'birthdate', 'city', 'geo', 'height', 'weight', 'onboarding_step', 'profile_step'].includes(key)) {
      continue;
    }
    fields[key] = req.body[key];
  }

  await db.updateUserByTgId(initData.user.id, fields);
  res.json({ ok: true });
});


function getNormalSize({ width, height, orientation }) {
  return (orientation || 0) >= 5
    ? { width: height, height: width }
    : { width, height };
}
app.post('/upload', upload.single('file'), async (req, res) => {
  const initData = validateInitData(req.body.initData);
  if (!initData) {
    res.json({ error: 'Invalid initData' });
    return;
  }

  const img = sharp(req.file.buffer);
  const size = getNormalSize(await img.metadata());
  const ratio = Math.max(0.92, Math.min(1.22, size.width / size.height));

  const targetSize = [360, Math.floor(360 / ratio)];
  const scaledImg = await img.resize(targetSize[0], targetSize[1], { fit: 'cover', position: 'attention' }).jpeg({ mozjpeg: true }).toBuffer();
  const scaledImg2x = await img.resize(targetSize[0] * 2, targetSize[1] * 2, { fit: 'cover', position: 'attention' }).jpeg({ quality: 75, mozjpeg: true }).toBuffer();

  const me = await db.userByTgId(initData.user.id);
  const id = Math.floor(Math.random() * 1e14).toString(36) + Math.floor(Math.random() * 1e14).toString(36);
  fs.mkdir(`static/files/${me.id}`, () => {
    fs.writeFile(`static/files/${me.id}/${id}.jpg`, scaledImg, () => {
      fs.writeFile(`static/files/${me.id}/${id}.2x.jpg`, scaledImg2x, async () => {
        await db.updateUserByTgId(initData.user.id, {
          photo_id: id,
        });
        res.json({ id });
      });
    });
  });
});
app.post('/matches', async (req, res) => {
  const initData = validateInitData(req.body.initData);
  if (!initData) {
    res.json({ error: 'Invalid initData' });
    return;
  }
  const me = await db.userByTgId(initData.user.id);
  const feed = userProfiles(await db.matchesByLiker(me.id));
  res.json({ feed });
});
app.post('/delete', async (req, res) => {
  const initData = validateInitData(req.body.initData);
  if (!initData) {
    res.json({ error: 'Invalid initData' });
    return;
  }
  const me = await db.userByTgId(initData.user.id);
  await db.deleteLikesByLikerOrLikee(me.id);
  await db.deleteUserById(me.id);
  res.json({ ok: true });
});
app.post('/search', async (req, res) => {
  const initData = validateInitData(req.body.initData);
  if (!initData) {
    res.json({ error: 'Invalid initData' });
    return;
  }

  if (req.body.local) {
    const lng = parseFloat(req.body.longitude);
    const lat = parseFloat(req.body.latitude);
    await db.updateUserByTgId(initData.user.id, { geo_lng: lng, geo_lat: lat });
  }

  const me = await db.userByTgId(initData.user.id);
  const feed = shuffle(userProfiles(await db.usersByCriteria([me.id])));
  res.json({ feed });
});
app.post('/like', async (req, res) => {
  const initData = validateInitData(req.body.initData);
  if (!initData) {
    res.json({ error: 'Invalid initData' });
    return;
  }
  if (req.body.type != 1 && req.body.type != -1) {
    res.json({ error: 'Invalid like type' });
    return;
  }
  const me = await db.userByTgId(initData.user.id);
  const likeeId = req.body.id;
  let likeType = req.body.type;

  const likeBack = await db.likeByLikerLikee(likeeId, me.id);
  if (likeType == 1) {
    if (likeBack && likeBack.like_type > 0) { // Upgrade like to mutual
      await db.likeUser(me.id, likeeId, 2);
      await db.likeUser(likeeId, me.id, 2);
      res.json({ ok: true, mutual: await db.userById(likeeId) });
      // TODO: also notify other person
      return;
    }
  } else {
    if (likeBack && likeBack.like_type == 2) { // Downgrade like from mutual
      await db.likeUser(likeeId, me.id, 1);
    }
  }
  await db.likeUser(me.id, req.body.id, likeType);
  res.json({ ok: true });
});

app.listen(process.env.MINIAPP_PORT, () => {
  console.log(`@${process.env.TELEGRAM_USERNAME} listening on port ${process.env.MINIAPP_PORT}`);
});