export interface S3Port {
  readiness(): Promise<boolean>;
  putObject(key: string, body: Buffer, mimeType: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  createPresignedDownloadUrl(
    key: string,
    expiresInSeconds?: number,
  ): Promise<string>;
}
