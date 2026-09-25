import { Capacitor } from '@capacitor/core';
import { FileTransfer } from '@capacitor/file-transfer';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getToken } from '../utils/authStorage.js';
import env from '../config/env.js';

export async function downloadPrescriptionInAndroid(id) {
    const url =
        `${env.apiBaseUrl}/prescriptions/${id}/download`;
    const token = getToken();
    const fileName = `prescription-${id}.pdf`;

    const file = await Filesystem.getUri({
        directory: Directory.Cache,
        path: fileName
    });

    await FileTransfer.downloadFile({
        url,
        path: file.uri,
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    console.log('Prescription downloaded:', file.uri);
}
