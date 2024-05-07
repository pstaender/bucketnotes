# Welcome to Bucketnotes 👋

An editor which helps you to focus on just writing. Use your own S3 bucket for cheap, private and fast storage.

[Live Demo (you need S3 credentials)](http://www.bucketnotes.app)

```
⚠️ The software/developer is not responsible to possible damage on editing files in your s3 bucket ⚠️
```  

https://github.com/pstaender/bucketnotes/assets/140571/f1b120da-ce2f-459f-bde0-1c670e3adde0
  
## Features

  * minimalistic interface
  * auto-save
  * dark mode
  * responsive (works on desktop, mobile and tablet)
  * different fixed-size fonts
  * supports a bit of markdown syntax
  * writes and reads text files from any s3 bucket
  * supports versioning (if s3 versioning is enabled)
  * built-in OCR (via tesseract+wasm)
  * html and pdf to markdown import
  * progressive web app (means: you can do offline writing)
  * requires no extra service than the s3 bucket
  * open source

## Server requirements

You can host the dist folder (see below how to build) as static files with any webserver. Of couse you need also a S3 bucket. 

## Setup S3 Bucket in AWS

You can setup a S3 bucket via [aws cloudformation](https://aws.amazon.com/cloudformation/) by simply uploading the yaml-file below.

The example cloudformation-file does:

  * creates a S3 bucket with
    * versioning enabled
    * permissive CORS settings
    * R+W+D permissions
  * creates a programmatic user access (api access-token with secret), the credentials will be shown in the `Outputs` tab. 

Change ``mybucketnotes` to your preferred bucket name:

```yaml
Parameters:
  BucketName:
    Type: String
    Description: Name of the S3 bucket
    Default: mybucketnotes
Resources:
  S3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref BucketName
      VersioningConfiguration:
        Status: Enabled
      CorsConfiguration:
        CorsRules:
          - AllowedHeaders:
              - '*'
            AllowedMethods:
              - GET
              - PUT
              - POST
              - DELETE
              - HEAD
            AllowedOrigins:
              - '*'
            Id: allowAllCors
            MaxAge: 3600
  S3User:
      Type: AWS::IAM::User
      Properties:
        Policies:
          - PolicyName: bucket-access
            PolicyDocument:
              Version: '2012-10-17'
              Statement:
              - Effect: Allow
                Action:
                - s3:*
                Resource:
                  - !Sub arn:aws:s3:::${S3Bucket}
                  - !Sub arn:aws:s3:::${S3Bucket}/*
  S3UserAccessKey:
    Type: AWS::IAM::AccessKey
    Properties:
      UserName: !Ref S3User
Outputs:
  BucketName:
    Value: !Ref 'S3Bucket'
    Description: Name of the Amazon S3 bucket.
  S3BucketSecureURL:
    Value: !Join ['', ['https://', !GetAtt [S3Bucket, DomainName]]]
    Description: Domain Name of the Amazon S3 bucket
  AccessKeyID:
    Value: !Ref S3UserAccessKey
  SecretAccessKey:
    Value: !GetAtt S3UserAccessKey.SecretAccessKey
  User:
    Value: !Ref S3User
```

## Non-AWS providers

You can use other S3-compatible-providers (not tested, but endpoint URL is exchangable at the login).

Always ensure, that you have correct/permissive CORE policies in your S3 bucket, otherwise the direct client-side S3 api calls from the browser will not work.

## Costs

Depends on your S3 provider, file-sizes and overall usage/traffic. But I guess it's very hard to reach the 1 USD per month as a single user…

## Build

Clone the repo, ensure Node v18+ is available, then:

```sh
$ yarn install
$ yarn build
```

## Development

```sh
$ yarn start
```
