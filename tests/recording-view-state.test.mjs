import test from 'node:test';
import assert from 'node:assert/strict';
import {localRecordingView,archiveEmptyText} from '../kamera/recording-view-state.mjs';
test('unconfirmed destination never claims successful folder recording',()=>{
 const v=localRecordingView({recording:true,folder:'',saved:0,queued:56,verifiedToDrive:0,reason:'Folder czeka na ponowną zgodę Chrome. Przywróć dostęp.'});
 assert.match(v.text,/nie jest potwierdzony/);assert.doesNotMatch(v.text,/Drive|56/);assert.match(v.details,/Przywróć/);
});
test('folder permission loss remains a warning even when a name is cached',()=>{assert.match(localRecordingView({recording:true,folder:'nagrania',reason:'Folder czeka na ponowną zgodę'}).text,/Wymagane potwierdzenie/);});
test('local save error and missing telemetry never claim healthy capture',()=>{assert.match(localRecordingView(null).text,/Brak aktualnego/);assert.match(localRecordingView({folder:'nagrania'},{saveError:true}).text,/Błąd zapisu/);});
test('local confirmed folder state is independent from historical cloud counters',()=>{const v=localRecordingView({folder:'nagrania',recording:true,saved:3,queued:56,verifiedToDrive:0});assert.match(v.text,/Zapisane pliki: 3/);assert.doesNotMatch(v.text,/Drive|56/);});
test('archive read failure or disconnected host cannot be presented as empty archive',()=>{for(const state of [{connected:false},{connected:true,localFailed:true},{connected:true,driveFailed:true}])assert.doesNotMatch(archiveEmptyText(state),/^Brak.*nagrań/);});
test('open segment and empty closed-file list are different states',()=>{assert.match(archiveEmptyText({connected:true,hasOpenSegment:true}),/jeszcze się nagrywa/);assert.match(archiveEmptyText({connected:true}),/Brak zamkniętych/);});
