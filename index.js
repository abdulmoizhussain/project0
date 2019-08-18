/**
 * NPM Module dependencies.
 */
const express = require('express');
const trackRoute = express.Router();
const multer = require('multer');
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const ObjectID = mongodb.ObjectID;
const cors = require("cors");

/**
 * NodeJS Module dependencies.
 */
const { Readable } = require('stream');


/**
 * Create Express server && Express Router configuration.
 */
const app = express();
app.use(cors());
app.use('/tracks', trackRoute);

/**
 * Connect Mongo Driver to MongoDB.
 */
let db;
const DB_NAME = "trackDB";
// const connectionString = "mongodb://localhost:27017/" + DB_NAME;
const connectionString = `mongodb+srv://project0:WcRK1olYHQcTLNIV@cluster0-h2i9q.mongodb.net/${DB_NAME}?retryWrites=true&w=majority`;
MongoClient.connect(connectionString, { useNewUrlParser: true })
  .then(client => {
    db = client.db();
    console.log("db initialized.");
  })
  .catch(() => {
    console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
  });
// (err, database) => {
//   if (err) {
//     console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
//     process.exit(1);
//   }
//   db = database;
//   console.log("db initialized.")
// });


/**
 * POST /tracks
 */
trackRoute.post('/', (req, res) => {
  const storage = multer.memoryStorage();
  const upload = multer({
    storage: storage,
    limits: {
      fields: 1,
      fileSize: 6000000,
      files: 1,
      parts: 2
    },
  });
  upload.single('track')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: "Upload Request Validation Failed." });
    } else if (!req.body.name) {
      return res.status(400).json({ message: "No track name in request body." });
    }

    let trackName = req.body.name;

    // Covert buffer to Readable Stream
    const readableTrackStream = new Readable();
    readableTrackStream.push(req.file.buffer);
    readableTrackStream.push(null);

    let bucket = new mongodb.GridFSBucket(db, {
      bucketName: 'tracks'
    });

    let uploadStream = bucket.openUploadStream(trackName);
    let id = uploadStream.id;
    readableTrackStream.pipe(uploadStream);

    uploadStream.on('error', () => {
      return res.status(500).json({ message: "Error uploading file" });
    });

    uploadStream.on('finish', () => {
      return res.status(201).json({ message: "File uploaded successfully, stored under Mongo ObjectID: " + id });
    });
  });
});



/**
 * GET /tracks/:trackID
 */
trackRoute.get('/:trackName', async (req, res) => {
  let trackID, track;
  const trackName = req.params.trackName, trackSize = req.query.size;
  try {
    if (!trackName)
      throw " ";
    track = await db.collection("tracks.files").findOne({ filename: trackName });
    if (!track)
      throw " ";
    trackID = new ObjectID(track._id);
  } catch (err) {
    return res.status(400).json(`Track with name: '${trackName}' does not exist.`);
    // "Must be a single String of 12 bytes or a string of 24 hex characters."
  }
  res.set('content-type', 'audio/mp3');
  res.set('accept-ranges', 'bytes');
  let bucket = new mongodb.GridFSBucket(db, {
    bucketName: 'tracks',
  });
  let downloadStream = bucket.openDownloadStream(trackID,
    trackSize == "half" ? { start: track.length / 2 } : {}
  );
  downloadStream.on('data', (chunk) => {
    res.write(chunk);
  });
  downloadStream.on('error', () => {
    res.sendStatus(404);
  });
  downloadStream.on('end', () => {
    res.end();
  });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}!`);
});
