require("dotenv").config({ path: "../.env" });
const AWS = require("aws-sdk");

AWS.config.update({
  apiVersion: "latest",
  region: process.env.AWS_REGION || "us-east-1",
  // endpoint: process.env.AWS_ENDPOINT || "http://localhost:8000",
  accessKeyId: process.env.AWS_ACCESS_KEY || "debugkey",
  secretAccessKey: process.env.AWS_SECRET_KEY || "debugsecret",
});

const dynamodb = new AWS.DynamoDB();

const params = {
  TableName: "LookUp",
  KeySchema: [
    { AttributeName: "id", KeyType: "HASH" },
    { AttributeName: "name", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "name", AttributeType: "S" },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5,
  },
};

dynamodb.createTable(params, function (err, data) {
  if (err) {
    console.error(
      "Unable to create table. Error JSON:",
      JSON.stringify(err, null, 2)
    );
  } else {
    console.log(
      "Created table. Table description JSON:",
      JSON.stringify(data, null, 2)
    );
  }
});
