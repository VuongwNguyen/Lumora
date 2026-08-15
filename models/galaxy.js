const { model, Schema } = require("mongoose");
const { SOUNDSCAPE_INSTRUMENT_KEYS, SOUNDSCAPE_KEYS } = require('../config/soundscapes');

const soundscapeSchema = new Schema({
  preset: {
    type: String,
    enum: [...SOUNDSCAPE_KEYS],
    default: 'none',
  },
  intensity: { type: Number, min: 0, max: 100, default: 0 },
  warmth: { type: Number, min: 0, max: 100, default: 50 },
  motion: { type: Number, min: 0, max: 100, default: 0 },
  instrument: { type: String, enum: [...SOUNDSCAPE_INSTRUMENT_KEYS], default: 'auto' },
  tempo: { type: Number, min: 40, max: 140, default: 76 },
  space: { type: Number, min: 0, max: 100, default: 50 },
  variation: { type: Number, min: 0, max: 100, default: 50 },
}, { _id: false });

const galaxySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  themeId: {
    type: Schema.Types.ObjectId,
    ref: "Theme",
  },
  backgroundMusicId: {
    type: Schema.Types.ObjectId,
    ref: "BackgroundMusic",
  },
  soundscape: {
    type: soundscapeSchema,
    default: () => ({
      preset: 'none', intensity: 0, warmth: 50, motion: 0,
      instrument: 'auto', tempo: 76, space: 50, variation: 50,
    }),
  },
  caption: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  template: {
    type: String,
    enum: ["galaxy", "fall"],
    default: "galaxy",
  },
  seEffect: {
    type: String,
    enum: ['none', 'stardust', 'firefly', 'aurora'],
    default: 'none',
  },
  storyType: {
    type: String,
    enum: ['couple', 'birthday', 'friendship', 'school', 'family', 'self', 'travel', 'special'],
    default: null,
  },
  occasion: {
    type: String,
    default: null,
  },
  chapters: {
    type: [
      {
        id:       { type: String },
        hookText: { type: String, default: null },
      }
    ],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// name unique per user (2 users can have galaxy "moon" but not same user)
galaxySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = model("Galaxy", galaxySchema, "galaxies");
