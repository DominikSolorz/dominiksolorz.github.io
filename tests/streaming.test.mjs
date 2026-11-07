import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createReconnectingChannel} from '../kamera/core/reconnecting-channel.mjs';

function setup(overrides={}) {
  const channels=[];
  const removed=[];
  const errors=[];
  const retries=[];
  const timers=[];
  const client={
    channel(name,options) {
      const channel={
        name,options,handlers:{},
        on(type,config,callback){this.handlers[config.event]=callback;return this;},
        subscribe(callback){this.status=callback;return this;},
      };
      channels.push(channel);
      return channel;
    },
    removeChannel:async channel=>{removed.push(channel);return 'ok';},
    ...overrides.client,
  };
  const manager=createReconnectingChannel({
    client,name:'cam-test',onSignal:async value=>{retries.push(['signal',value]);},
    onSubscribed:channel=>{retries.push(['subscribed',channel]);},
    onRetry:(delay,status)=>retries.push(['retry',delay,status]),
    onError:error=>errors.push(error),
    schedule:(callback,delay)=>{
      const timer={delay,cancelled:false,fired:false};
      timer.callback=()=>{timer.fired=true;callback();};
      timers.push(timer);
      return timer;
    },
    cancel:timer=>{timer.cancelled=true;},
    ...overrides.options,
  });
  return {manager,channels,removed,errors,retries,timers};
}

const activeTimers=timers=>timers.filter(timer=>!timer.cancelled&&!timer.fired);

test('signaling retries use capped exponential backoff and only one timer per channel failure',()=>{
  const x=setup();
  x.manager.start();
  assert.equal(x.channels.length,1);
  assert.deepEqual(x.channels[0].options,{config:{broadcast:{self:false}}});
  const delays=[];
  for(let attempt=0;attempt<7;attempt++){
    const channel=x.channels.at(-1);
    channel.status('CHANNEL_ERROR');
    channel.status('TIMED_OUT');
    const [timer]=activeTimers(x.timers);
    delays.push(timer.delay);
    timer.callback();
  }
  assert.deepEqual(delays,[2000,4000,8000,16000,30000,30000,30000]);
  assert.equal(x.channels.length,8);
});

test('successful subscription resets backoff and manual reconnect cancels the pending retry',()=>{
  const x=setup();
  x.manager.start();
  const first=x.channels[0];
  first.status('CHANNEL_ERROR');
  const pending=activeTimers(x.timers)[0];
  assert.equal(pending.delay,2000);
  x.manager.reconnect();
  assert.equal(pending.cancelled,true);
  assert.deepEqual(x.removed,[first]);
  const second=x.channels[1];
  second.status('SUBSCRIBED');
  second.status('CLOSED');
  assert.equal(activeTimers(x.timers)[0].delay,2000);
});

test('stale channel status and signal events are ignored after reconnect or stop',async()=>{
  const x=setup();
  x.manager.start();
  const first=x.channels[0];
  x.manager.reconnect();
  const current=x.channels[1];
  first.status('SUBSCRIBED');
  first.handlers.signal({payload:'stale'});
  current.status('SUBSCRIBED');
  current.handlers.signal({payload:'current'});
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(x.retries.filter(([type])=>type==='subscribed'),[['subscribed',current]]);
  assert.deepEqual(x.retries.filter(([type])=>type==='signal'),[['signal','current']]);
  x.manager.stop();
  current.handlers.signal({payload:'after stop'});
  await Promise.resolve();
  assert.deepEqual(x.retries.filter(([type])=>type==='signal'),[['signal','current']]);
  assert.deepEqual(x.removed,[first,current]);
});

test('stop cancels the retry timer and removes the active channel',()=>{
  const x=setup();
  x.manager.start();
  const channel=x.channels[0];
  channel.status('CHANNEL_ERROR');
  const pending=activeTimers(x.timers)[0];
  x.manager.stop();
  assert.equal(pending.cancelled,true);
  assert.equal(x.manager.channel,null);
  assert.deepEqual(x.removed,[channel]);
  pending.callback();
  assert.equal(x.channels.length,1);
});

test('synchronous and asynchronous signal callback failures are reported without breaking the channel',async()=>{
  const failures=[];
  let invocation=0;
  const x=setup({options:{
    onSignal:()=>{invocation++;if(invocation===1)throw Error('sync failure');return Promise.reject(Error('async failure'));},
    onError:error=>failures.push(error.message),
  }});
  x.manager.start();
  const channel=x.channels[0];
  channel.handlers.signal({payload:1});
  channel.handlers.signal({payload:2});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(failures.length,2);
  assert.equal(failures[0],'sync failure');
  assert.equal(failures[1],'async failure');
  assert.equal(x.manager.channel,channel);
});

test('the production panel and PWA shell load the tested reconnect module',async()=>{
  const [app,worker]=await Promise.all([
    readFile(new URL('../kamera/app.js',import.meta.url),'utf8'),
    readFile(new URL('../kamera/sw.js',import.meta.url),'utf8'),
  ]);
  assert.ok(app.includes('./core/reconnecting-channel.mjs?v=1'));
  assert.ok(worker.includes('./core/reconnecting-channel.mjs?v=1'));
});
