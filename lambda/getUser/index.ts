import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USERS_TABLE!;

export const handler = async (event: any) => {
  console.log("Incoming Event:", JSON.stringify(event));

  try {
    const mobileNumber = event.pathParameters?.mobileNumber;

    if (!mobileNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "mobileNumber path parameter is required" }),
      };
    }

    const result = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { mobileNumber },
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
