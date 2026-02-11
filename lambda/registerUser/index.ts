import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USERS_TABLE!;

export const handler = async (event: any) => {
  console.log("Incoming Event:", JSON.stringify(event));

  try {
    const body = JSON.parse(event.body);
const { mobileNumber } = body;

if (!mobileNumber) {
  return {
    statusCode: 400,
    body: JSON.stringify({ message: "mobileNumber is required" }),
  };
}

if (typeof mobileNumber !== "string") {
  return {
    statusCode: 400,
    body: JSON.stringify({ message: "mobileNumber must be a string" }),
  };
}

if (!/^[1-9][0-9]{9}$/.test(mobileNumber)) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      message: "mobileNumber must be a valid 10-digit number",
    }),
  };
}


    // Check if user already exists
    const existingUser = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { mobileNumber },
      })
    );

    if (existingUser.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "User already exists" }),
      };
    }

    // Create new user
    await docClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          mobileNumber,
          createdAt: new Date().toISOString(),
          borrowCount: 0,
        },
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "User registered successfully",
        mobileNumber,
      }),
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
      }),
    };
  }
};
