import express, { Router } from 'express';
import h from '../utils/asyncHandler.js';
import * as c from '../controllers/webhook.controller.js';

const r = Router();
// raw body is required to verify the X-Jaas-Signature HMAC
r.post('/jaas', express.raw({ type: '*/*', limit: '1mb' }), h(c.jaasWebhook));
export default r;
