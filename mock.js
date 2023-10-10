const { faker } = require('@faker-js/faker');
const { BotDb } = require('./storage');
const sharp = require('sharp');
const Axios = require('axios');
const fs = require('fs');
const db = new BotDb();

function downloadFile(url, fname) {
  const writer = fs.createWriteStream(fname);
  return Axios({
    method: 'get',
    url,
    responseType: 'stream',
  }).then(response => {
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      let error = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) {
          resolve(true);
        }
      });
    });
  });
}

const sexualities = [
  'hetero',
  'gay',
  'lesbian',
  'bisexual',
  'pansexual',
  'polysexual',
  'asexual',
  'queer',
  'bi-curious',
  'heteroflexible',
  'homoflexible',
  'gray-A',
  'androgynosexual',
  'androsexual',
  'autosexual',
  'demisexual',
  'gynosexual',
  'objectumsexual',
  'omnisexual',
  'skoliosexual',
];

const lookingfor = [4, 2, 6, 0, 4, 2, 4, 2, 4, 2, 8, 64, 62, 102, 126, 4, 2];

(async () => {
  await db.deleteFakeUsers();

  for (let i = 0; i < 300; i++) {
    const photoId = Math.random() < 0.2 ? null : (Math.floor(Math.random() * 1e14).toString(36) + Math.floor(Math.random() * 1e14).toString(36));

    const tgId = -Math.floor(Math.random() * 1e9);
    const sexType = faker.person.sexType();

    const gender = Math.random() < 0.05 ? 5 : (sexType == 'female' ? (Math.random() < 0.1 ? 3 : 1) : (Math.random() < 0.1 ? 4 : 2));
    const displayGender = Math.random() < 0.6 ? null : faker.person.gender().toLowerCase();
    
    const firstName = faker.person.firstName(gender == 5 ? undefined : sexType);
    const lastName = faker.person.lastName(gender == 5 ? undefined : sexType);

    const pronouns = Math.random() < 0.1 ? (sexType == 'female' ? 'she/her' : 'he/him') : null;
    const sexuality = Math.random() < 0.3 ? null : sexualities[Math.floor(Math.random() * sexualities.length)];
    const city = Math.random() < 0.6 ? faker.location.city() : null;

    const birthdate = Math.random() < 0.25 ? null : faker.date.birthdate({ min: 18, max: 48, mode: 'age' });
    const hasPartner = Math.random() < 0.1;

    const lastSeen = Math.floor(faker.date.recent({ days: 20 }).getTime() / 1000);
    const height = Math.random() < 0.8 ? null : Math.floor(160 + Math.random() * 50);
    const weight = Math.random() < 0.8 ? null : Math.floor(50 + Math.random() * 50);
    const about = Math.random() < 0.3 ? null : faker.lorem.sentences({ min: 1, max: 6 });

    const look = lookingfor[Math.floor(lookingfor.length * Math.random())];

    await db.runAsync('INSERT INTO users (tg_id, first_name, last_name, username, lang, last_seen, gender, display_gender, photo_id, pronouns, sexuality, city, birthdate, has_partner, height, weight, about, lookingfor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      tgId,
      firstName, lastName, null,
      'en',
      lastSeen,
      gender, displayGender,
      photoId,
      pronouns,
      sexuality,
      city,
      birthdate ? `${birthdate.getDate().toString().padStart(2, '0')}.${(birthdate.getMonth() + 1).toString().padStart(2, '0')}.${birthdate.getFullYear()}` : null,
      hasPartner ? 1 : 0,
      height, weight, about, look
    );

    const userId = db.lastId;
    if (photoId) {
      const ratio = 0.92 + Math.random() * (1.22 - 0.92);
      const width = 720;
      const height = Math.floor(width / ratio);
      const photoUrl = faker.image.urlLoremFlickr({ width, height, category: 'portrait' });
      console.log(photoUrl);
      
      fs.mkdirSync(`static/files/${userId}`);

      const path2x = `static/files/${userId}/${photoId}.2x.jpg`;
      await downloadFile(photoUrl, path2x);

      const path = `static/files/${userId}/${photoId}.jpg`;
      await sharp(path2x).resize(width / 2, Math.floor(height / 2)).jpeg().toFile(path);
    }
  }
})();