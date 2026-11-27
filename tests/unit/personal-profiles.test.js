import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceKey } from '../../src/security/crypto.js';
import { PersonalProfileStore, mapProfileFields } from '../../src/library/personal-profiles.js';

class MemoryRepository {
  data=new Map();
  async getAll(){return [...this.data.values()];}
  async get(_store,id){return this.data.get(id)??null;}
  async put(_store,record){this.data.set(record.id,structuredClone(record));}
  async delete(_store,id){this.data.delete(id);}
  async clear(){this.data.clear();}
}

test('personal profiles are encrypted at rest and can be read through the store',async()=>{
  const repo=new MemoryRepository(), key=await createDeviceKey();
  const store=new PersonalProfileStore(repo,async()=>key);
  const saved=await store.save({name:'Primary',fields:{fullName:'Ada Lovelace',mobile:'1234567890'}});
  const raw=repo.data.get(saved.id);
  assert.equal(JSON.stringify(raw).includes('Ada Lovelace'),false);
  assert.equal((await store.get(saved.id)).fields.fullName,'Ada Lovelace');
});

test('personal profiles are limited to five and reject unnamed profiles',async()=>{
  const repo=new MemoryRepository(),key=await createDeviceKey(),store=new PersonalProfileStore(repo,async()=>key);
  await assert.rejects(store.save({fields:{}}),/name/i);
  for(let i=0;i<5;i++) await store.save({name:`Profile ${i}`});
  await assert.rejects(store.save({name:'Sixth'}),/up to 5/i);
});

test('personal profiles can be re-encrypted under a replacement device key',async()=>{
  const repo=new MemoryRepository();
  let key=await createDeviceKey();
  const store=new PersonalProfileStore(repo,async()=>key);
  await store.save({name:'Profile',fields:{fullName:'Ada'}});
  const plain=await store.exportForRekey();
  key=await createDeviceKey();
  await store.importAfterRekey(plain);
  assert.equal((await store.list())[0].fields.fullName,'Ada');
});


test('personal profile maps only recognized text field names and does not overwrite non-text fields',()=>{
  const mapped=mapProfileFields({fields:{fullName:'Ada',mobile:'123',email:'ada@example.test'}},[
    {name:'ApplicantFullName',kind:'text',supported:true},
    {name:'Mobile_Number',kind:'text',supported:true},
    {name:'EmailAddress',kind:'text',supported:true},
    {name:'AcceptTerms',kind:'checkbox',supported:true},
    {name:'UnknownField',kind:'text',supported:true}
  ]);
  assert.deepEqual(mapped,{ApplicantFullName:'Ada',Mobile_Number:'123',EmailAddress:'ada@example.test'});
});
