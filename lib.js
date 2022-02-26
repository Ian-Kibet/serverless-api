require("dotenv").config();
const busboy = require("busboy");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const key = "jb1m2a30nmb1ag9ngh8mz4gkcw0xb040"; // Replace this
const iv = "35zospdk1edxfcu1"; // Replace this

/**
 * Gets the request's content type
 * @param {*} event
 * @returns String - Content Type
 */
const getContentType = (event) => {
  let contentType = event.headers["content-type"];
  if (!contentType) {
    return event.headers["Content-Type"];
  }
  return contentType;
};

/**
 * Encrypts provided data
 * @param {*} data - Data to be encrypted
 * @returns
 */
module.exports.encryptDataAES = (data) => {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(key),
    Buffer.from(iv)
  );
  let encryptedData = cipher.update(Buffer.from(data), "utf-8", "hex");
  return encryptedData;
};

/**
 * Decrypts provided data
 * @param {*} data - Data to be dencrypted
 * @returns
 */
module.exports.decryptDataAES = (encryptedData) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key),
    Buffer.from(iv)
  );
  const decryptedData = decipher.update(encryptedData, "base64", "base64");
  return decryptedData;
};

/**
 * Encrypts provided data using RSA
 * @param {*} buffer - Data to be encrypted in buffer form
 * @param {string} publicKeyPath - Relative or absolute path to the public key
 * @returns String - Content Type
 */
module.exports.encryptDataRSA = (buffer, publicKeyPath) => {
  const absolutePath = path.resolve(publicKeyPath);
  const publicKey = fs.readFileSync(absolutePath, "utf8");
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
      oaepHash: "sha256",
    },
    buffer
  );
  return encrypted.toString("base64");
};

/**
 * Decrypts provided data
 * @param {*} buffer - Data to be deencrypted
 * @param {string} privateKeyPath - Relative or absolute path to the private key
 * @returns String - Content Type
 */
module.exports.decryptData = (buffer, privateKeyPath) => {
  const absolutePath = path.resolve(privateKeyPath);
  const privateKey = fs.readFileSync(absolutePath, "utf8");
  const decrypted = crypto.privateDecrypt(privateKey, buffer);
  return decrypted.toString("utf8");
};

/**
 * Parses the multipart form data and returns the uploaded files and fields
 */
module.exports.parseFormData = async (event) =>
  new Promise((resolve, reject) => {
    const bb = busboy({
      headers: { "content-type": getContentType(event) },
    });
    let uploadedFile;

    bb.on("file", (_, file, info) => {
      const { filename, encoding, mimeType } = info;
      let content = "";

      file.on("data", (data) => {
        content = data;
      });

      file.on("error", reject);

      file.on("end", () => {
        uploadedFile = {
          filename,
          encoding,
          mimeType,
          content,
        };
      });
    });

    bb.on("error", reject);

    bb.on("finish", () => {
      return resolve(uploadedFile);
    });

    bb.write(event.body || "", event.isBase64Encoded ? "base64" : "binary");
    bb.end();
  });
