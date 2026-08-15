require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { getDatabaseConfig } = require('../config/database');

async function migrate() {
  const { databaseUrl, databaseName } = getDatabaseConfig();
  await mongoose.connect(databaseUrl, { dbName: databaseName });
  console.log("Connected to database");

  try {
    const result = await mongoose
      .connection
      .collection("gallery")
      .updateMany({ name: { $exists: false } }, { $set: { name: "moon" } });

    console.log(`Migration complete: ${result.modifiedCount} documents updated → name="moon"`);
  } finally {
    await mongoose.disconnect();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
