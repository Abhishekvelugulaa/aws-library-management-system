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
    
    const api = new apigateway.RestApi(this, 'LibraryApi', {
      restApiName: 'Library Service API',
      deployOptions: {
        stageName: 'dev',
      },
    });
    
    
    
    // REGISTE API
    const registerResource = api.root.addResource('register');
    registerResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(registerUserLambda)
    );

    /// PERMISSIONS----
    usersTable.grantReadWriteData(registerUserLambda);
    userRegistrationTopic.grantPublish(registerUserLambda);


    

    
  }
}
