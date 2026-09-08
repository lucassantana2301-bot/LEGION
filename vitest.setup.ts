import dotenv from "dotenv";

// Load .env.local first (highest priority), followed by .env
dotenv.config({ path: ".env.local" });
dotenv.config();
