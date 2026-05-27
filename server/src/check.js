import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

// В ES-модулях создаем аналог __dirname самостоятельно
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Формируем путь к базе в папке ../checker
const dbPath = path.join(__dirname, '..', 'checker', 'metrics.db');

// Включаем подробный режим отладки
const sqlite3Verbose = sqlite3.verbose();

// Открываем базу данных в режиме Read-Only
const db = new sqlite3Verbose.Database(dbPath, sqlite3Verbose.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Не удалось найти файл по пути:', dbPath);
        return console.error('Ошибка:', err.message);
    }
    console.log('Успешное подключение к:', dbPath);
});

const sql = `SELECT * FROM system_metrics ORDER BY id DESC LIMIT 5`;

db.all(sql, [], (err, rows) => {
    if (err) {
        return console.error(err.message);
    }
    
    if (rows.length === 0) {
        console.log("Таблица пуста или еще не создана.");
    } else {
        console.log("\n--- ПОСЛЕДНИЕ 5 ЗАПИСЕЙ ИЗ БАЗЫ ---");
        console.table(rows);
    }
});

db.close();