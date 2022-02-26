"use strict";
require("dotenv").config({ path: "./.env" });
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const async = require("async");

const {
  parseFormData,
  encryptDataAES,
  decryptDataAES,
  queryDynamoDB,
  getS3Object,
} = require("./lib");

const config = {
  apiVersion: "2012-08-10",
  // endpoint: process.env.AWS_ENDPOINT || "http://localhost:8000",
  accessKeyId: process.env.AWS_ACCESS_KEY || "debugkey",
  secretAccessKey: process.env.AWS_SECRET_KEY || "debugsecret",
  s3ForcePathStyle: true,
};

AWS.config.update(config);

const dynamodbClient = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

/**
 * Helper function to return an error response
 * @param {*} statusCode
 * @param {*} message
 * @returns
 */
const createErrorResponse = (statusCode, message) => ({
  statusCode: statusCode || 501,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    error: message || "An Error occurred.",
  }),
});

/**
 * POST request function
 * @param {*} event
 * @returns
 */
module.exports.postFile = async (event, callback) => {
  try {
    const uuid = uuidv4();
    const file = await parseFormData(event);
    const encryptedData = encryptDataAES(file.content);
    const uploadParams = {
      Body: Buffer.from(encryptedData, "hex"),
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: uuid,
      "ContentType ": file.mimeType,
    };
    await s3.upload(uploadParams, async (err, data) => {
      if (err) {
        throw new Error(err);
      } else {
        // Insert item record to dynamodb
        const insertParams = {
          TableName: "LookUp",
          Item: {
            id: uuid,
            name: file.filename,
          },
        };
        await dynamodbClient.put(insertParams, function (err, data) {
          if (err) {
            throw new Error(err);
          }
        });
      }
    });
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          url: `/?id=${uuid}`,
        },
        null,
        2
      ),
    };
  } catch (error) {
    const message = error.name
      ? `Invalid ${error.path}: ${error.value}`
      : error.message || "";
    return createErrorResponse(error.statusCode, message);
  }
};

/**
 * GET request function
 * @param {*} event
 * @returns
 */
module.exports.getFile = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    if (
      !event.queryStringParameters ||
      !("id" in event.queryStringParameters)
    ) {
      return callback(null, createErrorResponse(403, "File ID not provided"));
    }
    // Fetch uuid from path
    const id = event.queryStringParameters.id;
    const searchParams = {
      TableName: "LookUp",
      KeyConditionExpression: "id = :i",
      ExpressionAttributeValues: {
        ":i": id,
      },
    };
    const downloadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: id,
    };

    s3.getObject(downloadParams, (err, object) => {
      if (err) {
        callback(null, createErrorResponse(err.statusCode || 404, err.message));
      }
      if (!object) {
        callback(
          null,
          createErrorResponse(404, "File not found in download server")
        );
      }

      dynamodbClient.query(searchParams, async (err, data) => {
        if (err) {
          return callback(
            null,
            createErrorResponse(err.statusCode || 404, err.message)
          );
        }
        if (data.Items.length < 1) {
          return callback(null, createErrorResponse(404, "File not found"));
        }
        const item = data.Items[0];
        const decryptData = decryptDataAES(object.Body.toString("base64"));

        callback(null, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST",
            "Content-type": object.ContentType,
            "Content-Disposition": `inline; filename="${item.name}"`,
          },
          isBase64Encoded: true,
          body: decryptData,
        });
      });
    });
  } catch (error) {
    console.log(error);
    return callback(null, createErrorResponse(500, error.message));
  }
};
