import { FileTransfer } from '@capacitor/file-transfer';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getToken } from '../utils/authStorage.js';
import env from '../config/env.js';

export async function downloadPrescriptionInAndroid(id) {
  const url = `${env.apiBaseUrl}/prescriptions/${id}/download`;
  const token = getToken();
  const fileName = `prescription-${id}.pdf`;

  if (!token) {
    throw new Error('Authentication token is missing. Please login again.');
  }

  console.log('[Prescription] URL:', url);
  console.log('[Prescription] Token exists:', Boolean(token));

  const file = await Filesystem.getUri({
    directory: Directory.Cache,
    path: fileName
  });

  console.log('[Prescription] File URI:', file.uri);

  const result = await FileTransfer.downloadFile({
    url,
    path: file.uri,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/pdf'
    }
  });

  console.log('[Prescription] Download result:', result);

  // Verify that the file actually exists.
  const stat = await Filesystem.stat({
    directory: Directory.Cache,
    path: fileName
  });

  console.log('[Prescription] File size:', stat.size);

  if (!stat.size || Number(stat.size) === 0) {
    throw new Error('Downloaded prescription PDF is empty.');
  }

  // Open/share the PDF using Android's installed PDF-capable apps.
  await Share.share({
    title: 'Prescription',
    text: 'Prescription PDF',
    url: file.uri,
    dialogTitle: 'Open prescription'
  });

  return file.uri;
}
