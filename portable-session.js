const fs = require('fs').promises;
const path = require('path');

const PORTABLE_SESSION_VERSION = 1;
const MEDIA_DIRECTORY = 'Media';

function cloneSessionData(sessionData) {
  return JSON.parse(JSON.stringify(sessionData));
}

function getVideoEntries(sessionData) {
  const entries = [];
  const tabs = sessionData?.tabs?.videos || {};
  for (const [tabIndex, videos] of Object.entries(tabs)) {
    for (const [clipNumber, video] of Object.entries(videos || {})) {
      if (video) entries.push({ tabIndex, clipNumber, video });
    }
  }
  return entries;
}

function allocateFilename(originalName, usedNames) {
  const parsed = path.parse(originalName || 'video.mp4');
  const stem = parsed.name || 'video';
  const extension = parsed.ext || '';
  let candidate = `${stem}${extension}`;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem}-${suffix}${extension}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function buildCollectionPlan(sessionData) {
  const portableSession = cloneSessionData(sessionData);
  portableSession.version = '1.19';
  portableSession.portableSession = {
    version: PORTABLE_SESSION_VERSION,
    mediaDirectory: MEDIA_DIRECTORY
  };

  const sourceMap = new Map();
  const usedNames = new Set();
  const files = [];

  for (const { tabIndex, clipNumber, video } of getVideoEntries(portableSession)) {
    if (!video.filePath) {
      throw new Error(`Cannot collect unresolved video "${video.name || 'Unnamed video'}" in tab ${Number(tabIndex) + 1}, clip ${clipNumber}. Reconnect it before collecting the show.`);
    }
    if (!path.isAbsolute(video.filePath)) {
      throw new Error(`Cannot collect unresolved media path: ${video.filePath}`);
    }

    const sourcePath = path.resolve(video.filePath);
    const sourceKey = process.platform === 'win32' ? sourcePath.toLowerCase() : sourcePath;
    let planned = sourceMap.get(sourceKey);
    if (!planned) {
      const filename = allocateFilename(path.basename(sourcePath), usedNames);
      const relativePath = path.posix.join(MEDIA_DIRECTORY, filename);
      planned = { sourcePath, relativePath, filename };
      sourceMap.set(sourceKey, planned);
      files.push(planned);
    }

    video.filePath = planned.relativePath;
    video.portableRelativePath = planned.relativePath;
  }

  if (files.length === 0) {
    throw new Error('No video clips with readable file paths are loaded.');
  }

  return { portableSession, files };
}

function safeSessionFilename(sessionName) {
  const safeName = String(sessionName || 'metropolis-session')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim();
  return `${safeName || 'metropolis-session'}.json`;
}

function isIgnoredSystemFile(name) {
  return name === '.DS_Store' || name === 'Thumbs.db';
}

async function inspectDestination(destinationFolder, sessionFilename) {
  await fs.mkdir(destinationFolder, { recursive: true });
  const entries = (await fs.readdir(destinationFolder, { withFileTypes: true }))
    .filter(entry => !isIgnoredSystemFile(entry.name));
  if (entries.length === 0) return { existingPackage: false };

  const expectedNames = new Set([MEDIA_DIRECTORY.toLowerCase(), sessionFilename.toLowerCase()]);
  if (entries.length !== 2 || entries.some(entry => !expectedNames.has(entry.name.toLowerCase()))) {
    throw new Error('The destination folder is not empty and is not this portable show package. Choose another folder to avoid overwriting unrelated files.');
  }

  const mediaEntry = entries.find(entry => entry.name.toLowerCase() === MEDIA_DIRECTORY.toLowerCase());
  const sessionEntry = entries.find(entry => entry.name.toLowerCase() === sessionFilename.toLowerCase());
  if (!mediaEntry?.isDirectory() || !sessionEntry?.isFile()) {
    throw new Error('The destination does not contain a valid portable show package.');
  }

  const existingSessionPath = path.join(destinationFolder, sessionEntry.name);
  let existingSession;
  try {
    existingSession = JSON.parse(await fs.readFile(existingSessionPath, 'utf8'));
  } catch {
    throw new Error('The existing portable session file cannot be read safely.');
  }
  if (!existingSession.portableSession) {
    throw new Error('The existing session is not marked as a portable show package.');
  }

  const referencedMedia = new Set(
    getVideoEntries(existingSession)
      .map(({ video }) => video.portableRelativePath || video.filePath)
      .filter(Boolean)
      .map(relativePath => path.basename(String(relativePath)).toLowerCase())
  );
  const mediaEntries = (await fs.readdir(path.join(destinationFolder, mediaEntry.name), { withFileTypes: true }))
    .filter(entry => !isIgnoredSystemFile(entry.name));
  if (mediaEntries.some(entry => !entry.isFile() || !referencedMedia.has(entry.name.toLowerCase()))) {
    throw new Error('The Media folder contains files not managed by this portable session. They were left untouched.');
  }

  return {
    existingPackage: true,
    mediaPath: path.join(destinationFolder, mediaEntry.name),
    sessionPath: existingSessionPath
  };
}

async function collectPortableSession(sessionData, destinationFolder) {
  const { portableSession, files } = buildCollectionPlan(sessionData);
  const sessionFilename = safeSessionFilename(portableSession.sessionName);
  const destination = await inspectDestination(destinationFolder, sessionFilename);

  for (const file of files) {
    const stats = await fs.stat(file.sourcePath);
    if (!stats.isFile()) throw new Error(`Media source is not a file: ${file.sourcePath}`);
  }

  const stagingFolder = path.join(destinationFolder, `.mimolume-collect-${Date.now()}`);
  const stagingMediaFolder = path.join(stagingFolder, MEDIA_DIRECTORY);
  const stagingSessionPath = path.join(stagingFolder, sessionFilename);
  const finalMediaFolder = path.join(destinationFolder, MEDIA_DIRECTORY);
  const finalSessionPath = path.join(destinationFolder, sessionFilename);
  const backupFolder = path.join(destinationFolder, `.mimolume-backup-${Date.now()}`);
  const backupMediaFolder = path.join(backupFolder, MEDIA_DIRECTORY);
  const backupSessionPath = path.join(backupFolder, sessionFilename);
  let oldMediaBackedUp = false;
  let oldSessionBackedUp = false;
  let mediaPromoted = false;
  let sessionPromoted = false;

  try {
    await fs.mkdir(stagingMediaFolder, { recursive: true });
    for (const file of files) {
      await fs.copyFile(file.sourcePath, path.join(stagingMediaFolder, file.filename));
    }
    await fs.writeFile(stagingSessionPath, JSON.stringify(portableSession, null, 2));

    if (destination.existingPackage) {
      await fs.mkdir(backupFolder);
      await fs.rename(destination.mediaPath, backupMediaFolder);
      oldMediaBackedUp = true;
      await fs.rename(destination.sessionPath, backupSessionPath);
      oldSessionBackedUp = true;
    }

    await fs.rename(stagingMediaFolder, finalMediaFolder);
    mediaPromoted = true;
    await fs.rename(stagingSessionPath, finalSessionPath);
    sessionPromoted = true;
    await fs.rm(stagingFolder, { recursive: true, force: true });
    if (destination.existingPackage) await fs.rm(backupFolder, { recursive: true, force: true });
  } catch (error) {
    await fs.rm(stagingFolder, { recursive: true, force: true });
    if (sessionPromoted) await fs.rm(finalSessionPath, { force: true });
    if (mediaPromoted) await fs.rm(finalMediaFolder, { recursive: true, force: true });
    if (oldSessionBackedUp) await fs.rename(backupSessionPath, destination.sessionPath);
    if (oldMediaBackedUp) await fs.rename(backupMediaFolder, destination.mediaPath);
    await fs.rm(backupFolder, { recursive: true, force: true });
    throw error;
  }

  return {
    sessionData: portableSession,
    sessionFilePath: finalSessionPath,
    files: files.map(file => ({
      ...file,
      collectedPath: path.join(destinationFolder, ...file.relativePath.split('/'))
    }))
  };
}

function resolvePortableSessionPaths(sessionData, sessionFilePath, selectedMediaFolder = null) {
  const resolvedSession = cloneSessionData(sessionData);
  if (!resolvedSession.portableSession) return resolvedSession;

  const sessionFolder = path.dirname(sessionFilePath);
  for (const { video } of getVideoEntries(resolvedSession)) {
    const relativePath = video.portableRelativePath || video.filePath;
    if (!relativePath || path.isAbsolute(relativePath)) continue;

    const relativeParts = String(relativePath).split(/[\\/]+/).filter(Boolean);
    if (relativeParts.length < 2 || relativeParts.some(part => part === '..' || part === '.')) {
      throw new Error(`Invalid portable media path: ${relativePath}`);
    }
    const resolvedPath = selectedMediaFolder
      ? path.join(selectedMediaFolder, ...relativeParts.slice(1))
      : path.resolve(sessionFolder, ...relativeParts);

    if (!selectedMediaFolder) {
      const relativeCheck = path.relative(sessionFolder, resolvedPath);
      if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) {
        throw new Error(`Portable media path escapes its session folder: ${relativePath}`);
      }
    }

    video.portableRelativePath = relativePath.replace(/\\/g, '/');
    video.filePath = resolvedPath;
  }
  return resolvedSession;
}

async function findMissingMedia(sessionData) {
  const missing = [];
  for (const { tabIndex, clipNumber, video } of getVideoEntries(sessionData)) {
    if (!video.filePath) continue;
    try {
      await fs.access(video.filePath);
    } catch {
      missing.push({ tabIndex, clipNumber, name: video.name, filePath: video.filePath });
    }
  }
  return missing;
}

module.exports = {
  MEDIA_DIRECTORY,
  buildCollectionPlan,
  collectPortableSession,
  findMissingMedia,
  resolvePortableSessionPaths,
  safeSessionFilename
};
