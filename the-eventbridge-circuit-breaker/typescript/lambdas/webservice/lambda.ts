const AWS = require('aws-sdk')
AWS.config.region = process.env.AWS_REGION || 'us-east-1'
const eventbridge = new AWS.EventBridge()

exports.handler = async (event:any, context:any) => {
  const ERROR_THRESHOLD = 3;
  const serviceURL = 'www.google.com';

  // create AWS SDK clients
  const dynamo = new AWS.DynamoDB();

  // We are querying our error Dynamo to count how many errors are in there for www.google.com
  var dynamoParams = {
    ExpressionAttributeValues: {
     ":v1": {
       S: serviceURL
      }
    }, 
    KeyConditionExpression: "siteUrl = :v1", 
    IndexName: "UrlIndex",
    TableName: process.env.TABLE_NAME,
   };

  const recentErrors = await dynamo.query(dynamoParams).promise();
  console.log('--- Recent Errors ---');
  console.log(recentErrors);
  
  // If we are within our error threshold, make the http call
  if(recentErrors.Count < ERROR_THRESHOLD){
    let errorType = '';
    
    // In here assume we made an http request to google and it was down, 
    // 10 sec hard coded delay for simulation
    const fakeServiceCall = await new Promise((resolve, reject) => {
      console.log('--- Calling Webservice, recent errors below threshold ---');
      setTimeout( function() {
        reject("service timeout exception")
      }, 1000) 
    }).catch((reason)=> {
      console.log('--- Service Call Failure ---');
      console.log(reason);
      errorType = reason;
    });
  
    // Building our failure event for EventBridge
    var params = {
      Entries: [
        {
          DetailType: 'httpcall',
          EventBusName: 'default',
          Source: 'cdkpatterns.eventbridge.circuitbreaker',
          Time: new Date(),
          // Main event body
          Detail: JSON.stringify({
            status: 'fail',
            siteUrl: serviceURL,
            errorType: errorType
          })
        }
      ]
    };
  
    const result = await eventbridge.putEvents(params).promise();
  
    console.log('--- EventBridge Response ---')
    console.log(result)  
  }

  // Tell the user it errored
  return sendRes(500, 'Something appears to be wrong with this service, please try again later');
}

const sendRes = (status:any, body:any) => {
  var response = {
      statusCode: status,
      headers: {
          "Content-Type": "text/html"
      },
      body: body
  };
  return response;
};
