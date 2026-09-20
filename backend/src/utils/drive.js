import { google } from 'googleapis';
import axios from 'axios';
import { Readable } from 'node:stream';
import { env } from '../config/env.js';

const driveClient = () => {
  if (!env.drive.enabled) {
    console.warn('[drive] GOOGLE_DRIVE_ENABLED=false, upload skipped');
    return null;
  }
  if (!env.drive.clientId || !env.drive.clientSecret || !env.drive.refreshToken) {
    console.warn('[drive] google credentials incomplete, upload skipped');
    return null;
  }
  const auth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret);
  auth.setCredentials({ refresh_token: env.drive.refreshToken });
  return google.drive({ version: 'v3', auth });
};

/**
 * Pull the finished JaaS recording from its (short lived) url and push it into
 * the Google Drive of GOOGLE_DRIVE_OWNER_EMAIL.
 */
export const uploadRecordingToDrive = async ({ url, fileName }) => {
  const drive = driveClient();
  if (!drive) return { uploaded: false, reason: 'drive-not-configured' };
  try {
    console.log(`[drive] downloading recording ${fileName}`);
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
    const created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: env.drive.folderId ? [env.drive.folderId] : undefined,
      },
      media: {
        mimeType: 'video/mp4',
        body: Readable.from(Buffer.from(response.data)),
      },
      fields: 'id, webViewLink',
    });
    console.log(`[drive] uploaded ${fileName} as ${created.data.id}`);
    return { uploaded: true, fileId: created.data.id, link: created.data.webViewLink };
  } catch (error) {
    console.error('[drive] upload failed:', error.message);
    return { uploaded: false, reason: error.message };
  }
};
