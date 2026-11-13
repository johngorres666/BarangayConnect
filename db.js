
require("dotenv").config();

const { Pool } = require("pg");

console.log("Database username being used:", process.env.DB_USER);

const pool = new Pool({
    console.log("Database username being used:", process.env.DB_USER);
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = pool;
