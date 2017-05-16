#!/usr/bin/env node
const fs = require('fs');
const cloudFormationFunctionTemplate = {
  "Type": "AWS::Lambda::Function",
  "Properties": {
    "Handler": "index.handler",
    "Role": { "Fn::GetAtt": [ "LambdaRole", "Arn" ] },
    "Code": {
      "ZipFile": {
        "Fn::Join": [
          "\n",
          []
        ]
      }
    },
    "Environment": {
      "Variables": {
        "TABLE_NAME": { "Ref": "DB" }
      }
    },
    "Runtime": "nodejs4.3",
    "Timeout": "30"
  },
  "DependsOn": [
    "LambdaRole"
  ]
};
const cloudFormationPermissionTemplate = {
  "Type": "AWS::Lambda::Permission",
  "Properties": {
    "Action": "lambda:InvokeFunction",
    "FunctionName": { "Fn::GetAtt": [ "Function", "Arn" ] },
    "Principal": "apigateway.amazonaws.com",
    "SourceArn": {
      "Fn::Join": [
        "",
        [
          "arn:aws:execute-api:",
          { "Ref": "AWS::Region" },
          ":",
          { "Ref": "AWS::AccountId" },
          ":",
          { "Ref": "Api" },
          "/*/*/*"
        ]
      ]
    }
  },
  "DependsOn": [
    "Function",
    "Api"
  ]
};
const scriptDir = 'app',
      functionSuffix = 'Function',
      permissionSuffix = 'Permission',
      template = 'cloudformation/deploy-blacklist.template',
      templateNode = JSON.parse(fs.readFileSync(template).toString()),
      resourcesNode = templateNode["Resources"]
;

Object.keys(resourcesNode).forEach(function(resourceName) {
  if (resourceName.match(functionSuffix + '$') || resourceName.match(functionSuffix + permissionSuffix + '$')) {
    delete resourcesNode[resourceName];
  }
});

const functionNames = fs.readdirSync(scriptDir).map(function(path) {
  var functionName = path.replace(/\..+$/, functionSuffix),
      functionPerm = functionName + permissionSuffix,
      functionContents = fs.readFileSync(scriptDir + '/' + path).toString();
  resourcesNode[functionName] = JSON.parse(JSON.stringify(cloudFormationFunctionTemplate));
  resourcesNode[functionName]["Properties"]["Code"]["ZipFile"]["Fn::Join"][1] = functionContents.split("\n");
  if (functionName == "MoMessageFunction") resourcesNode[functionName]["Properties"]["Environment"]["Variables"]["STOP_WORDS"] = { "Ref": "StopWords" };
  resourcesNode[functionPerm] = JSON.parse(JSON.stringify(cloudFormationPermissionTemplate));
  resourcesNode[functionPerm]["Properties"]["FunctionName"]["Fn::GetAtt"][0] = functionName;
  resourcesNode[functionPerm]["DependsOn"][0] = functionName;
  return functionName;
});

fs.writeFileSync(template, JSON.stringify(templateNode, null, 2));