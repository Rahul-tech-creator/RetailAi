const fs = require('fs');
const path = require('path');
let mongoose;
try {
  mongoose = require('mongoose');
} catch (e) {
  mongoose = null;
}

const DB_FILE = path.join(__dirname, '..', 'analytics', 'db.json');

// Define Mongoose Schema & Models if MongoDB URI is provided
let StoreDocModel = null;
if (process.env.MONGODB_URI && mongoose) {
  const StoreDocSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // 'videos', 'zones', 'jobs', 'reports'
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
  }, { timestamps: true });

  StoreDocModel = mongoose.models.StoreDoc || mongoose.model('StoreDoc', StoreDocSchema);

  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('[Store] Connected successfully to MongoDB Atlas.'))
    .catch(err => console.error('[Store] MongoDB Atlas connection error:', err.message));
}

class Store {
  constructor() {
    this.data = {
      videos: {},
      zones: {},
      jobs: {},
      reports: {}
    };
    this.load();
  }

  async load() {
    // 1. Try loading from MongoDB Atlas if configured
    if (StoreDocModel && mongoose && mongoose.connection.readyState === 1) {
      try {
        const docs = await StoreDocModel.find({});
        for (const doc of docs) {
          if (doc.key && this.data[doc.key] !== undefined) {
            this.data[doc.key] = doc.data;
          }
        }
        console.log('[Store] Synchronized initial data from MongoDB Atlas.');
        return;
      } catch (err) {
        console.warn('[Store] Failed loading from MongoDB Atlas, falling back to db.json:', err.message);
      }
    }

    // 2. Local JSON fallback
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[Store] Warning: Could not read db.json, initializing fresh store:', err.message);
    }
  }

  saveKey(key) {
    // Save to local disk fallback
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Store] Error saving to db.json:', err.message);
    }

    // Save to MongoDB Atlas if connected
    if (StoreDocModel && mongoose && mongoose.connection.readyState === 1) {
      StoreDocModel.findOneAndUpdate(
        { key },
        { key, data: this.data[key] },
        { upsert: true, new: true }
      ).catch(err => console.error(`[Store] Error persisting ${key} to MongoDB Atlas:`, err.message));
    }
  }

  setVideo(videoId, info) {
    this.data.videos[videoId] = info;
    this.saveKey('videos');
  }

  getVideo(videoId) {
    return this.data.videos[videoId] || null;
  }

  setZones(videoId, zones) {
    this.data.zones[videoId] = zones;
    this.saveKey('zones');
  }

  getZones(videoId) {
    return this.data.zones[videoId] || null;
  }

  setJob(jobId, jobData) {
    this.data.jobs[jobId] = {
      ...(this.data.jobs[jobId] || {}),
      ...jobData,
      updatedAt: new Date().toISOString()
    };
    this.saveKey('jobs');
  }

  getJob(jobId) {
    return this.data.jobs[jobId] || null;
  }

  setReport(jobId, report) {
    this.data.reports[jobId] = report;
    this.saveKey('reports');
  }

  getReport(jobId) {
    return this.data.reports[jobId] || null;
  }
}

module.exports = new Store();

