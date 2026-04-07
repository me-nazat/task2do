import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import { google, drive_v3 } from 'googleapis';

import {
  MAX_TASK_ATTACHMENT_FILES,
  MAX_TASK_ATTACHMENT_SIZE_BYTES,
  type TaskAttachmentRecord,
  inferTaskAttachmentPreviewKind,
  isTaskAttachmentPrintable,
} from '@/lib/task-attachments';

const DRIVE_SCOPE = ['https://www.googleapis.com/auth/drive'];
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const DEFAULT_DRIVE_ROOT_FOLDER_ID = '19awMDkoX3z3Ed-eQU2AkdO1YM48Nr_0d';
const TASK2DO_TYPE_APP_PROPERTY = 'task2doType';
const TASK2DO_USER_ID_APP_PROPERTY = 'task2doUserId';
const TASK2DO_USER_FOLDER_TYPE = 'user-folder';
const LOCAL_ENV_FILES = ['.env.local', '.env'];

type DriveAppProperties = Record<string, string>;

interface DriveFolderContext {
  folderId: string;
  folderUrl: string;
  folderName: string;
  appProperties: DriveAppProperties | null;
}

interface DriveFolderRecord extends DriveFolderContext {}

interface TaskFolderLookupResult {
  taskFolderId: string | null;
  folderUrl: string | null;
  userFolderId: string | null;
}

interface TaskAttachmentLookupResult {
  file: TaskAttachmentRecord;
  taskFolderId: string;
  folderUrl: string;
}

export interface TaskAttachmentContentResult extends TaskAttachmentLookupResult {
  contentType: string;
  contentLength: string | null;
  contentRange: string | null;
  etag: string | null;
  lastModified: string | null;
  status: number;
  stream: Readable;
}

export interface DriveUserIdentity {
  userId: string;
  name?: string | null;
  email?: string | null;
}

export interface EnsureUserDriveFolderResult extends DriveFolderContext {
  status: 'existing' | 'created' | 'adopted';
}

function extractGoogleApiMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      response?: {
        status?: number;
        data?: {
          error?: {
            message?: string;
            status?: string;
          };
        };
      };
      code?: number;
      errors?: Array<{ message?: string }>;
    };

    if (maybeError.response?.data?.error?.message) {
      return maybeError.response.data.error.message;
    }

    if (maybeError.errors?.[0]?.message) {
      return maybeError.errors[0].message;
    }
  }

  return null;
}

function toFriendlyDriveError(error: unknown) {
  const message = extractGoogleApiMessage(error) ?? 'Unable to reach Google Drive right now.';

  if (message.includes('Google Drive API has not been used') || message.includes('drive.googleapis.com')) {
    return new Error(
      'Google Drive API is disabled for the configured Google Cloud project. Enable drive.googleapis.com, wait a minute, and retry the upload.'
    );
  }

  if (message.includes('Service Usage API has not been used') || message.includes('serviceusage.googleapis.com')) {
    return new Error(
      'Google Cloud Service Usage is disabled for this project. Enable serviceusage.googleapis.com first, then enable Google Drive API.'
    );
  }

  if (message.includes('File not found') || message.includes('insufficientFilePermissions')) {
    return new Error(
      'The configured Drive folder is not accessible to the service account. Share the root folder with the service account email and retry.'
    );
  }

  if (message.includes('Service Accounts do not have storage quota')) {
    return new Error(
      'This Drive root is in a personal Google Drive, so service-account uploads cannot store files there. Configure Google OAuth user credentials for the Drive owner, or move the root folder to a supported shared-drive setup.'
    );
  }

  return new Error(message);
}

function getDriveRootFolderId() {
  const rawValue = readConfigValue('GOOGLE_DRIVE_ROOT_FOLDER_ID');

  if (!rawValue) {
    return DEFAULT_DRIVE_ROOT_FOLDER_ID;
  }

  const matchedFolderId = rawValue.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1];
  return matchedFolderId ?? rawValue;
}

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function loadLocalEnvFileValues() {
  const values: Record<string, string> = {};

  for (const fileName of LOCAL_ENV_FILES) {
    try {
      const fileContents = await readFile(path.join(process.cwd(), fileName), 'utf8');
      const lines = fileContents.split(/\r?\n/);

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }

        const separatorIndex = trimmedLine.indexOf('=');

        if (separatorIndex === -1) {
          continue;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

        if (!key || key in values) {
          continue;
        }

        values[key] = stripWrappingQuotes(rawValue);
      }
    } catch {
      continue;
    }
  }

  return values;
}

async function readConfigValueAsync(key: string) {
  const runtimeValue = process.env[key]?.trim();

  if (runtimeValue) {
    return runtimeValue;
  }

  const localEnvValues = await loadLocalEnvFileValues();
  return localEnvValues[key]?.trim();
}

function readConfigValue(key: string) {
  return process.env[key]?.trim();
}

function normalizeServiceAccountCredentials(parsed: {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}) {
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key?.replace(/\\n/g, '\n'),
    project_id: parsed.project_id,
  };
}

async function getDriveCredentials() {
  const rawJson = await readConfigValueAsync('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');

  if (rawJson) {
    return normalizeServiceAccountCredentials(JSON.parse(rawJson) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
    });
  }

  const serviceAccountFile = await readConfigValueAsync('GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE');

  if (serviceAccountFile) {
    try {
      const fileContents = await readFile(serviceAccountFile, 'utf8');
      return normalizeServiceAccountCredentials(JSON.parse(fileContents) as {
        client_email?: string;
        private_key?: string;
        project_id?: string;
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(
          `Google Drive service account file was not found at "${serviceAccountFile}". Update GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE, or configure Google OAuth credentials instead.`
        );
      }

      throw error;
    }
  }

  return {
    client_email: await readConfigValueAsync('GOOGLE_DRIVE_CLIENT_EMAIL'),
    private_key: (await readConfigValueAsync('GOOGLE_DRIVE_PRIVATE_KEY'))?.replace(/\\n/g, '\n'),
    project_id: await readConfigValueAsync('GOOGLE_DRIVE_PROJECT_ID'),
  };
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeFolderName(value: string | null | undefined, fallbackValue: string) {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : fallbackValue;
}

function normalizeFolderCollisionKey(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildDriveFolderUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function getFolderUserId(appProperties: DriveAppProperties | null | undefined) {
  return appProperties?.[TASK2DO_USER_ID_APP_PROPERTY] ?? null;
}

function isMarkedTask2DoUserFolder(appProperties: DriveAppProperties | null | undefined) {
  return appProperties?.[TASK2DO_TYPE_APP_PROPERTY] === TASK2DO_USER_FOLDER_TYPE;
}

function buildUserFolderAppProperties(userId: string): DriveAppProperties {
  return {
    [TASK2DO_TYPE_APP_PROPERTY]: TASK2DO_USER_FOLDER_TYPE,
    [TASK2DO_USER_ID_APP_PROPERTY]: userId,
  };
}

function mapDriveFile(file: drive_v3.Schema$File): TaskAttachmentRecord {
  return {
    id: file.id ?? '',
    name: file.name ?? 'Untitled file',
    mimeType: file.mimeType ?? null,
    size: Number(file.size ?? 0),
    webViewLink: file.webViewLink ?? null,
    webContentLink: file.webContentLink ?? null,
    iconLink: file.iconLink ?? null,
    modifiedTime: file.modifiedTime ?? null,
  };
}

function mapDriveFolder(file: drive_v3.Schema$File): DriveFolderRecord {
  const folderId = file.id;

  if (!folderId) {
    throw new Error('Google Drive returned a folder without an ID.');
  }

  return {
    folderId,
    folderUrl: buildDriveFolderUrl(folderId),
    folderName: file.name ?? 'Untitled Folder',
    appProperties: (file.appProperties as DriveAppProperties | undefined) ?? null,
  };
}

async function getDriveClient() {
  const oauthClientId = await readConfigValueAsync('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
  const oauthClientSecret = await readConfigValueAsync('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');
  const oauthRefreshToken = await readConfigValueAsync('GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN');

  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    const auth = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
    auth.setCredentials({ refresh_token: oauthRefreshToken });

    return google.drive({ version: 'v3', auth });
  }

  const credentials = await getDriveCredentials();

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(
      'Google Drive uploads are not configured. Add GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, and GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN, or GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE, GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON, or GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: DRIVE_SCOPE,
  });

  return google.drive({ version: 'v3', auth });
}

async function listFoldersInParent(drive: drive_v3.Drive, parentId: string) {
  try {
    const folders: DriveFolderRecord[] = [];
    let pageToken: string | undefined;

    do {
      const response = await drive.files.list({
        q: [
          `'${escapeDriveQueryValue(parentId)}' in parents`,
          `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
          'trashed = false',
        ].join(' and '),
        fields: 'nextPageToken, files(id,name,appProperties)',
        pageSize: 1000,
        pageToken,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });

      folders.push(...(response.data.files ?? []).map(mapDriveFolder));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return folders;
  } catch (error) {
    throw toFriendlyDriveError(error);
  }
}

async function updateFolderAppProperties(
  drive: drive_v3.Drive,
  folder: DriveFolderRecord,
  appProperties: DriveAppProperties
) {
  try {
    const response = await drive.files.update({
      fileId: folder.folderId,
      requestBody: {
        appProperties: {
          ...(folder.appProperties ?? {}),
          ...appProperties,
        },
      },
      fields: 'id,name,appProperties',
      supportsAllDrives: true,
    });

    return mapDriveFolder(response.data);
  } catch (error) {
    throw toFriendlyDriveError(error);
  }
}

async function createFolder(
  drive: drive_v3.Drive,
  parentId: string,
  folderName: string,
  appProperties?: DriveAppProperties
): Promise<DriveFolderRecord> {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: DRIVE_FOLDER_MIME_TYPE,
        parents: [parentId],
        ...(appProperties ? { appProperties } : {}),
      },
      fields: 'id,name,appProperties',
      supportsAllDrives: true,
    });

    return mapDriveFolder(response.data);
  } catch (error) {
    throw toFriendlyDriveError(error);
  }
}

function resolveDriveFolderContext(folder: DriveFolderRecord, status: EnsureUserDriveFolderResult['status']): EnsureUserDriveFolderResult {
  return {
    folderId: folder.folderId,
    folderUrl: folder.folderUrl,
    folderName: folder.folderName,
    appProperties: folder.appProperties,
    status,
  };
}

function findFolderByUserId(folders: DriveFolderRecord[], userId: string) {
  return folders.find((folder) => getFolderUserId(folder.appProperties) === userId) ?? null;
}

function findFoldersByNormalizedName(folders: DriveFolderRecord[], folderName: string) {
  const collisionKey = normalizeFolderCollisionKey(folderName);
  return folders.filter((folder) => normalizeFolderCollisionKey(folder.folderName) === collisionKey);
}

function pickAdoptableFolder(folders: DriveFolderRecord[], userId: string) {
  const matchingUserFolder = folders.find((folder) => getFolderUserId(folder.appProperties) === userId);

  if (matchingUserFolder) {
    return {
      folder: matchingUserFolder,
      status: 'existing' as const,
    };
  }

  const conflictingFolderExists = folders.some((folder) => {
    const existingUserId = getFolderUserId(folder.appProperties);
    return Boolean(existingUserId && existingUserId !== userId);
  });

  if (conflictingFolderExists) {
    return null;
  }

  const unclaimedFolders = folders.filter((folder) => !getFolderUserId(folder.appProperties));

  if (unclaimedFolders.length !== 1) {
    return null;
  }

  return {
    folder: unclaimedFolders[0],
    status: 'adopted' as const,
  };
}

function resolveCollisionSafeFolderName(folders: DriveFolderRecord[], preferredFolderName: string, userId: string) {
  const collides = folders.some((folder) => {
    const existingUserId = getFolderUserId(folder.appProperties);
    return normalizeFolderCollisionKey(folder.folderName) === normalizeFolderCollisionKey(preferredFolderName)
      && existingUserId !== userId;
  });

  if (!collides) {
    return preferredFolderName;
  }

  return `${preferredFolderName} (${userId.slice(0, 8)})`;
}

async function resolveUserFolder(
  drive: drive_v3.Drive,
  identity: DriveUserIdentity,
  createIfMissing: boolean
): Promise<EnsureUserDriveFolderResult | null> {
  const rootFolderId = getDriveRootFolderId();
  const rootFolders = await listFoldersInParent(drive, rootFolderId);
  const existingFolder = findFolderByUserId(rootFolders, identity.userId);

  if (existingFolder) {
    if (!isMarkedTask2DoUserFolder(existingFolder.appProperties) && createIfMissing) {
      const updatedFolder = await updateFolderAppProperties(
        drive,
        existingFolder,
        buildUserFolderAppProperties(identity.userId)
      );
      return resolveDriveFolderContext(updatedFolder, 'adopted');
    }

    return resolveDriveFolderContext(existingFolder, 'existing');
  }

  const preferredFolderName = resolveDriveUsername(identity);
  const preferredNameMatch = pickAdoptableFolder(
    findFoldersByNormalizedName(rootFolders, preferredFolderName),
    identity.userId
  );

  if (preferredNameMatch) {
    if (preferredNameMatch.status === 'adopted' && createIfMissing) {
      const updatedFolder = await updateFolderAppProperties(
        drive,
        preferredNameMatch.folder,
        buildUserFolderAppProperties(identity.userId)
      );
      return resolveDriveFolderContext(updatedFolder, 'adopted');
    }

    return resolveDriveFolderContext(
      preferredNameMatch.folder,
      preferredNameMatch.status === 'adopted' ? 'existing' : preferredNameMatch.status
    );
  }

  const collisionSafeFolderName = resolveCollisionSafeFolderName(rootFolders, preferredFolderName, identity.userId);

  if (collisionSafeFolderName !== preferredFolderName) {
    const collisionSafeMatch = pickAdoptableFolder(
      findFoldersByNormalizedName(rootFolders, collisionSafeFolderName),
      identity.userId
    );

    if (collisionSafeMatch) {
      if (collisionSafeMatch.status === 'adopted' && createIfMissing) {
        const updatedFolder = await updateFolderAppProperties(
          drive,
          collisionSafeMatch.folder,
          buildUserFolderAppProperties(identity.userId)
        );
        return resolveDriveFolderContext(updatedFolder, 'adopted');
      }

      return resolveDriveFolderContext(
        collisionSafeMatch.folder,
        collisionSafeMatch.status === 'adopted' ? 'existing' : collisionSafeMatch.status
      );
    }
  }

  if (!createIfMissing) {
    return null;
  }

  const createdFolder = await createFolder(
    drive,
    rootFolderId,
    collisionSafeFolderName,
    buildUserFolderAppProperties(identity.userId)
  );

  return resolveDriveFolderContext(createdFolder, 'created');
}

async function ensureFolder(
  drive: drive_v3.Drive,
  parentId: string,
  folderName: string,
  createIfMissing: boolean
): Promise<DriveFolderRecord | null> {
  const siblingFolders = await listFoldersInParent(drive, parentId);
  const matchingFolder = siblingFolders.find(
    (folder) => normalizeFolderCollisionKey(folder.folderName) === normalizeFolderCollisionKey(folderName)
  );

  if (matchingFolder) {
    return matchingFolder;
  }

  if (!createIfMissing) {
    return null;
  }

  return createFolder(drive, parentId, folderName);
}

async function resolveTaskFolder(
  drive: drive_v3.Drive,
  identity: DriveUserIdentity,
  taskTitle: string,
  createIfMissing: boolean
): Promise<TaskFolderLookupResult> {
  const userFolder = await resolveUserFolder(drive, identity, createIfMissing);
  const normalizedTaskTitle = normalizeFolderName(taskTitle, 'Untitled Objective');

  if (!userFolder) {
    return {
      taskFolderId: null,
      folderUrl: null,
      userFolderId: null,
    };
  }

  const taskFolder = await ensureFolder(drive, userFolder.folderId, normalizedTaskTitle, createIfMissing);

  if (!taskFolder) {
    return {
      taskFolderId: null,
      folderUrl: userFolder.folderUrl,
      userFolderId: userFolder.folderId,
    };
  }

  return {
    taskFolderId: taskFolder.folderId,
    folderUrl: taskFolder.folderUrl,
    userFolderId: userFolder.folderId,
  };
}

export function resolveDriveUsername({
  name,
  email,
  userId,
}: DriveUserIdentity) {
  const trimmedName = name?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  const emailPrefix = email?.split('@')[0]?.trim();

  if (emailPrefix) {
    return emailPrefix;
  }

  return `Task2Do-${userId.slice(0, 8)}`;
}

export async function ensureUserDriveFolder(identity: DriveUserIdentity) {
  const drive = await getDriveClient();
  const folder = await resolveUserFolder(drive, identity, true);

  if (!folder) {
    throw new Error('Unable to resolve the Google Drive user folder.');
  }

  return folder;
}

export async function listTaskAttachments({
  userId,
  userName,
  userEmail,
  taskTitle,
}: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  taskTitle: string;
}) {
  const drive = await getDriveClient();
  const folder = await resolveTaskFolder(
    drive,
    {
      userId,
      name: userName,
      email: userEmail,
    },
    taskTitle,
    false
  );

  if (!folder.taskFolderId) {
    return {
      files: [] as TaskAttachmentRecord[],
      folderUrl: folder.folderUrl,
      taskFolderId: null,
      limit: {
        maxFiles: MAX_TASK_ATTACHMENT_FILES,
        maxFileSizeBytes: MAX_TASK_ATTACHMENT_SIZE_BYTES,
      },
    };
  }

  try {
    const response = await drive.files.list({
      q: [
        `'${escapeDriveQueryValue(folder.taskFolderId)}' in parents`,
        `mimeType != '${DRIVE_FOLDER_MIME_TYPE}'`,
        'trashed = false',
      ].join(' and '),
      fields: 'files(id,name,mimeType,size,webViewLink,webContentLink,iconLink,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: MAX_TASK_ATTACHMENT_FILES,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return {
      files: (response.data.files ?? []).map(mapDriveFile),
      folderUrl: folder.folderUrl,
      taskFolderId: folder.taskFolderId,
      limit: {
        maxFiles: MAX_TASK_ATTACHMENT_FILES,
        maxFileSizeBytes: MAX_TASK_ATTACHMENT_SIZE_BYTES,
      },
    };
  } catch (error) {
    throw toFriendlyDriveError(error);
  }
}

async function resolveTaskAttachment(
  drive: drive_v3.Drive,
  {
    userId,
    userName,
    userEmail,
    taskTitle,
    fileId,
  }: {
    userId: string;
    userName?: string | null;
    userEmail?: string | null;
    taskTitle: string;
    fileId: string;
  }
): Promise<TaskAttachmentLookupResult> {
  const folder = await resolveTaskFolder(
    drive,
    {
      userId,
      name: userName,
      email: userEmail,
    },
    taskTitle,
    false
  );

  if (!folder.taskFolderId || !folder.folderUrl) {
    throw new Error('This objective does not have an attachment folder yet.');
  }

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,webViewLink,webContentLink,iconLink,modifiedTime,parents',
      supportsAllDrives: true,
    });

    const parents = response.data.parents ?? [];

    if (!parents.includes(folder.taskFolderId)) {
      throw new Error('That file does not belong to this objective.');
    }

    return {
      file: mapDriveFile(response.data),
      taskFolderId: folder.taskFolderId,
      folderUrl: folder.folderUrl,
    };
  } catch (error) {
    throw toFriendlyDriveError(error);
  }
}

export async function getTaskAttachmentMetadata({
  userId,
  userName,
  userEmail,
  taskTitle,
  fileId,
}: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  taskTitle: string;
  fileId: string;
}) {
  const drive = await getDriveClient();
  const attachment = await resolveTaskAttachment(drive, {
    userId,
    userName,
    userEmail,
    taskTitle,
    fileId,
  });

  return {
    ...attachment,
    previewKind: inferTaskAttachmentPreviewKind(attachment.file.name, attachment.file.mimeType),
    printable: isTaskAttachmentPrintable(attachment.file.name, attachment.file.mimeType),
  };
}

export async function getTaskAttachmentContent({
  userId,
  userName,
  userEmail,
  taskTitle,
  fileId,
  range,
}: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  taskTitle: string;
  fileId: string;
  range?: string | null;
}): Promise<TaskAttachmentContentResult> {
  const drive = await getDriveClient();
  const attachment = await resolveTaskAttachment(drive, {
    userId,
    userName,
    userEmail,
    taskTitle,
    fileId,
  });

  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      {
        responseType: 'stream',
        headers: range ? { Range: range } : undefined,
      }
    );

    return {
      ...attachment,
      contentType: response.headers['content-type'] ?? attachment.file.mimeType ?? 'application/octet-stream',
      contentLength: response.headers['content-length'] ?? null,
      contentRange: response.headers['content-range'] ?? null,
      etag: response.headers.etag ?? null,
      lastModified: response.headers['last-modified'] ?? null,
      status: response.status ?? (range ? 206 : 200),
      stream: response.data as Readable,
    };
  } catch (error) {
    throw toFriendlyDriveError(error);
  }
}

export async function uploadFilesToTaskFolder({
  userId,
  userName,
  userEmail,
  taskTitle,
  files,
}: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  taskTitle: string;
  files: File[];
}) {
  const drive = await getDriveClient();
  const folder = await resolveTaskFolder(
    drive,
    {
      userId,
      name: userName,
      email: userEmail,
    },
    taskTitle,
    true
  );

  if (!folder.taskFolderId || !folder.folderUrl) {
    throw new Error('Unable to resolve the Google Drive task folder.');
  }

  const uploadedFiles: TaskAttachmentRecord[] = [];

  try {
    for (const file of files) {
      const mimeType = file.type || 'application/octet-stream';
      const response = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [folder.taskFolderId],
        },
        media: {
          mimeType,
          body: Readable.fromWeb(file.stream() as any),
        },
        fields: 'id,name,mimeType,size,webViewLink,webContentLink,iconLink,modifiedTime',
        supportsAllDrives: true,
      });

      uploadedFiles.push(mapDriveFile(response.data));
    }
  } catch (error) {
    throw toFriendlyDriveError(error);
  }

  return {
    files: uploadedFiles,
    folderUrl: folder.folderUrl,
    taskFolderId: folder.taskFolderId,
  };
}
