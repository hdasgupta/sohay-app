import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3'; import {getSignedUrl} from '@aws-sdk/s3-request-presigner'; import {env} from '../config/env.js';
const s3=new S3Client({region:env.s3Region,endpoint:env.s3Endpoint,forcePathStyle:true,credentials:{accessKeyId:env.s3AccessKey,secretAccessKey:env.s3Secret}});
export const putPdf=(key,buffer)=>s3.send(new PutObjectCommand({Bucket:env.s3Bucket,Key:key,Body:buffer,ContentType:'application/pdf'})).then(()=>key);
export const signedPdfUrl=(key,expiresIn=900)=>getSignedUrl(s3,new GetObjectCommand({Bucket:env.s3Bucket,Key:key}),{expiresIn});
