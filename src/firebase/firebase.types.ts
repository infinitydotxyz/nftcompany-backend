export type FirebaseModuleOptions = {
  /**
   * The service account certificate to use.
   */
  cert: any;

  /**
   * Unique name to identify the service account.
   */
  certName?: string;

  isTest?: boolean;

  /**
   * Name of the cloud storage bucket to use.
   */
  storageBucket?: string;
};
