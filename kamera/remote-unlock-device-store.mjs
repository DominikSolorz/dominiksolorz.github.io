// Device keys are stored as nonextractable CryptoKey objects in this origin's IndexedDB.
// Never fall back to localStorage, plaintext JWK private keys or user-visible PIN storage.
const NAME='home-security-remote-devices-v1';
let opening;
function open(){
 if(!globalThis.indexedDB)return Promise.reject(new Error('Secure device storage is unavailable'));
 opening??=new Promise((resolve,reject)=>{
   const req=indexedDB.open(NAME,1);
   req.onupgradeneeded=()=>req.result.createObjectStore('identities');
   req.onerror=()=>reject(req.error);
   req.onsuccess=()=>resolve(req.result);
 });
 return opening;
}
export async function getDeviceState(key){
 const db=await open();
 return new Promise((resolve,reject)=>{
   const transaction=db.transaction('identities','readonly');
   const request=transaction.objectStore('identities').get(key);
   request.onsuccess=()=>resolve(request.result||null);
   request.onerror=()=>reject(request.error);
 });
}
export async function setDeviceState(key,value){
 const db=await open();
 return new Promise((resolve,reject)=>{
   const transaction=db.transaction('identities','readwrite');
   transaction.objectStore('identities').put(value,key);
   transaction.oncomplete=()=>resolve();
   transaction.onerror=()=>reject(transaction.error);
   transaction.onabort=()=>reject(transaction.error||new Error('Failed to store device identity'));
 });
}
export async function clearDeviceState(key){
 const db=await open();
 return new Promise((resolve,reject)=>{
   const transaction=db.transaction('identities','readwrite');
   transaction.objectStore('identities').delete(key);
   transaction.oncomplete=()=>resolve();
   transaction.onerror=()=>reject(transaction.error);
   transaction.onabort=()=>reject(transaction.error);
 });
}
