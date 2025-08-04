const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf = file.originalname.toLowerCase().endsWith(".pdf");

    return {
      folder: "yourspace_uploads",
      resource_type: isPdf ? "raw" : "auto", // 👈 necessary for PDFs
      format: isPdf ? "pdf" : undefined,
    };
  },
});

module.exports = { cloudinary, storage };