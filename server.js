
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./db");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://127.0.0.1:5500",
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60
}
}));


app.post("/api/admin/login", async (req, res) => {
    try {
        const email =
            typeof req.body.email === "string"
                ? req.body.email.trim().toLowerCase()
                : "";

        const password =
            typeof req.body.password === "string"
                ? req.body.password
                : "";

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const result = await pool.query(
            `SELECT staff_id, full_name, email, password_hash, role
             FROM staff_users
             WHERE email = $1`,
            [email]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const staff = result.rows[0];
        const passwordMatches = await bcrypt.compare(
            password,
            staff.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        await new Promise((resolve, reject) => {
            req.session.regenerate((error) => {
                if (error) return reject(error);
                resolve();
            });
        });

        req.session.staff = {
            staff_id: staff.staff_id,
            full_name: staff.full_name,
            email: staff.email,
            role: staff.role
        };

        await new Promise((resolve, reject) => {
            req.session.save((error) => {
                if (error) return reject(error);
                resolve();
            });
        });

        return res.json({
            success: true,
            message: "Login successful.",
            staff: req.session.staff
        });
    } catch (error) {
        console.error("Staff login failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to log in right now."
        });
    }
});

// Log out the admin and destroy the session
app.post("/api/admin/logout", (req, res) => {
    if (!req.session) {
        return res.json({
            success: true,
            message: "Logged out successfully."
        });
    }

    req.session.destroy((error) => {
        if (error) {
            console.error("Logout failed:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to log out."
            });
        }

        res.clearCookie("connect.sid");

        return res.json({
            success: true,
            message: "Logged out successfully."
        });
    });
});

function requireStaffLogin(req, res, next) {
    if (!req.session || !req.session.staff) {
        return res.status(401).json({
            success: false,
            message: "Please log in to access this resource."
        });
    }

    next();
}


function requireAdmin(req, res, next) {
    console.log("ADMIN CHECK REACHED");
    console.log("Session staff:", req.session?.staff);

    if (!req.session || !req.session.staff) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    if (req.session.staff.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Administrator access required."
        });
    }

    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0"
    });

    next();
}



const PORT = process.env.PORT || 3000;

// Temporary server test
app.get("/test", (req, res) => {
    res.send("BarangayConnect server is updated!");
});

// Test the PostgreSQL database connection
app.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database() AS database_name"
        );

        res.json({
            success: true,
            message: "Database connection successful!",
            database: result.rows[0].database_name
        });
    } catch (error) {
        console.error("Database test failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});


 // Register a new resident
app.post("/api/residents/register", async (req, res) => {
    try {
        // Accept both the frontend and database-style field names
        const first_name = req.body.firstName ?? req.body.first_name;
        const middle_name = req.body.middleName ?? req.body.middle_name;
        const surname = req.body.surname;
        const suffix = req.body.suffix;
        const birth_date = req.body.birthday ?? req.body.birth_date;
        const address = req.body.address;
        const phone = req.body.phone;
        const email =
            typeof req.body.email === "string"
                ? req.body.email.trim().toLowerCase() || null
                : null;

        // Validate required fields
        if (
            typeof first_name !== "string" ||
            !first_name.trim() ||
            typeof surname !== "string" ||
            !surname.trim() ||
            typeof birth_date !== "string" ||
            !birth_date.trim() ||
            typeof address !== "string" ||
            !address.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "First name, surname, birth date, and address are required."
            });
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid birth date."
            });
        }

        // Validate that the date exists and isn't in the future
        const parsedDate = new Date(`${birth_date}T00:00:00Z`);
        const today = new Date().toISOString().slice(0, 10);

        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== birth_date ||
            birth_date > today
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Birth date must be a valid date that is not in the future."
            });
        }

        // Save the resident to PostgreSQL
        const result = await pool.query(
            `INSERT INTO residents (
                first_name,
                middle_name,
                surname,
                suffix,
                birth_date,
                address,
                phone,
                email
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                resident_id,
                first_name,
                surname,
                registration_status,
                created_at`,
            [
                first_name.trim(),
                typeof middle_name === "string"
                    ? middle_name.trim() || null
                    : null,
                surname.trim(),
                typeof suffix === "string"
                    ? suffix.trim() || null
                    : null,
                birth_date,
                address.trim(),
                typeof phone === "string"
                    ? phone.trim() || null
                    : null,
                email
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Resident registered successfully!",
            resident: result.rows[0]
        });

    } catch (error) {
        // Handle duplicate email addresses
        if (
            error.code === "23505" &&
            error.constraint === "residents_email_unique"
        ) {
            return res.status(409).json({
                success: false,
                message: "This email address is already registered."
            });
        }

        console.error("Resident registration failed:", error);

        return res.status(500).json({
            success: false,
            message:
                "Registration failed. Please check the information and try again."
        });
    }
});

// Get live statistics for the admin dashboard
app.get(
    "/api/admin/dashboard-stats",
    requireAdmin,
    async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM residents)
                    AS registered_residents,

                (SELECT COUNT(*) FROM residents
                 WHERE registration_status = 'pending')
                    AS pending_residents,

                (SELECT COUNT(*) FROM residents
                 WHERE registration_status = 'approved')
                    AS approved_residents,

                (SELECT COUNT(*) FROM residents
                 WHERE registration_status = 'rejected')
                    AS rejected_residents,

                (SELECT COUNT(*) FROM service_requests
                 WHERE request_status = 'pending')
                    AS pending_requests,

                (SELECT COUNT(*) FROM service_requests
                 WHERE submitted_at::date = CURRENT_DATE)
                    AS requests_received_today,

                (SELECT COUNT(*) FROM service_requests
                 WHERE request_status IN (
                     'approved', 'rejected', 'completed'
                 ))
                    AS requests_processed
        `);

        const stats = result.rows[0];

        res.json({
            success: true,
            stats: {
                registeredResidents: Number(stats.registered_residents),
                pendingResidents: Number(stats.pending_residents),
                approvedResidents: Number(stats.approved_residents),
                rejectedResidents: Number(stats.rejected_residents),
                pendingRequests: Number(stats.pending_requests),
                requestsReceivedToday: Number(stats.requests_received_today),
                requestsProcessed: Number(stats.requests_processed)
            }
        });
    } catch (error) {
        console.error("Dashboard statistics failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load dashboard statistics."
        });
    }
});

// Get all service requests with resident full names
app.get("/api/requests", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                sr.request_id,
                sr.resident_id,
                TRIM(CONCAT_WS(' ',
                    r.first_name,
                    NULLIF(r.middle_name, ''),
                    r.surname,
                    NULLIF(r.suffix, '')
                )) AS resident_name,
                sr.service_type,
                sr.description,
                sr.request_status,
                sr.submitted_at,
                sr.updated_at
            FROM service_requests sr
            INNER JOIN residents r
                ON sr.resident_id = r.resident_id
            ORDER BY sr.submitted_at DESC
        `);

        return res.json({
            success: true,
            requests: result.rows
        });

    } catch (error) {
        console.error(
            "Failed to retrieve service requests:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve service requests."
        });
    }
});
// Update a service request's status
app.patch(
    "/api/requests/:id/status",
    requireAdmin,
    async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        const status = req.body.request_status ?? req.body.status;

        if (!Number.isSafeInteger(requestId) || requestId < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid request ID."
            });
        }

        const allowedStatuses = [
            "approved",
            "rejected",
            "completed"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be approved, rejected, or completed."
            });
        }

        const result = await pool.query(
            `UPDATE service_requests
             SET request_status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $2
             RETURNING
                 request_id,
                 resident_id,
                 service_type,
                 description,
                 request_status,
                 submitted_at,
                 updated_at`,
            [status, requestId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        return res.json({
            success: true,
            message: `Service request ${status}.`,
            request: result.rows[0]
        });
    } catch (error) {
        console.error(
            "Service request status update failed:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update service request status."
        });
    }
});

// Get approved residents for service request form
app.get("/api/residents/approved-names", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                resident_id,
                TRIM(
                    CONCAT_WS(' ',
                        first_name,
                        NULLIF(middle_name, ''),
                        surname,
                        NULLIF(suffix, '')
                    )
                ) AS full_name
            FROM residents
            WHERE registration_status = 'approved'
            ORDER BY surname, first_name
        `);

        return res.json({
            success: true,
            residents: result.rows
        });
    } catch (error) {
        console.error("Failed to load approved residents:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load resident names."
        });
    }
});

// Add a resident through the admin dashboard
app.post("/api/admin/residents", requireAdmin, async (req, res) => {
    try {
        const {
            first_name,
            middle_name,
            surname,
            suffix,
            birth_date,
            address,
            phone,
            email
        } = req.body;

        if (
            typeof first_name !== "string" || !first_name.trim() ||
            typeof surname !== "string" || !surname.trim() ||
            typeof birth_date !== "string" || !birth_date.trim() ||
            typeof address !== "string" || !address.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        const result = await pool.query(
            `INSERT INTO residents (
                first_name,
                middle_name,
                surname,
                suffix,
                birth_date,
                address,
                phone,
                email,
                registration_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved')
            RETURNING resident_id, first_name, middle_name, surname,
                      suffix, birth_date, address, phone, email,
                      registration_status, created_at`,
            [
                first_name.trim(),
                middle_name?.trim() || null,
                surname.trim(),
                suffix?.trim() || null,
                birth_date,
                address.trim(),
                phone?.trim() || null,
                email?.trim() || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Resident added successfully!",
            resident: result.rows[0]
        });
    } catch (error) {
        console.error("Failed to add resident:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to add resident."
        });
    }
});

// Create a new service request using the resident's full name
app.post("/api/requests", async (req, res) => {
    try {
        const { full_name, service_type, description } = req.body;

        if (
            typeof full_name !== "string" ||
            !full_name.trim() ||
            typeof service_type !== "string" ||
            !service_type.trim() ||
            typeof description !== "string" ||
            !description.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide your full name, service type, and description."
            });
        }

        const resident = await pool.query(
            `SELECT resident_id
             FROM residents
             WHERE registration_status = 'approved'
             AND regexp_replace(
                 LOWER(TRIM(CONCAT_WS(' ',
                     first_name,
                     NULLIF(middle_name, ''),
                     surname,
                     NULLIF(suffix, '')
                 ))),
                 '\\s+', ' ', 'g'
             ) = regexp_replace(LOWER(TRIM($1)), '\\s+', ' ', 'g')
             LIMIT 2`,
            [full_name]
        );

        if (resident.rowCount === 0) {
            return res.status(403).json({
                success: false,
                message: "Resident not found or registration not approved. Please check your registered full name."
            });
        }

        if (resident.rowCount > 1) {
            return res.status(409).json({
                success: false,
                message: "Multiple residents have this name. Please contact the barangay office."
            });
        }

        const result = await pool.query(
            `INSERT INTO service_requests
                (resident_id, service_type, description)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [
                resident.rows[0].resident_id,
                service_type.trim(),
                description.trim()
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Request submitted successfully!",
            request: result.rows[0]
        });

    } catch (error) {
        console.error("Request submission failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to submit your service request."
        });
    }
});



 // Get all residents for the Resident Management page
app.get("/api/residents", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                resident_id,
                first_name,
                middle_name,
                surname,
                suffix,
                birth_date,
                address,
                phone,
                email,
                profile_picture_path,
                registration_status,
                created_at
            FROM residents
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            residents: result.rows
        });
    } catch (error) {
        console.error("Failed to load residents:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load resident records."
        });
    }
});


 // Approve or reject a resident registration
app.patch(
    "/api/residents/:id/status",
    requireAdmin,
    async (req, res) => {
    try {
        const residentId = Number(req.params.id);
        const status = req.body.registration_status ?? req.body.status;

        if (!Number.isSafeInteger(residentId) || residentId < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid resident ID."
            });
        }

        const allowedStatuses = ["approved", "rejected"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be approved or rejected."
            });
        }

        const result = await pool.query(
            `UPDATE residents
             SET registration_status = $1
             WHERE resident_id = $2
             RETURNING
                resident_id,
                first_name,
                middle_name,
                surname,
                suffix,
                registration_status,
                created_at`,
            [status, residentId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Resident not found."
            });
        }

        return res.json({
            success: true,
            message: `Resident ${status} successfully.`,
            resident: result.rows[0]
        });

    } catch (error) {
        console.error("Resident status update failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update resident status."
        });
    }
});


app.get("/admin-dashboard.html", requireAdmin, (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "admin-dashboard.html")
    );
});


app.get("/admin-residents.html", requireAdmin, (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "admin-residents.html")
    );
});


app.get("/admin-reports.html", requireAdmin, (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "admin-reports.html")
    );
});

app.get("/admin-requests.html", requireAdmin, (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "admin-requests.html")
    );
});

app.get("/admin-add-resident.html", requireAdmin, (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "admin-add-resident.html")
    );
});


// Serve website files from the public folder
app.use(express.static(path.join(__dirname, "public"), {
    index: false
}));

// Display the homepage
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).send("Page not found. Check the URL.");
});

// Start the server
app.listen(PORT, () => {
    console.log(
        `BarangayConnect server is running at http://localhost:${PORT}`
    );
});
