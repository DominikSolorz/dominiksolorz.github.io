import test from 'node:test';
import assert from 'node:assert/strict';
import {requireFolderHost,hasLocalSaveError} from '../kamera/communication/folder-readiness.mjs';
test('old live host is rejected with its real version, not sent an unsupported command',()=>assert.throws(()=>requireFolderHost({version:'177',receivedAt:1000},2000),/177.*192/));
test('current fresh host can receive folder commands',()=>assert.doesNotThrow(()=>requireFolderHost({version:'192',receivedAt:1000},2000)));
test('stale or unknown host version does not claim readiness',()=>{assert.throws(()=>requireFolderHost({version:'190',receivedAt:1000},50000));assert.throws(()=>requireFolderHost({version:'',receivedAt:1000},2000));});
test('InvalidBlob is a local-save failure, cloud outage is separate',()=>{assert.equal(hasLocalSaveError({reason:'Nie udało się zapisać kamera.mp4: Failed to write blobs (InvalidBlob)'}),true);assert.equal(hasLocalSaveError({reason:'Nie udało się wysłać na Google Drive'}),false);});
