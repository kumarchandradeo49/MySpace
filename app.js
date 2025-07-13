require('dotenv').config(); // Load environment variables

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const _ = require('lodash');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Connect to MongoDB Atlas using env variable
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Set view engine and static files
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/files");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Define schema and model
const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  file: String
});
const Post = mongoose.model("Post", postSchema);

// Routes
app.get("/", (req, res) => {
  Post.find({})
    .then(posts => {
      res.render("home", { posts: posts });
    })
    .catch(err => res.send(err));
});

app.get("/compose", (req, res) => {
  res.render("compose");
});

app.post("/compose", upload.single("uploaded_file"), (req, res) => {
  const post = new Post({
    title: req.body.post_title,
    content: req.body.post_body,
    file: req.file ? req.file.filename : ""
  });
  post.save()
    .then(() => res.redirect("/"))
    .catch(err => res.send(err));
});

app.get("/posts/:postId", (req, res) => {
  const requestedId = req.params.postId;
  Post.findById(requestedId)
    .then(post => {
      res.render("post", {
        title: post.title,
        content: post.content,
        file: post.file,
        postId: post._id
      });
    })
    .catch(err => res.send(err));
});

app.get("/uploads/files/:filename", (req, res) => {
  const filePath = path.join(__dirname, "public", "uploads", "files", req.params.filename);
  res.sendFile(filePath);
});

app.post("/posts/:postId/delete", (req, res) => {
  Post.findByIdAndDelete(req.params.postId)
    .then(deleted => {
      if (deleted.file) {
        fs.unlinkSync(path.join(__dirname, "public", "uploads", "files", deleted.file));
      }
      res.redirect("/");
    })
    .catch(err => res.send(err));
});

app.get("/posts/:postId/edit", (req, res) => {
  Post.findById(req.params.postId)
    .then(post => {
      res.render("edit", {
        postId: post._id,
        title: post.title,
        content: post.content
      });
    })
    .catch(err => res.send(err));
});

app.post("/posts/:postId/edit", (req, res) => {
  Post.findByIdAndUpdate(req.params.postId, {
    title: req.body.post_title,
    content: req.body.post_body
  })
    .then(() => res.redirect("/posts/" + req.params.postId))
    .catch(err => res.send(err));
});

// Start server on dynamic port
const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("🚀 Server started on port " + port);
});