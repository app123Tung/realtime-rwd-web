const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 建立或連接 SQLite 資料庫
const dbFile = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('資料庫連線失敗', err.message);
    } else {
        console.log('成功連接至 SQLite 資料庫');
    }
});

// 初始化資料表
db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 託管靜態前端檔案
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Socket.io 連線監聽
io.on('connection', (socket) => {
    console.log('有使用者已連線:', socket.id);

    // 當前端送出新資料時
    socket.on('new_message', (data) => {
        const stmt = db.prepare('INSERT INTO messages (content) VALUES (?)');
        stmt.run(data.content, function(err) {
            if (!err) {
                // 取得剛新增的資料
                db.get(`SELECT * FROM messages WHERE id = ?`, [this.lastID], (err, row) => {
                    if (!err && row) {
                        // 廣播給所有連線中的客戶端（即時更新）
                        io.emit('update_message', row);
                    }
                });
            }
        });
        stmt.finalize();
    });

    socket.on('disconnect', () => {
        console.log('使用者已斷線:', socket.id);
    });
});

// 提供初始資料的 API
app.get('/api/messages', (req, res) => {
    db.all('SELECT * FROM messages ORDER BY id DESC LIMIT 50', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器執行於 http://localhost:${PORT}`);
});
