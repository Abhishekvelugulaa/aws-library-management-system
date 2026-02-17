import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createHash } from "crypto";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const BOOKS_TABLE = process.env.BOOKS_TABLE!;

// Deterministic Book ID Generator
function generateBookId(title: string, author: string, edition: string) {
  return createHash("sha256")
    .update(`${title}-${author}-${edition}`)
    .digest("hex");
}

export const handler = async (event: any) => {
  console.log("Incoming Event:", JSON.stringify(event));

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Request body is required" }),
      };
    }

    const { title, author, edition, copies } = JSON.parse(event.body);

    // Validation
    if (!title || !author || !edition || !copies) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "title, author, edition and copies are required",
        }),
      };
    }

    if (copies <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "copies must be greater than 0",
        }),
      };
    }

    const bookId = generateBookId(title, author, edition);

    await docClient.send(
      new UpdateCommand({
        TableName: BOOKS_TABLE,
        Key: { bookId },
        UpdateExpression: `
          SET 
            title = :title,
            author = :author,
            edition = :edition,
            totalCopies = if_not_exists(totalCopies, :zero) + :inc,
            availableCopies = if_not_exists(availableCopies, :zero) + :inc,
            createdAt = if_not_exists(createdAt, :createdAt)
        `,
        ExpressionAttributeValues: {
          ":title": title,
          ":author": author,
          ":edition": edition,
          ":inc": copies,
          ":zero": 0,
          ":createdAt": new Date().toISOString(),
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Book added/updated successfully",
        bookId,
      }),
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
