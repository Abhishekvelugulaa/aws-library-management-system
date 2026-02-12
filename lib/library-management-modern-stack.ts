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

    
    const api = new apigateway.RestApi(this, 'LibraryApi', {
  restApiName: 'Library Service API',
  deployOptions: {
    stageName: 'dev',
  },
});

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




    /// PERMISSIONS----
    usersTable.grantReadWriteData(registerUserLambda);
    userRegistrationTopic.grantPublish(registerUserLambda);
    usersTable.grantReadData(getUserLambda);



    

    
  }
}
