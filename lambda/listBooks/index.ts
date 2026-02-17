import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const BOOKS_TABLE = process.env.BOOKS_TABLE!;

export const handler = async (event: any) => {
  console.log("Incoming Event:", JSON.stringify(event));

  try {
    const queryParams = event.queryStringParameters || {};

    const limit = queryParams.limit
      ? parseInt(queryParams.limit)
      : 10;

    const scanParams: any = {
      TableName: BOOKS_TABLE,
      Limit: limit,
    };

    if (queryParams.lastKey) {
      scanParams.ExclusiveStartKey = {
        bookId: queryParams.lastKey,
      };
    }

    const result = await docClient.send(
      new ScanCommand(scanParams)
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        books: result.Items || [],
        lastEvaluatedKey:
          result.LastEvaluatedKey?.bookId || null,
      }),
    };
  } catch (error: any) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error.message,
      }),
    };
  }
};
