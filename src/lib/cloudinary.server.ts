import { v2 as cloudinary } from "cloudinary";

export type CloudinaryConfig = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
  secure: true;
};

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  const apiKey = process.env["CLOUDINARY_API_KEY"];
  const apiSecret = process.env["CLOUDINARY_API_SECRET"];
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Configuration Cloudinary manquante : renseignez CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET dans .env");
  }
  return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true };
}

export function getCloudinary() {
  cloudinary.config(getCloudinaryConfig());
  return cloudinary;
}
