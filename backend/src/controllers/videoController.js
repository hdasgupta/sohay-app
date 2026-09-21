import * as videoService from '../services/videoService.js';
import { requireFields } from '../middleware/validate.js';

export const getConsultation = async (req, res) => {
  const data = await videoService.getConsultationContext({
    appointmentId: req.params.appointmentId,
    user: req.user,
  });
  res.json({ success: true, data });
};

export const recordingWebhook = async (req, res) => {
  const payload = req.body || {};
  const roomId = payload.roomId || payload.fqn || payload?.data?.fqn;
  const recordingUrl = payload.recordingUrl || payload?.data?.preAuthenticatedLink || payload?.data?.url;
  requireFields({ roomId, recordingUrl }, ['roomId', 'recordingUrl']);
  const data = await videoService.handleRecordingReady({
    roomId,
    recordingUrl,
    secret: req.headers['x-webhook-secret'],
  });
  res.json({ success: true, message: 'Recording processed', data });
};
