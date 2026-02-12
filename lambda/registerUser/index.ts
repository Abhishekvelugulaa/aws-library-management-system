import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USERS_TABLE!;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;

const snsClient = new SNSClient({});

export const handler = async (event: any) => {
  console.log("Incoming Event:", JSON.stringify(event));

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Request body is required" }),
      };
    }

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

    // 🔥 Atomic write — no race condition
    try {
      await docClient.send(
        new PutCommand({
          TableName: USERS_TABLE,
          Item: {
            mobileNumber,
            createdAt: new Date().toISOString(),
            borrowCount: 0,
          },
          ConditionExpression: "attribute_not_exists(mobileNumber)",
        })
      );
    } catch (error: any) {
      if (error.name === "ConditionalCheckFailedException") {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "User already exists" }),
        };
      }
      throw error;
    }

    // 🔔 SNS notification (non-blocking)
    try {
      await snsClient.send(
        new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Subject: "Library Registration Notification",
          Message: `User with mobile number ${mobileNumber} registered successfully.`,
        })
      );
    } catch (snsError) {
      console.error("SNS publish failed:", snsError);
      // Registration should not fail if SNS fails
    }

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