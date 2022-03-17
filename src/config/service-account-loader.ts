import { Logger } from '@nestjs/common';
import { ServiceAccounts } from 'app.module';
import { ServiceAccount } from 'firebase-admin';
import { readFile } from 'fs/promises';
import { join } from 'path';

export default <T extends keyof ServiceAccounts>(projectId: string, serviceAccountFileSuffix: string, name: T) => {
  return async (): Promise<Record<T, ServiceAccount>> => {
    const filePath = `${projectId}${serviceAccountFileSuffix}`;
    const serviceAccountPath = join(__dirname, 'creds', filePath);
    const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf-8'));

    if (serviceAccount.project_id !== projectId) {
      Logger.warn(
        `Firebase config project id: ${projectId} does not match service account project id: ${serviceAccount.project_id}`
      );
    }

    Logger.log('loaded');
    return { [name]: serviceAccount as ServiceAccount } as Record<T, ServiceAccount>;
  };
};
