

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
    const ext = file.originalname.split(".").pop().toLowerCase();

    let resource_type = "auto";
    if (["pdf", "doc", "docx", "xls", "xlsx"].includes(ext)) {
      resource_type = "raw"; 
    }

    return {
      folder: "yourspace_uploads",
      resource_type,
      format: ext, 
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}` 
    };
  },
});

module.exports = { cloudinary, storage };