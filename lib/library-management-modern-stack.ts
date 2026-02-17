import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';



export class LibraryManagementModernStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // USERS TABLE
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'Users',
      partitionKey: {
        name: 'mobileNumber',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // dev only
    });
    // books table ()
    const booksTable = new dynamodb.Table(this, 'BooksTable', {
  tableName: 'Books',
  partitionKey: {
    name: 'bookId',
    type: dynamodb.AttributeType.STRING,
  },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.DESTROY, // dev only
});
//GSI
  booksTable.addGlobalSecondaryIndex({
  indexName: 'TitleAuthorIndex',
  partitionKey: {
    name: 'title',
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: 'author',
    type: dynamodb.AttributeType.STRING,
  },
  projectionType: dynamodb.ProjectionType.ALL,
});
// transaction Table --
const borrowTransactionsTable = new dynamodb.Table(this, 'BorrowTransactionsTable', {
  tableName: 'BorrowTransactions',
  partitionKey: {
    name: 'mobileNumber',
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: 'borrowedAt',
    type: dynamodb.AttributeType.STRING,
  },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
});

borrowTransactionsTable.addGlobalSecondaryIndex({
  indexName: 'BookBorrowIndex',
  partitionKey: {
    name: 'bookId',
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: 'borrowedAt',
    type: dynamodb.AttributeType.STRING,
  },
  projectionType: dynamodb.ProjectionType.ALL,
});




    //SNS NOTIFICATION -f1
    const userRegistrationTopic = new sns.Topic(this, 'UserRegistrationTopic', {
  displayName: 'User Registration Notifications',
});

userRegistrationTopic.addSubscription(
  new subscriptions.EmailSubscription('avelugul@gitam.in')
);

/// lambdas-----
    const registerUserLambda = new lambdaNodejs.NodejsFunction(this, 'RegisterUserLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'lambda/registerUser/index.ts',
      handler: 'handler',
      bundling:{
        externalModules:[]

      },
      
      environment: {
        USERS_TABLE: usersTable.tableName,
        SNS_TOPIC_ARN: userRegistrationTopic.topicArn


      },
    });
    const getUserLambda = new lambda.Function(this, 'GetUserLambda', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/getUser'),
  environment: {
    USERS_TABLE: usersTable.tableName,
  },
});

const addBookLambda = new lambdaNodejs.NodejsFunction(this, 'AddBookLambda', {
  runtime: lambda.Runtime.NODEJS_20_X,
  entry: 'lambda/addBook/index.ts',
  handler: 'handler',
  bundling: {
    externalModules: [],
  },
  environment: {
    BOOKS_TABLE: booksTable.tableName,
  },
});
const listBooksLambda = new lambdaNodejs.NodejsFunction(this, 'ListBooksLambda', {
  runtime: lambda.Runtime.NODEJS_20_X,
  entry: 'lambda/listBooks/index.ts',
  handler: 'handler',
  environment: {
    BOOKS_TABLE: booksTable.tableName,
  },
});

const borrowBookLambda = new lambdaNodejs.NodejsFunction(this, 'BorrowBookLambda', {
  runtime: lambda.Runtime.NODEJS_20_X,
  entry: 'lambda/borrowBook/index.ts',
  handler: 'handler',
  bundling: {
    externalModules: [],
  },
  environment: {
    USERS_TABLE: usersTable.tableName,
    BOOKS_TABLE: booksTable.tableName,
    BORROW_TABLE: borrowTransactionsTable.tableName,
  },
});



    
    const api = new apigateway.RestApi(this, 'LibraryApi', {
  restApiName: 'Library Service API',
  deployOptions: {
    stageName: 'dev',
  },
});
//api resources

// USERS RESOURCE
const usersResource = api.root.addResource('users');

// POST /users
usersResource.addMethod(
  'POST',
  new apigateway.LambdaIntegration(registerUserLambda)
);

// GET /users/{mobileNumber}
const singleUserResource = usersResource.addResource('{mobileNumber}');

singleUserResource.addMethod(
  'GET',
  new apigateway.LambdaIntegration(getUserLambda)
);
// BOOKS RESOURCE
const booksResource = api.root.addResource('books');

// POST /books
booksResource.addMethod(
  'POST',
  new apigateway.LambdaIntegration(addBookLambda)
);
//GET /books
booksResource.addMethod(
  'GET',
  new apigateway.LambdaIntegration(listBooksLambda)
);

// POST /borrow
const borrowResource = api.root.addResource('borrow');

borrowResource.addMethod(
  'POST',
  new apigateway.LambdaIntegration(borrowBookLambda)
);




    /// PERMISSIONS----
    usersTable.grantReadWriteData(registerUserLambda);
    userRegistrationTopic.grantPublish(registerUserLambda);
    usersTable.grantReadData(getUserLambda);
    booksTable.grantReadWriteData(addBookLambda);
    booksTable.grantReadData(listBooksLambda);
    usersTable.grantReadWriteData(borrowBookLambda);
    booksTable.grantReadWriteData(borrowBookLambda);
    borrowTransactionsTable.grantReadWriteData(borrowBookLambda);





    

    
  }
}
