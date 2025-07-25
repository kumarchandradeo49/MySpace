require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('./models/User');

const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const app = express();


mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));


app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: false
}));


app.use(passport.initialize());
app.use(passport.session());
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});


function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Auth Routes

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  User.register(new User({ username: req.body.username }), req.body.password, (err, user) => {
    if (err) {
      console.log(err);
      return res.redirect('/register');
    }
    passport.authenticate("local")(req, res, () => {
      res.redirect('/');
    });
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login"
}));

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

//  File Upload Setup 

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/files"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Post Schema

const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  file: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});
const Post = mongoose.model("Post", postSchema);

//  Routes 
//  Public Homepage
app.get("/", (req, res) => {
  if (!req.user) {
    return res.render("home", { posts: [], user: null });
  }

  Post.find({ author: req.user._id })
    .then(posts => res.render("home", { posts, user: req.user }))
    .catch(err => res.status(500).send(err));
});

// Compose (Only for logged-in users)
app.get("/compose", isLoggedIn, (req, res) => {
  res.render("compose", { user: req.user });
});

app.post("/compose", isLoggedIn, upload.single("uploaded_file"), (req, res) => {
  const post = new Post({
    title: req.body.post_title,
    content: req.body.post_body,
    file: req.file ? req.file.filename : "",
    author: req.user._id
  });
  post.save()
    .then(() => res.redirect("/"))
    .catch(err => res.status(500).send(err));
});

// View Post (Only by the post owner)
app.get("/posts/:postId", isLoggedIn, (req, res) => {
  Post.findById(req.params.postId)
    .then(post => {
      if (!post.author.equals(req.user._id)) return res.status(403).send("Forbidden");
      res.render("post", {
        title: post.title,
        content: post.content,
        file: post.file,
        postId: post._id,
        user: req.user
      });
    })
    .catch(err => res.status(500).send(err));
});

app.get("/posts/:postId/edit", isLoggedIn, (req, res) => {
  Post.findById(req.params.postId)
    .then(post => {
      if (!post.author.equals(req.user._id)) return res.status(403).send("Forbidden");
      res.render("edit", {
        postId: post._id,
        title: post.title,
        content: post.content,
        file: post.file,
        user: req.user
      });
    })
    .catch(err => res.status(500).send(err));
});

app.post("/posts/:postId/edit", isLoggedIn, upload.single("myfile"), (req, res) => {
  Post.findById(req.params.postId)
    .then(post => {
      if (!post.author.equals(req.user._id)) return res.status(403).send("Forbidden");

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

app.post("/posts/:postId/delete", isLoggedIn, (req, res) => {
  Post.findById(req.params.postId)
    .then(post => {
      if (!post.author.equals(req.user._id)) return res.status(403).send("Forbidden");

      return Post.findByIdAndDelete(req.params.postId).then(deleted => {
        if (deleted?.file) {
          const filePath = path.join(__dirname, "public/uploads/files", deleted.file);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      });
    })
    .then(() => res.redirect("/"))
    .catch(err => res.status(500).send(err));
});

//  View File in Browser
app.get("/uploads/view/:filename", (req, res) => {
  const filePath = path.join(__dirname, "public/uploads/files", req.params.filename);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) return res.status(404).send("File not found.");
    res.sendFile(filePath); // Display inline
  });
});

//  Download File
app.get("/uploads/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "public/uploads/files", req.params.filename);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) return res.status(404).send("File not found.");
    res.download(filePath); // Force download
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🚀 Server started on port " + port));