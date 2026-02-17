import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USERS_TABLE!;
const BOOKS_TABLE = process.env.BOOKS_TABLE!;
const BORROW_TABLE = process.env.BORROW_TABLE!;

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
    const { mobileNumber, bookId } = body;

    if (!mobileNumber || !bookId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "mobileNumber and bookId are required",
        }),
      };
    }

    const borrowedAt = new Date().toISOString();
    const transactionId = uuidv4();

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          // 1️⃣ Decrement book availableCopies
          {
            Update: {
              TableName: BOOKS_TABLE,
              Key: { bookId },
              UpdateExpression:
                "SET availableCopies = availableCopies - :one",
              ConditionExpression:
                "availableCopies > :zero",
              ExpressionAttributeValues: {
                ":one": 1,
                ":zero": 0,
              },
            },
          },

          // 2️⃣ Increment user borrowCount (max 3 limit)
          {
            Update: {
              TableName: USERS_TABLE,
              Key: { mobileNumber },
              UpdateExpression:
                "SET borrowCount = if_not_exists(borrowCount, :zero) + :one",
              ConditionExpression:
                "attribute_exists(mobileNumber) AND borrowCount < :limit",
              ExpressionAttributeValues: {
                ":one": 1,
                ":zero": 0,
                ":limit": 3,
              },
            },
          },

          // 3️⃣ Insert borrow transaction
          {
            Put: {
              TableName: BORROW_TABLE,
              Item: {
                mobileNumber,
                borrowedAt,
                bookId,
                transactionId,
                status: "BORROWED",
              },
            },
          },
        ],
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Book borrowed successfully",
        transactionId,
      }),
    };
  } catch (error: any) {
    console.error("Error:", error);

    if (error.name === "TransactionCanceledException") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Borrow failed. Either book unavailable, user limit exceeded, or user does not exist.",
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
      }),
    };
  }
};
