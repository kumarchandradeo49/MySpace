require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const multer = require("multer");

const User = require("./models/User");
const { storage } = require("./cloudinary");
const upload = multer({ storage });

const app = express();


mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));


app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: "yourSecretKey",
  resave: false,
  saveUninitialized: false,
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
  res.redirect("/login");
}


const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  file: String, 
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});
const Post = mongoose.model("Post", postSchema);

// Routes
app.get("/register", (req, res) => res.render("register"));

app.post("/register", (req, res) => {
  User.register(
    new User({ username: req.body.username }),
    req.body.password,
    (err, user) => {
      if (err) {
        console.log(err);
        return res.redirect("/register");
      }
      passport.authenticate("local")(req, res, () => res.redirect("/"));
    }
  );
});

app.get("/login", (req, res) => res.render("login"));

app.post("/login", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login",
}));

app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});


app.get("/", (req, res) => {
  if (!req.user) return res.render("home", { posts: [], user: null });

  Post.find({ author: req.user._id })
    .then(posts => res.render("home", { posts }))
    .catch(err => res.status(500).send("Error loading posts"));
});


app.get("/compose", isLoggedIn, (req, res) => {
  res.render("compose");
});

app.post("/compose", isLoggedIn, upload.single("uploaded_file"), (req, res) => {
  const newPost = new Post({
    title: req.body.post_title,
    content: req.body.post_body,
    file: req.file?.path || "",
    author: req.user._id
  });

  newPost.save()
    .then(() => res.redirect("/"))
    .catch(err => res.status(500).send("Error saving post"));
});


app.get("/posts/:postId", isLoggedIn, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post || !post.author.equals(req.user._id)) return res.status(403).send("Forbidden");

    res.render("post", {
      title: post.title,
      content: post.content,
      file: post.file,
      postId: post._id,
      user: req.user,
      downloadLink: post.file // ✅ use direct Cloudinary URL for download
    });

  } catch (err) {
    console.error("Error loading post:", err);
    res.status(500).send("Error loading post");
  }
});


app.get("/posts/:postId/edit", isLoggedIn, async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post || !post.author.equals(req.user._id)) return res.status(403).send("Forbidden");

  res.render("edit", {
    postId: post._id,
    title: post.title,
    content: post.content,
    file: post.file,
    user: req.user,
  });
});

app.post("/posts/:postId/edit", isLoggedIn, upload.single("myfile"), async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post || !post.author.equals(req.user._id)) return res.status(403).send("Forbidden");

  if (req.file) {
    post.file = req.file.path;
  }

  post.title = req.body.post_title;
  post.content = req.body.post_body;
  await post.save();

  res.redirect("/posts/" + req.params.postId);
});


app.post("/posts/:postId/delete", isLoggedIn, async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post || !post.author.equals(req.user._id)) return res.status(403).send("Forbidden");

  await Post.findByIdAndDelete(req.params.postId);
  res.redirect("/");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🚀 Server running on port " + port));