require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { getDatabaseConfig } = require('../config/database');

async function migrate() {
  const { databaseUrl, databaseName } = getDatabaseConfig();
  await mongoose.connect(databaseUrl, { dbName: databaseName });
  console.log("Connected to database");

  try {
    const UserModel = require("../models/user");
    const GalaxyModel = require("../models/galaxy");

    // 1. Tạo user owner nếu chưa có
    let owner = await UserModel.findOne({ email: "nguye4567@gmail.com" });
    if (!owner) {
      const passwordHash = await bcrypt.hash("changeme123", 10);
      owner = await UserModel.create({
        email: "nguye4567@gmail.com",
        passwordHash,
        role: "admin",
      });
      console.log(`Created owner user: ${owner._id}`);
    } else {
      console.log(`Owner already exists: ${owner._id}`);
    }

    // 2. Tạo Galaxy "moon" nếu chưa có
    let moonGalaxy = await GalaxyModel.findOne({ userId: owner._id, name: "moon" });
    if (!moonGalaxy) {
      moonGalaxy = await GalaxyModel.create({ userId: owner._id, name: "moon" });
      console.log(`Created galaxy moon: ${moonGalaxy._id}`);
    } else {
      console.log(`Galaxy moon exists: ${moonGalaxy._id}`);
    }

    // 3. Tạo Galaxy "emiu" nếu chưa có
    let emiuGalaxy = await GalaxyModel.findOne({ userId: owner._id, name: "emiu" });
    if (!emiuGalaxy) {
      emiuGalaxy = await GalaxyModel.create({ userId: owner._id, name: "emiu" });
      console.log(`Created galaxy emiu: ${emiuGalaxy._id}`);
    } else {
      console.log(`Galaxy emiu exists: ${emiuGalaxy._id}`);
    }

    // 4. Update Gallery documents: name "moon" → galaxyId
    const moonResult = await mongoose.connection.collection("gallery").updateMany(
      { name: "moon" },
      { $set: { galaxyId: moonGalaxy._id }, $unset: { name: "" } }
    );
    console.log(`Moon gallery updated: ${moonResult.modifiedCount} documents`);

    // 5. Update Gallery documents: name "emiu" → galaxyId
    const emiuResult = await mongoose.connection.collection("gallery").updateMany(
      { name: "emiu" },
      { $set: { galaxyId: emiuGalaxy._id }, $unset: { name: "" } }
    );
    console.log(`Emiu gallery updated: ${emiuResult.modifiedCount} documents`);

    console.log("\n=== Migration complete ===");
    console.log(`Moon galaxy ID: ${moonGalaxy._id}`);
    console.log(`Emiu galaxy ID: ${emiuGalaxy._id}`);
    console.log("\nUpdate frontend URLs:");
    console.log(`  moon: /galaxy-moon/?galaxyId=${moonGalaxy._id}`);
    console.log(`  emiu: /galaxy-moon/?galaxyId=${emiuGalaxy._id}`);
  } finally {
    await mongoose.disconnect();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
