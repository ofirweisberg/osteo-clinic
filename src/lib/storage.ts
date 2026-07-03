import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

// Patient files live in a private Azure Blob container; the app hands out
// short-lived SAS URLs to the authenticated practitioner (same model as the
// old Supabase signed URLs).
const CONTAINER = "patient-files";

function parseConn(): { account: string; key: string } {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING ?? "";
  const account = /AccountName=([^;]+)/.exec(conn)?.[1];
  const key = /AccountKey=([^;]+)/.exec(conn)?.[1];
  if (!account || !key) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
  return { account, key };
}

function container() {
  return BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!
  ).getContainerClient(CONTAINER);
}

export async function uploadFile(
  path: string,
  data: Buffer,
  contentType?: string
) {
  await container()
    .getBlockBlobClient(path)
    .uploadData(data, {
      blobHTTPHeaders: { blobContentType: contentType || "application/octet-stream" },
    });
}

export async function deleteFile(path: string) {
  await container().getBlockBlobClient(path).deleteIfExists();
}

/** Short-lived read URL (default 1h) — replacement for createSignedUrl. */
export function getSignedUrl(path: string, expiresInSeconds = 3600): string {
  const { account, key } = parseConn();
  const cred = new StorageSharedKeyCredential(account, key);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName: path,
      permissions: BlobSASPermissions.parse("r"),
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
    },
    cred
  ).toString();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://${account}.blob.core.windows.net/${CONTAINER}/${encodedPath}?${sas}`;
}
