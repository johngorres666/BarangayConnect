
require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("./db");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function createAdmin() {
    try {
        const fullName = (await ask("Admin full name: ")).trim();
        const email = (await ask("Admin email: "))
            .trim()
            .toLowerCase();
        const password = await ask("Create admin password: ");

        if (!fullName || !email || password.length < 12) {
            console.log(
                "Name and email are required. Password must be at least 12 characters."
            );
            return;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await pool.query(
            `INSERT INTO staff_users
                (full_name, email, password_hash, role)
             VALUES ($1, $2, $3, 'admin')`,
            [fullName, email, passwordHash]
        );

        console.log("Admin account created successfully.");
    } catch (error) {
        if (error.code === "23505") {
            console.log("That email is already registered.");
        } else {
            console.error("Admin creation failed:", error.message);
        }
    } finally {
        rl.close();
        await pool.end();
    }
}

createAdmin();
