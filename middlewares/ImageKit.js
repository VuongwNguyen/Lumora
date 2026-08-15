const ImageKit = require("imagekit");
const { errorResponse } = require("../context/responseHandle");
require("dotenv").config();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

class ImageKitMiddleware {
  async deleteImage(err, req, res, next) {
    if (err) {
      const images = Array.isArray(req.files) ? req.files : [];
      try {
        await Promise.all(
          images.map((image) => {
            if (image.fileId) {
              return imagekit.deleteFile(image.fileId);
            }
            return null;
          })
        );
      } catch (error) {
        console.error("ImageKit upload rollback failed:", error.message);
      } finally {
        return next(err);
      }
    } else {
      return next();
    }
  }

  async uploadMusic(req, res, next) {
    if (!req.file) return next();
    
    try {
      const result = await imagekit.upload({
        file: req.file.buffer,
        fileName: `${Date.now()}-${req.file.originalname}`,
        folder: "moon/music",
      });
      
      req.musicUrl = result.url;
      next();
    } catch (error) {
      console.error('ImageKit upload error:', error);
      throw new errorResponse({
        message: 'Failed to upload music: ' + error.message,
        statusCode: 500,
      });
    }
  }
  }


module.exports = new ImageKitMiddleware();
