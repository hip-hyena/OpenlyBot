const sqlite3 = require('sqlite3').verbose();

class Database extends sqlite3.Database {
  constructor(name) {
    super(`./${name}.sqlite3`);

    // Create async methods instead of callbacks
    const _this = this;
    for (let fnName of ['run', 'all', 'get', 'exec']) {
      this[fnName + 'Async'] = (sql, ...params) => {
        return new Promise((resolve, reject) => {
          const t0 = Date.now();
          this[fnName](sql, ...params, function(err, res) {
            _this.lastId = this.lastID;
            _this.lastQueryTime = Date.now() - t0;
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
        });
      }
    }
  }

  createTables(tables) {
    const queries = [];
    for (let tableName in tables) {
      const table = tables[tableName];
      const columns = table.columns;
      queries.push(`CREATE TABLE IF NOT EXISTS ${tableName} (` + Object.keys(columns).map(columnName => {
        const column = columns[columnName];
        if (typeof column == 'string') {
          return `${columnName} ${column}`;
        }
        return `${columnName} ${column.type}` +
          (column.notNull ? ' NOT NULL' : '') +
          ('default' in column ? ' DEFAULT ' + column.default : '') +
          (column.primary ? ' PRIMARY KEY' : '');
      }).concat(table.primary ? [`PRIMARY KEY (${table.primary.join(', ')})`] : []).join(', ') + `);`);

      for (let index of (table.indices || [])) {
        const name = index.name || `${tableName}_idx_${index.columns.map(column => column.split(' ')[0]).join('_')}`;
        queries.push(`CREATE${index.unique ? ' UNIQUE' : ''} INDEX IF NOT EXISTS ${name} ON ${tableName} (${index.columns.join(', ')});`);
      }
    }
    return this.execAsync(queries.join('\n'));
  }

  bulkInsert(tableName, columns, { ignore = false, batchSize = 3000 } = {}) {
    let args = [], params = [];
    return async (...values) => {
      if (values.length) {
        args.push('(' + '?'.repeat(values.length).split('').join(', ') + ')');
        params.push(...values);
      }

      if (args.length >= batchSize || (args.length > 0 && !values.length)) {
        await this.runAsync(`INSERT${ignore ? ' OR IGNORE' : ''} INTO ${tableName} (${columns.join(', ')}) VALUES ${args.join(', ')}`, params);
        args = [];
        params = [];
      }
    };
  }
}

class BotDb extends Database {
  constructor() {
    super('db');
  }

  createTables() {
    return super.createTables({
      users: {
        columns: {
          // We can't use Telegram ids as our identifiers, unfortunately, because this would allow to de-anonymize users
          id: { type: 'INTEGER', primary: true },
          tg_id: { type: 'INT', notNull: true },
          name: 'TEXT',
          first_name: { type: 'TEXT', notNull: true },
          last_name: 'TEXT',
          username: 'TEXT',
          interests: 'TEXT',
          photo_id: 'TEXT', // TODO: migrate to photos table
          about: 'TEXT',
          hide_profile: { type: 'INT', notNull: true, default: 0 },
          lang: { type: 'TEXT', notNull: true },
          gender: 'INT',
          search_gender: 'INT',
          display_gender: 'TEXT',
          pronouns: 'TEXT',
          sexuality: 'TEXT',
          lookingfor: 'INT',
          birthdate: 'TEXT',
          city: 'TEXT',
          geo_lng: 'REAL', // geo_lng+geo_lat => geo in PostgreSQL
          geo_lat: 'REAL',
          height: 'INT',
          weight: 'INT',
          last_seen: { type: 'INT', notNull: true },
          partner_id: 'INT',
          partner_code: 'TEXT',
          has_partner: { type: 'INT', notNull: true, default: 0 },
          onboarding_step: { type: 'INT', notNull: true, default: 0 },
          profile_step: { type: 'INT', notNull: true, default: 0 },
          seen_ids: { type: 'TEXT', notNull: true, default: '""' },
          prev_ids: { type: 'TEXT', notNull: true, default: '""' },
          next_ids: { type: 'TEXT', notNull: true, default: '""' },
          deactivated: { type: 'INT', notNull: true, default: 0 },
          stopped: { type: 'INT', notNull: true, default: 0 },
          unlinkable: { type: 'INT', notNull: true, default: 0 },
          standing: { type: 'INT', notNull: true, default: 0 },
          last_geo_change: 'INT',

          // These would be generated fields in PostgreSQL
          gen_score: { type: 'INT', notNull: true, default: 0 },
          gen_active: { type: 'INT', notNull: true, default: 0 },
          gen_has_geo: { type: 'INT', notNull: true, default: 0 },
        },
        indices: [{
          columns: ['tg_id'],
          unique: true,
        }],
      },
      likes: {
        columns: {
          liker_id: { type: 'INT', notNull: true },
          likee_id: { type: 'INT', notNull: true },
          like_type: { type: 'INT', notNull: true },
          liked_at: { type: 'INT', notNull: true },
        },
        primary: ['liker_id', 'likee_id'],
      },
      photos: {
        columns: {
          id: { type: 'TEXT', primary: true },
          user_id: { type: 'INT', notNull: true },
          order_pos: { type: 'INT', notNull: true, default: 0 },
          is_private: { type: 'INT', notNull: true, default: 0 },
          is_nsfw: { type: 'INT', notNull: true, default: 0 },
          is_hidden: { type: 'INT', notNull: true, default: 0 },
          width: { type: 'INT', notNull: true },
          height: { type: 'INT', notNull: true },
          uploaded_at: { type: 'INT', notNull: true },
        }
      }
    })
  }

  async upsertUserByTgUser({ id, first_name, last_name, username, language_code }) {
    await this.runAsync('INSERT INTO users (tg_id, first_name, last_name, username, lang, last_seen) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tg_id) DO UPDATE SET first_name=excluded.first_name, last_name=excluded.last_name, username=excluded.username, last_seen=excluded.last_seen', id, first_name, last_name || null, username, language_code || 'en', Math.floor(Date.now() / 1000));
    return this.getAsync('SELECT * FROM users WHERE tg_id = ?', id);
  }

  userById(id) {
    return this.getAsync('SELECT * FROM users WHERE id = ?', id);
  }

  userByTgId(id) {
    return this.getAsync('SELECT * FROM users WHERE tg_id = ?', id);
  }

  updateUserByTgId(id, fields) {
    if (!Object.keys(fields).length) {
      return;
    }
    return this.runAsync('UPDATE users SET ' + Object.keys(fields).map(k => `${k} = ?`).join(', ') + ' WHERE tg_id = ?', Object.keys(fields).map(k => fields[k]).concat([id]));
  }

  usersByCriteria(exceptIds, offs = 0) {
    return this.allAsync('SELECT * FROM users WHERE id NOT IN (' + exceptIds.map(id => '?') + ') AND NOT hide_profile AND NOT deactivated LIMIT ?, 40', ...exceptIds, offs);
  }

  likeUser(likerId, likeeId, likeType) {
    return this.runAsync('INSERT INTO likes (liker_id, likee_id, like_type, liked_at) VALUES (?, ?, ?, ?) ON CONFLICT (liker_id, likee_id) DO UPDATE SET like_type=excluded.like_type, liked_at=excluded.liked_at', likerId, likeeId, likeType, Math.floor(Date.now() / 1000));
  }

  likeByLikerLikee(likerId, likeeId) {
    return this.getAsync('SELECT * FROM likes WHERE liker_id = ? AND likee_id = ?', likerId, likeeId);
  }

  matchesByLiker(likerId) {
    return this.allAsync('SELECT * FROM likes LEFT JOIN users ON users.id = likes.likee_id WHERE liker_id = ? AND like_type = 2 ORDER BY liked_at DESC', likerId);
  }

  deleteUserById(id) {
    return this.runAsync('DELETE FROM users WHERE id = ?', id);
  }

  deleteLikesByLikerOrLikee(id) {
    return this.runAsync('DELETE FROM likes WHERE liker_id = ? OR likee_id = ?', id);
  }

  deleteFakeUsers() {
    return this.runAsync('DELETE FROM users WHERE tg_id < 0');
  }
}

module.exports = { BotDb };