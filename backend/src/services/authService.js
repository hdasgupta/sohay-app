import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken'; import {env} from '../config/env.js';
export const hashPassword=password=>bcrypt.hash(password,12);
export const comparePassword=(password,hash)=>bcrypt.compare(password,hash);
export const issueJwt=payload=>jwt.sign(payload,env.jwtSecret,{expiresIn:env.jwtExpiresIn});
export const issueOtpVerification=(email,purpose)=>jwt.sign({kind:'otp_verification',email,purpose},env.otpSecret,{expiresIn:env.otpTtlSeconds});
export function verifyOtpVerification(token,email,purpose){const p=jwt.verify(token,env.otpSecret);if(p.kind!=='otp_verification'||p.email!==email||p.purpose!==purpose)throw new Error('OTP verification token is invalid.');return p}
