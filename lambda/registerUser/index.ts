import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
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
    // ✅ Validate request body exists
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Request body is required" }),
      };
    }

    const body = JSON.parse(event.body);
    const { mobileNumber } = body;

    // ✅ Validate mobileNumber presence
    if (!mobileNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "mobileNumber is required" }),
      };
    }

    // ✅ Validate type
    if (typeof mobileNumber !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "mobileNumber must be a string" }),
      };
    }

    // ✅ Validate 10-digit Indian mobile number
    if (!/^[1-9][0-9]{9}$/.test(mobileNumber)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "mobileNumber must be a valid 10-digit number",
        }),
      };
    }

    // ✅ Check if user already exists
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

    // ✅ Create new user
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

    // ✅ Publish SNS notification (non-blocking)
    try {
      await snsClient.send(
        new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Subject: "Library Registration Notification",
          Message: `
SMS sent to mobile number ${mobileNumber}
User registered successfully in Library Management System.
          `,
        })
      );
    } catch (snsError) {
      console.error("SNS publish failed:", snsError);
      // Do NOT fail registration if notification fails
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
