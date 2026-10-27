
const pool = require("./db");

async function checkRoleRules() {
    try {
        const result = await pool.query(`
            SELECT
                conname AS constraint_name,
                pg_get_constraintdef(oid) AS rule
            FROM pg_constraint
            WHERE conrelid = 'public.staff_users'::regclass
            ORDER BY conname;
        `);

        console.log("Staff table constraints:");

        if (result.rowCount === 0) {
            console.log("No table constraints found.");
        }

        result.rows.forEach((row) => {
            console.log(`${row.constraint_name}: ${row.rule}`);
        });
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await pool.end();
    }
}

checkRoleRules();
