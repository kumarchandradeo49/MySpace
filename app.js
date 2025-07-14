require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Middleware & Static Files
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/files"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Mongoose Schema
const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  file: String
});
const Post = mongoose.model("Post", postSchema);

// Routes

// Home
app.get("/", (req, res) => {
  Post.find()
    .then(posts => res.render("home", { posts }))
    .catch(err => res.status(500).send(err));
});

// Compose
app.get("/compose", (req, res) => res.render("compose"));

app.post("/compose", upload.single("uploaded_file"), (req, res) => {
  const post = new Post({
    title: req.body.post_title,
    content: req.body.post_body,
    file: req.file ? req.file.filename : ""
  });
  post.save()
    .then(() => res.redirect("/"))
    .catch(err => res.status(500).send(err));
});

// View Post
app.get("/posts/:postId", (req, res) => {
  Post.findById(req.params.postId)
    .then(post => {
      res.render("post", {
        title: post.title,
        content: post.content,
        file: post.file,
        postId: post._id
      });
    })
    .catch(err => res.status(500).send(err));
});

// Edit Post
app.get("/posts/:postId/edit", (req, res) => {
  Post.findById(req.params.postId)
    .then(post => {
      res.render("edit", {
        postId: post._id,
        title: post.title,
        content: post.content,
        file: post.file
      });
    })
    .catch(err => res.status(500).send(err));
});

app.post("/posts/:postId/edit", upload.single("myfile"), (req, res) => {
  Post.findById(req.params.postId)
    .then(post => {
      if (req.file && post.file) {
        const oldFile = path.join(__dirname, "public", "uploads", "files", post.file);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        post.file = req.file.filename;
      }
      post.title = req.body.post_title;
      post.content = req.body.post_body;
      return post.save();
    })
    .then(() => res.redirect("/posts/" + req.params.postId))
    .catch(err => res.status(500).send(err));
});

// Delete Post
app.post("/posts/:postId/delete", (req, res) => {
  Post.findByIdAndDelete(req.params.postId)
    .then(deleted => {
      if (deleted?.file) {
        const filePath = path.join(__dirname, "public/uploads/files", deleted.file);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      res.redirect("/");
    })
    .catch(err => res.status(500).send(err));
});

// Serve Uploaded Files
app.get("/uploads/files/:filename", (req, res) => {
  const filePath = path.join(__dirname, "public/uploads/files", req.params.filename);
  fs.access(filePath, fs.constants.F_OK, err => {
    if (err) return res.status(404).send("File not found.");
    res.sendFile(filePath);
  });
});

// Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🚀 Server started on port " + port));