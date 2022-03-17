import { Logger } from '@nestjs/common';
import { ServiceAccount } from 'firebase-admin';
import { readFile } from 'fs/promises';
import { join } from 'path';

export default (serviceAccountFileSuffix: string) => {
  return (projectId: string) => {
    return async () => {
      const filePath = `${projectId}${serviceAccountFileSuffix}`;
      const serviceAccountPath = join(__dirname, 'creds', filePath);
      const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf-8'));

      if (serviceAccount.project_id !== projectId) {
        Logger.warn(
          `Firebase config project id: ${projectId} does not match service account project id: ${serviceAccount.project_id}`
        );
      }

      return serviceAccount as ServiceAccount;
    };
  };
};
