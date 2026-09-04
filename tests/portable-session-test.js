const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  collectPortableSession,
  findMissingMedia,
  resolvePortableSessionPaths
} = require('../portable-session');

async function run() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mimolume-portable-test-'));
  try {
    const sourceA = path.join(testRoot, 'source A');
    const sourceB = path.join(testRoot, 'source B');
    const destination = path.join(testRoot, 'portable show');
    await fs.mkdir(sourceA);
    await fs.mkdir(sourceB);
    await fs.mkdir(destination);

    const firstVideo = path.join(sourceA, 'scene #1.mp4');
    const secondVideo = path.join(sourceB, 'scene #1.mp4');
    await fs.writeFile(firstVideo, 'first-video');
    await fs.writeFile(secondVideo, 'second-video');

    const sessionData = {
      version: '1.13',
      sessionName: 'Metropolis Test Show',
      tabs: {
        videos: {
          0: {
            1: { name: 'scene #1.mp4', filePath: firstVideo },
            2: { name: 'scene #1.mp4', filePath: firstVideo },
            3: { name: 'scene #1.mp4', filePath: secondVideo }
          }
        },
        cuePoints: { 0: { 1: [{ id: 1, time: 1.25 }] } },
        accentPoints: { 0: { 1: { 1: { time: 0.8 } } } },
        scrubSettings: { 0: { 1: { enabled: true, mode: 'back-forward' } } },
        midiPermissions: { 0: { 1: { devices: { 'spd-20': { name: 'SPD-20', blocked: ['nextCuePoint'] } } } } }
      },
      midiMappings: { nextCuePoint: { type: 'noteon', channel: 1, note: 60 } }
    };

    const collected = await collectPortableSession(sessionData, destination);
    assert.equal(collected.files.length, 2, 'reused sources should only be copied once');
    assert.equal(collected.sessionData.version, '1.18');
    assert.equal(collected.sessionData.portableSession.mediaDirectory, 'Media');

    const firstPath = collected.sessionData.tabs.videos[0][1].filePath;
    const reusedPath = collected.sessionData.tabs.videos[0][2].filePath;
    const collisionPath = collected.sessionData.tabs.videos[0][3].filePath;
    assert.equal(firstPath, reusedPath, 'slots using the same source should share one collected file');
    assert.notEqual(firstPath.toLowerCase(), collisionPath.toLowerCase(), 'same-name sources must not overwrite each other');
    assert.match(firstPath, /^Media\//);
    assert.match(collisionPath, /^Media\//);
    assert.equal(collected.sessionData.tabs.cuePoints[0][1][0].time, 1.25);
    assert.equal(collected.sessionData.tabs.accentPoints[0][1][1].time, 0.8);
    assert.equal(collected.sessionData.tabs.scrubSettings[0][1].mode, 'back-forward');
    assert.deepEqual(collected.sessionData.tabs.midiPermissions[0][1].devices['spd-20'].blocked, ['nextCuePoint']);
    assert.equal(collected.sessionData.midiMappings.nextCuePoint.note, 60);

    const savedSession = JSON.parse(await fs.readFile(collected.sessionFilePath, 'utf8'));
    const movedDestination = path.join(testRoot, 'moved portable show');
    await fs.rename(destination, movedDestination);
    const movedSessionPath = path.join(movedDestination, path.basename(collected.sessionFilePath));
    const resolved = resolvePortableSessionPaths(savedSession, movedSessionPath);
    assert.equal((await findMissingMedia(resolved)).length, 0, 'portable media should resolve after moving the complete package');
    assert.ok(path.isAbsolute(resolved.tabs.videos[0][1].filePath));

    resolved.tabs.cuePoints[0][1][0].time = 2.5;
    const updated = await collectPortableSession(resolved, movedDestination);
    const updatedSession = JSON.parse(await fs.readFile(updated.sessionFilePath, 'utf8'));
    assert.equal(updatedSession.tabs.cuePoints[0][1][0].time, 2.5, 'collecting again should update the existing package');
    assert.equal(updated.files.length, 2, 'repeat collection should retain deduplication');
    assert.equal((await fs.readdir(path.join(movedDestination, 'Media'))).length, 2);

    const relocatedSessionPath = path.join(testRoot, 'session without media', path.basename(movedSessionPath));
    const relocated = resolvePortableSessionPaths(
      savedSession,
      relocatedSessionPath,
      path.join(movedDestination, 'Media')
    );
    assert.equal((await findMissingMedia(relocated)).length, 0, 'a manually located Media folder should reconnect every clip');

    const unsafeSession = structuredClone(savedSession);
    unsafeSession.tabs.videos[0][1].portableRelativePath = '../outside.mp4';
    assert.throws(
      () => resolvePortableSessionPaths(unsafeSession, movedSessionPath),
      /Invalid portable media path/
    );

    const nonEmptyDestination = path.join(testRoot, 'not empty');
    await fs.mkdir(nonEmptyDestination);
    await fs.writeFile(path.join(nonEmptyDestination, 'keep.txt'), 'do not overwrite');
    await assert.rejects(
      collectPortableSession(sessionData, nonEmptyDestination),
      /destination folder is not empty/
    );
    assert.equal(await fs.readFile(path.join(nonEmptyDestination, 'keep.txt'), 'utf8'), 'do not overwrite');

    await fs.writeFile(path.join(movedDestination, 'Media', 'personal-file.txt'), 'keep me');
    await assert.rejects(
      collectPortableSession(resolvePortableSessionPaths(updatedSession, updated.sessionFilePath), movedDestination),
      /files not managed by this portable session/
    );
    assert.equal(await fs.readFile(path.join(movedDestination, 'Media', 'personal-file.txt'), 'utf8'), 'keep me');

    console.log('Portable session test passed');
  } finally {
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
